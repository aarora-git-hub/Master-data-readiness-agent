# Master Data Operational Readiness Agent

SAP S/4HANA Agentic AI for post-creation setup orchestration across Material, Plant, and Customer (Business Partner) master data objects.

## Integration Details

### AI Core RAG Endpoint

| Property | Value |
|----------|-------|
| Endpoint URL | `https://api.ai.intprod-eu12.eu-central-1.aws.ml.hana.ondemand.com/v2/inference/deployments/db116ec41033908a/completion` |
| Method | `POST` |
| Auth | Bearer token — **must be injected at runtime via environment variable `AICORE_RAG_TOKEN`; never hardcoded** |
| Input parameter | `user_query` |

> Security note: The Bearer token provided is a short-lived JWT credential. It must be stored in a secrets manager (SAP BTP Credential Store or equivalent) and rotated before expiry. The agent runtime reads it from the environment at startup — it is never written to any file or source code.

## Business Challenge

After creating a new master data or org object (Material, Plant, or Customer/Business Partner) in SAP S/4HANA, teams frequently miss the downstream additional setup steps required across standard/custom tables and BRFplus decision rules. These steps vary by persona (Pricing Analyst, Logistics Coordinator, Contract Admin, Accounting/Controlling) and context (e.g., plant type: own/3rd-party/in-transit; material type; customer account group). The knowledge of what needs to be done is currently locked in unstructured Word/PDF documents on SharePoint, leading to activation delays, processing errors, rework, and audit gaps.

## Business Goals & Success Criteria

| Metric | Baseline | Target | Timeline | Process / Capability | Source |
|--------|----------|--------|----------|----------------------|--------|
| Missed setup steps per object | 2 | 0 | Within 3 months of go-live | Master Data Operational Readiness | user |
| Days to declare object operationally ready | 2 days | 1 day | Within 3 months of go-live | Master Data Operational Readiness | user |

## Key Milestones

1. **Checklist Retrieved** — Agent successfully queries the existing AI Core RAG endpoint and returns a persona- and context-specific setup checklist for the given master data object.
2. **Validation Complete** — Agent has read all required S/4HANA CDS/RAP services and classified each setup step as: System Verified (complete), Gap Identified (missing), or Not Verifiable (SPRO config, requires manual check).
3. **Updates Proposed** — Agent has generated safe in-line update proposals for all writable custom (Z/Y) tables and BRFplus decision rules, ready for human review.
4. **Human Confirmation Received** — User has approved or rejected each proposed update through the human-in-the-loop confirmation flow; approved changes have been executed.
5. **Operational Readiness Declared** — Final cross-check confirms all required steps are complete (System Verified or User Confirmed/User Confirmed with Evidence); object is declared operationally ready with a full audit trail.

## Business Architecture (RBA)

### End-to-End Process

Lead to Cash Standard B2B

### Process Hierarchy

```
Lead to Cash Standard B2B (E2E)
└── Manage Customers and Channels (B2B)
    └── Manage customers (B2B) [BPS-370_001]
        └── Manage customers and accounts
└── (Extended scope)
    └── Material & Plant master data setup
        └── Configure material views per plant and distribution channel
        └── Assign plant to sales organisation and distribution channel
    └── Define Organisational Structure
        └── Validate plant org assignments (T001W, TVKO, TVKWZ)
    └── Sell Products & Services
        └── Maintain pricing condition tables and BRFplus decision rules
```

### Summary

The challenge maps primarily to the "Manage Customers and Channels (B2B)" phase of Lead to Cash Standard B2B, but extends into material/plant master data governance and pricing rules setup — spanning wholesale distribution, sell-from-stock, and consumer product variants.

## Fit Gap Analysis

| Requirement (business) | Standard asset(s) found | API ORD ID | MCP Server ORD ID | MCP Server Version | Webhook API ORD ID | Data Product ORD ID | Gap? | Notes / assumptions |
|------------------------|-------------------------|------------|-------------------|--------------------|--------------------|---------------------|------|---------------------|
| Read/validate Customer (BP) master data completeness | SAP S/4HANA Cloud Private/Public — Customer Master Data Management (SC5682, SC1172) | `sap.s4:apiResource:API_BUSINESS_PARTNER:v1` | — | — | — | — | No | OData API available; no pre-built MCP server; custom MCP tool required |
| Read/validate Material master data completeness | SAP S/4HANA — Product Master | `sap.s4:apiResource:API_PRODUCT_SRV:v1` | — | — | — | — | No | OData API available; no pre-built MCP server; custom MCP tool required |
| Read/validate Plant configuration tables (T001W, TVKO, TVKWZ, TOVAK) | SAP S/4HANA — Plant Configuration | `sap.s4:apiResource:CE_PLANT_0001:v1` | — | — | — | — | No | OData API available; SPRO config tables readable via released CDS views |
| Retrieve persona-specific setup checklist from SharePoint documents | SAP AI Core Document Grounding (RAG) | — | — | — | — | — | No | AI Core RAG endpoint already deployed; agent calls it directly |
| Write to custom (Z/Y) tables via RAP services | Custom Z/Y RAP services in S/4HANA | — | — | — | — | — | Yes | Custom RAP service exposure required for each writable Z/Y table |
| Write to BRFplus decision tables via RAP/OData | Custom BRFplus RAP/OData service | — | — | — | — | — | Yes | BRFplus write API must be custom-built or exposed via RAP; no standard released API found |
| Validate SPRO configuration steps (read-only) | S/4HANA released CDS views for config tables | `sap.s4:apiResource:CE_PLANT_0001:v1` | — | — | — | — | Maybe | Read-only; agent surfaces gaps for manual completion; user can self-declare with evidence |
| Human-in-the-loop confirmation flow | SAP Build Work Zone / Joule Studio UI | — | — | — | — | — | No | Native capability of the Joule agent runtime; no additional product required |
| Audit trail of all recommendations, approvals, and evidence | Custom audit log entity in Z-table or CAP service | — | — | — | — | — | Yes | No standard released audit trail API for this pattern; custom persistence required |
| Credit management readiness check for new customer | SAP S/4HANA — Credit Management Master Data | `sap.s4:apiResource:API_CRDTMBUSINESSPARTNER:v1` | — | — | — | — | No | OData API available; relevant for Accounting/Controlling persona |

### Key findings

- SAP S/4HANA natively exposes OData APIs for Business Partner, Material (Product), Plant, and Credit Management — the agent can read and validate these without custom development on the read path.
- No pre-built MCP servers were found for any of the S/4HANA APIs; the agent will require custom MCP tool wrappers for all S/4HANA interactions.
- The AI Core RAG endpoint is already deployed — the agent queries it directly to retrieve persona- and context-specific setup checklists; no new AI Core provisioning is needed.
- Two critical write-path gaps exist: (1) custom Z/Y table updates and (2) BRFplus decision table updates both require custom RAP service exposure in S/4HANA before the agent can execute safe in-line changes.
- SPRO configuration steps cannot be executed programmatically (transport-managed); the agent validates them read-only and surfaces gaps for manual completion or self-declaration with evidence.
- The audit trail (step status, approval records, evidence attachments) requires a custom persistence layer — a CAP service with a Z-table or equivalent is the recommended approach.

## Recommendations

### Joule-powered Agentic AI for S/4HANA Master Data Operational Readiness

#### Executive Summary

Python A2A agent in Joule Studio that orchestrates post-creation setup via RAG, RAP, and human-in-the-loop confirmation.

#### Recommended Solution

A pro-code Python agent (A2A protocol) deployed in SAP Build Work Zone / Joule Studio that:
1. Accepts a trigger (new Material, Plant, or Customer/BP created in S/4HANA) and determines context (object type, plant type, material type, customer account group).
2. Calls the existing AI Core RAG endpoint to retrieve the persona-specific setup checklist for that context from SharePoint documents.
3. Validates each checklist step by reading the relevant S/4HANA CDS/OData services (Business Partner, Product Master, Plant Config, Credit Management, config tables).
4. For writable steps (custom Z/Y tables, BRFplus rules), proposes the exact change and routes it through a human-in-the-loop confirmation flow before executing.
5. For SPRO steps, validates via read-only CDS views; surfaces gaps and allows user self-declaration with optional evidence attachment.
6. Runs a final cross-check; declares the object operationally ready when all steps are System Verified or User Confirmed.
7. Persists a full audit trail (all recommendations, actions, approvals, evidence) in a custom CAP service.

#### Problem Statement

Teams creating master data objects in S/4HANA have no automated way to discover, track, or validate the required downstream setup steps. Manual processes rely on tribal knowledge embedded in unstructured documents, causing missed steps, delayed activations, and audit exposure.

#### Affected User Roles

- Pricing Analyst
- Logistics Coordinator
- Contract Administrator
- Accounting / Controlling Specialist
- Master Data Governance Owner (audit oversight)

#### Important factors

##### RAG endpoint already available
The AI Core Document Grounding endpoint for SharePoint is already deployed, eliminating one of the typical integration risks for RAG-based agents.

##### Read/write asymmetry in S/4HANA
All standard validation steps use released OData/CDS read APIs (low risk). Write operations are scoped exclusively to custom Z/Y tables and BRFplus rules (no risk to standard SAP configuration). SPRO steps remain transport-managed and out of scope for programmatic writes.

##### Human-in-the-loop is a first-class pattern
Every proposed write is surfaced for explicit user approval before execution. Users can also self-declare non-verifiable steps with optional evidence, giving teams both automation and governance flexibility.

##### Audit trail by design
Every agent action, recommendation, approval decision, and evidence attachment is persisted. The audit trail supports both internal governance reviews and external audit requirements.

#### Potential risks

##### Custom RAP service exposure
BRFplus and Z/Y table write-back requires custom RAP services to be built and released in S/4HANA. This is a dependency on the S/4HANA BASIS/development team and may introduce delivery timeline risk.

##### Document quality in SharePoint
The accuracy of the agent's setup checklists depends on the quality and currency of the source documents in SharePoint. Stale or incomplete documents will produce incomplete checklists.

##### Context determination complexity
Correctly classifying the object context (plant type, material type, account group) at trigger time is critical to retrieving the right checklist. Misclassification leads to incomplete or incorrect setup guidance.

#### Recommended solution category

AI Agent

#### Intent fit
92%
