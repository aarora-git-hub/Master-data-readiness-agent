import React from "react";
import StatusIcon from "./StatusIcon";

export default function ChecklistNavigator({ steps, activeStepId, onSelectStep, failedCount }) {
  const terminal = ["SYSTEM_VERIFIED", "WRITTEN_CONFIRMED", "USER_CONFIRMED",
    "USER_CONFIRMED_WITH_EVIDENCE", "CANCELLED_BY_USER", "FAILED_RESOLVED_INLINE", "FAILED_RESOLVED_BATCH"];
  const complete = steps.filter(s => terminal.includes(s.status)).length;

  return (
    <div style={{ width: 280, borderRight: "1px solid #e0e0e0", overflowY: "auto", padding: "12px 0" }}>
      <div style={{ padding: "0 16px 12px", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#333" }}>Checklist</div>
        <div style={{ fontSize: "0.8rem", color: "#666", marginTop: 4 }}>
          {complete} of {steps.length} steps complete
        </div>
        {failedCount > 0 && (
          <div style={{ marginTop: 6, fontSize: "0.8rem", color: "#d00", cursor: "pointer" }}
               onClick={() => onSelectStep("__failed__")}>
            ❌ {failedCount} Failed — View All
          </div>
        )}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {steps.map((step, idx) => (
          <li
            key={step.step_id}
            onClick={() => onSelectStep(step.step_id)}
            style={{
              padding: "10px 16px",
              cursor: "pointer",
              background: activeStepId === step.step_id ? "#e8f0fe" : "transparent",
              borderLeft: activeStepId === step.step_id ? "3px solid #1a73e8" : "3px solid transparent",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <StatusIcon status={step.status} />
            <span style={{ fontSize: "0.85rem", color: "#333", flex: 1 }}>
              {idx + 1}. {step.step_name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
