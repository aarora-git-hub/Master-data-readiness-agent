# Step Status Reference

## Status Definitions

| Status | Icon | Meaning | Who Sets It |
|--------|------|---------|-------------|
| PENDING | ⏳ | Not yet validated | System (initial) |
| SYSTEM_VERIFIED | ✅ | Confirmed complete via S/4HANA API | Agent (automated) |
| GAP_ACTION_REQUIRED | ⚠️ | Missing entry; user action needed | Agent (after validation) |
| NEEDS_INPUT | ✏️ | Data entry form open, awaiting user | Agent (write flow) |
| WRITTEN_CONFIRMED | ✅ | Record created via RAP service | Agent (after write) |
| USER_CONFIRMED | ☑️ | Manually completed and declared by user | User |
| USER_CONFIRMED_WITH_EVIDENCE | ☑️📎 | Manually completed with evidence attached | User |
| FAILED | ❌ | Write attempted and failed; awaiting resolution | Agent (after failed write) |
| BLOCKED | 🔒 | Dependent on a Failed/non-terminal step per grounding doc | Agent |
| CANCELLED_BY_USER | ⏭️ | User skipped; no write attempted | User |
| TR_REQUIRED | 🚛 | Transport-managed config; must be done in DEV and moved via TR | Agent (classification) |

## Terminal Statuses (can trigger readiness declaration)

- SYSTEM_VERIFIED
- WRITTEN_CONFIRMED
- USER_CONFIRMED
- USER_CONFIRMED_WITH_EVIDENCE
- CANCELLED_BY_USER
- FAILED_RESOLVED_INLINE (Failed → resolved manually before moving on)
- FAILED_RESOLVED_BATCH (Failed → resolved in batch view)

## Non-Terminal Statuses (block readiness declaration)

- PENDING
- GAP_ACTION_REQUIRED
- NEEDS_INPUT
- FAILED (unresolved)
- BLOCKED

## Status Transition Rules

| From | To | Trigger |
|------|----|---------|
| PENDING | SYSTEM_VERIFIED | API confirms entry exists |
| PENDING | GAP_ACTION_REQUIRED | API confirms entry missing |
| PENDING | TR_REQUIRED | API confirms entry missing; table is transport-managed |
| PENDING | NOT_VERIFIABLE | No CDS view / API error |
| GAP_ACTION_REQUIRED | NEEDS_INPUT | User opens data entry form (CUSTOM_TABLE / BRFPLUS) |
| NEEDS_INPUT | WRITTEN_CONFIRMED | Write succeeds |
| NEEDS_INPUT | FAILED | Write fails |
| FAILED | FAILED_RESOLVED_INLINE | User marks complete before moving to next step |
| FAILED | FAILED_RESOLVED_BATCH | User marks complete in batch resolution view |
| FAILED | CANCELLED_BY_USER | User clicks "Skip for Now" (deferred) |
| GAP_ACTION_REQUIRED | USER_CONFIRMED | User clicks "Mark as Complete" (OPERATIONAL_TABLE / CONFIG_TABLE) |
| GAP_ACTION_REQUIRED | USER_CONFIRMED_WITH_EVIDENCE | User marks complete + attaches evidence |
| NOT_VERIFIABLE | USER_CONFIRMED | User self-declares SPRO step complete |
| NOT_VERIFIABLE | USER_CONFIRMED_WITH_EVIDENCE | User self-declares + attaches evidence |
| ANY non-terminal | BLOCKED | Dependency step is in non-terminal status |
| BLOCKED | (previous non-terminal) | Blocking step resolves to terminal status |
