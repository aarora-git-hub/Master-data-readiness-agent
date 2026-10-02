import React, { useState, useEffect, useCallback } from "react";
import ChecklistNavigator from "./components/ChecklistNavigator";
import StepDetailPanel from "./components/StepDetailPanel";
import { createSession, getSession, getAuditTrail, declareReady } from "./api/agentApi";

const TABS = ["Active Step", "All Steps", "Failed Steps", "Audit Trail"];

export default function App() {
  // Session state
  const [session, setSession] = useState(null);
  const [steps, setSteps] = useState([]);
  const [activeStepId, setActiveStepId] = useState(null);
  const [activeTab, setActiveTab] = useState("Active Step");
  const [auditEvents, setAuditEvents] = useState([]);
  const [declaration, setDeclaration] = useState(null);

  // Session init form
  const [initForm, setInitForm] = useState({
    objectId: "", objectType: "MATERIAL", persona: "PRICING_ANALYST",
    plantType: "", materialType: "", accountGroup: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeStep = steps.find(s => s.step_id === activeStepId) || null;
  const failedSteps = steps.filter(s => s.status === "FAILED");

  const refreshSession = useCallback(async () => {
    if (!session) return;
    try {
      const data = await getSession(session.sessionId);
      setSteps(data.steps || []);
    } catch (e) {
      console.error("Failed to refresh session", e);
    }
  }, [session]);

  useEffect(() => {
    if (session) refreshSession();
  }, [session, refreshSession]);

  const handleStartSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await createSession(initForm);
      setSession(data);
      setSteps(data.steps || []);
      const firstActionable = (data.steps || []).find(
        s => !["SYSTEM_VERIFIED"].includes(s.status)
      );
      setActiveStepId(firstActionable?.step_id || data.steps?.[0]?.step_id || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeclareReady = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await declareReady(session.sessionId);
      setDeclaration(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    if (tab === "Audit Trail" && session) {
      try {
        const events = await getAuditTrail(initForm.objectId);
        setAuditEvents(events?.value || []);
      } catch (e) {
        console.error("Failed to load audit trail", e);
      }
    }
  };

  const handleSelectStep = (stepId) => {
    if (stepId === "__failed__") {
      setActiveTab("Failed Steps");
      return;
    }
    setActiveStepId(stepId);
    setActiveTab("Active Step");
  };

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: "#f5f7fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 8, padding: 40, width: 480, boxShadow: "0 2px 12px rgba(0,0,0,.1)" }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 24, color: "#1a1a2e" }}>
            🏭 Operational Readiness
          </h1>
          <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: 24 }}>
            Enter the details of the newly created master data object to begin the readiness assessment.
          </p>
          {[
            { key: "objectId", label: "Object ID *", type: "text" },
            { key: "objectType", label: "Object Type *", type: "select", options: ["MATERIAL", "PLANT", "CUSTOMER_BP"] },
            { key: "persona", label: "Your Persona *", type: "select", options: ["PRICING_ANALYST", "LOGISTICS_COORDINATOR", "CONTRACT_ADMIN", "ACCOUNTING_CONTROLLING", "GOVERNANCE_OWNER"] },
            { key: "plantType", label: "Plant Type (for PLANT objects)", type: "select", options: ["", "OWN", "THIRD_PARTY", "IN_TRANSIT"] },
            { key: "materialType", label: "Material Type (for MATERIAL objects)", type: "text" },
            { key: "accountGroup", label: "Account Group (for CUSTOMER_BP objects)", type: "text" },
          ].map(({ key, label, type, options }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: 4 }}>{label}</label>
              {type === "select" ? (
                <select value={initForm[key]} onChange={e => setInitForm(p => ({ ...p, [key]: e.target.value }))}
                        style={{ width: "100%", padding: "7px 10px", border: "1px solid #ccc", borderRadius: 4 }}>
                  {options.map(o => <option key={o} value={o}>{o || "— Not applicable —"}</option>)}
                </select>
              ) : (
                <input type="text" value={initForm[key]} onChange={e => setInitForm(p => ({ ...p, [key]: e.target.value }))}
                       style={{ width: "100%", padding: "7px 10px", border: "1px solid #ccc", borderRadius: 4 }} />
              )}
            </div>
          ))}
          {error && <div style={{ color: "#d00", fontSize: "0.85rem", marginBottom: 12 }}>{error}</div>}
          <button onClick={handleStartSession} disabled={loading || !initForm.objectId}
                  style={{ width: "100%", padding: "10px 0", background: "#1a73e8", color: "#fff",
                           border: "none", borderRadius: 4, fontWeight: 600, cursor: "pointer", fontSize: "1rem" }}>
            {loading ? "Starting..." : "Start Readiness Assessment"}
          </button>
        </div>
      </div>
    );
  }

  const terminal = ["SYSTEM_VERIFIED", "WRITTEN_CONFIRMED", "USER_CONFIRMED",
    "USER_CONFIRMED_WITH_EVIDENCE", "CANCELLED_BY_USER", "FAILED_RESOLVED_INLINE", "FAILED_RESOLVED_BATCH"];
  const complete = steps.filter(s => terminal.includes(s.status)).length;
  const progress = steps.length ? Math.round((complete / steps.length) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "72, Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#1a1a2e", color: "#fff", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontWeight: 700, fontSize: "1rem" }}>🏭 Operational Readiness</span>
        <span style={{ color: "#aaa", fontSize: "0.85rem" }}>
          {initForm.objectType} {initForm.objectId}
        </span>
        <span style={{ color: "#aaa", fontSize: "0.8rem" }}>· {initForm.persona.replace(/_/g, " ")}</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
          <span>{complete}/{steps.length} steps</span>
          <div style={{ width: 120, height: 8, background: "#333", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#2c7", transition: "width .3s" }} />
          </div>
          <span>{progress}%</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <ChecklistNavigator
          steps={steps}
          activeStepId={activeStepId}
          onSelectStep={handleSelectStep}
          failedCount={failedSteps.length}
        />

        {/* Right panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #e0e0e0", background: "#fff" }}>
            {TABS.map(tab => (
              <button key={tab} onClick={() => handleTabChange(tab)}
                      style={{ padding: "10px 20px", border: "none", background: "transparent",
                               borderBottom: activeTab === tab ? "2px solid #1a73e8" : "2px solid transparent",
                               color: activeTab === tab ? "#1a73e8" : "#555",
                               fontWeight: activeTab === tab ? 600 : 400, cursor: "pointer", fontSize: "0.9rem" }}>
                {tab}
                {tab === "Failed Steps" && failedSteps.length > 0 && (
                  <span style={{ marginLeft: 6, background: "#d00", color: "#fff",
                                 borderRadius: 10, padding: "1px 6px", fontSize: "0.75rem" }}>
                    {failedSteps.length}
                  </span>
                )}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={handleDeclareReady} disabled={loading}
                    style={{ margin: "6px 16px", padding: "6px 16px", background: "#2c7", color: "#fff",
                             border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>
              🏁 Declare Ready
            </button>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: "auto", background: "#fff" }}>
            {activeTab === "Active Step" && (
              <StepDetailPanel
                step={activeStep}
                sessionId={session.sessionId}
                onStepUpdated={refreshSession}
              />
            )}

            {activeTab === "All Steps" && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f5f7fa", borderBottom: "1px solid #e0e0e0" }}>
                    {["#", "Step Name", "Type", "Status"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {steps.map((step, idx) => (
                    <tr key={step.step_id} onClick={() => { setActiveStepId(step.step_id); setActiveTab("Active Step"); }}
                        style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f9f9f9"}
                        onMouseLeave={e => e.currentTarget.style.background = ""}>
                      <td style={{ padding: "10px 16px", color: "#888" }}>{idx + 1}</td>
                      <td style={{ padding: "10px 16px" }}>{step.step_name}</td>
                      <td style={{ padding: "10px 16px", color: "#666" }}>{step.step_type}</td>
                      <td style={{ padding: "10px 16px" }}><span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {step.status?.replace(/_/g, " ")}
                      </span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "Failed Steps" && (
              <div style={{ padding: 24 }}>
                <h3 style={{ marginTop: 0 }}>Failed Steps — Batch Resolution</h3>
                {failedSteps.length === 0 ? (
                  <p style={{ color: "#666" }}>No failed steps. ✅</p>
                ) : (
                  failedSteps.map(step => (
                    <div key={step.step_id} style={{ border: "1px solid #e0e0e0", borderRadius: 6,
                                                      padding: 16, marginBottom: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>{step.step_name}</div>
                      {step.error_detail && (
                        <div style={{ color: "#d00", fontSize: "0.85rem", marginBottom: 8 }}>
                          Error: {step.error_detail}
                        </div>
                      )}
                      <StepDetailPanel
                        step={{ ...step, status: "FAILED" }}
                        sessionId={session.sessionId}
                        onStepUpdated={refreshSession}
                      />
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "Audit Trail" && (
              <div style={{ padding: 24 }}>
                <h3 style={{ marginTop: 0 }}>Audit Trail — {initForm.objectId}</h3>
                {auditEvents.length === 0 ? (
                  <p style={{ color: "#666" }}>No audit events recorded yet.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ background: "#f5f7fa" }}>
                        {["Timestamp", "Step", "Action", "Status", "Actor"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {auditEvents.map(ev => (
                        <tr key={ev.ID} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "8px 12px", color: "#666" }}>{ev.timestamp?.slice(0, 19).replace("T", " ")}</td>
                          <td style={{ padding: "8px 12px" }}>{ev.stepId || "—"}</td>
                          <td style={{ padding: "8px 12px" }}>{ev.actionType}</td>
                          <td style={{ padding: "8px 12px" }}>{ev.status}</td>
                          <td style={{ padding: "8px 12px", color: "#666" }}>{ev.actor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Declaration overlay */}
      {declaration && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 8, padding: 40, width: 520, textAlign: "center" }}>
            {declaration.declared ? (
              <>
                <div style={{ fontSize: "3rem" }}>🎉</div>
                <h2 style={{ color: "#2c7" }}>Operationally Ready!</h2>
                <p>{declaration.message}</p>
                <p style={{ fontSize: "0.85rem", color: "#666" }}>
                  Total: {declaration.total_steps} · Verified: {declaration.system_verified} ·
                  Written: {declaration.written_confirmed} · Confirmed: {declaration.user_confirmed}
                </p>
                {declaration.self_declared_steps?.length > 0 && (
                  <p style={{ fontSize: "0.8rem", color: "#a50" }}>
                    ⚠️ {declaration.self_declared_steps.length} self-declared step(s) — flagged for governance review.
                  </p>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: "2rem" }}>🔒</div>
                <h2 style={{ color: "#d00" }}>Declaration Blocked</h2>
                <p>{declaration.message}</p>
                <ul style={{ textAlign: "left", fontSize: "0.85rem" }}>
                  {(declaration.blocking_steps || []).map(s => <li key={s}>{s}</li>)}
                </ul>
              </>
            )}
            <button onClick={() => setDeclaration(null)}
                    style={{ marginTop: 16, padding: "8px 24px", background: "#1a73e8", color: "#fff",
                             border: "none", borderRadius: 4, cursor: "pointer" }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
