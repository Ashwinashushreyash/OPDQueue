from datetime import datetime
from typing import Optional
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/queue", tags=["Queue"])

REGULAR_CONSULTATION_MINS = 8
EMERGENCY_CONSULTATION_MINS = 12
EMERGENCY_RESERVE_PER_SLOT = 2

mock_tokens = [
    {
        "id": "t-12", "token_display": "#12", "patient_name": "Johnathan Doe",
        "mrn": "MRN-90248", "patient_uid": "JOHDOES32101990", "department": "Cardiology",
        "cabin": "Cabin 104", "doctor": "Dr. Sarah Jenkins, MD", "priority": "priority",
        "status": "in_consultation", "estimated_wait_mins": 0,
        "chief_complaint": "Chest discomfort and mild palpitations",
    },
    {
        "id": "t-13", "token_display": "#13", "patient_name": "Priya Sharma",
        "mrn": "MRN-90249", "department": "Cardiology", "cabin": "Cabin 104",
        "doctor": "Dr. Sarah Jenkins, MD", "priority": "routine", "status": "waiting",
        "estimated_wait_mins": 4, "chief_complaint": "Routine cardiology review",
    },
    {
        "id": "t-14", "token_display": "#14", "patient_name": "Michael Chang",
        "mrn": "MRN-90250", "department": "Cardiology", "cabin": "Cabin 104",
        "doctor": "Dr. Sarah Jenkins, MD", "priority": "priority", "status": "waiting",
        "estimated_wait_mins": 12, "chief_complaint": "Post-procedure follow-up",
    },
    {
        "id": "t-15", "token_display": "#15", "patient_name": "Aaliyah Khan",
        "mrn": "MRN-90251", "department": "Cardiology", "cabin": "Cabin 104",
        "doctor": "Dr. Sarah Jenkins, MD", "priority": "routine", "status": "waiting",
        "estimated_wait_mins": 20, "chief_complaint": "Blood pressure follow-up",
    },
]

queue_events: list[dict] = []
clinical_visits: list[dict] = []


class IssueTokenRequest(BaseModel):
    patient_name: str
    mrn: Optional[str] = None
    department: str
    priority: str = "routine"
    chief_complaint: Optional[str] = None


class EmergencyArrivalRequest(BaseModel):
    patient_name: str = Field(min_length=2, max_length=120)
    patient_uid: Optional[str] = Field(default=None, max_length=64)
    chief_complaint: str = Field(min_length=2, max_length=280)
    cabin: str = "Cabin 104"


class ConsultationRequest(BaseModel):
    symptoms: str = Field(min_length=2, max_length=2000)
    diagnosis: str = Field(min_length=2, max_length=1000)
    blood_pressure: Optional[str] = None
    pulse: Optional[int] = Field(default=None, ge=0, le=300)
    temperature: Optional[float] = Field(default=None, ge=80, le=120)
    oxygen_saturation: Optional[int] = Field(default=None, ge=0, le=100)
    prescriptions: list[dict] = []
    lab_orders: list[str] = []


def _find_token(token_id: str) -> dict:
    token = next((item for item in mock_tokens if item["id"] == token_id), None)
    if token is None:
        raise HTTPException(status_code=404, detail="Token not found")
    return token


def _active_emergency_count(cabin: str) -> int:
    return sum(
        token["priority"] == "emergency"
        and token["cabin"] == cabin
        and token["status"] in {"waiting", "in_consultation", "hold"}
        for token in mock_tokens
    )


def _recalculate_waits(cabin: str) -> list[dict]:
    affected_tokens: list[dict] = []
    remaining_minutes = 0
    queue_position = 0
    for token in mock_tokens:
        if token["cabin"] != cabin or token["status"] in {"completed", "cancelled"}:
            continue
        if token["status"] == "in_consultation":
            token["estimated_wait_mins"] = 0
            token["queue_position"] = 0
            remaining_minutes = 4
            continue
        if token["status"] == "hold":
            continue
        previous_wait = token.get("estimated_wait_mins", 0)
        queue_position += 1
        token["queue_position"] = queue_position
        token["estimated_wait_mins"] = remaining_minutes
        if previous_wait != remaining_minutes:
            affected_tokens.append({
                "token_id": token["id"], "token_display": token["token_display"],
                "previous_wait_mins": previous_wait, "updated_wait_mins": remaining_minutes,
            })
        duration = EMERGENCY_CONSULTATION_MINS if token["priority"] == "emergency" else REGULAR_CONSULTATION_MINS
        remaining_minutes += duration
    return affected_tokens


def _queue_snapshot(cabin: str) -> list[dict]:
    return [
        token for token in mock_tokens
        if token["cabin"] == cabin and token["status"] not in {"completed", "cancelled"}
    ]


@router.get("/tokens")
async def get_active_tokens(cabin: str = "Cabin 104"):
    _recalculate_waits(cabin)
    return {
        "status": "success", "tokens": _queue_snapshot(cabin),
        "emergency_reserve": {"capacity": EMERGENCY_RESERVE_PER_SLOT, "used": _active_emergency_count(cabin)},
    }


@router.post("/tokens")
async def issue_token(request: IssueTokenRequest):
    new_sequence = len(mock_tokens) + 12
    token = {
        "id": f"t-{new_sequence}", "token_display": f"#{new_sequence}",
        "patient_name": request.patient_name, "mrn": request.mrn or f"MRN-{new_sequence * 1000}",
        "department": request.department, "cabin": "Cabin 104", "doctor": "Dr. Sarah Jenkins, MD",
        "priority": request.priority, "status": "waiting", "estimated_wait_mins": 0,
        "chief_complaint": request.chief_complaint or "General consultation",
    }
    mock_tokens.append(token)
    _recalculate_waits(token["cabin"])
    return {"status": "success", "token": token}


@router.post("/emergency-arrivals")
async def register_emergency_arrival(request: EmergencyArrivalRequest):
    active_index = next((
        index for index, token in enumerate(mock_tokens)
        if token["cabin"] == request.cabin and token["status"] == "in_consultation"
    ), -1)
    reserve_used_before = _active_emergency_count(request.cabin)
    emergency_number = sum(token["priority"] == "emergency" for token in mock_tokens) + 1
    token = {
        "id": f"em-{uuid.uuid4().hex[:8]}", "token_display": f"E-{emergency_number:02d}",
        "patient_name": request.patient_name, "patient_uid": request.patient_uid,
        "mrn": request.patient_uid or "Emergency registration pending", "department": "Cardiology",
        "cabin": request.cabin, "doctor": "Dr. Sarah Jenkins, MD", "priority": "emergency",
        "status": "waiting", "estimated_wait_mins": 0, "chief_complaint": request.chief_complaint,
        "is_emergency_overflow": reserve_used_before >= EMERGENCY_RESERVE_PER_SLOT,
        "arrived_at": datetime.utcnow().isoformat(),
    }
    insertion_index = active_index + 1 if active_index >= 0 else 0
    mock_tokens.insert(insertion_index, token)
    affected_tokens = _recalculate_waits(request.cabin)
    event = {
        "id": str(uuid.uuid4()), "event_type": "emergency_inserted", "emergency_token_id": token["id"],
        "cabin": request.cabin,
        "inserted_after": mock_tokens[insertion_index - 1]["token_display"] if insertion_index else None,
        "reserve_used_before": reserve_used_before, "is_overflow": token["is_emergency_overflow"],
        "affected_tokens": affected_tokens, "created_at": datetime.utcnow().isoformat(),
    }
    queue_events.append(event)
    return {
        "status": "success", "token": token, "event": event, "tokens": _queue_snapshot(request.cabin),
        "emergency_reserve": {"capacity": EMERGENCY_RESERVE_PER_SLOT, "used": reserve_used_before + 1},
    }


@router.post("/tokens/{token_id}/call")
async def call_token(token_id: str):
    token = _find_token(token_id)
    if any(item["status"] == "in_consultation" and item["id"] != token_id for item in mock_tokens):
        raise HTTPException(status_code=409, detail="Complete the current consultation before calling another patient")
    token["status"] = "in_consultation"
    token["called_at"] = datetime.utcnow().isoformat()
    _recalculate_waits(token["cabin"])
    return {"status": "success", "token": token, "tokens": _queue_snapshot(token["cabin"])}


@router.post("/tokens/{token_id}/hold")
async def hold_token(token_id: str):
    token = _find_token(token_id)
    if token["status"] in {"completed", "cancelled"}:
        raise HTTPException(status_code=409, detail="Completed tokens cannot be placed on hold")
    token["status"] = "hold"
    affected_tokens = _recalculate_waits(token["cabin"])
    return {
        "status": "success", "token": token, "tokens": _queue_snapshot(token["cabin"]),
        "affected_tokens": affected_tokens,
    }


@router.post("/tokens/{token_id}/resume")
async def resume_token(token_id: str):
    token = _find_token(token_id)
    if token["status"] != "hold":
        raise HTTPException(status_code=409, detail="Only held tokens can be resumed")
    token["status"] = "waiting"
    affected_tokens = _recalculate_waits(token["cabin"])
    return {
        "status": "success", "token": token, "tokens": _queue_snapshot(token["cabin"]),
        "affected_tokens": affected_tokens,
    }


@router.post("/tokens/{token_id}/complete")
async def complete_token(token_id: str):
    token = _find_token(token_id)
    if token["status"] not in {"in_consultation", "hold"}:
        raise HTTPException(status_code=409, detail="Only in-consultation or held tokens can be completed")
    token["status"] = "completed"
    token["completed_at"] = datetime.utcnow().isoformat()
    next_token = next((item for item in _queue_snapshot(token["cabin"]) if item["status"] == "waiting"), None)
    if next_token is not None:
        next_token["status"] = "in_consultation"
        next_token["called_at"] = datetime.utcnow().isoformat()
    _recalculate_waits(token["cabin"])
    return {
        "status": "success", "completed_token": token, "next_token": next_token,
        "tokens": _queue_snapshot(token["cabin"]),
    }


@router.post("/tokens/{token_id}/visit")
async def save_consultation(token_id: str, request: ConsultationRequest):
    token = _find_token(token_id)
    visit = {
        "id": str(uuid.uuid4()), "token_id": token_id, "patient_name": token["patient_name"],
        "symptoms": request.symptoms, "diagnosis": request.diagnosis,
        "vitals": {
            "blood_pressure": request.blood_pressure, "pulse": request.pulse,
            "temperature": request.temperature, "oxygen_saturation": request.oxygen_saturation,
        },
        "prescriptions": request.prescriptions, "lab_orders": request.lab_orders,
        "created_at": datetime.utcnow().isoformat(),
    }
    clinical_visits.append(visit)
    return {"status": "success", "visit": visit}


@router.post("/call-next")
async def call_next_token(cabin: str = "Cabin 104"):
    if any(token["cabin"] == cabin and token["status"] == "in_consultation" for token in mock_tokens):
        raise HTTPException(status_code=409, detail="Complete the current consultation before calling another patient")
    next_token = next(
        (item for item in _queue_snapshot(cabin) if item["status"] == "waiting"), None,
    )
    if next_token is None:
        raise HTTPException(status_code=404, detail="No waiting tokens in this cabin queue")
    next_token["status"] = "in_consultation"
    next_token["called_at"] = datetime.utcnow().isoformat()
    _recalculate_waits(cabin)
    return {"status": "success", "token": next_token, "tokens": _queue_snapshot(cabin)}


@router.get("/events")
async def get_queue_events(cabin: str = "Cabin 104"):
    return {"status": "success", "events": [event for event in queue_events if event["cabin"] == cabin]}
