# Specification

> **Guidelines**: Read [guidelines.md](./guidelines.md) before executing ANY tasks below.

Check off items as completed.

---

## Solution Setup

- [x] Create asset directories:
  ```bash
  mkdir -p assets/master-data-readiness-agent/
  mkdir -p assets/master-data-readiness-cap/
  mkdir -p assets/master-data-readiness-ui/
  ```
- [x] Invoke `setup-solution` skill to create `solution.yaml` and `asset.yaml` files for every asset:
  - `master-data-readiness-agent` — kind: `agent`
  - `master-data-readiness-cap` — kind: `cap`
  - `master-data-readiness-ui` — kind: `application`
- [x] Validate all `asset.yaml` and `solution.yaml` files exist and are well-formed

---

## Asset Implementation

- [x] Execute `specification/master-data-readiness-agent/specification.md` (all items)
- [x] Cross-implementation compatibility check — verify the following before marking complete:
  - Fiori UI (`master-data-readiness-ui`) REST API calls match the agent's exposed endpoint signatures (`/sessions`, `/sessions/{id}/steps/{id}/submit`, etc.)
  - CAP service (`master-data-readiness-cap`) OData entity field names match the `audit_persist_event` tool's payload field names
  - Environment variable names are consistent across agent, CAP service, and UI (`CAP_AUDIT_SERVICE_URL`, `S4_ODATA_BASE_URL`, etc.)
  - Principal propagation headers are forwarded consistently from Fiori UI → agent → S/4HANA OData calls
  - Step status enum values are identical across agent Python code, CAP CDS entities, and Fiori UI rendering logic
