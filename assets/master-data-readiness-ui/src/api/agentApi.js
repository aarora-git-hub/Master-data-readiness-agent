/**
 * agentApi.js — REST client for the Master Data Readiness Agent backend API.
 *
 * All workflow actions (session creation, step submission, mark-complete,
 * readiness declaration) go through the agent's REST endpoints.
 * The CAP audit service is called directly for read-only audit trail queries.
 */

// All session and checklist calls go to the CAP service REST API
const CAP_BASE_URL = process.env.REACT_APP_CAP_URL || "http://localhost:4004";
const SESSIONS_URL = `${CAP_BASE_URL}/sessions`;

async function request(url, options = {}) {
  const token = sessionStorage.getItem("auth_token") || "";
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

/** Create a new readiness session and retrieve the classified checklist. */
export function createSession(params) {
  return request(`${SESSIONS_URL}`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/** Get the current session state including all step statuses. */
export function getSession(sessionId) {
  return request(`${SESSIONS_URL}/${sessionId}`);
}

/** Get field definitions for a CUSTOM_TABLE or BRFPLUS step. */
export function getFormMetadata(sessionId, stepId) {
  return request(`${SESSIONS_URL}/${sessionId}/steps/${stepId}/form-metadata`, {
    method: "POST",
  });
}

/** Submit form data and execute the write immediately. */
export function submitStep(sessionId, stepId, fieldValues) {
  return request(`${SESSIONS_URL}/${sessionId}/steps/${stepId}/submit`, {
    method: "POST",
    body: JSON.stringify({ fieldValues }),
  });
}

/** Mark a step as User Confirmed (with optional evidence reference). */
export function markStepComplete(sessionId, stepId, evidenceRef = null) {
  return request(`${SESSIONS_URL}/${sessionId}/steps/${stepId}/mark-complete`, {
    method: "POST",
    body: JSON.stringify({ evidenceRef }),
  });
}

/** Skip a Failed step (Cancelled by User). */
export function skipStep(sessionId, stepId) {
  return request(`${SESSIONS_URL}/${sessionId}/steps/${stepId}/skip`, {
    method: "POST",
  });
}

/** Trigger the final cross-check and attempt to declare operational readiness. */
export function declareReady(sessionId) {
  return request(`${SESSIONS_URL}/${sessionId}/declare-ready`, {
    method: "POST",
  });
}

/** Fetch the full audit trail for a session's object (via CAP service). */
export function getAuditTrail(objectId) {
  return request(
    `${CAP_BASE_URL}/odata/v4/ReadinessService/getAuditTrailByObject(objectId='${objectId}')`
  );
}
