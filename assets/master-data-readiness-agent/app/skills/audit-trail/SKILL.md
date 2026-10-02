---
name: audit-trail
description: Persists every agent action, validation result, user decision, and evidence reference to the CAP audit service
allowed-tools:
  - audit_persist_event
---

# Audit Trail Skill

## Purpose

Every state transition in a readiness session must be recorded in the CAP audit service. This skill defines what events to record, when to record them, and what payload each event must carry.

## Events to Record

| Event | action_type | When |
|-------|-------------|------|
| Checklist retrieved | CHECKLIST_RETRIEVED | After M1 completes successfully |
| Step validated | STEP_VALIDATED | After each step is classified (all statuses) |
| Form submitted | FORM_SUBMITTED | When user submits a data entry form (before write) |
| Write executed | WRITE_EXECUTED | After a successful write to Z/Y table or BRFplus |
| Write failed | WRITE_FAILED | After a failed write attempt |
| Step declared complete | STEP_DECLARED_COMPLETE | When user marks a step as User Confirmed |
| Evidence attached | EVIDENCE_ATTACHED | When user attaches evidence to a declaration |
| Readiness declared | READINESS_DECLARED | When Operational Readiness Declaration is issued |
| Step cancelled | STEP_CANCELLED | When user skips/cancels a step |
| Step blocked | STEP_BLOCKED | When a step is marked Blocked due to a dependency |

## Event Payload Structure

Call `audit_persist_event` with this payload for every event:

```json
{
  "object_id": "<SAP object ID — material number, plant code, or BP number>",
  "step_id": "<step identifier from the checklist>",
  "action_type": "<one of the action_types above>",
  "actor": "<user ID from the current session — never a service account>",
  "timestamp": "<ISO 8601 UTC timestamp>",
  "status": "<new step status after this event>",
  "evidence_ref": "<BTP Object Store blob URL — only for EVIDENCE_ATTACHED events>",
  "error_detail": "<error message — only for WRITE_FAILED events>",
  "field_values": {"field1": "value1", ...}  // only for WRITE_EXECUTED and FORM_SUBMITTED
}
```

## Immutability Rule

The `READINESS_DECLARED` event is **immutable**. Once written:
- It must never be overwritten, updated, or deleted
- The CAP service sets `isImmutable: true` on this record
- If the same object undergoes a second readiness session, a new declaration event is created — the previous one is retained

## Audit Trail Completeness Checklist

Before issuing the Operational Readiness Declaration, verify the audit trail contains at minimum:
- One CHECKLIST_RETRIEVED event for this session
- One STEP_VALIDATED event for every step in the checklist
- One WRITE_EXECUTED or WRITE_FAILED event for every CUSTOM_TABLE and BRFPLUS step
- One STEP_DECLARED_COMPLETE event for every USER_CONFIRMED and USER_CONFIRMED_WITH_EVIDENCE step
- One EVIDENCE_ATTACHED event for every USER_CONFIRMED_WITH_EVIDENCE step

If any of the above are missing, log a warning but do not block the declaration — completeness is audited after the fact, not enforced as a gate.
