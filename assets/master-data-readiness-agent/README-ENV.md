# Environment Variables — Master Data Readiness Agent

All secrets and configuration are injected at runtime via environment variables.
**Never store credentials in code or commit them to source control.**

## Required Variables

| Variable | Description | Example |
|---|---|---|
| `AICORE_RAG_TOKEN` | Bearer token for the AI Core RAG endpoint. Read from BTP Credential Store at runtime. | `eyJ0eXAi...` |
| `AICORE_RAG_ENDPOINT` | Full URL of the AI Core Document Grounding completion endpoint. | `https://api.ai.intprod-eu12.eu-central-1.aws.ml.hana.ondemand.com/v2/inference/deployments/db116ec41033908a/completion` |
| `CAP_AUDIT_SERVICE_URL` | Base URL of the deployed CAP readiness audit service. | `https://master-data-readiness-cap.cfapps.eu10.hana.ondemand.com` |

## Optional Variables

| Variable | Description | Default |
|---|---|---|
| `S4_CUSTOM_TABLE_RAP_URL` | Base URL for custom Z/Y table RAP services (provided by S/4HANA dev team). | `https://placeholder.example.com/rap/custom-tables` |
| `S4_BRFPLUS_RAP_URL` | Base URL for BRFplus decision table RAP services. | `https://placeholder.example.com/rap/brfplus` |
| `S4_ODATA_BASE_URL` | Base URL for S/4HANA OData services (used by MCP server wrappers). | — |
| `PORT` | Port the agent server listens on. | `5000` |
| `HOST` | Host the agent server binds to. | `0.0.0.0` |

## BTP Credential Store

In production, `AICORE_RAG_TOKEN` must be stored in the SAP BTP Credential Store and
injected into the container at runtime — never hardcoded or committed to source control.

The token is short-lived. Set up automated rotation in the BTP Credential Store before
go-live to prevent RAG call failures due to token expiry.
