import type { RLAction, RLActionShare, RLDecision, RLRewardPoint } from "@/types";
import {
  PROTOCOLS,
  generateIP,
  id,
  internalIP,
  minutesAgo,
  pick,
  randomFloat,
} from "./utils";

const ACTIONS: RLAction[] = ["allow", "block", "quarantine", "redirect"];

const REASONS: Record<RLAction, string[]> = {
  allow: ["Benign traffic profile", "Known-good service fingerprint", "Below anomaly threshold"],
  block: ["High XGBoost malicious confidence", "Matched Tier-0 denylist", "Repeated policy violation"],
  quarantine: ["Lateral movement suspected", "Device deviating from baseline", "Credential abuse pattern"],
  redirect: ["Routed to honeynet for capture", "Low-cost observation preferred", "Deception yields higher reward"],
};

export const getDecisions = (count = 20): RLDecision[] =>
  Array.from({ length: count }, () => {
    const decision = pick(ACTIONS);
    return {
      id: id("RL"),
      timestamp: minutesAgo(Math.random() * 120),
      sourceIp: generateIP(),
      destinationIp: internalIP(),
      confidence: randomFloat(0.55, 0.99),
      decision,
      tier1Score: randomFloat(0.1, 0.99),
      tier2Score: randomFloat(0.1, 0.99),
      reason: pick(REASONS[decision]),
      protocol: pick(PROTOCOLS),
    } satisfies RLDecision;
  }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

export const getRewardCurve = (count = 40): RLRewardPoint[] => {
  let cumulative = 0;
  return Array.from({ length: count }, (_, i) => {
    const reward = randomFloat(-0.4, 1.1) + i / count;
    cumulative += reward;
    return {
      episode: i + 1,
      reward: Number(reward.toFixed(3)),
      cumulative: Number(cumulative.toFixed(2)),
    };
  });
};

export const getActionDistribution = (): RLActionShare[] => {
  const raw = ACTIONS.map((action) => ({ action, share: randomFloat(0.05, 1) }));
  const total = raw.reduce((sum, r) => sum + r.share, 0);
  return raw.map((r) => ({ action: r.action, share: r.share / total }));
};
