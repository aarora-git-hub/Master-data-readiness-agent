# Specification: master-data-readiness-agent

> **Guidelines**: Read all applicable guidelines before executing ANY tasks below:
> - [guidelines.md](../guidelines.md) — Universal execution rules
> - [guidelines-agent.md](../guidelines-agent.md) — Universal agent patterns
> - [guidelines-agent-python.md](../guidelines-agent-python.md) — Python implementation details
> - [guidelines-agent-skills.md](../guidelines-agent-skills.md) — Runtime skills patterns
> - [guidelines-agent-mcp.md](../guidelines-agent-mcp.md) — MCP integration patterns

---

## Basic Setup

- [ ] Read `product-requirements-document.md` at the solution root as the authoritative input
- [ ] Bootstrap agent code in `assets/master-data-readiness-agent/` using the `sap-agent-bootstrap` skill (invoke from inside `assets/master-data-readiness-agent/`, use copy commands — do NOT create files manually)
- [ ] Install dependencies, validate the agent starts and responds at `/.well-known/agent.json`

---

## Runtime Skills

This agent requires runtime skills — the checklist logic, validation rules, and persona-specific instructions are too complex for the system prompt alone.

- [ ] Create `assets/master-data-readiness-agent/app/skills/checklist-orchestration/SKILL.md` with:
  - YAML frontmatter: `name: checklist-orchestration`, `description: Orchestrates the full setup checklist lifecycle for a master data object — retrieval, validation, guided data entry, dependency resolution, and readiness declaration`
  - Instructions covering:
    - Object context classification (Material / Plant / Customer-BP; plant type; material type; account group)
    - Checklist retrieval via `rag_retrieve_checklist` tool
    - Step classification logic (System Verified / Gap Identified / Not Verifiable)
    - Dependency chain evaluation (check grounding doc for explicit dependencies before marking Blocked)
    - Final cross-check logic and readiness declaration conditions

- [ ] Create `assets/master-data-readiness-agent/app/skills/checklist-orchestration/references/step-statuses.md` with:
  - Full step status reference table (all 11 statuses: Pending, System Verified, Gap—Action Required, Needs Input, Written+Confirmed, User Confirmed, User Confirmed with Evidence, Failed, Blocked, Cancelled by User, TR Required)
  - Transition rules: which statuses can transition to which

- [ ] Create `assets/master-data-readiness-agent/app/skills/checklist-orchestration/references/fiori-link-map.json` with:
  - JSON mapping of standard operational/master data table names to Fiori Semantic Object + Action pairs
  - Include entries for: pricing condition tables (A004, A005, etc. → `ConditionRecord-manage`), TSW location master (`TSWLocation-maintain`), material master views (`Material-maintain`)
  - Include `transactionCode` fallback field for tables with no Fiori app
  - Include `tableCategory` field: `"operational"` or `"transport-managed"` for each entry

- [ ] Create `assets/master-data-readiness-agent/app/skills/write-orchestration/SKILL.md` with:
  - YAML frontmatter: `name: write-orchestration`, `description: Guides the user through the data entry and write flow for Z/Y custom tables and BRFplus decision rules`
  - Instructions covering:
    - How to retrieve field definitions for a target Z/Y table / BRFplus rule (via `s4_write_custom_table` metadata call)
    - Mandatory / optional field labelling rules
    - Pre-population logic for context fields (material number, plant, company code, sales org inferred from object context)
    - Form validation: block submit if mandatory fields are empty; show field-level error messages
    - Pre-confirmation summary: show full record before executing write
    - Immediate write execution upon final confirmation (before moving to next step)
    - Write failure handling: mark step Failed, pause, present "Resolve Now" vs "Skip for Now" options
    - Dependency check: if grounding doc declares failed step as dependency of subsequent step, mark subsequent step Blocked

- [ ] Create `assets/master-data-readiness-agent/app/skills/audit-trail/SKILL.md` with:
  - YAML frontmatter: `name: audit-trail`, `description: Persists every agent action, validation result, user decision, and evidence reference to the CAP audit service`
  - Instructions covering:
    - Which events must be recorded: checklist retrieved, step validated, form submitted, write executed, write failed, step declared complete, evidence attached, readiness declared
    - Payload structure for each event type: `object_id`, `step_id`, `action_type`, `actor`, `timestamp`, `status`, `evidence_ref` (optional)
    - How to call `audit_persist_event` tool
    - Immutability rule: Operational Readiness Declaration events must never be overwritten

---

## Project-Specific Tasks

### R01 — Context-Aware Checklist Retrieval

- [ ] Implement `rag_retrieve_checklist` tool wrapper in `app/tools/rag_tool.py`:
  - Accepts: `object_type` (MATERIAL / PLANT / CUSTOMER_BP), `object_id`, `plant_type` (OWN / THIRD_PARTY / IN_TRANSIT, optional), `material_type` (optional), `account_group` (optional), `persona` (PRICING_ANALYST / LOGISTICS_COORDINATOR / CONTRACT_ADMIN / ACCOUNTING_CONTROLLING / GOVERNANCE_OWNER)
  - Constructs a `user_query` string combining all context attributes
  - POSTs to AI Core RAG endpoint: `https://api.ai.intprod-eu12.eu-central-1.aws.ml.hana.ondemand.com/v2/inference/deployments/db116ec41033908a/completion`
  - Reads Bearer token from environment variable `AICORE_RAG_TOKEN` — never hardcodes credentials
  - Returns structured checklist (list of steps with: `step_id`, `step_name`, `persona`, `step_type` [CUSTOM_TABLE / BRFPLUS / OPERATIONAL_TABLE / CONFIG_TABLE / SPRO], `dependency_ids` [], `description`)
  - On empty or error response: raises exception with clear message — agent halts and informs user; never proceeds with empty checklist
  - Latency must be within 30 seconds

- [ ] Add context ambiguity detection in `app/agent.py`:
  - If `plant_type`, `material_type`, or `account_group` is required but not provided, agent asks clarifying question before calling `rag_retrieve_checklist`
  - Emit milestone log on completion: `[M1.achieved]: checklist retrieved for object={object_id} type={object_type} persona={persona} steps={step_count}`
  - Emit milestone log on failure: `[M1.missed]: checklist retrieval failed or returned empty for object={object_id} reason={error}`

### R02 — Automated Step Validation via S/4HANA APIs

- [ ] Implement `s4_read_business_partner` tool wrapper in `app/tools/s4_tools.py`:
  - Validates BP/customer master data completeness via `API_BUSINESS_PARTNER` OData
  - Checks: BP category, account group, partner functions, payment terms assignment
  - Returns: `step_id`, `status` (SYSTEM_VERIFIED / GAP_IDENTIFIED), `verified_entity`, `api_source`, `missing_fields` []

- [ ] Implement `s4_read_material` tool wrapper in `app/tools/s4_tools.py`:
  - Validates material master view completeness via `API_PRODUCT_SRV` OData
  - Checks: relevant material views (Basic Data, Sales, Purchasing, MRP, Accounting, Costing) for the given material and plant
  - Returns: `step_id`, `status`, `verified_entity`, `api_source`, `missing_fields` []

- [ ] Implement `s4_read_plant_config` tool wrapper in `app/tools/s4_tools.py`:
  - Reads plant org assignments and standard SPRO config tables (T001W, TVKO, TVKWZ, TOVAK) via released CDS views / `CE_PLANT_0001`
  - Classifies each step:
    - Entry present → `SYSTEM_VERIFIED`
    - Entry missing, table is operational → `GAP_IDENTIFIED` (operational)
    - Entry missing, table is transport-managed → `GAP_IDENTIFIED` (TR required)
    - CDS view not available for table → `NOT_VERIFIABLE`
  - Returns: `step_id`, `status`, `table_name`, `table_category` (operational / transport-managed), `missing_entry`, `api_source`

- [ ] Implement `s4_read_credit_management` tool wrapper in `app/tools/s4_tools.py`:
  - Validates credit limit and risk class for new customer via `API_CRDTMBUSINESSPARTNER`
  - Returns: `step_id`, `status`, `verified_entity`, `api_source`, `missing_fields` []

- [ ] Implement `s4_resolve_fiori_link` tool in `app/tools/fiori_link_tool.py`:
  - Accepts: `table_name`, `object_context` (dict with plant, company_code, sales_org, material, etc.)
  - Looks up `fiori-link-map.json` from the `checklist-orchestration` skill
  - Returns: `fiori_url` (constructed Semantic Object + Action deep link with pre-filled params) or `transaction_code` fallback if no Fiori app exists, plus `table_category`

- [ ] Add validation orchestration in `app/agent.py`:
  - After checklist retrieved, validate all steps in parallel where no dependency exists
  - On API call failure: mark step `NOT_VERIFIABLE (API Error)`, continue with remaining steps
  - Emit milestone log on completion: `[M2.achieved]: validation complete for object={object_id} verified={n} gaps={n} not_verifiable={n}`
  - Emit milestone log on failure: `[M2.missed]: validation incomplete for object={object_id} pending_steps={n} reason={error}`

### R03 — Guided Data Entry and Human-Approved Writes

- [ ] Implement `s4_write_custom_table` tool wrapper in `app/tools/write_tools.py`:
  - Accepts: `table_name`, `fields` (dict of field_name → value), `object_context`
  - First call with `mode=metadata`: returns field definitions (name, label, type, mandatory/optional, default_value) — used to build the entry form
  - Second call with `mode=write`: executes record creation via custom Z/Y table RAP service endpoint
  - Returns on success: `record_id`, `table_name`, `fields_written`, `timestamp`
  - Returns on failure: `error_code`, `error_message`, `table_name`
  - Note: RAP service endpoints are provided by the S/4HANA development team; use placeholder endpoint URL configurable via environment variable `S4_CUSTOM_TABLE_RAP_URL`

- [ ] Implement `s4_write_brfplus_rule` tool wrapper in `app/tools/write_tools.py`:
  - Accepts: `rule_name`, `fields` (dict), `object_context`
  - First call with `mode=metadata`: returns field definitions for BRFplus decision table row
  - Second call with `mode=write`: executes row creation via BRFplus RAP service
  - Returns on success: `rule_name`, `row_id`, `fields_written`, `timestamp`
  - Returns on failure: `error_code`, `error_message`, `rule_name`
  - Note: RAP service endpoint configurable via environment variable `S4_BRFPLUS_RAP_URL`

- [ ] Add write orchestration logic in `app/agent.py`:
  - For each Gap Identified step of type CUSTOM_TABLE or BRFPLUS:
    - Call tool with `mode=metadata` to get field definitions
    - Present form to user (via Fiori app API — agent returns structured form definition JSON)
    - Validate: block submission if mandatory fields empty
    - Show record summary and request final confirmation
    - On confirmation: call tool with `mode=write` immediately (before next step)
    - On write success: mark step Written+Confirmed, proceed to next step
    - On write failure: mark step Failed, pause and present two options (Resolve Now / Skip for Now)
    - Check grounding doc for dependency: if failed step is declared dependency of subsequent step, mark subsequent step Blocked
  - Emit milestone log: `[M3.achieved]: data entry forms presented for object={object_id} forms={n} total_fields={n}`
  - Emit milestone log on failure: `[M3.missed]: data entry form generation incomplete for object={object_id} failed_steps={step_ids}`

### R04 — Standard Table Gap Detection with Guided Task Cards

- [ ] Add task card generation logic in `app/agent.py`:
  - For each Gap Identified step of type OPERATIONAL_TABLE:
    - Call `s4_resolve_fiori_link` to get Fiori deep link or transaction code fallback
    - Return structured task card JSON: `{step_id, table_name, missing_entry, business_impact, fiori_url, transaction_code_fallback, table_category: "operational", actions: ["mark_complete", "attach_evidence"]}`
  - For each Gap Identified step of type CONFIG_TABLE (transport-managed):
    - Return structured task card JSON: `{step_id, table_name, missing_entry, business_impact, instruction: "Complete in DEV system and transport to production via Transport Request", table_category: "transport-managed", actions: ["mark_complete", "attach_evidence"]}`
  - On "Mark as Complete": update step status to USER_CONFIRMED, call `audit_persist_event`
  - On "Attach Evidence": store evidence reference (BTP Object Store blob URL) in audit event, update step status to USER_CONFIRMED_WITH_EVIDENCE

### R05 — SPRO Step Self-Declaration

- [ ] Add SPRO self-declaration handling in `app/agent.py`:
  - For each step of type SPRO (Not Verifiable):
    - Return task card JSON with plain-language explanation of why the step cannot be verified programmatically
    - Include: `{step_id, step_name, explanation, actions: ["mark_complete", "attach_evidence"]}`
  - On "Mark as Complete": update step status to USER_CONFIRMED, call `audit_persist_event`
  - On "Attach Evidence": store evidence reference, update step to USER_CONFIRMED_WITH_EVIDENCE

### R06 — Final Cross-Check and Operational Readiness Declaration

- [ ] Implement `perform_final_cross_check` function in `app/agent.py`:
  - Checks all steps are in a terminal status (SYSTEM_VERIFIED, USER_CONFIRMED, USER_CONFIRMED_WITH_EVIDENCE, WRITTEN_CONFIRMED, CANCELLED_BY_USER, FAILED_RESOLVED_INLINE, FAILED_RESOLVED_BATCH)
  - If any step remains in GAP_IDENTIFIED, PENDING, or BLOCKED: returns blocking items list, does not issue declaration
  - If all steps terminal: issues Operational Readiness Declaration with timestamp
  - Declaration summary includes:
    - Total steps, system verified count, user confirmed count, user confirmed with evidence count
    - Self-declared steps flagged for awareness (User Confirmed / User Confirmed with Evidence)
    - Failed → Manually Resolved steps flagged separately for governance transparency
  - Calls `audit_persist_event` with immutable declaration event
  - Emit milestone log: `[M5.achieved]: operational readiness declared for object={object_id} total_steps={n} self_declared={n} timestamp={ts}`
  - Emit milestone log on blocked: `[M5.missed]: readiness declaration blocked for object={object_id} blocking_steps={step_ids}`

### R07 — Full Audit Trail Persistence

- [ ] Implement `audit_persist_event` tool wrapper in `app/tools/audit_tool.py`:
  - Accepts: `object_id`, `step_id`, `action_type` (CHECKLIST_RETRIEVED / STEP_VALIDATED / FORM_SUBMITTED / WRITE_EXECUTED / WRITE_FAILED / STEP_DECLARED_COMPLETE / EVIDENCE_ATTACHED / READINESS_DECLARED / STEP_CANCELLED / STEP_BLOCKED), `actor`, `timestamp`, `status`, `evidence_ref` (optional), `error_detail` (optional), `field_values` (optional dict — for write events)
  - POSTs to CAP audit service endpoint (configurable via env var `CAP_AUDIT_SERVICE_URL`)
  - Returns: `event_id`, `timestamp`
  - All events are write-only; Operational Readiness Declaration events are flagged as immutable

- [ ] Ensure `audit_persist_event` is called at every state transition throughout `app/agent.py`:
  - After checklist retrieved (M1)
  - After each step is validated (M2)
  - After each form is submitted and each write is executed or failed (M3/M4)
  - After each "Mark as Complete" or "Attach Evidence" action (R04, R05)
  - After final cross-check and declaration (R06)
  - Emit milestone log: `[M4.achieved]: human confirmation complete for object={object_id} written={n} failed_resolved_inline={n} failed_resolved_batch={n} cancelled={n} self_declared={n}`
  - Emit milestone log on incomplete: `[M4.missed]: human confirmation incomplete for object={object_id} pending_forms={n} unresolved_failed={n}`

### CAP Backend Service

- [ ] Create CAP service in `assets/master-data-readiness-cap/`:
  - Define CDS entity `ReadinessAuditEvent` with fields: `ID` (UUID key), `objectId`, `stepId`, `actionType`, `actor`, `timestamp`, `status`, `evidenceRef`, `errorDetail`, `fieldValuesJson`, `isImmutable` (Boolean)
  - Define CDS entity `ReadinessSession` with fields: `ID` (UUID key), `objectId`, `objectType`, `persona`, `plantType`, `materialType`, `accountGroup`, `startedAt`, `declaredReadyAt`, `overallStatus`
  - Expose OData service `ReadinessService` with: `ReadinessAuditEvents` (read + create, no delete/update), `ReadinessSessions` (read + create + update)
  - Add `@readonly` annotation on `ReadinessAuditEvents` UPDATE and DELETE operations
  - Add index on `objectId` field for query performance
  - Implement `POST /audit-events` endpoint consumed by agent's `audit_persist_event` tool
  - Implement `GET /audit-events?objectId={id}` returning all events for an object in chronological order

### Fiori Application

- [ ] Create React + SAP UI5 Web Components app in `assets/master-data-readiness-ui/`:
  - Two-panel master-detail layout:
    - **Left panel (Checklist Navigator):** scrollable list of all steps with live status icons; click any step to load it in the right panel; progress counter badge; Failed/Blocked count badge with "View Failed Steps" link
    - **Right panel (Active Step Detail):** renders step content based on `step_type` and `status` (see PRD Step Detail Panel table)
  - **Header:** object ID, object type, persona label, overall progress bar (steps complete / total)
  - **Four tabs in right panel:**
    - `Active Step` — current step with all action controls
    - `All Steps` — full checklist table with filter/sort by status
    - `Failed Steps` — batch resolution view for all ❌ Failed steps
    - `Audit Trail` — full chronological event log for the current object (reads from CAP service)
  - Step card rendering by type:
    - `SYSTEM_VERIFIED`: read-only confirmation with API source and timestamp
    - `OPERATIONAL_TABLE` gap: table name, missing entry, business impact, Fiori deep link button (opens in new tab), transaction code fallback if no Fiori app, "Mark as Complete" + "Attach Evidence" buttons
    - `CONFIG_TABLE` gap: table name, missing entry, business impact, TR instruction banner, "Mark as Complete" + "Attach Evidence" buttons
    - `CUSTOM_TABLE` / `BRFPLUS`: structured form rendered from agent's field definition JSON — mandatory fields marked with *, optional fields labelled; Submit button disabled until all mandatory fields filled; pre-confirmation summary modal; final "Confirm & Submit" button
    - Write succeeded: success message with record details and "Next Step" button
    - Write failed: error detail with "Resolve Now — Mark as Complete" and "Skip for Now" buttons
    - `SPRO`: plain-language explanation, "Mark as Complete" + "Attach Evidence" buttons
    - `BLOCKED`: dependency explanation, link to blocking step in left panel, "View Failed Steps" tab shortcut
  - Failed Steps tab: lists all Failed steps with step name, error detail, "Mark as Complete" + "Attach Evidence" per step; resolve in any order
  - Embedded Joule assistant panel: collapsible chat panel docked bottom-right of right panel (toggled via 💬 button); does not drive workflow actions
  - Application entry point: supports deep link URL params `?objectId=&objectType=` for pre-filling
  - Role-based access: reads user persona from BTP user attributes; shows only persona-relevant steps by default (with "Show All" toggle)
  - Calls agent REST API for: session init, checklist retrieval, step status updates, write execution, readiness declaration
  - Calls CAP service directly for: audit trail reads

### Agent REST API (Backend for Frontend)

- [ ] Expose the following REST endpoints from the Python agent in `app/main.py`:
  - `POST /sessions` — create a new readiness session; accepts `{objectId, objectType, persona, plantType?, materialType?, accountGroup?}`; triggers checklist retrieval (M1) and validation (M2); returns session ID and classified checklist
  - `GET /sessions/{sessionId}` — get current session state including all step statuses
  - `POST /sessions/{sessionId}/steps/{stepId}/form-metadata` — get field definitions for a CUSTOM_TABLE or BRFPLUS step
  - `POST /sessions/{sessionId}/steps/{stepId}/submit` — submit form data and execute write; returns immediately after write attempt with success or failure
  - `POST /sessions/{sessionId}/steps/{stepId}/mark-complete` — mark a step as User Confirmed; accepts optional `evidenceRef`
  - `POST /sessions/{sessionId}/steps/{stepId}/skip` — skip a Failed step (Cancelled by User)
  - `POST /sessions/{sessionId}/declare-ready` — trigger final cross-check; returns declaration or blocking items list
  - `GET /sessions/{sessionId}/audit-trail` — proxy to CAP service audit events for this session's object

### Environment Variables

- [ ] Document all required environment variables in `assets/master-data-readiness-agent/README-ENV.md` (not a `.env` file — documentation only):
  - `AICORE_RAG_TOKEN` — Bearer token for AI Core RAG endpoint (read from BTP Credential Store at runtime)
  - `AICORE_RAG_ENDPOINT` — AI Core RAG endpoint URL (default: the endpoint from PRD)
  - `S4_CUSTOM_TABLE_RAP_URL` — Base URL for custom Z/Y table RAP services (provided by S/4HANA dev team)
  - `S4_BRFPLUS_RAP_URL` — Base URL for BRFplus decision table RAP services
  - `S4_ODATA_BASE_URL` — Base URL for S/4HANA OData services
  - `CAP_AUDIT_SERVICE_URL` — URL of the deployed CAP audit service

### Guardrails Implementation

- [ ] Implement guardrail checks in `app/agent.py`:
  - Before any write tool call: verify `human_approval_recorded=True` in session state; raise `GuardrailViolationError` if not
  - Before calling `rag_retrieve_checklist`: verify checklist is not already populated for this session (prevent duplicate retrieval)
  - On empty RAG response: raise `EmptyChecklistError` with user-facing message; do not proceed
  - On ambiguous context: pause and ask clarifying question before checklist retrieval
  - Write tool calls only permitted for CUSTOM_TABLE and BRFPLUS step types — never for CONFIG_TABLE or SPRO

---

## Business Instrumentation

- [ ] Implement business step instrumentation for all 5 milestones from the PRD:
  - M1: Checklist Retrieved
  - M2: Validation Complete
  - M3: Data Entry Forms Presented
  - M4: Human Confirmation Received
  - M5: Operational Readiness Declared
  - Each milestone emits structured log on both `achieved` and `missed` with the exact log patterns from the PRD
  - Each milestone wrapped in an OpenTelemetry span using the decorator form on regular async methods and context manager form inside non-generator async functions
  - Never use `with tracer.start_as_current_span(...)` inside `stream()` — extract business logic into `_run_agent()` helper and instrument that instead
- [ ] Verify `bootstrap(app)` is called after `app = server.build()` in `main.py`

---

## MCP Tool Integration

- [ ] All S/4HANA API interactions go through MCP tools — no direct HTTP clients for OData APIs
- [ ] Wire MCP tool loading in `agent.py` using `get_mcp_tools()` from the `mcp_tools` module
- [ ] Add MCP server dependencies to `asset.yaml` under `requires` for:
  - `API_BUSINESS_PARTNER` MCP server (ORD ID: discovered via `mcp-translation-file` skill from `sap.s4:apiResource:API_BUSINESS_PARTNER:v1`)
  - `API_PRODUCT_SRV` MCP server (ORD ID: discovered via `mcp-translation-file` skill from `sap.s4:apiResource:API_PRODUCT_SRV:v1`)
  - `CE_PLANT_0001` MCP server (ORD ID: discovered via `mcp-translation-file` skill from `sap.s4:apiResource:CE_PLANT_0001:v1`)
  - `API_CRDTMBUSINESSPARTNER` MCP server (ORD ID: discovered via `mcp-translation-file` skill from `sap.s4:apiResource:API_CRDTMBUSINESSPARTNER:v1`)
- [ ] Invoke `mcp-translation-file` skill for each of the four S/4HANA OData APIs listed above; save generated `translation.json` and `.tool-list.json` to `specification/master-data-readiness-agent/mcps/<api-name>/`
- [ ] Invoke `setup-solution` skill to register the generated MCP server assets
- [ ] Generate `mcp-mock.json` using `mcp-mock-config` skill after all MCP translation files are generated

---

## Testing

- [ ] `conftest.py` only sets `IBD_TESTING=true`
- [ ] Write unit tests in `assets/master-data-readiness-agent/tests/` — one per tool:
  - `test_rag_tool.py` — tests `rag_retrieve_checklist` with mock RAG response; tests empty response handling; tests auth header injection
  - `test_s4_tools.py` — tests each of the four S/4HANA read tools with mock OData responses; tests SYSTEM_VERIFIED, GAP_IDENTIFIED, and NOT_VERIFIABLE classification branches
  - `test_fiori_link_tool.py` — tests Fiori URL construction for operational tables; tests transaction code fallback; tests transport-managed table category assignment
  - `test_write_tools.py` — tests `s4_write_custom_table` metadata mode and write mode; tests `s4_write_brfplus_rule`; tests failure response handling
  - `test_audit_tool.py` — tests `audit_persist_event` with mock CAP service; tests each action type
  - `test_guardrails.py` — tests that write tools raise `GuardrailViolationError` when called without recorded human approval; tests empty checklist halt
- [ ] Write one integration test in `assets/master-data-readiness-agent/tests/test_integration.py`:
  - Mocks LLM (ChatLiteLLM), RAG endpoint, all S/4HANA OData APIs, CAP audit service
  - Exercises the full agent flow: session init → checklist retrieval (M1) → validation (M2) → form presentation (M3) → write execution → human confirmation (M4) → readiness declaration (M5)
  - Asserts all 5 milestone logs are emitted
  - Asserts audit events are persisted at each state transition
  - Tests must run fully offline
- [ ] Run `pytest` from `assets/master-data-readiness-agent/` — fix failures immediately
- [ ] Ensure coverage ≥ 70%; add targeted tests if below threshold
- [ ] Run `pytest` again (no args) to generate final `test_report.json`
- [ ] Verify `test_report.json` exists in `assets/master-data-readiness-agent/`
