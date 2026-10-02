---
name: write-orchestration
description: Guides the user through the data entry and write flow for Z/Y custom tables and BRFplus decision rules
allowed-tools:
  - s4_write_custom_table
  - s4_write_brfplus_rule
  - audit_persist_event
---

# Write Orchestration Skill

## Purpose

This skill governs the guided data entry and write execution flow for steps that require creating a record in a custom Z/Y table or a BRFplus decision table. Load this skill when processing a CUSTOM_TABLE or BRFPLUS gap step.

## Step 1: Retrieve Field Definitions

Call the relevant write tool with `mode=metadata` to retrieve the field definitions for the target table or rule:

```
s4_write_custom_table(table_name=<name>, mode="metadata", object_context=<ctx>)
s4_write_brfplus_rule(rule_name=<name>, mode="metadata", object_context=<ctx>)
```

The metadata response contains a list of fields, each with:
- `field_name`: technical name
- `label`: human-readable label
- `field_type`: string / number / date / boolean / enum
- `mandatory`: true / false
- `default_value`: pre-filled value if available
- `allowed_values`: list of valid values (for enum fields)

## Step 2: Pre-populate Context Fields

Before presenting the form, pre-populate fields that can be inferred from the object context:

| Context Attribute | Pre-fills |
|---|---|
| object_id (Material) | Material, Matnr |
| object_id (Plant) | Plant, Werks |
| object_id (Customer/BP) | Customer, Kunnr, BusinessPartner |
| company_code | Bukrs, CompanyCode |
| sales_org | Vkorg, SalesOrganization |
| distribution_channel | Vtweg, DistributionChannel |

Do NOT pre-populate fields that require business decisions by the user, even if a default value is technically available.

## Step 3: Present the Entry Form

Return a structured JSON form definition to the Fiori UI:

```json
{
  "step_id": "<step_id>",
  "table_name": "<table_name>",
  "form_title": "Create record in <table_name>",
  "fields": [
    {
      "field_name": "Material",
      "label": "Material Number",
      "field_type": "string",
      "mandatory": true,
      "value": "<pre-populated or empty>",
      "allowed_values": null
    }
  ]
}
```

**Mandatory fields** must be clearly marked (the UI renders them with an asterisk *).
**Submit button** must be disabled until all mandatory fields contain a non-empty value.

## Step 4: Validate Before Submission

When the user submits the form:
1. Verify all mandatory fields are non-empty — if any are empty, return field-level error messages and do NOT proceed
2. Validate enum fields contain only allowed values
3. Show the user a pre-confirmation summary of the record to be created:

```
You are about to create the following record in [table_name]:
  - Field 1: Value 1
  - Field 2: Value 2
  ...
Confirm?  [Confirm & Submit]  [Cancel]
```

## Step 5: Execute Write Immediately on Confirmation

On final confirmation, call the write tool with `mode=write` **immediately** — before processing any other step:

```
s4_write_custom_table(table_name=<name>, fields=<submitted_values>, mode="write", object_context=<ctx>)
```

**Do not queue or batch writes.** Each write is executed and completed before moving to the next step.

## Step 6: Handle Write Result

### On Success
- Mark step as WRITTEN_CONFIRMED
- Call `audit_persist_event` with action_type=WRITE_EXECUTED, all field values, actor, and timestamp
- Proceed to the next step

### On Failure
- Mark step as FAILED with the error detail
- Call `audit_persist_event` with action_type=WRITE_FAILED and error_detail
- **PAUSE** — do not proceed to next step automatically
- Present the user with two explicit options:
  a. **Resolve Now — Mark as Complete**: user completes the step manually outside the agent and marks it complete (with optional evidence). On selection, update status to FAILED_RESOLVED_INLINE and call `audit_persist_event` with action_type=STEP_DECLARED_COMPLETE.
  b. **Skip for Now**: leave step as FAILED and continue to next step. The step joins the batch resolution view. On selection, call `audit_persist_event` with action_type=STEP_CANCELLED (deferred).

### Dependency Check on Failure
After marking a step FAILED, check if any subsequent steps have this step's `step_id` in their `dependency_ids`. If yes, mark those dependent steps as BLOCKED and notify the user — regardless of which resolution option they choose.

## Batch Resolution View

At any point during the session (or after all other steps are complete), the user may open the Failed Steps tab in the Fiori UI to resolve all FAILED steps together. For each failed step:
- Show: step name, table/rule name, error detail, dependency status
- Provide: "Mark as Complete" + "Attach Evidence" buttons
- On completion: update status to FAILED_RESOLVED_BATCH and call `audit_persist_event`

The user may resolve failed steps in any order. A step that was FAILED and resolved by the user is NEVER automatically re-executed — fresh user input is always required.
