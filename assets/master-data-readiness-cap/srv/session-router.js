"use strict";

/**
 * session-router.js
 * Express router that provides REST session endpoints for the Fiori UI.
 * All sessions are held in memory.
 *
 * POST   /sessions
 * GET    /sessions/:id
 * POST   /sessions/:id/steps/:stepId/form-metadata
 * POST   /sessions/:id/steps/:stepId/submit
 * POST   /sessions/:id/steps/:stepId/mark-complete
 * POST   /sessions/:id/steps/:stepId/skip
 * POST   /sessions/:id/declare-ready
 */

const { Router } = require("express");
const { v4: uuidv4 } = require("uuid");

const router = Router();
router.use(require("express").json());

/* ── In-memory session store ──────────────────────────────────────────────── */
const sessions = new Map();

/* ── Checklist builder ────────────────────────────────────────────────────── */
function buildChecklist({ objectType, plantType }) {
  const common = [
    { step_id: "S01", step_name: "Verify Basic Data Completeness",   step_type: "SYSTEM_CHECK", status: "PENDING" },
    { step_id: "S02", step_name: "Confirm Organisational Assignment", step_type: "USER_CONFIRM", status: "PENDING" },
    { step_id: "S03", step_name: "Check Valuation Class",            step_type: "SYSTEM_CHECK", status: "PENDING" },
    { step_id: "S04", step_name: "Validate Output Determination",    step_type: "USER_CONFIRM", status: "PENDING" },
    { step_id: "S05", step_name: "Release for Procurement",          step_type: "USER_CONFIRM", status: "PENDING" },
  ];
  const byType = {
    MATERIAL: [
      { step_id: "M01", step_name: "Set MRP Parameters",             step_type: "CUSTOM_TABLE", status: "PENDING" },
      { step_id: "M02", step_name: "Maintain Purchasing Info Record", step_type: "USER_CONFIRM", status: "PENDING" },
      { step_id: "M03", step_name: "Assign Storage Location",        step_type: "CUSTOM_TABLE", status: "PENDING" },
    ],
    PLANT: [
      { step_id: "P01", step_name: "Maintain Plant Address Data",    step_type: "CUSTOM_TABLE", status: "PENDING" },
      { step_id: "P02", step_name: "Assign Factory Calendar",        step_type: "USER_CONFIRM", status: "PENDING" },
      { step_id: "P03", step_name: "Configure Shipping Point",       step_type: "USER_CONFIRM", status: "PENDING" },
      ...(plantType === "OWN"
        ? [{ step_id: "P04", step_name: "Set Production Scheduling Profile", step_type: "BRFPLUS",      status: "PENDING" }] : []),
      ...(plantType === "THIRD_PARTY"
        ? [{ step_id: "P05", step_name: "Maintain Third-Party Vendor",       step_type: "CUSTOM_TABLE", status: "PENDING" }] : []),
    ],
    CUSTOMER_BP: [
      { step_id: "C01", step_name: "Maintain Credit Limit",          step_type: "CUSTOM_TABLE", status: "PENDING" },
      { step_id: "C02", step_name: "Assign Payment Terms",           step_type: "USER_CONFIRM", status: "PENDING" },
      { step_id: "C03", step_name: "Confirm Partner Functions",      step_type: "USER_CONFIRM", status: "PENDING" },
    ],
  };
  return [...common, ...(byType[objectType] || [])];
}

/* ── Form field definitions ───────────────────────────────────────────────── */
const FORM_FIELDS = {
  M01: [
    { name: "mrpType",       label: "MRP Type",       type: "select", options: ["PD","VB","ND"], required: true  },
    { name: "lotSize",       label: "Lot Size",        type: "select", options: ["EX","FX","HB"], required: true  },
    { name: "reorderPoint",  label: "Reorder Point",   type: "number",                            required: false },
  ],
  M03: [
    { name: "storageLocation", label: "Storage Location", type: "text", required: true  },
    { name: "warehouseNo",     label: "Warehouse Number", type: "text", required: false },
  ],
  P01: [
    { name: "street",     label: "Street",      type: "text", required: true },
    { name: "city",       label: "City",         type: "text", required: true },
    { name: "country",    label: "Country",      type: "text", required: true },
    { name: "postalCode", label: "Postal Code",  type: "text", required: true },
  ],
  P05: [
    { name: "vendorId",    label: "Vendor ID",    type: "text",   required: true },
    { name: "partnerRole", label: "Partner Role", type: "select", options: ["LF","WL","VN"], required: true },
  ],
  C01: [
    { name: "creditLimit", label: "Credit Limit (USD)", type: "number",                           required: true },
    { name: "riskClass",   label: "Risk Class",         type: "select", options: ["1","2","3"], required: true },
  ],
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const notFound   = (res, msg) => res.status(404).json({ error: msg });
const badRequest = (res, msg) => res.status(400).json({ error: msg });

const TERMINAL = new Set([
  "SYSTEM_VERIFIED","WRITTEN_CONFIRMED","USER_CONFIRMED",
  "USER_CONFIRMED_WITH_EVIDENCE","CANCELLED_BY_USER",
  "FAILED_RESOLVED_INLINE","FAILED_RESOLVED_BATCH",
]);

/* ── Routes ───────────────────────────────────────────────────────────────── */

// POST /sessions
router.post("/", (req, res) => {
  const { objectId, objectType, persona, plantType, materialType, accountGroup } = req.body || {};
  if (!objectId || !objectType) return badRequest(res, "objectId and objectType are required.");

  const sessionId = uuidv4();
  const steps     = buildChecklist({ objectType, plantType });
  const session   = {
    sessionId, objectId, objectType, persona,
    plantType, materialType, accountGroup,
    steps, overallStatus: "IN_PROGRESS",
    createdAt: new Date().toISOString(),
  };
  sessions.set(sessionId, session);
  console.log(`[SESSION CREATED] ${sessionId} — ${objectType} ${objectId}`);
  res.status(201).json(session);
});

// GET /sessions/:id
router.get("/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return notFound(res, "Session not found.");
  res.json(session);
});

// POST /sessions/:id/steps/:stepId/form-metadata
router.post("/:id/steps/:stepId/form-metadata", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return notFound(res, "Session not found.");
  const step = session.steps.find(s => s.step_id === req.params.stepId);
  if (!step) return notFound(res, "Step not found.");
  res.json({ fields: FORM_FIELDS[step.step_id] || [{ name: "value", label: "Value", type: "text", required: true }] });
});

// POST /sessions/:id/steps/:stepId/submit
router.post("/:id/steps/:stepId/submit", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return notFound(res, "Session not found.");
  const step = session.steps.find(s => s.step_id === req.params.stepId);
  if (!step) return notFound(res, "Step not found.");

  step.status      = "WRITTEN_CONFIRMED";
  step.fieldValues = req.body?.fieldValues || {};
  step.completedAt = new Date().toISOString();
  console.log(`[STEP SUBMITTED] ${req.params.stepId} — session ${req.params.id}`);
  res.json({ step });
});

// POST /sessions/:id/steps/:stepId/mark-complete
router.post("/:id/steps/:stepId/mark-complete", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return notFound(res, "Session not found.");
  const step = session.steps.find(s => s.step_id === req.params.stepId);
  if (!step) return notFound(res, "Step not found.");

  const { evidenceRef } = req.body || {};
  step.status      = evidenceRef ? "USER_CONFIRMED_WITH_EVIDENCE" : "USER_CONFIRMED";
  step.evidenceRef = evidenceRef || null;
  step.completedAt = new Date().toISOString();
  console.log(`[STEP CONFIRMED] ${req.params.stepId} — ${step.status}`);
  res.json({ step });
});

// POST /sessions/:id/steps/:stepId/skip
router.post("/:id/steps/:stepId/skip", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return notFound(res, "Session not found.");
  const step = session.steps.find(s => s.step_id === req.params.stepId);
  if (!step) return notFound(res, "Step not found.");

  step.status      = "CANCELLED_BY_USER";
  step.completedAt = new Date().toISOString();
  console.log(`[STEP SKIPPED] ${req.params.stepId}`);
  res.json({ step });
});

// POST /sessions/:id/declare-ready
router.post("/:id/declare-ready", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return notFound(res, "Session not found.");

  const blocking = session.steps.filter(s => !TERMINAL.has(s.status));
  if (blocking.length > 0) {
    return res.json({
      declared: false,
      message: `${blocking.length} step(s) are not yet complete.`,
      blocking_steps: blocking.map(s => `${s.step_id}: ${s.step_name}`),
    });
  }

  session.overallStatus = "READY";
  session.declaredAt    = new Date().toISOString();
  const selfDeclared    = session.steps.filter(s => s.status === "USER_CONFIRMED_WITH_EVIDENCE");

  console.log(`[READINESS DECLARED] ${session.objectType} ${session.objectId}`);
  res.json({
    declared:          true,
    message:           `${session.objectType} ${session.objectId} is operationally ready.`,
    total_steps:       session.steps.length,
    system_verified:   session.steps.filter(s => s.status === "SYSTEM_VERIFIED").length,
    written_confirmed: session.steps.filter(s => s.status === "WRITTEN_CONFIRMED").length,
    user_confirmed:    session.steps.filter(s => ["USER_CONFIRMED","USER_CONFIRMED_WITH_EVIDENCE"].includes(s.status)).length,
    self_declared_steps: selfDeclared.map(s => s.step_id),
  });
});

module.exports = router;
