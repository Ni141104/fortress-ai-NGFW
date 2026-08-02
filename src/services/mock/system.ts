import type { SystemMetric } from "@/types";
import { randomBetween } from "./utils";

const metric = (
  name: string,
  unit: string,
  min: number,
  max: number,
  warn: number,
  crit: number,
): SystemMetric => {
  const value = randomBetween(min, max);
  return {
    name,
    unit,
    value,
    status: value >= crit ? "critical" : value >= warn ? "warning" : "normal",
    history: Array.from({ length: 24 }, () => randomBetween(min, max)),
  };
};

export const getHealth = (): SystemMetric[] => [
  metric("CPU Utilization", "%", 18, 92, 70, 88),
  metric("Memory Usage", "%", 30, 88, 72, 85),
  metric("DPDK Throughput", "Gbps", 12, 96, 200, 200),
  metric("Inference Queue", "req/s", 400, 9800, 8000, 9200),
  metric("Packet Drop Rate", "ppm", 0, 240, 120, 200),
  metric("Enforcement Latency", "ms", 1, 42, 25, 35),
];
