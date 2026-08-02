import type { RLAction, Severity } from "@/types";
import type {
  AttackConfig,
  AttackEvent,
  AttackKind,
  AttackRunState,
  PacketEvent,
  PolicyEvent,
  QueuedAttack,
  SimEventBase,
  SimStageId,
  SimStageState,
  SimStageStatus,
  SimulationEvent,
  SimulationMetrics,
  SimulationPacket,
  SimulationSnapshot,
  SimulationSpeed,
  SimulationStatus,
  StageEvent,
  ThreatEvent,
  TimelineEvent,
} from "@/types/simulation";
import { id, internalIP, pick, randomBetween, randomFloat, PROTOCOLS } from "./mock/utils";
import {
  INTENSITY_MULTIPLIER,
  PIPELINE_STAGES,
  getAttackDefinition,
} from "./mock/attack-catalog";

/**
 * Centralized simulation engine — the single source of truth for every widget.
 *
 * Widgets NEVER generate their own random data: they subscribe to this engine
 * (through the Phase 2 services) and render the published snapshot. When the
 * FastAPI backend lands, `SimulationEngine` is replaced by a websocket client
 * that pushes the exact same `SimulationSnapshot` shape.
 */

const TICK_MS = 500;
const MAX_EVENTS = 300;
const MAX_PACKETS = 60;
/** Ticks a packet spends inside one stage before it advances. */
const STAGE_DWELL_TICKS = 1;

const STAGE_ORDER: SimStageId[] = PIPELINE_STAGES.map((s) => s.id);

const emptyMetrics = (): SimulationMetrics => ({
  packetsGenerated: 0,
  packetsInspected: 0,
  packetsBlocked: 0,
  packetsAllowed: 0,
  threatsDetected: 0,
  policyUpdates: 0,
  avgConfidence: 0,
  elapsedSec: 0,
});

const freshStages = (): SimStageState[] =>
  PIPELINE_STAGES.map((s) => ({
    ...s,
    status: "idle" as SimStageStatus,
    latencyMs: 0,
    confidence: 0,
    packetCount: 0,
    blockedCount: 0,
  }));

export type SimulationListener = (snapshot: SimulationSnapshot) => void;

class SimulationEngine {
  private status: SimulationStatus = "idle";
  private speed: SimulationSpeed = 1;
  private tick = 0;
  private startedAt: string | null = null;
  private queue: QueuedAttack[] = [];
  private stages: SimStageState[] = freshStages();
  private packets: SimulationPacket[] = [];
  private events: SimulationEvent[] = [];
  private metrics: SimulationMetrics = emptyMetrics();
  private confidenceSum = 0;
  private confidenceCount = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<SimulationListener>();
  private packetDwell = new Map<string, number>();
  private lastConfig: AttackConfig | null = null;
  private lastQueueSpec: Array<{ kind: AttackKind; config: AttackConfig }> = [];

  /* ---------------------------------------------------------------- */
  /* Subscription                                                      */
  /* ---------------------------------------------------------------- */

  subscribe(listener: SimulationListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): SimulationSnapshot {
    return {
      status: this.status,
      speed: this.speed,
      tick: this.tick,
      startedAt: this.startedAt,
      queue: this.queue.map((a) => ({ ...a, config: { ...a.config } })),
      activeAttackId: this.queue.find((a) => a.state === "running")?.id ?? null,
      stages: this.stages.map((s) => ({ ...s })),
      packets: this.packets.map((p) => ({ ...p })),
      events: this.events.slice(0, MAX_EVENTS),
      metrics: { ...this.metrics },
    };
  }

  private emit() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((l) => l(snapshot));
  }

  /* ---------------------------------------------------------------- */
  /* Queue management                                                  */
  /* ---------------------------------------------------------------- */

  enqueue(kind: AttackKind, config: AttackConfig): QueuedAttack {
    const def = getAttackDefinition(kind);
    const attack: QueuedAttack = {
      id: id("ATK"),
      kind,
      name: def.name,
      mitreTactic: def.mitreTactic,
      mitreTechniqueId: def.mitreTechniqueId,
      severity: def.severity,
      config: { ...config },
      state: "queued",
      progress: 0,
      sourceIp: config.stealthMode ? internalIP() : `185.${randomBetween(10, 240)}.${randomBetween(0, 255)}.${randomBetween(2, 254)}`,
      packetsSent: 0,
      packetsBlocked: 0,
      createdAt: new Date().toISOString(),
      confidence: 0,
    };
    this.lastConfig = { ...config };
    this.queue = [...this.queue, attack];
    this.pushEvent(this.attackEvent(attack, "queued", `${attack.name} queued`, `Target ${config.target} · ${config.intensity} intensity · ${config.packetRate} pkt/s`));
    this.emit();
    return attack;
  }

  duplicate(attackId: string): QueuedAttack | null {
    const source = this.queue.find((a) => a.id === attackId);
    if (!source) return null;
    return this.enqueue(source.kind, { ...source.config });
  }

  removeFromQueue(attackId: string) {
    this.queue = this.queue.filter((a) => a.id !== attackId);
    this.packets = this.packets.filter((p) => p.attackId !== attackId);
    this.emit();
  }

  clearQueue() {
    this.queue = [];
    this.packets = [];
    this.packetDwell.clear();
    this.pushEvent(this.timelineEvent("Queue cleared", "All pending attack operations removed", "low"));
    this.emit();
  }

  /* ---------------------------------------------------------------- */
  /* Transport controls                                                */
  /* ---------------------------------------------------------------- */

  start() {
    if (this.status === "running") return;
    if (this.status === "paused") return this.resume();

    if (!this.queue.some((a) => a.state === "queued")) return;

    this.status = "running";
    this.startedAt = new Date().toISOString();
    this.lastQueueSpec = this.queue.map((a) => ({ kind: a.kind, config: { ...a.config } }));
    this.pushEvent(this.timelineEvent("Simulation started", `${this.queue.length} operation(s) scheduled`, "medium"));
    this.startTimer();
    this.emit();
  }

  pause() {
    if (this.status !== "running") return;
    this.status = "paused";
    this.queue = this.queue.map((a) => (a.state === "running" ? { ...a, state: "paused" } : a));
    this.stopTimer();
    this.pushEvent(this.timelineEvent("Simulation paused", "Packet generation suspended", "low"));
    this.emit();
  }

  resume() {
    if (this.status !== "paused") return;
    this.status = "running";
    this.queue = this.queue.map((a) => (a.state === "paused" ? { ...a, state: "running" } : a));
    this.startTimer();
    this.pushEvent(this.timelineEvent("Simulation resumed", "Packet generation restored", "low"));
    this.emit();
  }

  cancel() {
    if (this.status === "idle") return;
    this.status = "cancelled";
    this.stopTimer();
    this.queue = this.queue.map((a) =>
      a.state === "running" || a.state === "paused" || a.state === "queued"
        ? { ...a, state: "cancelled", finishedAt: new Date().toISOString() }
        : a,
    );
    this.packets = [];
    this.packetDwell.clear();
    this.stages = this.stages.map((s) => ({ ...s, status: "idle" }));
    this.pushEvent(this.timelineEvent("Simulation cancelled", "Operator aborted the run", "high"));
    this.emit();
  }

  /** Re-queues the exact same operations and runs them again. */
  replay() {
    const spec = this.lastQueueSpec.length
      ? this.lastQueueSpec
      : this.queue.map((a) => ({ kind: a.kind, config: { ...a.config } }));
    if (!spec.length) return;
    this.reset();
    spec.forEach((s) => this.enqueue(s.kind, s.config));
    this.lastQueueSpec = spec.map((s) => ({ kind: s.kind, config: { ...s.config } }));
    this.pushEvent(this.timelineEvent("Replay armed", `${spec.length} operation(s) restored from last run`, "low"));
    this.start();
  }

  /** Replays a single completed/cancelled attack. */
  replayAttack(attackId: string) {
    const source = this.queue.find((a) => a.id === attackId);
    if (!source) return;
    this.enqueue(source.kind, { ...source.config });
    if (this.status !== "running") this.start();
  }

  pauseAttack(attackId: string) {
    this.queue = this.queue.map((a) =>
      a.id === attackId && a.state === "running" ? { ...a, state: "paused" } : a,
    );
    this.emit();
  }

  resumeAttack(attackId: string) {
    this.queue = this.queue.map((a) =>
      a.id === attackId && a.state === "paused" ? { ...a, state: "running" } : a,
    );
    if (this.status !== "running") this.start();
    this.emit();
  }

  cancelAttack(attackId: string) {
    const target = this.queue.find((a) => a.id === attackId);
    if (!target) return;
    this.queue = this.queue.map((a) =>
      a.id === attackId ? { ...a, state: "cancelled", finishedAt: new Date().toISOString() } : a,
    );
    this.packets = this.packets.filter((p) => p.attackId !== attackId);
    this.pushEvent(this.attackEvent(target, "cancelled", `${target.name} cancelled`, "Operation aborted by operator"));
    this.emit();
  }

  reset() {
    this.stopTimer();
    this.status = "idle";
    this.tick = 0;
    this.startedAt = null;
    this.queue = [];
    this.stages = freshStages();
    this.packets = [];
    this.events = [];
    this.metrics = emptyMetrics();
    this.confidenceSum = 0;
    this.confidenceCount = 0;
    this.packetDwell.clear();
    this.emit();
  }

  setSpeed(speed: SimulationSpeed) {
    this.speed = speed;
    if (this.status === "running") this.startTimer();
    this.emit();
  }

  getLastConfig(): AttackConfig | null {
    return this.lastConfig ? { ...this.lastConfig } : null;
  }

  /* ---------------------------------------------------------------- */
  /* Loop                                                              */
  /* ---------------------------------------------------------------- */

  private startTimer() {
    this.stopTimer();
    if (typeof window === "undefined") return;
    this.timer = setInterval(() => this.step(), TICK_MS / this.speed);
  }

  private stopTimer() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private step() {
    this.tick += 1;
    this.metrics.elapsedSec = Number(((this.tick * TICK_MS) / 1000).toFixed(1));

    // Promote the next queued attack when nothing is running.
    if (!this.queue.some((a) => a.state === "running")) {
      const next = this.queue.find((a) => a.state === "queued");
      if (next) {
        this.updateAttack(next.id, {
          state: "running",
          startedAt: new Date().toISOString(),
        });
        const started = this.queue.find((a) => a.id === next.id)!;
        this.pushEvent(this.attackEvent(started, "running", `Attack started — ${started.name}`, `${started.sourceIp} → ${started.config.target}`));
        this.pushEvent(
          this.threatEventFor(started, `Threat surfaced — ${started.mitreTechniqueId}`, `${started.mitreTactic} technique observed at perimeter`),
        );
      }
    }

    this.advancePackets();
    this.generatePackets();
    this.decayStages();

    // Complete finished attacks and settle the run.
    const running = this.queue.find((a) => a.state === "running");
    if (running && running.progress >= 100) {
      const inFlight = this.packets.some((p) => p.attackId === running.id);
      if (!inFlight) this.settleAttack(running.id);
    }

    if (
      this.status === "running" &&
      !this.queue.some((a) => a.state === "running" || a.state === "queued" || a.state === "paused") &&
      this.packets.length === 0
    ) {
      this.status = "completed";
      this.stopTimer();
      this.stages = this.stages.map((s) => ({ ...s, status: "idle" }));
      this.pushEvent(this.timelineEvent("Simulation completed", `${this.metrics.packetsInspected} packets inspected · ${this.metrics.packetsBlocked} blocked`, "medium"));
    }

    this.emit();
  }

  /* ---------------------------------------------------------------- */
  /* Packet lifecycle                                                  */
  /* ---------------------------------------------------------------- */

  private generatePackets() {
    const active = this.queue.find((a) => a.state === "running");
    if (!active) return;

    const mult = INTENSITY_MULTIPLIER[active.config.intensity] ?? 1;
    const spawn = Math.max(1, Math.min(4, Math.round((active.config.packetRate * mult) / 400)));
    const ratePerTick = (active.config.packetRate * mult * TICK_MS) / 1000;

    for (let i = 0; i < spawn; i += 1) {
      const packet: SimulationPacket = {
        id: id("PKT"),
        attackId: active.id,
        kind: active.kind,
        severity: active.severity,
        stage: "attacker",
        sourceIp: active.sourceIp,
        targetIp: active.config.target,
        protocol: pick(PROTOCOLS),
        bytes: randomBetween(64, 1480),
        malicious: true,
        blocked: false,
        confidence: 0,
        createdAt: Date.now(),
      };
      this.packets = [packet, ...this.packets].slice(0, MAX_PACKETS);
      this.packetDwell.set(packet.id, 0);
      this.touchStage("attacker", "processing", randomFloat(0.2, 0.9), 0);
    }

    this.metrics.packetsGenerated += Math.round(ratePerTick);

    const durationTicks = Math.max(1, (active.config.durationSec * 1000) / TICK_MS);
    const progress = Math.min(100, active.progress + 100 / durationTicks);
    this.updateAttack(active.id, {
      progress,
      packetsSent: active.packetsSent + Math.round(ratePerTick),
    });

    if (this.tick % 6 === 0) {
      this.pushEvent(
        this.packetEventFor(active, this.packets[0]!, "Packet generated", `${spawn} synthetic ${active.kind} packet(s) injected at ${Math.round(active.config.packetRate * mult)} pkt/s`),
      );
    }
  }

  private advancePackets() {
    const next: SimulationPacket[] = [];

    for (const packet of this.packets) {
      const dwell = (this.packetDwell.get(packet.id) ?? 0) + 1;
      if (dwell < STAGE_DWELL_TICKS) {
        this.packetDwell.set(packet.id, dwell);
        next.push(packet);
        continue;
      }
      this.packetDwell.set(packet.id, 0);

      const idx = STAGE_ORDER.indexOf(packet.stage);
      const targetStage = STAGE_ORDER[idx + 1];
      if (!targetStage) {
        this.packetDwell.delete(packet.id);
        continue; // reached production server, retire
      }

      const moved = this.processStage({ ...packet, stage: targetStage });
      if (moved) next.push(moved);
      else this.packetDwell.delete(packet.id);
    }

    this.packets = next;
  }

  /** Runs one pipeline stage for a packet. Returns null when the packet is dropped. */
  private processStage(packet: SimulationPacket): SimulationPacket | null {
    const attack = this.queue.find((a) => a.id === packet.attackId);
    const stealth = attack?.config.stealthMode ?? false;
    const latency = randomFloat(0.4, 4.5);

    switch (packet.stage) {
      case "packetgen": {
        this.touchStage("packetgen", "processing", randomFloat(0.3, 0.6), latency);
        return packet;
      }
      case "tier0": {
        const signatureHit = !stealth && packet.kind !== "zero-day" && Math.random() < 0.35;
        this.metrics.packetsInspected += 1;
        if (signatureHit) {
          this.touchStage("tier0", "blocked", 0.98, latency, true);
          this.metrics.packetsBlocked += 1;
          if (attack) {
            this.updateAttack(attack.id, { packetsBlocked: attack.packetsBlocked + 1 });
            if (this.tick % 4 === 0) {
              this.pushEvent(this.timelineEventFor(attack, "Tier-0 adaptive rule matched", `Signature drop on ${packet.protocol} from ${packet.sourceIp}`, "tier0"));
            }
          }
          return null;
        }
        this.touchStage("tier0", "escalating", randomFloat(0.4, 0.7), latency);
        return { ...packet, confidence: randomFloat(0.25, 0.55) };
      }
      case "tier1": {
        const anomaly = stealth ? randomFloat(0.35, 0.7) : randomFloat(0.55, 0.95);
        this.touchStage("tier1", anomaly > 0.6 ? "escalating" : "clear", anomaly, latency);
        if (anomaly > 0.6 && this.tick % 5 === 0 && attack) {
          this.pushEvent(this.timelineEventFor(attack, "Isolation Forest triggered", `Anomaly score ${anomaly.toFixed(2)} exceeds contamination threshold`, "tier1"));
        }
        return { ...packet, confidence: anomaly };
      }
      case "tier2": {
        const conf = Math.min(0.99, packet.confidence + randomFloat(0.05, 0.25));
        this.touchStage("tier2", conf > 0.75 ? "escalating" : "clear", conf, latency);
        this.confidenceSum += conf;
        this.confidenceCount += 1;
        this.metrics.avgConfidence = Number((this.confidenceSum / this.confidenceCount).toFixed(3));
        if (attack) this.updateAttack(attack.id, { confidence: conf });
        if (this.tick % 5 === 0 && attack) {
          this.pushEvent(this.timelineEventFor(attack, "Tier-2 classification", `XGBoost labelled traffic as ${attack.name} (${(conf * 100).toFixed(0)}% confidence)`, "tier2"));
        }
        return { ...packet, confidence: conf };
      }
      case "mitre": {
        this.touchStage("mitre", "processing", packet.confidence, latency);
        if (attack && this.tick % 6 === 0) {
          this.metrics.threatsDetected += 1;
          this.pushEvent(this.threatEventFor(attack, "MITRE ATT&CK mapping", `${attack.mitreTechniqueId} · ${attack.mitreTactic}`));
        }
        return packet;
      }
      case "rl": {
        const action = this.decide(packet.confidence);
        this.touchStage("rl", action === "allow" ? "clear" : "escalating", packet.confidence, latency);
        if (attack && this.tick % 5 === 0) {
          this.pushEvent(this.timelineEventFor(attack, "RL decision", `Policy agent selected "${action}" (expected reward ${randomFloat(0.4, 0.98).toFixed(2)})`, "rl"));
        }
        if (attack) this.updateAttack(attack.id, { verdict: action });
        return { ...packet, blocked: action !== "allow" };
      }
      case "peo": {
        if (packet.blocked) {
          this.touchStage("peo", "blocked", packet.confidence, latency, true);
          this.metrics.packetsBlocked += 1;
          this.metrics.policyUpdates += 1;
          if (attack) {
            this.updateAttack(attack.id, { packetsBlocked: attack.packetsBlocked + 1 });
            if (this.tick % 5 === 0) {
              this.pushEvent(this.policyEventFor(attack, packet.confidence));
            }
          }
          return null;
        }
        this.touchStage("peo", "clear", packet.confidence, latency);
        return packet;
      }
      case "server": {
        this.touchStage("server", "clear", packet.confidence, latency);
        this.metrics.packetsAllowed += 1;
        return packet;
      }
      default:
        return packet;
    }
  }

  private decide(confidence: number): RLAction {
    if (confidence > 0.85) return "block";
    if (confidence > 0.7) return "quarantine";
    if (confidence > 0.55) return "redirect";
    return "allow";
  }

  private settleAttack(attackId: string) {
    const attack = this.queue.find((a) => a.id === attackId);
    if (!attack) return;

    const blockRatio = attack.packetsSent > 0 ? attack.packetsBlocked / attack.packetsSent : 0;
    const state: AttackRunState =
      blockRatio > 0.4 ? "blocked" : attack.confidence > 0.5 ? "completed" : "unknown";

    this.updateAttack(attackId, {
      state,
      progress: 100,
      finishedAt: new Date().toISOString(),
    });

    const settled = this.queue.find((a) => a.id === attackId)!;
    this.pushEvent(
      this.attackEvent(
        settled,
        state,
        `${settled.name} → ${state.toUpperCase()}`,
        `${settled.packetsBlocked.toLocaleString()} of ${settled.packetsSent.toLocaleString()} packets contained`,
      ),
    );
    if (state === "blocked") {
      this.pushEvent(this.timelineEventFor(settled, "Firewall updated", "Tier-0 ruleset synchronized with new RL policy", "peo"));
    }
  }

  /* ---------------------------------------------------------------- */
  /* Helpers                                                           */
  /* ---------------------------------------------------------------- */

  private updateAttack(attackId: string, patch: Partial<QueuedAttack>) {
    this.queue = this.queue.map((a) => (a.id === attackId ? { ...a, ...patch } : a));
  }

  private touchStage(
    stageId: SimStageId,
    status: SimStageStatus,
    confidence: number,
    latencyMs: number,
    blocked = false,
  ) {
    this.stages = this.stages.map((s) =>
      s.id === stageId
        ? {
            ...s,
            status,
            confidence: Number(confidence.toFixed(2)),
            latencyMs: Number(latencyMs.toFixed(2)),
            packetCount: s.packetCount + 1,
            blockedCount: s.blockedCount + (blocked ? 1 : 0),
          }
        : s,
    );
  }

  /** Stages fade back to idle when no packet has touched them recently. */
  private decayStages() {
    const busy = new Set(this.packets.map((p) => p.stage));
    this.stages = this.stages.map((s) =>
      busy.has(s.id) || s.status === "idle" ? s : { ...s, status: busy.size ? s.status : "idle" },
    );
  }

  private base(title: string, description: string, severity: Severity): SimEventBase {
    return {
      id: id("EVT"),
      type: "timeline",
      timestamp: new Date().toISOString(),
      tick: this.tick,
      title,
      description,
      severity,
    };
  }

  private pushEvent(event: SimulationEvent) {
    this.events = [event, ...this.events].slice(0, MAX_EVENTS);
  }

  private attackEvent(
    attack: QueuedAttack,
    state: AttackRunState,
    title: string,
    description: string,
  ): AttackEvent {
    return {
      ...this.base(title, description, attack.severity),
      type: "attack",
      attackId: attack.id,
      state,
    };
  }

  private packetEventFor(
    attack: QueuedAttack,
    packet: SimulationPacket,
    title: string,
    description: string,
  ): PacketEvent {
    return {
      ...this.base(title, description, attack.severity),
      type: "packet",
      attackId: attack.id,
      packet,
    };
  }

  private timelineEvent(title: string, description: string, severity: Severity): TimelineEvent {
    return { ...this.base(title, description, severity), type: "timeline" };
  }

  private timelineEventFor(
    attack: QueuedAttack,
    title: string,
    description: string,
    stage: SimStageId,
  ): TimelineEvent {
    return {
      ...this.base(title, description, attack.severity),
      type: "timeline",
      attackId: attack.id,
      stage,
    };
  }

  private threatEventFor(attack: QueuedAttack, title: string, description: string): ThreatEvent {
    return {
      ...this.base(title, description, attack.severity),
      type: "threat",
      attackId: attack.id,
      kind: attack.kind,
      mitreTechniqueId: attack.mitreTechniqueId,
      confidence: attack.confidence,
    };
  }

  private policyEventFor(attack: QueuedAttack, confidence: number): PolicyEvent {
    return {
      ...this.base(
        "Policy enforced",
        `PEO installed drop rule for ${attack.sourceIp} (${(confidence * 100).toFixed(0)}% confidence)`,
        attack.severity,
      ),
      type: "policy",
      attackId: attack.id,
      action: "block",
      rule: `deny ${attack.sourceIp} → ${attack.config.target}`,
    };
  }

  /** Emitted stage definitions for consumers that need the static layout. */
  getStageDefinitions() {
    return PIPELINE_STAGES;
  }
}

export const simulationEngine = new SimulationEngine();
export type { SimulationEngine };
