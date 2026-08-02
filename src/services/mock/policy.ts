import type { PolicyVersion } from "@/types";
import { minutesAgo, pick, randomBetween } from "./utils";

const AUTHORS = ["rl-optimizer", "soc-analyst@ngfw", "federated-aggregator", "tier0-autotune"];

const build = (major: number, minor: number, patch: number, ageMin: number): PolicyVersion => ({
  version: `v${major}.${minor}.${patch}`,
  publishedAt: minutesAgo(ageMin),
  ruleCount: randomBetween(1180, 1460),
  added: randomBetween(0, 24),
  removed: randomBetween(0, 9),
  modified: randomBetween(0, 31),
  author: pick(AUTHORS),
  rolloutPercent: ageMin < 30 ? randomBetween(25, 95) : 100,
});

export const getCurrentVersion = (): PolicyVersion => build(4, 12, 3, randomBetween(3, 25));

export const getHistory = (): PolicyVersion[] => [
  build(4, 12, 3, 18),
  build(4, 12, 2, 240),
  build(4, 12, 1, 900),
  build(4, 11, 7, 2600),
  build(4, 11, 6, 5400),
];
