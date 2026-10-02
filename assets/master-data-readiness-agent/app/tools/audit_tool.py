"""Audit Trail Tool — persists every agent action and user decision to the CAP audit service."""

import logging
import os
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

import httpx
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

CAP_AUDIT_SERVICE_URL = os.environ.get("CAP_AUDIT_SERVICE_URL", "http://localhost:4004")

VALID_ACTION_TYPES = {
    "CHECKLIST_RETRIEVED",
    "STEP_VALIDATED",
    "FORM_SUBMITTED",
    "WRITE_EXECUTED",
    "WRITE_FAILED",
    "STEP_DECLARED_COMPLETE",
    "EVIDENCE_ATTACHED",
    "READINESS_DECLARED",
    "STEP_CANCELLED",
    "STEP_BLOCKED",
}


@tool
def audit_persist_event(
    object_id: str,
    action_type: str,
    actor: str,
    status: str,
    step_id: Optional[str] = None,
    evidence_ref: Optional[str] = None,
    error_detail: Optional[str] = None,
    field_values: Optional[dict] = None,
    timestamp: Optional[str] = None,
) -> dict:
    """Persist an audit trail event to the CAP readiness audit service.

    Every state transition in a readiness session must be recorded via this tool.
    READINESS_DECLARED events are immutable and must never be overwritten.

    Args:
        object_id: The SAP object ID (material number, plant code, or BP number).
        action_type: Event type — must be one of the defined VALID_ACTION_TYPES.
        actor: User ID of the person who triggered this event.
        status: New step status after this event.
        step_id: Checklist step identifier (optional for session-level events).
        evidence_ref: BTP Object Store blob URL for evidence attachments.
        error_detail: Error message for WRITE_FAILED events.
        field_values: Field name → value dict for WRITE_EXECUTED and FORM_SUBMITTED events.
        timestamp: ISO 8601 UTC timestamp (defaults to current time if not provided).

    Returns:
        dict with event_id and timestamp on success, or error details on failure.
    """
    if action_type not in VALID_ACTION_TYPES:
        raise ValueError(
            f"Invalid action_type '{action_type}'. Must be one of {sorted(VALID_ACTION_TYPES)}."
        )

    event_id = str(uuid4())
    ts = timestamp or datetime.now(timezone.utc).isoformat()

    payload = {
        "ID": event_id,
        "objectId": object_id,
        "stepId": step_id,
        "actionType": action_type,
        "actor": actor,
        "timestamp": ts,
        "status": status,
        "evidenceRef": evidence_ref,
        "errorDetail": error_detail,
        "fieldValuesJson": str(field_values) if field_values else None,
        "isImmutable": action_type == "READINESS_DECLARED",
    }

    logger.info(
        "Persisting audit event: object=%s step=%s action=%s status=%s",
        object_id, step_id, action_type, status,
    )

    try:
        response = httpx.post(
            f"{CAP_AUDIT_SERVICE_URL}/odata/v4/ReadinessService/ReadinessAuditEvents",
            json=payload,
            timeout=10.0,
        )
        response.raise_for_status()
        return {"event_id": event_id, "timestamp": ts}
    except httpx.RequestError as exc:
        # Audit failures are logged but do not block the workflow
        logger.error("Failed to persist audit event: %s", exc)
        return {"event_id": event_id, "timestamp": ts, "warning": f"Audit persistence failed: {exc}"}
    except httpx.HTTPStatusError as exc:
        logger.error("Audit service returned HTTP %s: %s", exc.response.status_code, exc.response.text)
        return {"event_id": event_id, "timestamp": ts, "warning": f"Audit service error: {exc.response.status_code}"}
