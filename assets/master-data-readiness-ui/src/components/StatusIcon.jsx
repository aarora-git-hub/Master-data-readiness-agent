import React from "react";

const STATUS_CONFIG = {
  PENDING:                      { icon: "⏳", label: "Pending",                   color: "#888" },
  SYSTEM_VERIFIED:              { icon: "✅", label: "System Verified",            color: "#2c7" },
  GAP_ACTION_REQUIRED:          { icon: "⚠️", label: "Gap — Action Required",      color: "#e90" },
  NEEDS_INPUT:                  { icon: "✏️", label: "Needs Input",               color: "#07b" },
  WRITTEN_CONFIRMED:            { icon: "✅", label: "Written + Confirmed",         color: "#2c7" },
  USER_CONFIRMED:               { icon: "☑️", label: "User Confirmed",             color: "#2c7" },
  USER_CONFIRMED_WITH_EVIDENCE: { icon: "☑️📎", label: "Confirmed with Evidence",  color: "#2c7" },
  FAILED:                       { icon: "❌", label: "Failed",                     color: "#d00" },
  BLOCKED:                      { icon: "🔒", label: "Blocked",                   color: "#a50" },
  CANCELLED_BY_USER:            { icon: "⏭️", label: "Cancelled",                 color: "#888" },
  TR_REQUIRED:                  { icon: "🚛", label: "TR Required",               color: "#a50" },
  NOT_VERIFIABLE:               { icon: "❓", label: "Not Verifiable",             color: "#888" },
  FAILED_RESOLVED_INLINE:       { icon: "☑️", label: "Resolved (Inline)",          color: "#2c7" },
  FAILED_RESOLVED_BATCH:        { icon: "☑️", label: "Resolved (Batch)",           color: "#2c7" },
};

export default function StatusIcon({ status, showLabel = false }) {
  const cfg = STATUS_CONFIG[status] || { icon: "❓", label: status, color: "#888" };
  return (
    <span style={{ color: cfg.color, fontSize: "1rem" }} title={cfg.label}>
      {cfg.icon}
      {showLabel && <span style={{ marginLeft: 4, fontSize: "0.85rem" }}>{cfg.label}</span>}
    </span>
  );
}
