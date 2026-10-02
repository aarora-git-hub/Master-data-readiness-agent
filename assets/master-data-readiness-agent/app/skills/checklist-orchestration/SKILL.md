---
name: checklist-orchestration
description: Orchestrates the full setup checklist lifecycle for a master data object — retrieval, validation, guided data entry, dependency resolution, and readiness declaration
---

# Checklist Orchestration Skill

## Purpose

This skill governs how the agent retrieves, classifies, sequences, and resolves the setup checklist for a newly created master data object in SAP S/4HANA. Load this skill at the start of every readiness session.

## Step 1: Object Context Classification

Before retrieving the checklist, ensure all required context attributes are known:

| Object Type | Required Attributes | Optional Attributes |
|---|---|---|
| MATERIAL | object_id, material_type, plant | persona |
| PLANT | object_id, plant_type (OWN / THIRD_PARTY / IN_TRANSIT) | company_code, sales_org |
| CUSTOMER_BP | object_id, account_group | company_code, sales_org |

**If any required attribute is missing or ambiguous**, ask the user to clarify before calling `rag_retrieve_checklist`. Do not proceed with an incomplete context — a wrong context produces the wrong checklist.

## Step 2: Checklist Retrieval

Call `rag_retrieve_checklist` with the full context. The tool returns a list of steps, each with:
- `step_id`: unique identifier
- `step_name`: human-readable name
- `persona`: target persona (PRICING_ANALYST / LOGISTICS_COORDINATOR / CONTRACT_ADMIN / ACCOUNTING_CONTROLLING / GOVERNANCE_OWNER)
- `step_type`: CUSTOM_TABLE / BRFPLUS / OPERATIONAL_TABLE / CONFIG_TABLE / SPRO
- `dependency_ids`: list of step_ids that must be completed before this step
- `description`: what needs to be done and why

**If the tool returns empty or an error**: halt immediately and inform the user. Never proceed with a synthesised or assumed checklist.

**Milestone M1 log on success**: `[M1.achieved]: checklist retrieved for object={object_id} type={object_type} persona={persona} steps={step_count}`
**Milestone M1 log on failure**: `[M1.missed]: checklist retrieval failed or returned empty for object={object_id} reason={error}`

## Step 3: Step Classification

After retrieval, validate each step against the relevant S/4HANA APIs. Classification rules:

| Step Type | Validation Tool | System Verified | Gap Identified | Not Verifiable |
|---|---|---|---|---|
| OPERATIONAL_TABLE | s4_read_plant_config / s4_read_material / s4_read_business_partner | Entry present in table | Entry missing; table is operational (maintainable in prod) | CDS view unavailable |
| CONFIG_TABLE | s4_read_plant_config | Entry present | Entry missing; table is transport-managed (DEV→TR→Prod) | CDS view unavailable |
| CUSTOM_TABLE | s4_write_custom_table (metadata mode) | Record exists | Record missing | RAP service unavailable |
| BRFPLUS | s4_write_brfplus_rule (metadata mode) | Rule row exists | Rule row missing | RAP service unavailable |
| SPRO | (not verifiable programmatically) | — | — | Always NOT_VERIFIABLE |

**Run validations in parallel** for steps that have no dependency on each other. For steps with `dependency_ids`, validate only after all dependencies are in a terminal status.

**On API call failure**: mark the step NOT_VERIFIABLE (API Error) and continue with remaining steps. Do not halt.

**Milestone M2 log on success**: `[M2.achieved]: validation complete for object={object_id} verified={n} gaps={n} not_verifiable={n}`
**Milestone M2 log on failure**: `[M2.missed]: validation incomplete for object={object_id} pending_steps={n} reason={error}`

## Step 4: Dependency Chain Evaluation

Before acting on any step, check its `dependency_ids`:
- If a dependency step is in FAILED, CANCELLED_BY_USER, or any non-terminal state, mark this step as BLOCKED
- Surface BLOCKED steps to the user with a clear explanation of what is blocking them
- When a blocking step is resolved, re-evaluate and unblock the dependent step

A step is **only** BLOCKED when the grounding document explicitly lists it in `dependency_ids`. Do not infer dependencies — use only what is in the checklist data.

## Step 5: Sequencing Actionable Steps

After classification, present actionable steps in this order:
1. System Verified steps — shown as complete, no action needed
2. CUSTOM_TABLE / BRFPLUS gaps — guided data entry (see write-orchestration skill)
3. OPERATIONAL_TABLE gaps — Fiori deep link task cards
4. CONFIG_TABLE gaps — TR instruction task cards
5. SPRO / NOT_VERIFIABLE steps — self-declaration task cards
6. BLOCKED steps — shown with dependency explanation

## Step 6: Final Cross-Check Logic

Before issuing the Operational Readiness Declaration, verify ALL steps are in a terminal status:
- Terminal statuses: SYSTEM_VERIFIED, USER_CONFIRMED, USER_CONFIRMED_WITH_EVIDENCE, WRITTEN_CONFIRMED, CANCELLED_BY_USER, FAILED_RESOLVED_INLINE, FAILED_RESOLVED_BATCH
- Non-terminal (blocking): GAP_IDENTIFIED, PENDING, BLOCKED

**If any step is non-terminal**: list the blocking items and do NOT issue the declaration.
**If all steps are terminal**: issue the Operational Readiness Declaration with timestamp.

Declaration summary must include:
- Total steps count
- System verified count
- User confirmed count (self-declared — flag for awareness without blocking)
- User confirmed with evidence count
- Failed → Manually Resolved count (flag separately for governance transparency)

See references/step-statuses.md for the complete status reference and transition rules.
