"""Federated learning: share RL policy weights + reward stats only."""

import logging
import time
from typing import Any, Dict, List, Optional

from database.db import get_store
from ml.rl import get_policy

logger = logging.getLogger("cyber.services.federated")

NUM_CLIENTS = 5
MAX_HISTORY = 10


class FederatedService:
    """Simulates FL rounds: clients report weight deltas, server FedAverages."""

    def __init__(self, num_clients: int = NUM_CLIENTS) -> None:
        self.num_clients = num_clients
        self.round = 0
        self.clients: List[Dict[str, Any]] = []
        self.history: List[Dict[str, Any]] = []

    def _client_state(self, idx: int, policy: Any) -> Dict[str, Any]:
        base = {
            "anomaly_score": 0.35,
            "attack_probability": 0.45,
            "threat_intel": 0.1,
            "reputation": 0.1,
        }
        noise = (idx * 7) % 5 - 2  # deterministic per client
        return {
            "anomaly_score": max(0.0, base["anomaly_score"] + noise * 0.01),
            "attack_probability": max(0.0, base["attack_probability"] - noise * 0.005),
            "threat_intel": base["threat_intel"],
            "reputation": base["reputation"],
        }

    def _client_rewards(self, idx: int) -> Dict[str, float]:
        seed = (self.round * 31 + idx * 17) % 100
        return {
            "total_reward": 2000 + seed * 13,
            "avg_reward": round(0.6 + (seed % 40) / 100.0, 4),
            "events": 800 + seed * 7,
        }

    async def aggregate(self) -> Dict[str, Any]:
        """One FL round: collect client updates, FedAvg, apply to local policy."""
        policy = get_policy()
        self.round += 1
        clients: List[Dict[str, Any]] = []
        for i in range(self.num_clients):
            clients.append(
                {
                    "client_id": f"client-{i + 1}",
                    "weights": self._client_state(i, policy),
                    "rewards": self._client_rewards(i),
                }
            )

        # FedAvg of weight vectors
        keys = ["anomaly_score", "attack_probability", "threat_intel", "reputation"]
        avg = {k: sum(c["weights"][k] for c in clients) / self.num_clients for k in keys}
        policy.weights = {k: round(v, 4) for k, v in avg.items()}
        policy.policy_update(0.5, source="federated")

        round_data = {
            "round_no": self.round,
            "model_type": "rl",
            "clients": clients,
            "metrics": {
                "avg_reward": round(
                    sum(c["rewards"]["avg_reward"] for c in clients) / self.num_clients, 4
                ),
                "total_events": sum(c["rewards"]["events"] for c in clients),
                "weight_delta": {k: round(v - 0.25, 4) for k, v in avg.items()},
            },
            "aggregated_weights": avg,
            "timestamp": time.time(),
        }
        self.history.append(round_data)
        if len(self.history) > MAX_HISTORY:
            self.history = self.history[-MAX_HISTORY:]

        try:
            get_store().create_federated_round(round_data)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to persist FL round: %s", exc)

        logger.info("FL round %d complete (avg_reward=%.4f)",
                    self.round, round_data["metrics"]["avg_reward"])
        return round_data

    def status(self) -> Dict[str, Any]:
        last = self.history[-1] if self.history else None
        return {
            "enabled": True,
            "global_round": self.round,
            "num_clients": self.num_clients,
            "last_round": last,
            "history": self.history,
        }


_federated: Optional[FederatedService] = None


def init_federated() -> FederatedService:
    global _federated
    _federated = FederatedService()
    return _federated


def get_federated() -> FederatedService:
    assert _federated is not None, "federated service not initialized"
    return _federated
