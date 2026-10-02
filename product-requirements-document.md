# Product Requirements Document (PRD)

**Title:** Master Data Operational Readiness Agent
**Date:** 2026-10-01
**Owner:** Master Data Governance Owner
**Solution Category:** AI Agent

---

## Product Purpose & Value Proposition

**Elevator Pitch:**
When a new Material, Plant, or Customer is created in S/4HANA, a cascade of downstream setup steps must be completed across multiple systems and personas before that object is usable. Today those steps are missed, delayed, or undocumented. This agent finds them, validates them, executes the safe ones, and declares the object ready — with a full audit trail.

**Business Need:**
Post-creation setup knowledge is locked in unstructured Word/PDF documents stored in BTP Object Store. There is no automated mechanism to retrieve the right checklist for the right persona and context, validate completion against live S/4HANA data, or track what was done and by whom. The result is activation delays, processing errors, rework, and audit exposure.

**Expected Value:**
- Missed setup steps per object: from 2 → 0 within 3 months of go-live
- Days to declare an object operationally ready: from 2 days → 1 day within 3 months of go-live

**Product Objectives (Prioritized):**
1. Eliminate missed setup steps by retrieving context-specific checklists from grounded knowledge at runtime
2. Halve time-to-readiness by automating validation and safe write operations with human approval
3. Provide a full, tamper-evident audit trail for every setup action, approval, and evidence item

---

## Business Metrics

| Metric | Baseline | Target | Timeline | Process / Capability | Source |
|--------|----------|--------|----------|----------------------|--------|
| Missed setup steps per object | 2 | 0 | Within 3 months of go-live | Master Data Operational Readiness | user |
| Days to declare object operationally ready | 2 days | 1 day | Within 3 months of go-live | Master Data Operational Readiness | user |

---

## User Profiles & Personas

### Primary Persona: Pricing Analyst

Maria is a 34-year-old Pricing Analyst who manages condition tables and BRFplus pricing decision rules across hundreds of materials and customers. When a new material or customer is created, she must manually check whether pricing condition entries exist for every relevant combination. She currently works from a checklist in a Word document, cross-referencing multiple S/4HANA transactions. She misses steps when the document is out of date and has no way to prove she completed them. She needs a guided, validated workflow that tells her exactly what is missing and lets her fix it without leaving her working context.

### Secondary Persona: Logistics Coordinator

David is a 41-year-old Logistics Coordinator responsible for ensuring new plants and materials are fully configured for goods movements. He deals with three plant types — own, third-party, and in-transit — each with different setup requirements for storage locations, shipping points, and loading groups. He frequently discovers missing configuration only when an order fails. He needs the agent to surface these gaps before the object goes live, not after the first exception.

### Other User Types

- **Contract Administrator** — validates that new customers/BPs are set up correctly for contract processing (account group, partner functions, payment terms).
- **Accounting / Controlling Specialist** — verifies cost centre assignments, profit centre, credit management limits for new customers/plants.
- **Master Data Governance Owner** — does not use the agent operationally but reviews the audit trail for compliance, governance sign-off, and audit preparation.

---

## User Goals & Tasks

### For Pricing Analyst / Logistics Coordinator / Contract Administrator / Accounting Specialist:

**Goals:**
- Know exactly which setup steps are required for the object they are responsible for, without reading documents
- Complete all required steps within one working day of object creation
- Have confidence that nothing has been missed before declaring the object ready

**Key Tasks:**
- Trigger the agent for a newly created Material, Plant, or Customer/BP
- Review the persona-specific checklist retrieved by the agent
- Inspect validation results (System Verified, Gap Identified, Not Verifiable)
- Approve or reject proposed in-line updates to Z/Y tables and BRFplus rules
- Self-declare SPRO configuration steps as complete, attaching evidence where available
- Confirm final operational readiness declaration

### For Master Data Governance Owner:

**Goals:**
- Maintain a complete, auditable record of every setup action across all objects
- Identify any self-declared steps that could not be independently verified

**Key Tasks:**
- Review audit trail entries for a given object
- Filter by step status (System Verified / User Confirmed / User Confirmed with Evidence)
- Flag unverified self-declarations for follow-up

---

## Product Principles

1. **Retrieve before reasoning:** The agent always grounds its checklist in the documents stored in BTP Object Store via the AI Core RAG endpoint — it never generates setup steps from model knowledge alone.
2. **Human-in-the-loop for every write:** No change to a Z/Y table or BRFplus rule is executed without explicit user approval. The agent proposes; the human decides.
3. **Read-only for standard config:** SPRO configuration steps are validated by reading released CDS views only. The agent never attempts transport-managed config changes programmatically.
4. **Transparency over blocking:** Self-declaration is always available. The agent tracks the declaration status (System Verified / User Confirmed / User Confirmed with Evidence) and surfaces unverified items — but does not block progress.
5. **Surface gaps, not instructions — with a clear distinction between operational and config tables:**
   - For **standard operational and master data tables** (e.g. pricing condition tables, TSW location master, material master views, and any other table referenced in the grounding document that can be maintained directly in production), the agent surfaces a structured task card with a Fiori deep link (or transaction code fallback) pre-filled with the object context. The user has a one-click path to resolve the gap in production immediately.
   - For **SPRO / transport-managed configuration tables** (e.g. T001W, TVKO, TVKWZ, TOVAK), the agent surfaces the gap as an outstanding task — but does not provide a direct production maintenance link, since these changes must be performed in the DEV system and transported to production via a Transport Request (TR). The task card makes this requirement explicit so the user knows what is expected of them.
6. **Audit by design:** Every recommendation, validation result, approval, rejection, and evidence attachment is persisted from the first interaction. The audit trail is not an afterthought.

---

## Goals and Non-Goals

### Goals (In Scope)

- Retrieve persona- and context-specific setup checklists from documents in BTP Object Store via the existing AI Core RAG endpoint
- Validate each checklist step against live S/4HANA OData/CDS services (Business Partner, Product Master, Plant Config, Credit Management, SPRO config tables)
- Propose and execute (post-approval) safe in-line updates to custom Z/Y tables and BRFplus decision rules via custom RAP services
- Support self-declaration of SPRO configuration steps with optional evidence attachment
- Run a final cross-check and issue an operational readiness declaration
- Persist a full audit trail in a CAP-backed custom service

### Non-Goals (Out of Scope)

- Programmatic writes to SPRO / transport-managed standard SAP configuration
- Authoring, uploading, or maintaining grounding documents in BTP Object Store (responsibility of Master Data Governance Owner)
- Creation of the master data objects themselves (Material, Plant, Customer/BP) — the agent is triggered after creation
- Automated rotation or management of the AI Core Bearer token (handled by BTP Credential Store operations)

---

## Requirements

### Must-Have Requirements

**R01: Context-Aware Checklist Retrieval**

- **Problem to Solve:** Users do not know which setup steps apply to the specific object they just created. The answer varies by object type, plant type, material type, and customer account group.
- **User Story:** As a persona-aligned user, I need the agent to query the AI Core RAG endpoint with the object's context so that I receive only the setup steps relevant to my role and this specific object.
- **Acceptance Criteria:**
  - Given a newly created object with known type and context attributes, when the agent is triggered, then it returns a checklist scoped to the correct persona(s) and context within 30 seconds.
  - Given an ambiguous context, when the agent cannot determine a required attribute, then it asks the user to clarify before proceeding.
- **Maps to Objective:** Objective 1
- **Priority Rank:** 1

**R02: Automated Step Validation via S/4HANA APIs**

- **Problem to Solve:** Users manually verify setup completion by checking multiple S/4HANA transactions. This is slow, error-prone, and leaves no trace.
- **User Story:** As a user, I need the agent to read the relevant S/4HANA services and classify each checklist step as System Verified, Gap Identified, or Not Verifiable so that I can focus my time on the gaps rather than the confirmations.
- **Acceptance Criteria:**
  - Given a retrieved checklist, when the agent validates each step, then every step is classified with one of three statuses: System Verified, Gap Identified, or Not Verifiable (SPRO).
  - Given a System Verified step, when displayed to the user, then no action is required and the step is marked complete automatically.
- **Maps to Objective:** Objectives 1 and 2
- **Priority Rank:** 2

**R03: Guided Data Entry and Human-Approved Writes (Z/Y Tables and BRFplus)**

- **Problem to Solve:** Users must manually create records in custom Z/Y tables and BRFplus decision tables through separate transactions, with no guidance on which fields are required, what values are valid, or what the record should look like for the object in question.
- **User Story:** As a user, I need the agent to present me with a structured data entry form — listing all fields for the target table or BRFplus rule with mandatory/optional labels — so that I can provide the correct values, review my entries, and confirm the write, without ever needing to navigate to a separate transaction.
- **Acceptance Criteria:**
  - Given a Gap Identified step for a writable Z/Y table or BRFplus decision rule, when the agent surfaces the entry form, then it lists all relevant fields for that table/rule with a clear mandatory/optional label against each field, pre-populated where the value can be inferred from the object context (e.g. material number, plant, company code).
  - Given the entry form is presented, when the user submits without filling all mandatory fields, then the agent highlights the missing mandatory fields and does not proceed until they are provided.
  - Given the user has filled all mandatory fields, when they confirm the submission, then the agent displays a summary of the record to be created and requests a final explicit confirmation before executing the write.
  - Given a final confirmation, when the agent executes the write, then the record is created immediately via the custom RAP service — before the agent moves to the next step — and the event is recorded in the audit trail with: table/rule name, all field values submitted, actor, and timestamp.
  - Given the write succeeds, when the agent records the outcome, then the step is marked Written + Confirmed and the agent proceeds to the next step.
  - Given the write fails (RAP service error, validation rejection, or timeout), when the agent records the outcome, then the step is marked Failed with the error detail and the agent pauses on that step — presenting the user with two explicit options: (a) **Resolve now** — complete the step manually outside the agent and mark it as complete (with optional evidence) before the agent proceeds to the next step; or (b) **Skip for now** — leave the step as Failed and continue to the next step, with the option to resolve all Failed steps together later in a batch resolution view. Unless the grounding document explicitly declares this step as a dependency of a subsequent step, in which case the dependent step is additionally marked Blocked and surfaced to the user regardless of which option is chosen.
  - Given one or more steps are in Failed status at any point in the session, when the user chooses to resolve them, then the agent presents all Failed steps together in a single resolution view so the user can complete them as a batch — they are not required to resolve failures inline before continuing.
  - Given a user manually completes a Failed step outside the agent, when they return and mark it complete, then the step status updates to User Confirmed (or User Confirmed with Evidence if evidence is attached) and the resolution is recorded in the audit trail.
  - Given a user cancellation at any point before final confirmation, when the cancellation is recorded, then the step is marked Cancelled by User and no write is attempted.
- **Maps to Objective:** Objectives 1 and 2
- **Priority Rank:** 3

**R04: Standard Table Gap Detection with Guided Task Cards**

- **Problem to Solve:** When a required entry is missing from a standard S/4HANA table, the user has no guided path to resolve it. The correct resolution path differs depending on whether the table is an operational/master data table (maintainable directly in production) or a transport-managed configuration table (must be changed in DEV and moved to production via a Transport Request).
- **User Story:** As a user, I need the agent to surface a structured task card for every standard table gap it detects — with a resolution path that is appropriate to the table type — so that I know exactly what to do and where to do it.
- **Acceptance Criteria:**
  - Given a Gap Identified step for a **standard operational or master data table** (e.g. pricing condition table, TSW location master, material master view), when the agent surfaces the task card, then the card shows: the table name, the missing entry (key fields and expected value), the business impact, a Fiori deep link pre-filled with the relevant object context (plant, company code, sales org etc.), and a "Mark as Complete" button.
  - Given a Fiori app exists for the operational table, when the deep link is constructed, then it is pre-filled with the relevant object context so the user lands on the correct record.
  - Given no Fiori app is available for an operational table, when the task card is shown, then a transaction code is displayed as a fallback in place of the Fiori deep link.
  - Given a Gap Identified step for a **transport-managed SPRO configuration table** (e.g. T001W, TVKO, TVKWZ, TOVAK), when the agent surfaces the task card, then the card shows: the table name, the missing entry, the business impact, and a clear instruction that the change must be performed in the DEV system and transported to production via a Transport Request — no direct production maintenance link is provided.
  - Given the user clicks "Mark as Complete" on any task card type, when the step is confirmed, then the step status updates to User Confirmed and the event is recorded in the audit trail with timestamp and user ID.
  - Given the user attaches evidence when marking complete, when the declaration is saved, then the evidence reference is stored in the audit trail and the step status is set to User Confirmed with Evidence.
- **Maps to Objective:** Objectives 1 and 2
- **Priority Rank:** 4

**R05: SPRO Step Self-Declaration**

- **Problem to Solve:** Some SPRO configuration steps cannot be validated programmatically at all (no released CDS view covers the resulting config). These steps must still be tracked and declared.
- **User Story:** As a user, I need to self-declare SPRO configuration steps as complete (with or without attaching evidence) so that these steps are tracked in the audit trail even when programmatic verification is not possible.
- **Acceptance Criteria:**
  - Given a Not Verifiable step, when the agent presents it to the user, then the user can mark it as User Confirmed or User Confirmed with Evidence.
  - Given a User Confirmed with Evidence declaration, when the user attaches a document or screenshot, then the evidence reference is stored in the audit trail alongside the declaration.
- **Maps to Objective:** Objective 1
- **Priority Rank:** 5

**R06: Final Cross-Check and Operational Readiness Declaration**

- **Problem to Solve:** There is no single, unambiguous signal that all required setup steps are done. Users rely on memory or manual checklists to decide when an object is ready.
- **User Story:** As a user, I need the agent to run a final cross-check across all checklist steps and declare the object operationally ready when all steps are System Verified or User Confirmed so that I have a single, trustworthy readiness signal.
- **Acceptance Criteria:**
  - Given all checklist steps are in a terminal status (System Verified, User Confirmed, or User Confirmed with Evidence), when the agent runs the final cross-check, then it issues an Operational Readiness Declaration with timestamp.
  - Given one or more steps remain in Gap Identified, pending, or Blocked status, when the final cross-check is requested, then the agent lists the blocking items and does not issue a declaration.
  - Given any self-declared steps (User Confirmed or User Confirmed with Evidence), when the declaration is issued, then the summary surfaces those steps for awareness without blocking the declaration.
  - Given any steps that were Failed and resolved via manual user confirmation, when the declaration is issued, then the summary flags those steps separately (Failed → Manually Resolved) for governance transparency.
- **Maps to Objective:** Objectives 1 and 2
- **Priority Rank:** 6

**R07: Full Audit Trail Persistence**

- **Problem to Solve:** There is currently no record of what setup steps were taken, by whom, when, and on what basis. This creates governance and audit exposure.
- **User Story:** As a Master Data Governance Owner, I need a complete, queryable audit trail of every agent recommendation, validation result, user approval/rejection, self-declaration, and evidence attachment so that I can satisfy internal governance reviews and external audit requirements.
- **Acceptance Criteria:**
  - Given any agent action or user decision, when it occurs, then a record is written to the CAP-backed audit trail service with: object ID, step ID, action type, actor, timestamp, status, and evidence reference (if applicable).
  - Given the audit trail, when a governance owner queries by object ID, then all events for that object are returned in chronological order.
- **Maps to Objective:** Objective 3
- **Priority Rank:** 6

---

## Non-Functional Requirements

### Performance
- **Latency:** Checklist retrieval (RAG call) completes within 30 seconds; S/4HANA validation for a full checklist (up to 20 steps) completes within 60 seconds.
- **Throughput:** The agent must support concurrent sessions for at least 10 users simultaneously.

### Reliability
- **Availability:** Agent available during business hours (aligned with SAP Build Work Zone SLA).
- **Fallback:** If the RAG endpoint is unavailable, the agent informs the user and does not proceed with an empty checklist. If an S/4HANA API call fails, the step is marked Not Verifiable (API Error) and the user is notified.

### Explainability
- **Traceability:** Every validation result references the specific S/4HANA API call and entity checked.
- **Decision Logging:** All agent decisions, proposals, approvals, and rejections are logged in the audit trail.
- **Uncertainty Communication:** Steps where the agent cannot determine a clear result are surfaced as Not Verifiable with a plain-language explanation.

---

## Solution Architecture

**Architecture Overview:**
A Python A2A agent deployed on SAP BTP, fronted by a dedicated Fiori application (React + SAP UI5 Web Components) surfaced as a tile in SAP Build Work Zone. The Fiori app is the primary user interface — it calls the agent's backend API for all AI orchestration, which in turn calls the AI Core RAG endpoint for knowledge retrieval, wraps S/4HANA OData APIs as custom MCP tools for read/write operations, and persists all activity to a CAP-backed audit service. A collapsible Joule assistant panel is embedded in the Fiori app for contextual help. Principal propagation ensures the user's own S/4HANA identity is used for all API calls and audit records.

**Key Components:**

- **Fiori Application (React + SAP UI5 Web Components):** Primary user interface — two-panel master-detail layout with checklist navigator, active step detail, failed steps batch resolution, and audit trail tab. Surfaced as a tile in SAP Build Work Zone.
- **Python A2A Agent (BTP):** Orchestration engine; manages the checklist lifecycle, routes to tools, handles write execution and dependency logic, exposes a REST API consumed by the Fiori app.
- **AI Core RAG Tool:** Calls the deployed AI Core Document Grounding endpoint (BTP Object Store) to retrieve grounded, persona- and context-specific setup checklists.
- **S/4HANA Read Tools (MCP):** Custom MCP tool wrappers for Business Partner (API_BUSINESS_PARTNER), Product Master (API_PRODUCT_SRV), Plant Config (CE_PLANT_0001), and Credit Management (API_CRDTMBUSINESSPARTNER) OData APIs.
- **S/4HANA Write Tools (MCP):** Custom MCP tool wrappers for custom Z/Y table RAP services and BRFplus decision table RAP services (to be built by S/4HANA development team).
- **CAP Backend Service:** Node.js CAP service serving the Fiori app, persisting all audit trail events, step statuses, and evidence references, and proxying agent API calls.
- **Embedded Joule Assistant Panel:** Collapsible contextual help panel docked within the Fiori app — for grounding document lookups, field guidance, and natural language navigation. Does not drive workflow actions.

**Integration Points:**

- AI Core RAG Endpoint: POST `https://api.ai.intprod-eu12.eu-central-1.aws.ml.hana.ondemand.com/v2/inference/deployments/db116ec41033908a/completion` — input: `user_query`; auth: Bearer token from BTP Credential Store.
- S/4HANA OData APIs: read-only via released OData v2/v4 services; destination configured in BTP.
- Custom Z/Y Table RAP services: write via custom-built RAP endpoints; S/4HANA development team dependency.
- Custom BRFplus RAP services: write via custom-built RAP endpoints; S/4HANA development team dependency.

**Deployment Environments:**

- **Dev:** Full agent with mock S/4HANA responses; RAG endpoint used in test mode.
- **QA:** Connected to S/4HANA quality system; CAP audit service with isolated schema.
- **Prod:** Connected to S/4HANA production; BTP Credential Store for all secrets; audit trail write-protected.

---

### Agent Extensibility & Instrumentation

**Agent Extensibility:**
The agent is designed to be extended without core changes:
- **New object types** (e.g., Vendor, Cost Centre): add a new context classifier and corresponding RAG query template; no changes to the orchestration engine.
- **New personas:** add persona-scoped tool invocations; the HITL flow and audit trail are persona-agnostic.
- **New S/4HANA API tools:** register additional MCP tool wrappers; the agent discovers and invokes them via the tool registry.
- **New write targets:** expose additional Z/Y table or BRFplus RAP services as MCP tools; the proposal-and-approval loop handles them automatically.

**Business Step Instrumentation:**
All five milestones emit structured log statements at achievement and on miss/skip. Log pattern: `[MILESTONE_ID].[achieved|missed]: <description>`. These logs feed the agent's observability dashboard and enable SLA tracking against the business metrics targets.

---

### Automation & Agent Behaviour

**Automation Level:** Hybrid — autonomous for read/validate; human-approved for all writes and self-declarations.

**Actions the system performs without human approval:**
- Query the AI Core RAG endpoint to retrieve the setup checklist
- Read S/4HANA OData/CDS services to classify each step
- Read SPRO configuration tables to validate standard config steps
- Classify each step as System Verified, Gap Identified, or Not Verifiable
- Retrieve field definitions (with mandatory/optional labels) for a target Z/Y table or BRFplus rule to build the data entry form
- Run the final cross-check logic

**Actions that require human review or approval:**
- Present a guided data entry form for a Z/Y table or BRFplus rule gap, collect field values from the user, and request final confirmation before executing the write
- Execute any write to a custom Z/Y table via RAP service (only after user provides all mandatory fields and gives final confirmation)
- Execute any write to a BRFplus decision table via RAP service (only after user provides all mandatory fields and gives final confirmation)
- Mark a Not Verifiable step as User Confirmed or User Confirmed with Evidence
- Issue the final Operational Readiness Declaration

**Model / engine used:** SAP AI Core — existing Document Grounding (RAG) deployment; LLM used only for checklist retrieval and natural language reasoning, not for data writes.

**Knowledge & data sources accessed:**
- BTP Object Store: setup procedure documents (Word/PDF); maintained by Master Data Governance Owner.
- S/4HANA Business Partner OData API: customer/BP master data validation.
- S/4HANA Product Master OData API: material master data validation.
- S/4HANA Plant Config OData API + released CDS views: plant and SPRO config validation.
- S/4HANA Credit Management OData API: credit limit and risk class validation.
- Custom Z/Y Table RAP services: targeted write-back for custom table entries.
- Custom BRFplus RAP services: targeted write-back for pricing/logistics decision rules.
- CAP Audit Service: read/write for all audit trail events.

**Tools or connectors invoked:**

| Tool | Purpose | Side Effects |
|------|---------|--------------|
| `rag_retrieve_checklist` | Query AI Core RAG endpoint; return grounded setup checklist | Read-only |
| `s4_read_business_partner` | Read BP/customer master data completeness | Read-only |
| `s4_read_material` | Read material/product master data completeness | Read-only |
| `s4_read_plant_config` | Read plant org assignments and SPRO config tables | Read-only |
| `s4_read_credit_management` | Read credit limit and risk class for new customer | Read-only |
| `s4_write_custom_table` | Execute approved write to Z/Y custom table via RAP | **Write — requires human approval** |
| `s4_write_brfplus_rule` | Execute approved write to BRFplus decision table via RAP | **Write — requires human approval** |
| `s4_resolve_fiori_link` | Resolve Semantic Object + Action to a Fiori deep link URL for a given config table and object context | Read-only |
| `audit_persist_event` | Write audit trail event to CAP service | Write (system-initiated) |

**Guardrails & fail-safes:**
- No write tool is ever called without a recorded human approval in the current session.
- The agent never attempts to modify SPRO / transport-managed configuration.
- If the RAG endpoint returns an empty or error response, the agent halts checklist retrieval and informs the user — it does not proceed with a synthesised checklist.
- If an S/4HANA API call fails during validation, the affected step is marked Not Verifiable (API Error); the agent continues with remaining steps.
- If a Z/Y table or BRFplus write fails after user confirmation, the step is marked Failed and the agent pauses, offering the user two options: (a) resolve it manually and mark it complete before proceeding, or (b) skip it now and resolve later in the batch resolution view. If the grounding document explicitly declares the failed step as a dependency of a subsequent step, the dependent step is additionally marked Blocked regardless of which option the user chooses.
- Failed steps are non-blocking by default. The user may resolve all Failed steps together in a batch resolution view at any point in the session, or after all other steps are complete.
- A step that was Failed and subsequently resolved manually by the user is marked User Confirmed or User Confirmed with Evidence — it is never automatically re-executed by the agent without fresh user input.
- If context classification is ambiguous (plant type, material type, account group unknown), the agent asks the user before retrieving the checklist.

---

## UX & Interaction Design

### Primary Interface: Dedicated Fiori Tile

The agent is surfaced as a **dedicated Fiori application tile** in SAP Build Work Zone — not as a Joule conversational interface. The Fiori tile provides a structured, always-visible workflow UI suited to multi-step checklists, multi-field data entry forms, batch failure resolution, and persistent progress tracking. The AI agent operates entirely in the background, orchestrating all retrieval, validation, write, and audit logic via its backend API.

A **collapsible Joule assistant panel** is embedded within the Fiori tile for contextual help and natural language queries — but the primary workflow is driven through the structured UI, not the chat thread.

---

### Fiori Application Layout

The application uses a **two-panel master-detail layout** with a persistent header and tabbed navigation:

```
┌──────────────────────────────────────────────────────────────────┐
│  Operational Readiness  │  Material 1234 — Plant 1010  │ 9/14 ██░│
├─────────────────────────┼────────────────────────────────────────┤
│  CHECKLIST              │  ACTIVE STEP                           │
│  ───────────────────    │  ──────────────────────────────────    │
│  ✅ Step 1              │  ⚠️  Step 6 — Pricing Condition Table  │
│  ✅ Step 2              │                                        │
│  ✅ Step 3              │  Table: A004                           │
│  ✅ Step 4              │  Missing: Material/Customer condition  │
│  ✅ Step 5              │  Impact: Orders will fail at pricing   │
│  ⚠️  Step 6  ←          │                                        │
│  ⏳ Step 7              │  [ Open in VK11 ↗ ]                    │
│  ⏳ Step 8              │                                        │
│  ⏳ Step 9              │  [ ✔ Mark as Complete ]                │
│  ⏳ Step 10             │  [ 📎 Attach Evidence ]                │
│                         │                                        │
│  ❌ 1 Failed            │                        [ 💬 Joule ▾ ] │
└─────────────────────────┴────────────────────────────────────────┘
```

**Header:** Object ID, type, persona scope, and an overall progress bar (steps complete / total).

**Left panel — Checklist Navigator:**
- Always visible; lists all steps with live status icons
- Clicking any step jumps directly to it in the right panel
- Failed / Blocked step count shown as a badge with a direct "View Failed Steps" link

**Right panel — Active Step Detail:**
- Full detail for the currently selected step
- Content adapts to step type (see Step Detail Panel section below)
- "Next Step" / "Previous Step" navigation buttons at the bottom

**Tabs (top of right panel):**

| Tab | Contents |
|-----|---------|
| Active Step | Current step detail and action controls |
| All Steps | Full checklist in a table view with filter/sort by status |
| Failed Steps | Batch resolution view for all ❌ Failed steps |
| Audit Trail | Full chronological event log for the current object |

---

### Step Status Reference

| Status | Icon | Meaning |
|--------|------|---------|
| Pending | ⏳ | Not yet validated |
| System Verified | ✅ | Confirmed complete via S/4HANA API |
| Gap — Action Required | ⚠️ | Missing entry; user action needed |
| Needs Input | ✏️ | Data entry form open, awaiting user |
| Written + Confirmed | ✅ | Record created via RAP service |
| User Confirmed | ☑️ | Manually completed and declared by user |
| User Confirmed with Evidence | ☑️📎 | Manually completed with evidence attached |
| Failed | ❌ | Write attempted and failed; awaiting resolution |
| Blocked | 🔒 | Dependent on a Failed step per grounding doc |
| Cancelled by User | ⏭️ | User skipped; no write attempted |
| TR Required | 🚛 | Transport-managed config; must be completed in DEV and moved via TR |

---

### Step Detail Panel — Content by Step Type

| Step type | Right panel content |
|-----------|-------------------|
| System Verified | Step name, verified entity, API source, timestamp — read-only, no action needed |
| Operational table gap | Table name, missing entry (key fields + expected value), business impact, Fiori deep link button (pre-filled with object context) or transaction code fallback, "Mark as Complete" + "Attach Evidence" buttons |
| Transport-managed config gap | Table name, missing entry, business impact, clear instruction to complete in DEV and transport via TR — no production link, "Mark as Complete" + "Attach Evidence" buttons |
| Z/Y table / BRFplus entry | Table/rule name, structured data entry form with all fields labelled mandatory/optional (context fields pre-filled), field-level validation, Submit button (disabled until all mandatory fields are filled), record summary shown before final confirmation |
| Write succeeded | Confirmation message, record details, step marked Written + Confirmed — "Next Step" button |
| Write failed | Error detail, two action buttons: "Resolve Now — Mark as Complete" and "Skip for Now" |
| Not Verifiable (SPRO) | Step name, plain-language explanation of why it cannot be verified programmatically, "Mark as Complete" + "Attach Evidence" buttons |
| Blocked | Step name, the dependency blocking it, link to the blocking step in the left panel, "View Failed Steps" tab shortcut |
| Final cross-check | Operational Readiness Declaration card with full step summary, self-declared step list flagged for awareness, Failed → Manually Resolved steps highlighted — or list of blocking items if declaration cannot be issued |

---

### Failed Steps Tab — Batch Resolution View

All ❌ Failed steps are listed together in the Failed Steps tab. For each failed step the user sees:
- Step name, table/rule targeted, error detail from the failed write attempt
- "Mark as Complete" button (inline resolution with optional evidence attachment)
- The step's dependency status — if it is blocking a subsequent step, that is shown clearly

The user can resolve all failed steps in any order without returning to the main checklist flow.

---

### Embedded Joule Assistant Panel

A collapsible Joule chat panel (collapsed by default, toggled via the 💬 button) is docked in the bottom-right of the right panel. It is available for:

| Use case | Example query |
|----------|--------------|
| Contextual explanation | *"Why is this step required for my material type?"* |
| Field guidance during data entry | *"What value should I enter for Distribution Channel?"* |
| Grounding document reference | *"Show me the source document for this step"* |
| Conversational filtering | *"Show me only the Pricing Analyst steps"* |
| Quick navigation | *"Take me to the first failed step"* |

The Joule panel does **not** drive the workflow — it is an assistant layer only. All workflow actions (form submission, mark complete, declare ready) are performed through the structured UI controls.

---

### Application Entry Points

| Entry point | How it works |
|-------------|-------------|
| Build Work Zone tile | Dedicated "Operational Readiness" tile on the user's launchpad; clicking it opens the app and prompts for object ID and type |
| Fiori Launchpad URL | Direct deep link with object ID pre-filled: `…/operationalreadiness?objectId=1234&objectType=MATERIAL` — enabling launch from a notification, email, or another app |
| Joule @mention (optional) | User types `@OperationalReadiness material 1234` in any Joule conversation; Joule opens the Fiori tile in a side panel rather than running the agent inline |

---

### Authorisation & Identity

| Concern | Approach |
|---------|---------|
| Who can access the tile | Role-filtered by persona: Pricing Analyst, Logistics Coordinator, Contract Administrator, Accounting/Controlling Specialist, Master Data Governance Owner — configured in Build Work Zone role assignments |
| S/4HANA identity | Principal propagation — the user's own S/4HANA credentials are forwarded to all OData API calls; the audit trail records the real actor, not a service account |
| Write authorisation | The RAP services enforce S/4HANA object-level authorisation — the agent cannot write to a table the user is not authorised for in S/4HANA |

---

## Governance, Risk & Compliance

**Data Handling:**
- No PII is stored in the CAP audit trail beyond the S/4HANA user ID of the approver (required for audit).
- Audit trail records are retained for a minimum of 7 years in line with SAP standard audit policy.
- Evidence attachments are stored by reference (BTP Object Store blob URL) — not duplicated in the audit table.

**Approval Flows:**
- Every Z/Y table and BRFplus write requires an explicit in-session approval from the responsible persona before execution.
- Operational Readiness Declaration is issued by the agent only when all steps are in a terminal status; the declaration event is immutable in the audit trail.

---

## Milestones

### M1: Checklist Retrieved

- **Description:** Agent has queried the AI Core RAG endpoint and returned a persona- and context-specific setup checklist for the given master data object.
- **Achieved when:** The RAG endpoint returns a non-empty checklist scoped to the correct object type, context, and persona(s).
- **Log on achievement:** `M1.achieved: checklist retrieved for object={object_id} type={object_type} persona={persona} steps={step_count}`
- **Log on miss:** `M1.missed: checklist retrieval failed or returned empty for object={object_id} reason={error}`

### M2: Validation Complete

- **Description:** Agent has called all required S/4HANA CDS/OData services and classified every checklist step as System Verified, Gap Identified, or Not Verifiable.
- **Achieved when:** All steps in the checklist have a non-pending classification status.
- **Log on achievement:** `M2.achieved: validation complete for object={object_id} verified={n} gaps={n} not_verifiable={n}`
- **Log on miss:** `M2.missed: validation incomplete for object={object_id} pending_steps={n} reason={error}`

### M3: Data Entry Forms Presented

- **Description:** Agent has presented a guided data entry form (with mandatory/optional field labels) for all Gap Identified steps targeting writable Z/Y tables or BRFplus decision rules, and is awaiting user input.
- **Achieved when:** All writable Gap Identified steps have a corresponding data entry form presented to the user with field definitions loaded from the target table/rule metadata.
- **Log on achievement:** `M3.achieved: data entry forms presented for object={object_id} forms={n} total_fields={n}`
- **Log on miss:** `M3.missed: data entry form generation incomplete for object={object_id} failed_steps={step_ids}`

### M4: Human Confirmation Received

- **Description:** User has completed all data entry forms; all writes have been attempted immediately upon confirmation; any Failed steps have been resolved (manually marked complete) or acknowledged; all self-declarations are recorded.
- **Achieved when:** Every writable step has a terminal status (Written + Confirmed, Failed → Resolved Inline, Failed → Resolved in Batch, or Cancelled by User) and all self-declaration steps are recorded. No step remains in a pending, in-progress, or unacknowledged Failed state.
- **Log on achievement:** `M4.achieved: human confirmation complete for object={object_id} written={n} failed_resolved_inline={n} failed_resolved_batch={n} cancelled={n} self_declared={n}`
- **Log on miss:** `M4.missed: human confirmation incomplete for object={object_id} pending_forms={n} unresolved_failed={n}`

### M5: Operational Readiness Declared

- **Description:** Agent has run the final cross-check, confirmed all steps are in a terminal status, and issued the Operational Readiness Declaration.
- **Achieved when:** All checklist steps are System Verified, User Confirmed, or User Confirmed with Evidence; no steps remain in Gap Identified or pending status.
- **Log on achievement:** `M5.achieved: operational readiness declared for object={object_id} total_steps={n} self_declared={n} timestamp={ts}`
- **Log on miss:** `M5.missed: readiness declaration blocked for object={object_id} blocking_steps={step_ids}`

---

## Risks, Assumptions, and Dependencies

### Risks

- **Custom RAP service delivery:** BRFplus and Z/Y table write-back requires custom RAP services built by the S/4HANA development team. Delays in this delivery directly block write-path functionality.
- **Grounding document quality:** The accuracy of retrieved checklists depends on the currency and completeness of documents in BTP Object Store. Stale documents produce incomplete setup guidance.
- **Context determination accuracy:** Misclassifying object context (plant type, material type, account group) at trigger time causes the wrong checklist to be retrieved, leading to missed steps.
- **AI Core Bearer token expiry:** The token is short-lived. Failure to rotate it before expiry causes all RAG calls to fail until it is refreshed in the BTP Credential Store.

### Assumptions (Validate These)

- The AI Core RAG deployment (`db116ec41033908a`) is already active and operational — no new provisioning is needed.
- Grounding documents in BTP Object Store are current, correctly tagged by object type and persona, and maintained by the Master Data Governance Owner outside this solution.
- Released OData APIs (API_BUSINESS_PARTNER, API_PRODUCT_SRV, CE_PLANT_0001, API_CRDTMBUSINESSPARTNER) are accessible from the BTP runtime via a configured destination.
- The S/4HANA development team will deliver the custom Z/Y table and BRFplus RAP services before the write-path go-live milestone.
- A Fiori Semantic Object / Action mapping for all standard config tables in scope (T001W, TVKO, TVKWZ, TOVAK, and equivalents) will be maintained in a config file delivered with the agent. Tables with no Fiori app will be flagged with their SPRO transaction code as a fallback.

### Dependencies

- S/4HANA development team: custom RAP service exposure for Z/Y tables and BRFplus rules.
- BTP Credential Store: secure storage and runtime injection of AI Core Bearer token and S/4HANA destination credentials.
- SAP Build Work Zone: Fiori tile hosting, persona-based role assignments, and launchpad deep-link configuration.
- Joule Studio: embedded assistant panel registration and agent card publication.

---

## References

- SAP AI Core Document Grounding: https://help.sap.com/docs/sap-ai-core
- SAP S/4HANA Business Partner OData API: ORD ID `sap.s4:apiResource:API_BUSINESS_PARTNER:v1`
- SAP S/4HANA Product Master OData API: ORD ID `sap.s4:apiResource:API_PRODUCT_SRV:v1`
- SAP S/4HANA Plant API: ORD ID `sap.s4:apiResource:CE_PLANT_0001:v1`
- SAP S/4HANA Credit Management API: ORD ID `sap.s4:apiResource:API_CRDTMBUSINESSPARTNER:v1`
- SAP BTP Credential Store: https://help.sap.com/docs/credential-store
- SAP CAP (Cloud Application Programming Model): https://cap.cloud.sap
