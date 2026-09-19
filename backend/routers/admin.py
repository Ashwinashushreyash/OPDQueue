from datetime import datetime
from typing import Optional
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

mock_cabins = [
    {
        "id": "c-101",
        "cabin_number": "Cabin 101",
        "department": "General Medicine",
        "wing": "Wing A",
        "doctor_name": "Dr. Sarah Miller, MD",
        "avatar_initials": "SM",
        "status": "active",
        "serving_token": "#GM-38",
        "queue_depth": 4,
        "avg_velocity_mins": 7.2,
        "load_tag": "Float Ready",
        "corridor": "Corridor A",
    },
    {
        "id": "c-102",
        "cabin_number": "Cabin 102",
        "department": "Pediatrics",
        "wing": "Wing B",
        "doctor_name": "Dr. Alex Rivera, MD",
        "avatar_initials": "AR",
        "status": "active",
        "serving_token": "#PD-41",
        "queue_depth": 18,
        "avg_velocity_mins": 11.4,
        "load_tag": "High Load",
        "corridor": "Corridor B",
    },
    {
        "id": "c-103",
        "cabin_number": "Cabin 103",
        "department": "Dermatology",
        "wing": "Wing B",
        "doctor_name": "Dr. Emily Chen, MD",
        "avatar_initials": "EC",
        "status": "active",
        "serving_token": "#DM-19",
        "queue_depth": 6,
        "avg_velocity_mins": 8.8,
        "load_tag": "Balanced",
        "corridor": "Corridor B",
    },
    {
        "id": "c-104",
        "cabin_number": "Cabin 104",
        "department": "Cardiology",
        "wing": "Wing A",
        "doctor_name": "Dr. Sarah Jenkins, MD",
        "avatar_initials": "SJ",
        "status": "active",
        "serving_token": "#CARD-042",
        "queue_depth": 5,
        "avg_velocity_mins": 9.1,
        "load_tag": "Optimal",
        "corridor": "Corridor B",
    },
    {
        "id": "c-105",
        "cabin_number": "Cabin 105",
        "department": "Orthopedics",
        "wing": "Wing B",
        "doctor_name": "Dr. Marcus Vance, MD",
        "avatar_initials": "MV",
        "status": "active",
        "serving_token": "#OR-22",
        "queue_depth": 8,
        "avg_velocity_mins": 14.2,
        "load_tag": "Balanced",
        "corridor": "Corridor B",
    },
    {
        "id": "c-106",
        "cabin_number": "Cabin 106",
        "department": "ENT",
        "wing": "Wing C",
        "doctor_name": "Dr. Priya Nair, MD",
        "avatar_initials": "PN",
        "status": "on_break",
        "serving_token": "#ENT-14",
        "queue_depth": 0,
        "avg_velocity_mins": 0.0,
        "load_tag": "Break",
        "corridor": "Corridor C",
    },
]

admin_events = [
    {
        "id": "ev-01",
        "type": "emergency_insertion",
        "title": "Emergency Token E-01 Fast-Tracked",
        "detail": "Patient placed next in consultation order for Cabin 104. Wait times adjusted.",
        "cabin": "Cabin 104",
        "timestamp": "3 mins ago",
    },
    {
        "id": "ev-02",
        "type": "status_change",
        "title": "Cabin 106 Sterilization Break",
        "detail": "Dr. Priya Nair scheduled rotation break until 12:00 PM.",
        "cabin": "Cabin 106",
        "timestamp": "14 mins ago",
    },
    {
        "id": "ev-03",
        "type": "rebalance",
        "title": "Dynamic Load Shift Executed",
        "detail": "Transferred 4 routine overflow tokens from Wing B to Wing A.",
        "cabin": "Cabin 102 → 101",
        "timestamp": "28 mins ago",
    },
]

class CabinStatusUpdate(BaseModel):
    status: str = Field(pattern="^(active|paused|on_break|emergency)$")

class RebalanceRequest(BaseModel):
    source_cabin_id: Optional[str] = "c-102"
    target_cabin_id: Optional[str] = "c-101"
    tokens_to_shift: int = Field(default=4, ge=1, le=10)

def _find_cabin(cabin_id: str) -> dict:
    cabin = next((c for c in mock_cabins if c["id"] == cabin_id or c["cabin_number"].lower() == cabin_id.lower()), None)
    if not cabin:
        raise HTTPException(status_code=404, detail="Cabin not found")
    return cabin

@router.get("/overview")
async def get_admin_overview():
    active_cabins = sum(1 for c in mock_cabins if c["status"] == "active")
    total_queued = sum(c["queue_depth"] for c in mock_cabins)
    return {
        "status": "success",
        "kpis": {
            "daily_intake": 418,
            "completed": 312,
            "active": total_queued,
            "mean_wait_mins": 24,
            "wait_trend": "-12.4% today",
            "wait_threshold": "< 30 min",
            "active_clinician_units": active_cabins,
            "total_clinician_units": len(mock_cabins),
            "operating_percentage": round((active_cabins / len(mock_cabins)) * 100, 1),
            "sterilization_hold": sum(1 for c in mock_cabins if c["status"] == "on_break"),
            "bottleneck": {
                "wing": "Wing B Pediatrics",
                "cabin": "Cabin 102",
                "queued": next((c["queue_depth"] for c in mock_cabins if c["id"] == "c-102"), 18),
                "wait_eta_mins": 41,
            },
        },
        "acuity_mix": {
            "routine": 68,
            "priority": 22,
            "emergency": 10,
        },
        "emergency_telemetry": {
            "active_emergencies": 2,
            "max_reserve_capacity": 2,
            "latency_to_cabin_mins": 3.2,
            "escalation_protocol": "Tier 1 Active",
        },
    }

@router.get("/cabins")
async def get_cabins(wing: Optional[str] = None):
    if wing and wing.lower() != "all":
        filtered = [c for c in mock_cabins if wing.lower() in c["wing"].lower()]
        return {"status": "success", "cabins": filtered}
    return {"status": "success", "cabins": mock_cabins}

@router.post("/cabins/{cabin_id}/status")
async def update_cabin_status(cabin_id: str, request: CabinStatusUpdate):
    cabin = _find_cabin(cabin_id)
    old_status = cabin["status"]
    cabin["status"] = request.status
    if request.status == "on_break":
        cabin["load_tag"] = "Break"
    elif request.status == "emergency":
        cabin["load_tag"] = "Code Red"
    elif request.status == "paused":
        cabin["load_tag"] = "Paused"
    else:
        cabin["load_tag"] = "Optimal" if cabin["queue_depth"] <= 6 else "High Load"

    event = {
        "id": f"ev-{uuid.uuid4().hex[:6]}",
        "type": "status_change",
        "title": f"{cabin['cabin_number']} Status Shift",
        "detail": f"Status changed from {old_status} to {request.status}.",
        "cabin": cabin["cabin_number"],
        "timestamp": "Just now",
    }
    admin_events.insert(0, event)
    return {"status": "success", "cabin": cabin, "event": event}

@router.post("/rebalance")
async def trigger_fleet_rebalance(request: RebalanceRequest):
    src = _find_cabin(request.source_cabin_id or "c-102")
    tgt = _find_cabin(request.target_cabin_id or "c-101")
    
    shift_count = min(request.tokens_to_shift, src["queue_depth"])
    src["queue_depth"] = max(0, src["queue_depth"] - shift_count)
    tgt["queue_depth"] += shift_count
    
    src["load_tag"] = "Optimal" if src["queue_depth"] <= 8 else "High Load"
    tgt["load_tag"] = "Balanced" if tgt["queue_depth"] <= 8 else "High Load"
    
    event = {
        "id": f"ev-{uuid.uuid4().hex[:6]}",
        "type": "rebalance",
        "title": "Fleet Rebalance Executed",
        "detail": f"Transferred {shift_count} routine tokens from {src['cabin_number']} to {tgt['cabin_number']}.",
        "cabin": f"{src['cabin_number']} → {tgt['cabin_number']}",
        "timestamp": "Just now",
    }
    admin_events.insert(0, event)
    return {
        "status": "success",
        "shifted_count": shift_count,
        "source": src,
        "target": tgt,
        "cabins": mock_cabins,
        "event": event,
    }

@router.post("/flush")
async def flush_day_tokens():
    event = {
        "id": f"ev-{uuid.uuid4().hex[:6]}",
        "type": "flush",
        "title": "Day Tokens Flushed & Archived",
        "detail": "Historical tokens reconciled. Telemetry active stream flushed for night cycle.",
        "cabin": "Global Fleet",
        "timestamp": "Just now",
    }
    admin_events.insert(0, event)
    return {"status": "success", "message": "Fleet tokens successfully flushed", "event": event}

@router.get("/events")
async def get_admin_events():
    return {"status": "success", "events": admin_events[:15]}
