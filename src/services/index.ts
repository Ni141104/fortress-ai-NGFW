import type { NgfwService } from "./types";
import * as traffic from "./mock/traffic";
import * as threats from "./mock/threats";
import * as mitre from "./mock/mitre";
import * as rl from "./mock/rl";
import * as honeypot from "./mock/honeypot";
import * as federated from "./mock/federated";
import * as policy from "./mock/policy";
import * as system from "./mock/system";
import * as simulation from "./mock/simulation";

/**
 * Single provider export. Swap `mockService` for a live HTTP/WS implementation
 * of `NgfwService` and every widget follows without edits.
 */
export const mockService: NgfwService = {
  traffic,
  threats,
  mitre,
  rl,
  honeypot,
  federated,
  policy,
  system,
  simulation,
};

export const ngfw: NgfwService = mockService;

export type { NgfwService };
