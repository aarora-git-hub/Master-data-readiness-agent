# CF Deployment Guide — CAP Service & Fiori UI

## Prerequisites

Make sure the following tools are installed on your machine:

| Tool | Install |
|---|---|
| CF CLI v8 | https://github.com/cloudfoundry/cli/releases |
| MTA Build Tool (`mbt`) | `npm install -g mbt` |
| MultiApps CF Plugin | `cf install-plugin multiapps` |
| Node.js 20+ | https://nodejs.org |

---

## Step 1 — Log in to Cloud Foundry

```bash
cf login -a https://api.cf.eu12-002.hana.ondemand.com \
         --org "BTP_Canary Global Account Ashish_8wpjh4qd1l2lgzfm" \
         --space "Dev_8wpjh4qd1l2lgzfm-space"
```

---

## Step 2 — Deploy the CAP Service (with HANA HDI + XSUAA)

The CAP service uses the MTA (Multi-Target Application) approach to provision
the HANA HDI container and XSUAA service instance automatically.

```bash
cd assets/master-data-readiness-cap

# Build the MTA archive
mbt build -p cf

# Deploy to CF (this provisions HANA HDI + XSUAA + CAP app in one step)
cf deploy mta_archives/master-data-readiness_1.0.0.mtar --version-rule ALL
```

The deployment will take ~5 minutes. When complete, verify:

```bash
cf app master-data-readiness-cap
```

Expected output: `status: running`

Note the CAP service URL:
`https://master-data-readiness-cap.cfapps.eu12-002.hana.ondemand.com`

---

## Step 3 — Update the Agent with the CAP Service URL

Once the CAP service is running, update the `CAP_AUDIT_SERVICE_URL` environment
variable in the agent's `asset.yaml` and redeploy:

Open `assets/master-data-readiness-agent/asset.yaml` and add/update:

```yaml
env:
  - name: CAP_AUDIT_SERVICE_URL
    value: "https://master-data-readiness-cap.cfapps.eu12-002.hana.ondemand.com"
  # ... existing env vars ...
```

Then redeploy the agent via Joule Studio (the deploy button in this solution).

---

## Step 4 — Build and Deploy the Fiori UI

```bash
cd assets/master-data-readiness-ui

# Install dependencies
npm install

# Build the React app for production
npm run build

# Deploy to CF using the staticfile buildpack
cf push master-data-readiness-ui \
   -m 128M \
   -b staticfile_buildpack \
   -p build \
   --route master-data-readiness-ui.cfapps.eu12-002.hana.ondemand.com
```

Verify:

```bash
cf app master-data-readiness-ui
```

Expected output: `status: running`

Fiori UI URL:
`https://master-data-readiness-ui.cfapps.eu12-002.hana.ondemand.com`

---

## Step 5 — Assign Role Collections to Users

In BTP Cockpit → Security → Role Collections, assign the following to your users:

| Role Collection | Who gets it |
|---|---|
| `MasterDataReadiness_User` | Pricing Analysts, Logistics Coordinators, Contract Admins, Accounting Specialists |
| `MasterDataReadiness_Admin` | Master Data Governance Owners |
| `MasterDataReadiness_Viewer` | Read-only observers / auditors |

---

## Step 6 — Add Fiori Tile in SAP Build Work Zone

1. Open SAP Build Work Zone → Site Manager
2. Go to **Content Manager → Content Explorer**
3. Click **Add to My Content** for the Operational Readiness tile
4. Go to **My Content → New → App** and fill in:
   - **Title:** Operational Readiness
   - **URL:** `https://master-data-readiness-ui.cfapps.eu12-002.hana.ondemand.com`
   - **Open In:** New Tab
   - **Intent:** `OperationalReadiness-launch`
5. Assign the tile to the relevant user groups/roles
6. Publish the site

---

## Verification Checklist

- [ ] `cf app master-data-readiness-cap` shows `running`
- [ ] `cf app master-data-readiness-ui` shows `running`
- [ ] CAP health check responds: `GET https://master-data-readiness-cap.cfapps.eu12-002.hana.ondemand.com/health`
- [ ] Fiori UI loads at: `https://master-data-readiness-ui.cfapps.eu12-002.hana.ondemand.com`
- [ ] Agent `CAP_AUDIT_SERVICE_URL` env var updated and agent redeployed
- [ ] Role collections assigned to at least one test user
- [ ] Fiori tile visible in Build Work Zone

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `cf push` fails with buildpack error | Wrong buildpack | Verify `staticfile_buildpack` is available: `cf buildpacks` |
| CAP deploy fails at HDI step | HANA service not available in space | Check BTP Cockpit → Space → Service Marketplace → SAP HANA Schemas & HDI Containers |
| 401 Unauthorized on CAP API | XSUAA not bound | Run `cf bind-service master-data-readiness-cap master-data-readiness-xsuaa && cf restage master-data-readiness-cap` |
| Fiori UI shows blank page | React build not in `/build` folder | Re-run `npm run build` then `cf push` again |
| Agent audit writes fail | `CAP_AUDIT_SERVICE_URL` not set | Update agent asset.yaml and redeploy from Joule Studio |
