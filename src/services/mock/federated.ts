import type { FederatedClient, FederatedRound } from "@/types";
import { pick, randomBetween, randomFloat } from "./utils";

const SITES: Array<[string, string]> = [
  ["Mumbai Edge", "ap-south"],
  ["Frankfurt Core", "eu-central"],
  ["Virginia DC", "us-east"],
  ["Singapore POP", "ap-southeast"],
  ["Sao Paulo Edge", "sa-east"],
  ["London Core", "eu-west"],
  ["Tokyo POP", "ap-northeast"],
  ["Sydney Edge", "ap-southeast-2"],
  ["Bengaluru Lab", "ap-south"],
];

export const getClients = (): FederatedClient[] =>
  SITES.map(([name, region], i) => ({
    id: `FL-${(i + 1).toString().padStart(2, "0")}`,
    name,
    region,
    status: pick(["training", "idle", "aggregating", "offline"] as const),
    samples: randomBetween(40_000, 900_000),
    lastRound: randomBetween(38, 42),
  }));

export const getRounds = (count = 24): FederatedRound[] => {
  let accuracy = 0.72;
  let loss = 0.61;
  return Array.from({ length: count }, (_, i) => {
    accuracy = Math.min(0.985, accuracy + randomFloat(-0.004, 0.014));
    loss = Math.max(0.03, loss - randomFloat(-0.004, 0.021));
    return {
      round: i + 1,
      accuracy: Number(accuracy.toFixed(4)),
      loss: Number(loss.toFixed(4)),
      participants: randomBetween(5, 9),
    };
  });
};
