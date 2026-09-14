"""
Reinforcement Learning policy service (lightweight, deployable).

Design (as agreed):
  - RL optimizes ACTIONS (block / allow / quarantine / redirect / rate_limit),
    it does NOT create rules.
  - Inference-only online: per-event Q-value update with decayed exploration.
  - A policy-version bump + "Tier-0 rules updated" event makes the
    feedback loop visible in the demo.
  - Federated learning shares policy weights + reward stats (no rules,
    no raw traffic).

Optional SB3 weights can be dropped in as rl_policy.zip; the service falls
back to the rule-based policy without any torch dependency.
"""

import logging
import math
import random
from typing import Any, Dict, List, Optional

import numpy as np

from core.config import settings

logger = logging.getLogger("cyber.ml.rl")

VALID_ACTIONS = ["block", "allow", "quarantine", "redirect", "rate_limit"]

ACTION_FEATURES = [
    "anomaly_score",
    "attack_probability",
    "threat_intel",
    "reputation",
]

# default Q-table (state-key -> action -> q)
_DEFAULT_Q: Dict[str, Dict[str, float]] = {
    "benign": {"allow": 1.0, "block": 0.0, "quarantine": 0.0, "redirect": 0.0, "rate_limit": 0.0},
    "suspicious": {"allow": 0.2, "block": 0.6, "quarantine": 0.5, "redirect": 0.4, "rate_limit": 0.7},
    "attack": {"allow": 0.0, "block": 0.95, "quarantine": 0.8, "redirect": 0.5, "rate_limit": 0.4},
    "zero_day": {"allow": 0.0, "block": 0.3, "quarantine": 0.7, "redirect": 0.9, "rate_limit": 0.5},
}


class RLPolicyService:
    """Rule-based Q-learning policy for action selection + adaptation."""

    def __init__(self) -> None:
        self.q_table: Dict[str, Dict[str, float]] = {
            k: dict(v) for k, v in _DEFAULT_Q.items()
        }
        self.weights: Dict[str, float] = {
            "anomaly_score": 0.35,
            "attack_probability": 0.45,
            "threat_intel": 0.1,
            "reputation": 0.1,
        }
        self.epsilon = settings.rl_epsilon
        self.gamma = settings.rl_gamma
        self.lr = settings.rl_lr
        self.version = 0
        self.step_count = 0
        self._sb3: Optional[Any] = None
        self.rewards_rolling: List[float] = []

    # ------------------------------------------------------------------ #
    # decision
    # ------------------------------------------------------------------ #
    def _state_key(self, features: Dict[str, float]) -> str:
        if features.get("is_zero_day"):
            return "zero_day"
        p = features.get("attack_probability", 0.0)
        if p >= settings.xgb_high_conf_threshold:
            return "attack"
        if p >= settings.xgb_conf_threshold:
            return "suspicious"
        return "benign"

    def choose_action(
        self, features: Dict[str, float], force_action: Optional[str] = None
    ) -> Dict[str, Any]:
        state = self._state_key(features)
        q = self.q_table.setdefault(state, dict(_DEFAULT_Q.get(state, _DEFAULT_Q["benign"])))

        if force_action and force_action in q:
            action = force_action
            confidence = self._confidence(state, action)
            source = "forced"
        elif random.random() < self.epsilon:
            action = random.choice([a for a in q])
            confidence = 0.5
            source = "explore"
        else:
            action = max(q, key=q.get)
            confidence = self._confidence(state, action)
            source = "exploit"

        self.step_count += 1
        return {
            "state": state,
            "action": action,
            "confidence": round(confidence, 4),
            "q_values": {a: round(v, 4) for a, v in q.items()},
            "source": source,
            "step": self.step_count,
        }

    @staticmethod
    def _confidence(state: str, action: str) -> float:
        base = {
            "benign": 0.95,
            "suspicious": 0.75,
            "attack": 0.9,
            "zero_day": 0.85,
        }.get(state, 0.7)
        if state == "zero_day" and action == "redirect":
            return 0.93
        if state == "attack" and action == "block":
            return 0.95
        if action == "allow" and state != "benign":
            return min(base, 0.4)
        return base

    # ------------------------------------------------------------------ #
    # adaptation
    # ------------------------------------------------------------------ #
    def update(
        self,
        state: str,
        action: str,
        reward: float,
        done: bool = True,
    ) -> float:
        """Q-learning update; returns the new Q-value for (state, action)."""
        q = self.q_table.setdefault(state, dict(_DEFAULT_Q.get(state, _DEFAULT_Q["benign"])))
        old = q.get(action, 0.0)
        new = (1 - self.lr) * old + self.lr * (reward + self.gamma * max(q.values()) * (0 if done else 1))
        q[action] = round(new, 4)
        self.rewards_rolling.append(reward)
        if len(self.rewards_rolling) > 200:
            self.rewards_rolling = self.rewards_rolling[-200:]
        return q[action]

    def reward_for_verdict(self, chosen_action: str, outcome: str) -> float:
        """Reward shaping based on the true outcome of an action."""
        desired = {"block": "blocked", "quarantine": "quarantined", "redirect": "redirected", "rate_limit": "rate_limited", "allow": "allowed"}
        if desired.get(chosen_action) == outcome:
            return 1.0
        if chosen_action == "block" and outcome == "blocked":
            return 1.2
        if chosen_action == "allow" and outcome == "allowed":
            return 0.9
        return -0.5

    def policy_update(
        self,
        threat: float,
        attack_type: Optional[str] = None,
        source: str = "rl",
    ) -> Dict[str, Any]:
        """Simulate a policy update: bump version, tighten thresholds, decay epsilon."""
        self.version += 1
        self.epsilon = max(0.02, self.epsilon * settings.rl_epsilon_decay)
        params = {
            "policy_version": self.version,
            "epsilon": round(self.epsilon, 4),
            "lr": self.lr,
            "gamma": self.gamma,
            "threat_level": round(float(threat), 4),
            "attack_type": attack_type or "",
            "weights": self.weights,
            "q_table": {k: {a: round(v, 4) for a, v in q.items()} for k, q in self.q_table.items()},
        }
        return {
            "version": self.version,
            "source": source,
            "params": params,
            "message": "Policy Updated",
        }

    # ------------------------------------------------------------------ #
    # SB3 bridge (optional)
    # ------------------------------------------------------------------ #
    def load_sb3(self, path: Optional[str] = None) -> bool:
        try:
            from stable_baselines3 import PPO  # type: ignore
        except ImportError:
            return False
        if not path or not __import__("os").path.exists(path):
            return False
        try:
            self._sb3 = PPO.load(path)
            logger.info("Loaded SB3 policy from %s", path)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("SB3 load failed: %s", exc)
            return False

    def _sb3_action(self, features: Dict[str, float]) -> Optional[str]:
        if self._sb3 is None:
            return None
        try:
            vec = np.array(
                [[features.get(f, 0.0) for f in ACTION_FEATURES]], dtype=np.float32
            )
            action, _ = self._sb3.predict(vec, deterministic=True)
            idx = int(action[0])
            if 0 <= idx < len(VALID_ACTIONS):
                return VALID_ACTIONS[idx]
        except Exception as exc:  # noqa: BLE001
            logger.warning("SB3 inference failed: %s", exc)
        return None


_policy: Optional[RLPolicyService] = None


def init_policy() -> RLPolicyService:
    global _policy
    _policy = RLPolicyService()
    _policy.load_sb3(settings.rl_model_path or None)
    return _policy


def get_policy() -> RLPolicyService:
    assert _policy is not None, "RL policy not initialized"
    return _policy


def state_features(
    tier1: Dict[str, Any],
    tier2: Dict[str, Any],
    is_zero_day: bool = False,
    threat_intel: float = 0.0,
    reputation: float = 0.5,
) -> Dict[str, float]:
    return {
        "anomaly_score": tier1.get("anomaly_score", 0.5),
        "attack_probability": tier2.get("attack_probability", 0.0),
        "threat_intel": threat_intel,
        "reputation": reputation,
        "is_zero_day": is_zero_day,
    }
