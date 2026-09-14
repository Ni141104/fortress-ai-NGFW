import { getAttackCatalog } from "./mock/attack-catalog";
import { apiRequest, websocketUrl } from "./api-client";
import type {
  AttackService,
  PipelineService,
  SimulationService,
  TimelineService,
} from "./simulation-types";
import type {
  AttackConfig,
  AttackKind,
  QueuedAttack,
  SimStageDefinition,
  SimStageState,
  SimulationEvent,
  SimulationPacket,
  SimulationSnapshot,
  SimulationSpeed,
} from "@/types/simulation";

const BACKEND_ATTACK: Record<AttackKind, string> = {
  "sql-injection": "sql_injection",
  xss: "xss",
  "port-scan": "port_scan",
  "ssh-brute-force": "brute_force",
  ddos: "ddos",
  "malware-download": "ransomware",
  "dns-tunneling": "dns_tunneling",
  "insider-threat": "mitm",
  "zero-day": "zero_day",
};

/** Reverse lookup: FastAPI attack_type / attack_class string -> frontend AttackKind. */
export const BACKEND_ATTACK_REVERSE: Record<string, AttackKind> = {
  sql_injection: "sql-injection",
  xss: "xss",
  port_scan: "port-scan",
  brute_force: "ssh-brute-force",
  ddos: "ddos",
  ransomware: "malware-download",
  dns_tunneling: "dns-tunneling",
  mitm: "insider-threat",
  zero_day: "zero-day",
};

function backendSeverity(value: unknown): QueuedAttack["severity"] {
  const v = String(value ?? "");
  return v === "critical" || v === "high" || v === "medium" || v === "low"
    ? (v as QueuedAttack["severity"])
    : "medium";
}

/** Minimal shapes of the backend REST rows used by the observation poller. */
interface HistoryRow {
  id: string;
  attack_type?: string;
  attack_class?: string;
  status?: string;
  verdict?: string;
  confidence?: number;
  severity?: string;
  mitre_techniques?: string[];
  created_at?: string;
  flow?: { src_ip?: string; dst_ip?: string; protocol?: string };
}

interface DashboardWatch {
  recent_events: Array<{
    id: number;
    attack_id: string;
    stage: string;
    payload: Record<string, unknown>;
    created_at?: string;
  }>;
}

const STAGES: SimStageDefinition[] = [
  { id: "attacker", name: "Traffic Source", subtitle: "Ingress", short: "SRC" },
  { id: "packetgen", name: "Flow Ingestion", subtitle: "Feature extraction", short: "FLOW" },
  { id: "tier0", name: "Tier-0 Rules", subtitle: "Fast policy check", short: "T0" },
  { id: "tier1", name: "Tier-1 Anomaly", subtitle: "Isolation Forest", short: "T1" },
  { id: "tier2", name: "Tier-2 Classifier", subtitle: "XGBoost", short: "T2" },
  { id: "mitre", name: "MITRE ATT&CK", subtitle: "Technique mapping", short: "MITRE" },
  { id: "rl", name: "RL Policy", subtitle: "Adaptive action", short: "RL" },
  { id: "peo", name: "Honeypot / PEO", subtitle: "Containment", short: "PEO" },
  { id: "server", name: "Policy Store", subtitle: "Persistence", short: "DB" },
];

const emptyStages = (): SimStageState[] =>
  STAGES.map((stage) => ({
    ...stage,
    status: "idle",
    latencyMs: 0,
    confidence: 0,
    packetCount: 0,
    blockedCount: 0,
  }));

const initialSnapshot = (): SimulationSnapshot => ({
  status: "idle",
  speed: 1,
  tick: 0,
  startedAt: null,
  queue: [],
  activeAttackId: null,
  stages: emptyStages(),
  packets: [],
  events: [],
  metrics: {
    packetsGenerated: 0,
    packetsInspected: 0,
    packetsBlocked: 0,
    packetsAllowed: 0,
    threatsDetected: 0,
    policyUpdates: 0,
    avgConfidence: 0,
    elapsedSec: 0,
  },
});

function backendAttack(kind: AttackKind): string {
  return BACKEND_ATTACK[kind];
}

function stageId(stage: string): SimStageState["id"] {
  if (stage === "classify") return "mitre";
  if (stage === "rl_decision") return "rl";
  if (["honeypot", "behaviour", "contain"].includes(stage)) return "peo";
  if (stage === "start") return "attacker";
  if (stage === "end" || stage === "policy_update") return "server";
  return (STAGES.some((item) => item.id === stage) ? stage : "packetgen") as SimStageState["id"];
}

function asEvent(
  attackId: string,
  stage: string,
  payload: Record<string, unknown>,
  stableId?: string,
  classifyKind?: AttackKind,
): SimulationEvent {
  const id = stableId ?? `${attackId}-${stage}-${Date.now()}`;
  const severity = (payload["severity"] as SimulationEvent["severity"]) ?? "medium";
  const action = String(payload["action"] ?? payload["verdict"] ?? "processing");
  return {
    id,
    type: stage === "policy_update" ? "policy" : stage === "classify" ? "threat" : "timeline",
    timestamp: new Date().toISOString(),
    tick: Date.now(),
    attackId,
    title: `Backend pipeline: ${stage}`,
    description: String(
      payload["message"] ?? payload["reason"] ?? `${stage} completed (${action})`,
    ),
    severity,
    ...(stage === "classify"
      ? {
          kind: classifyKind ?? "zero-day",
          mitreTechniqueId: String(
            (payload["techniques"] as Array<{ id?: string }> | undefined)?.[0]?.id ?? "",
          ),
          confidence: Number(payload["confidence"] ?? 0),
        }
      : {}),
    ...(stage === "policy_update"
      ? {
          action: action as "allow" | "block" | "quarantine" | "redirect",
          rule: String(payload["rule_id"] ?? "policy"),
        }
      : {}),
  } as SimulationEvent;
}

class LiveSimulation implements SimulationService {
  private snapshot = initialSnapshot();
  private listeners = new Set<(snapshot: SimulationSnapshot) => void>();
  private sockets = new Map<string, WebSocket>();
  private localIdsByBackendId = new Map<string, string>();
  /** Backend attacks observed (not launched) through the /dashboard poller. */
  private observedBackendIds = new Set<string>();
  private ingestedEventIds = new Set<string>();

  subscribe(listener: (snapshot: SimulationSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): SimulationSnapshot {
    return this.snapshot;
  }

  private publish(): void {
    this.snapshot = { ...this.snapshot, tick: this.snapshot.tick + 1 };
    this.listeners.forEach((listener) => listener(this.snapshot));
  }

  private updateAttack(id: string, patch: Partial<QueuedAttack>): void {
    this.snapshot = {
      ...this.snapshot,
      queue: this.snapshot.queue.map((attack) =>
        attack.id === id ? { ...attack, ...patch } : attack,
      ),
    };
  }

  private handleMessage(
    backendAttackId: string,
    localAttackId: string,
    message: { stage?: string; payload?: Record<string, unknown> },
  ): void {
    const stage = message.stage ?? "timeline";
    const payload = message.payload ?? {};
    const mapped = stageId(stage);
    const current = this.snapshot.stages.find((item) => item.id === mapped);
    const queued = this.snapshot.queue.find((item) => item.id === localAttackId);
    const verdict = String(payload["verdict"] ?? "");
    const action = String(payload["action"] ?? "");
    const isBlocked =
      ["blocked", "quarantined", "redirected"].includes(verdict) ||
      ["block", "quarantine", "redirect"].includes(action);
    const isEnd = stage === "end";
    if (isEnd) {
      this.updateAttack(localAttackId, {
        state: isBlocked ? "blocked" : "completed",
        progress: 1,
        finishedAt: new Date().toISOString(),
        verdict: (action || verdict) as QueuedAttack["verdict"],
        confidence: Number(payload["confidence"] ?? queued?.confidence ?? 0),
        packetsBlocked: isBlocked ? 1 : (queued?.packetsBlocked ?? 0),
      });
      this.snapshot = { ...this.snapshot, status: "completed", activeAttackId: null };
      this.sockets.get(backendAttackId)?.close();
      this.sockets.delete(backendAttackId);
      this.localIdsByBackendId.delete(backendAttackId);
    } else {
      const classifyKind = BACKEND_ATTACK_REVERSE[String(payload["attack_class"] ?? "")];
      this.updateAttack(localAttackId, {
        state: "running",
        startedAt: queued?.startedAt ?? new Date().toISOString(),
        confidence: Number(
          payload["confidence"] ?? current?.confidence ?? queued?.confidence ?? 0,
        ),
        ...(stage === "classify" && classifyKind ? { kind: classifyKind } : {}),
        ...(stage === "classify"
          ? {
              mitreTechniqueId: String(
                (payload["techniques"] as Array<{ id?: string }> | undefined)?.[0]?.id ??
                  queued?.mitreTechniqueId ??
                  "",
              ),
            }
          : {}),
      });
      this.snapshot = {
        ...this.snapshot,
        status: "running",
        activeAttackId: localAttackId,
        stages: this.snapshot.stages.map((item) =>
          item.id === mapped
            ? {
                ...item,
                status: stage === "tier0" && payload["hit"] ? "blocked" : "processing",
                confidence: Number(payload["confidence"] ?? item.confidence),
                latencyMs: Number(payload["latency_ms"] ?? item.latencyMs),
              }
            : item,
        ),
        events: [
          asEvent(localAttackId, stage, payload, undefined, classifyKind),
          ...this.snapshot.events,
        ].slice(0, 200),
        metrics: {
          ...this.snapshot.metrics,
          threatsDetected: this.snapshot.metrics.threatsDetected + (stage === "classify" ? 1 : 0),
          policyUpdates: this.snapshot.metrics.policyUpdates + (stage === "policy_update" ? 1 : 0),
          avgConfidence:
            stage === "classify"
              ? Number(payload["confidence"] ?? this.snapshot.metrics.avgConfidence)
              : this.snapshot.metrics.avgConfidence,
        },
      };
    }
    this.publish();
    if (isEnd && this.snapshot.queue.some((item) => item.state === "queued")) {
      queueMicrotask(() => this.start());
    }
  }

  private connect(backendAttackId: string, localAttackId: string): void {
    const socket = new WebSocket(websocketUrl(`/ws/dashboard/${backendAttackId}`));
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as {
        stage?: string;
        payload?: Record<string, unknown>;
      };
      if (message.stage) this.handleMessage(backendAttackId, localAttackId, message);
    };
    socket.onerror = () => {
      // PREVIOUS IMPLEMENTATION — only set engine status idle:
      //   this.snapshot = { ...this.snapshot, status: "idle" };
      // Reason replaced: a WebSocket failure left the run stuck "running" with
      // no signal to the operator. Now the attack is marked disconnected, an
      // event is appended and the socket is cleaned up.
      this.updateAttack(localAttackId, { state: "disconnected" });
      this.snapshot = {
        ...this.snapshot,
        status: "idle",
        activeAttackId: null,
        events: [
          asEvent(localAttackId, "error", {
            message: "Backend WebSocket stream disconnected — pipeline status unknown",
          }),
          ...this.snapshot.events,
        ].slice(0, 200),
      };
      this.sockets.delete(backendAttackId);
      this.localIdsByBackendId.delete(backendAttackId);
      this.publish();
    };
    socket.onclose = () => {
      this.sockets.delete(backendAttackId);
    };
    this.sockets.set(backendAttackId, socket);
  }

  start(): void {
    // PREVIOUS IMPLEMENTATION — no running guard.
    // Reason replaced: enqueueing while a live run was in flight launched a
    // second attack concurrently. Live runs are now strictly sequential.
    if (this.snapshot.status === "running") return;
    const attack = this.snapshot.queue.find((item) => item.state === "queued");
    if (!attack) return;
    this.updateAttack(attack.id, { state: "running", startedAt: new Date().toISOString() });
    this.snapshot = {
      ...this.snapshot,
      status: "running",
      startedAt: new Date().toISOString(),
      activeAttackId: attack.id,
    };
    this.publish();

    const isPcap = Boolean(attack.config.pcapFile);
    const launch = isPcap
      ? this.launchPcap(attack)
      : apiRequest<{ attack_id: string }>("/attack/launch", {
          method: "POST",
          body: JSON.stringify({
            attack: backendAttack(attack.kind),
            intensity: attack.config.intensity === "extreme" ? "high" : attack.config.intensity,
            duration_sec: Math.max(1, attack.config.durationSec),
            packets_per_sec: Math.max(10, attack.config.packetRate),
            target: attack.config.target,
          }),
        });

    launch
      .then((result) => {
        this.localIdsByBackendId.set(result.attack_id, attack.id);
        this.updateAttack(attack.id, { backendId: result.attack_id });
        this.connect(result.attack_id, attack.id);
        this.publish();
      })
      .catch((error: Error) => {
        this.updateAttack(attack.id, { state: "unknown" });
        this.snapshot = { ...this.snapshot, status: "idle", activeAttackId: null };
        this.snapshot.events = [
          asEvent(attack.id, "error", { message: error.message }),
          ...this.snapshot.events,
        ];
        this.publish();
      });
  }

  private launchPcap(attack: QueuedAttack): Promise<{ attack_id: string }> {
    const body = new FormData();
    if (attack.config.pcapFile) body.append("file", attack.config.pcapFile);
    else body.append("file", new File([], "empty.pcap"), "empty.pcap");
    body.append("attack", backendAttack(attack.kind));
    body.append(
      "intensity",
      attack.config.intensity === "extreme" ? "high" : attack.config.intensity,
    );
    body.append("target", attack.config.target);
    return apiRequest<{ attack_id: string }>("/attack/launch-pcap", {
      method: "POST",
      body,
    });
  }

  pause(): void {}
  resume(): void {
    this.start();
  }
  cancel(): void {
    this.snapshot = { ...this.snapshot, status: "cancelled" };
    this.publish();
  }
  replay(): void {
    this.start();
  }
  reset(): void {
    this.sockets.forEach((socket) => socket.close());
    this.sockets.clear();
    this.localIdsByBackendId.clear();
    this.observedBackendIds.clear();
    this.ingestedEventIds.clear();
    this.snapshot = initialSnapshot();
    this.publish();
  }
  setSpeed(speed: SimulationSpeed): void {
    this.snapshot = { ...this.snapshot, speed };
    this.publish();
  }

  /**
   * Poll-based observation of backend attacks launched by OTHER sessions
   * (e.g. Blue Team watching a Red Team op launched from another browser).
   * The backend WS room is owner-only, so this streams the published event
   * feed from /dashboard and mirrors real rows from /history — real data only,
   * never generated. Placeholder queue rows keep Journey/Report/notifications
   * working for observed attacks by sharing their backend id.
   */
  async observeBackend(): Promise<boolean> {
    try {
      const settings = JSON.parse(
        window.localStorage.getItem("ngfw.platform.settings") ?? "{}",
      );
      if (settings.demoModeEnabled !== false) return false;
    } catch {
      return false;
    }
    const [dashboardData, rows] = await Promise.all([
      apiRequest<DashboardWatch>("/dashboard"),
      apiRequest<HistoryRow[]>("/history?limit=50"),
    ]);

    let changed = false;
    for (const event of dashboardData.recent_events ?? []) {
      changed = this.ingestDashboardEvent(event) || changed;
    }
    for (const row of rows.slice(0, 20)) {
      changed = this.upsertObservedRow(row) || changed;
    }

    // Reflect observed activity on the engine status (own launches take
    // priority; on an observer tab there are none).
    if (this.localIdsByBackendId.size === 0 && this.observedBackendIds.size > 0) {
      const hasRunningObserved = this.snapshot.queue.some((a) => a.state === "running");
      this.snapshot = {
        ...this.snapshot,
        status: hasRunningObserved ? "running" : "completed",
      };
      changed = true;
    }

    if (changed) this.publish();
    return true;
  }

  private ingestDashboardEvent(event: {
    id?: number;
    attack_id?: string;
    stage?: string;
    payload?: Record<string, unknown>;
  }): boolean {
    const backendId = String(event.attack_id ?? "");
    if (!backendId) return false;
    if (this.localIdsByBackendId.has(backendId)) return false; // own launch streams via WS
    const key = `${backendId}:${String(event.id ?? "")}`;
    if (this.ingestedEventIds.has(key)) return false;
    this.ingestedEventIds.add(key);

    const stage = event.stage ?? "timeline";
    const payload = event.payload ?? {};
    const mapped = stageId(stage);
    const current = this.snapshot.stages.find((item) => item.id === mapped);
    const classifyKind = BACKEND_ATTACK_REVERSE[String(payload["attack_class"] ?? "")];
    const stableId = `${backendId}-b${String(event.id ?? "")}`;
    if (this.snapshot.events.some((e) => e.id === stableId)) return false;

    const eventItem = asEvent(backendId, stage, payload, stableId, classifyKind);
    this.updateAttack(backendId, {
      state: "running",
      confidence: Number(payload["confidence"] ?? current?.confidence ?? 0),
    });
    this.snapshot = {
      ...this.snapshot,
      status: "running",
      activeAttackId: backendId,
      stages: this.snapshot.stages.map((item) =>
        item.id === mapped
          ? {
              ...item,
              status: stage === "tier0" && payload["hit"] ? "blocked" : "processing",
              confidence: Number(payload["confidence"] ?? item.confidence),
              latencyMs: Number(payload["latency_ms"] ?? item.latencyMs),
            }
          : item,
      ),
      events: [eventItem, ...this.snapshot.events].slice(0, 200),
      metrics: {
        ...this.snapshot.metrics,
        threatsDetected: this.snapshot.metrics.threatsDetected + (stage === "classify" ? 1 : 0),
        policyUpdates: this.snapshot.metrics.policyUpdates + (stage === "policy_update" ? 1 : 0),
        avgConfidence:
          stage === "classify"
            ? Number(payload["confidence"] ?? this.snapshot.metrics.avgConfidence)
            : this.snapshot.metrics.avgConfidence,
      },
    };
    return true;
  }

  private upsertObservedRow(row: HistoryRow): boolean {
    const id = String(row.id);
    if (this.localIdsByBackendId.has(id)) return false;
    const existing = this.snapshot.queue.find((a) => a.id === id);
    const kind =
      BACKEND_ATTACK_REVERSE[String(row.attack_type ?? "")] ??
      BACKEND_ATTACK_REVERSE[String(row.attack_class ?? "")] ??
      "zero-day";
    const verdict = String(row.verdict ?? "");
    const isBlocked = ["blocked", "quarantined", "redirected"].includes(verdict);
    const state: QueuedAttack["state"] = isBlocked
      ? "blocked"
      : row.status === "running"
        ? "running"
        : "completed";
    const progress = state === "blocked" || state === "completed" ? 1 : 0;

    if (existing) {
      const patch: Partial<QueuedAttack> = {
        kind,
        state,
        progress,
        verdict: (verdict || existing.verdict) as QueuedAttack["verdict"],
        confidence: Number(row.confidence ?? existing.confidence ?? 0),
        packetsBlocked: isBlocked ? 1 : 0,
      };
      if (existing.state === patch.state && existing.verdict === patch.verdict) return false;
      this.updateAttack(id, patch);
    } else {
      this.snapshot = {
        ...this.snapshot,
        queue: [
          ...this.snapshot.queue,
          {
            id,
            kind,
            name: String(row.attack_class || row.attack_type || "Backend detection"),
            mitreTactic: "Backend detection",
            mitreTechniqueId: String(row.mitre_techniques?.[0] ?? ""),
            severity: backendSeverity(row.severity),
            config: {
              target: String(row.flow?.dst_ip ?? "unknown"),
              intensity: "medium",
              durationSec: 1,
              packetRate: 0,
              payloadVariant: "default",
              stealthMode: false,
              notes: "Observed FastAPI incident",
            },
            state,
            progress,
            sourceIp: String(row.flow?.src_ip ?? "backend"),
            packetsSent: 0,
            packetsBlocked: isBlocked ? 1 : 0,
            createdAt: String(row.created_at ?? new Date().toISOString()),
            backendId: id,
            confidence: Number(row.confidence ?? 0),
          } satisfies QueuedAttack,
        ],
      };
    }
    this.observedBackendIds.add(id);
    return true;
  }
}

export const liveSimulationService = new LiveSimulation();

export const liveAttackService: AttackService = {
  getCatalog: () => getAttackCatalog(),
  getDefinition: (kind) =>
    getAttackCatalog().find((entry) => entry.id === kind) ?? getAttackCatalog()[0]!,
  defaultConfig: (kind) => {
    const definition =
      getAttackCatalog().find((entry) => entry.id === kind) ?? getAttackCatalog()[0]!;
    return {
      target: "10.0.4.22",
      intensity: "medium",
      durationSec: definition.defaultDurationSec,
      packetRate: definition.defaultPacketRate,
      payloadVariant: definition.payloadVariants[0] ?? "default",
      stealthMode: false,
      notes: "",
    };
  },
  enqueue: (kind, config) => {
    const definition =
      getAttackCatalog().find((entry) => entry.id === kind) ?? getAttackCatalog()[0]!;
    const attack: QueuedAttack = {
      id: crypto.randomUUID(),
      kind,
      name: definition.name,
      mitreTactic: definition.mitreTactic,
      mitreTechniqueId: definition.mitreTechniqueId,
      severity: definition.severity,
      config,
      state: "queued",
      progress: 0,
      sourceIp: "backend",
      packetsSent: 0,
      packetsBlocked: 0,
      createdAt: new Date().toISOString(),
      confidence: 0,
    };
    liveSimulationService["snapshot"] = {
      ...liveSimulationService.getSnapshot(),
      queue: [...liveSimulationService.getSnapshot().queue, attack],
    };
    liveSimulationService["publish"]();
    return attack;
  },
  getQueue: () => liveSimulationService.getSnapshot().queue,
  launch: () => liveSimulationService.start(),
  pauseAttack: () => {},
  resumeAttack: () => liveSimulationService.start(),
  cancelAttack: () => liveSimulationService.cancel(),
  replayAttack: (id) => {
    const item = liveSimulationService.getSnapshot().queue.find((attack) => attack.id === id);
    if (item && !["queued", "running", "paused"].includes(item.state)) {
      liveAttackService.enqueue(item.kind, item.config);
      return liveSimulationService.start();
    }
    return liveSimulationService.start();
  },
  duplicate: (id) => {
    const item = liveSimulationService.getSnapshot().queue.find((attack) => attack.id === id);
    return item ? liveAttackService.enqueue(item.kind, item.config) : null;
  },
  remove: (id) => {
    const snap = liveSimulationService.getSnapshot();
    liveSimulationService["snapshot"] = {
      ...snap,
      queue: snap.queue.filter((attack) => attack.id !== id),
      activeAttackId: snap.activeAttackId === id ? null : snap.activeAttackId,
      events: snap.events.filter((event) => event.attackId !== id),
    };
    liveSimulationService["publish"]();
  },
  clearQueue: () => liveSimulationService.reset(),
};

export const livePipelineService: PipelineService = {
  getStageDefinitions: () => STAGES,
  getStages: () => liveSimulationService.getSnapshot().stages,
  getPacketsInFlight: (): SimulationPacket[] => liveSimulationService.getSnapshot().packets,
};

export const liveTimelineService: TimelineService = {
  getEvents: (limit = 60) => liveSimulationService.getSnapshot().events.slice(0, limit),
  getEventsByType: (type, limit = 60) =>
    liveSimulationService
      .getSnapshot()
      .events.filter((event) => event.type === type)
      .slice(0, limit),
};
