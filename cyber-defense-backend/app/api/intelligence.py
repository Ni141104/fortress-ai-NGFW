"""Small read-only intelligence adapters over the existing attack records."""

from collections import Counter

from fastapi import APIRouter, Depends

from api.deps import get_current_user
from database.db import get_store
from ml.mitre_mapping import ATTACK_TECHNIQUES

router = APIRouter(prefix="/mitre", tags=["mitre"])


@router.get("/techniques")
async def mitre_techniques(user: dict = Depends(get_current_user)):
    attacks = await get_store().list_attacks(user["id"], limit=500)
    counts = Counter(
        technique
        for attack in attacks
        for technique in attack.get("mitre_techniques", [])
    )
    catalog: dict[str, dict] = {}
    for entries in ATTACK_TECHNIQUES.values():
        for technique_id, name, tactic in entries:
            catalog[technique_id] = {
                "id": technique_id,
                "name": name,
                "description": f"MITRE ATT&CK technique {name}.",
                "tactic": tactic,
                "count": counts.get(technique_id, 0),
                "severity": 0.9 if tactic == "Impact" else 0.7,
            }
    return sorted(catalog.values(), key=lambda item: item["count"], reverse=True)