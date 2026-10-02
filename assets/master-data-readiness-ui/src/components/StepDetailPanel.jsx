import React, { useState } from "react";
import StatusIcon from "./StatusIcon";
import { markStepComplete, skipStep, submitStep, getFormMetadata } from "../api/agentApi";

export default function StepDetailPanel({ step, sessionId, onStepUpdated }) {
  const [formFields, setFormFields] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [showSummary, setShowSummary] = useState(false);
  const [evidenceRef, setEvidenceRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!step) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
        Select a step from the checklist to view details.
      </div>
    );
  }

  const handleMarkComplete = async () => {
    setLoading(true);
    setError(null);
    try {
      await markStepComplete(sessionId, step.step_id, evidenceRef || null);
      onStepUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    setError(null);
    try {
      await skipStep(sessionId, step.step_id);
      onStepUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadForm = async () => {
    setLoading(true);
    setError(null);
    try {
      const meta = await getFormMetadata(sessionId, step.step_id);
      setFormFields(meta.field_definitions || []);
      const defaults = {};
      (meta.field_definitions || []).forEach(f => { defaults[f.field_name] = f.default_value || ""; });
      setFormValues(defaults);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForm = async () => {
    const missing = (formFields || []).filter(f => f.mandatory && !formValues[f.field_name]);
    if (missing.length > 0) {
      setError(`Please fill in mandatory fields: ${missing.map(f => f.label).join(", ")}`);
      return;
    }
    setShowSummary(true);
  };

  const handleConfirmWrite = async () => {
    setLoading(true);
    setError(null);
    setShowSummary(false);
    try {
      await submitStep(sessionId, step.step_id, formValues);
      onStepUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderActions = () => {
    const btn = (label, onClick, variant = "default") => (
      <button
        key={label}
        onClick={onClick}
        disabled={loading}
        style={{
          padding: "8px 16px",
          marginRight: 8,
          marginTop: 12,
          background: variant === "primary" ? "#1a73e8" : variant === "danger" ? "#d00" : "#f5f5f5",
          color: variant === "default" ? "#333" : "#fff",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        {label}
      </button>
    );

    const isTerminal = ["SYSTEM_VERIFIED", "WRITTEN_CONFIRMED", "USER_CONFIRMED",
      "USER_CONFIRMED_WITH_EVIDENCE", "CANCELLED_BY_USER",
      "FAILED_RESOLVED_INLINE", "FAILED_RESOLVED_BATCH"].includes(step.status);

    if (isTerminal) return null;

    if (["CUSTOM_TABLE", "BRFPLUS"].includes(step.step_type)) {
      if (!formFields) return btn("📋 Open Data Entry Form", handleLoadForm, "primary");
      if (showSummary) {
        return (
          <div>
            <div style={{ background: "#f9f9f9", border: "1px solid #ddd", borderRadius: 4, padding: 12, marginTop: 12 }}>
              <strong>Record to be created:</strong>
              <ul style={{ margin: "8px 0 0 0" }}>
                {Object.entries(formValues).map(([k, v]) => <li key={k}><b>{k}:</b> {v}</li>)}
              </ul>
            </div>
            {btn("✅ Confirm & Submit", handleConfirmWrite, "primary")}
            {btn("Cancel", () => setShowSummary(false))}
          </div>
        );
      }
      return (
        <div>
          {(formFields || []).map(f => (
            <div key={f.field_name} style={{ marginTop: 10 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500 }}>
                {f.label} {f.mandatory && <span style={{ color: "#d00" }}>*</span>}
              </label>
              <input
                type="text"
                value={formValues[f.field_name] || ""}
                onChange={e => setFormValues(prev => ({ ...prev, [f.field_name]: e.target.value }))}
                style={{ width: "100%", padding: "6px 10px", marginTop: 4, border: "1px solid #ccc", borderRadius: 4 }}
              />
            </div>
          ))}
          {btn("Review & Submit", handleSubmitForm, "primary")}
        </div>
      );
    }

    if (step.status === "FAILED") {
      return (
        <div>
          {btn("✅ Resolve Now — Mark as Complete", handleMarkComplete, "primary")}
          {btn("⏭️ Skip for Now", handleSkip)}
        </div>
      );
    }

    return (
      <div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 500 }}>Evidence URL (optional)</label>
          <input
            type="text"
            value={evidenceRef}
            onChange={e => setEvidenceRef(e.target.value)}
            placeholder="https://..."
            style={{ width: "100%", padding: "6px 10px", marginTop: 4, border: "1px solid #ccc", borderRadius: 4 }}
          />
        </div>
        {btn("✔ Mark as Complete", handleMarkComplete, "primary")}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <StatusIcon status={step.status} showLabel />
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>{step.step_name}</h2>
      </div>

      {step.description && (
        <p style={{ color: "#555", fontSize: "0.9rem", marginBottom: 16 }}>{step.description}</p>
      )}

      {step.step_type === "CONFIG_TABLE" && (
        <div style={{ background: "#fff8e1", border: "1px solid #ffc107", borderRadius: 4, padding: 12, marginBottom: 16 }}>
          <strong>🚛 Transport Required</strong><br />
          <span style={{ fontSize: "0.85rem" }}>
            This configuration must be completed in the <b>DEV system</b> and transported
            to production via a Transport Request (TR). Do not make this change directly in production.
          </span>
          {step.transaction_code && (
            <div style={{ marginTop: 6, fontSize: "0.85rem" }}>
              Transaction: <code>{step.transaction_code}</code>
            </div>
          )}
        </div>
      )}

      {step.step_type === "OPERATIONAL_TABLE" && step.fiori_url && (
        <div style={{ marginBottom: 16 }}>
          <a href={step.fiori_url} target="_blank" rel="noreferrer"
             style={{ display: "inline-block", padding: "8px 16px", background: "#1a73e8", color: "#fff",
                      borderRadius: 4, textDecoration: "none", fontSize: "0.9rem" }}>
            🔗 Open in Fiori ↗
          </a>
          {step.transaction_code && (
            <span style={{ marginLeft: 12, fontSize: "0.85rem", color: "#666" }}>
              or use transaction <code>{step.transaction_code}</code>
            </span>
          )}
        </div>
      )}

      {step.step_type === "SPRO" && (
        <div style={{ background: "#e3f2fd", border: "1px solid #90caf9", borderRadius: 4, padding: 12, marginBottom: 16 }}>
          <strong>ℹ️ Not Verifiable Programmatically</strong><br />
          <span style={{ fontSize: "0.85rem" }}>
            This SPRO configuration step cannot be verified automatically via an API.
            Please complete it manually and mark it as done below.
          </span>
        </div>
      )}

      {step.status === "BLOCKED" && (
        <div style={{ background: "#fff3e0", border: "1px solid #ff9800", borderRadius: 4, padding: 12, marginBottom: 16 }}>
          <strong>🔒 Blocked</strong><br />
          <span style={{ fontSize: "0.85rem" }}>
            This step is blocked because a dependency step has not been completed.
            Resolve the failed dependency first.
          </span>
        </div>
      )}

      {step.missing_entry && (
        <div style={{ background: "#fce4ec", border: "1px solid #ef9a9a", borderRadius: 4, padding: 12, marginBottom: 16 }}>
          <strong>Missing Entry:</strong>
          <pre style={{ margin: "6px 0 0 0", fontSize: "0.8rem" }}>
            {typeof step.missing_entry === "object"
              ? JSON.stringify(step.missing_entry, null, 2)
              : step.missing_entry}
          </pre>
        </div>
      )}

      {step.business_impact && (
        <div style={{ fontSize: "0.85rem", color: "#555", marginBottom: 16 }}>
          <strong>Business Impact:</strong> {step.business_impact}
        </div>
      )}

      {error && (
        <div style={{ color: "#d00", fontSize: "0.85rem", marginTop: 8, padding: "8px 12px",
                      background: "#fff0f0", borderRadius: 4 }}>
          {error}
        </div>
      )}

      {renderActions()}
    </div>
  );
}
