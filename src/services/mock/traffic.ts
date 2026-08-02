import type { PipelineStage, Role, TrafficStat } from "@/types";
import { randomBetween, randomFloat } from "./utils";

const sparkline = (min: number, max: number) =>
  Array.from({ length: 20 }, () => randomBetween(min, max));

export const getStats = (role: Role): TrafficStat[] => {
  if (role === "red") {
    return [
      {
        label: "Campaigns Launched",
        value: randomBetween(12, 64),
        change: randomFloat(-4, 22),
        status: "warning",
        icon: "Swords",
        sparklineData: sparkline(1, 12),
      },
      {
        label: "Techniques Executed",
        value: randomBetween(40, 220),
        change: randomFloat(-6, 28),
        status: "warning",
        icon: "Target",
        sparklineData: sparkline(2, 30),
      },
      {
        label: "Evaded Detection",
        value: randomBetween(3, 28),
        change: randomFloat(-12, 18),
        status: "success",
        icon: "EyeOff",
        sparklineData: sparkline(0, 8),
      },
      {
        label: "Blocked by NGFW",
        value: randomBetween(60, 400),
        change: randomFloat(-5, 25),
        status: "danger",
        icon: "ShieldAlert",
        sparklineData: sparkline(5, 60),
      },
      {
        label: "Honeypot Captures",
        value: randomBetween(8, 90),
        change: randomFloat(-3, 16),
        status: "warning",
        icon: "Radar",
        sparklineData: sparkline(1, 25),
      },
      {
        label: "Mean Time To Detect",
        value: randomBetween(2, 45),
        change: randomFloat(-18, 9),
        status: "success",
        icon: "Timer",
        sparklineData: sparkline(1, 50),
      },
    ];
  }

  return [
    {
      label: "Traffic Analyzed",
      value: randomBetween(1_000_000, 9_999_999),
      change: randomFloat(-5, 15),
      status: "success",
      icon: "Activity",
      sparklineData: sparkline(1000, 10000),
    },
    {
      label: "Threats Detected",
      value: randomBetween(100, 999),
      change: randomFloat(-10, 30),
      status: "warning",
      icon: "Shield",
      sparklineData: sparkline(10, 100),
    },
    {
      label: "Zero-Day Detections",
      value: randomBetween(5, 50),
      change: randomFloat(-5, 20),
      status: "danger",
      icon: "Bug",
      sparklineData: sparkline(1, 20),
    },
    {
      label: "Blocked Connections",
      value: randomBetween(500, 5000),
      change: randomFloat(-8, 25),
      status: "danger",
      icon: "ShieldAlert",
      sparklineData: sparkline(50, 500),
    },
    {
      label: "Quarantined Devices",
      value: randomBetween(10, 100),
      change: randomFloat(-3, 15),
      status: "warning",
      icon: "Lock",
      sparklineData: sparkline(5, 50),
    },
    {
      label: "Honeynet Captures",
      value: randomBetween(20, 200),
      change: randomFloat(-2, 18),
      status: "warning",
      icon: "Radar",
      sparklineData: sparkline(10, 80),
    },
  ];
};

export const getPipeline = (): PipelineStage[] => {
  const ingress = randomBetween(820_000, 1_400_000);
  const t1 = Math.round(ingress * randomFloat(0.06, 0.12));
  const t2 = Math.round(t1 * randomFloat(0.18, 0.34));
  const rl = Math.round(t2 * randomFloat(0.55, 0.9));
  const peo = rl;

  const health = (load: number): PipelineStage["status"] =>
    load > 0.85 ? "saturated" : load > 0.65 ? "degraded" : "healthy";

  return [
    {
      id: "tier0",
      name: "Tier-0 Policy",
      subtitle: "Dynamic policy repository",
      throughput: ingress,
      latencyMs: randomFloat(0.04, 0.18),
      escalated: t1,
      status: health(Math.random()),
    },
    {
      id: "tier1",
      name: "Tier-1 Isolation Forest",
      subtitle: "Unsupervised anomaly gate",
      throughput: t1,
      latencyMs: randomFloat(0.4, 1.6),
      escalated: t2,
      status: health(Math.random()),
    },
    {
      id: "tier2",
      name: "Tier-2 XGBoost",
      subtitle: "MITRE ATT&CK classification",
      throughput: t2,
      latencyMs: randomFloat(2.1, 6.8),
      escalated: rl,
      status: health(Math.random()),
    },
    {
      id: "rl",
      name: "RL Optimizer",
      subtitle: "Reinforcement policy selection",
      throughput: rl,
      latencyMs: randomFloat(1.2, 4.4),
      escalated: peo,
      status: health(Math.random()),
    },
    {
      id: "peo",
      name: "PEO Enforcement",
      subtitle: "Zero-trust enforcement point",
      throughput: peo,
      latencyMs: randomFloat(0.2, 0.9),
      escalated: 0,
      status: health(Math.random()),
    },
  ];
};
