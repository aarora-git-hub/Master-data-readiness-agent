using { com.sap.masterdata.readiness as db } from '../db/schema';

/**
 * ReadinessService — OData v4 service for the Master Data Operational Readiness solution.
 *
 * ReadinessAuditEvents: write-once audit trail (create only; no update/delete).
 * ReadinessSessions: full CRUD for session lifecycle management.
 */
service ReadinessService @(path: '/odata/v4/ReadinessService') {

  // Audit events are create-only — no update or delete allowed
  @insertonly
  entity ReadinessAuditEvents as projection on db.ReadinessAuditEvent
    actions {
      // No custom actions; all writes go through the standard OData POST
    };

  // Sessions support full lifecycle (create on trigger, update on status change)
  entity ReadinessSessions as projection on db.ReadinessSession;

  // Convenience function: get all audit events for an object in chronological order
  function getAuditTrailByObject(objectId: String) returns array of ReadinessAuditEvents;
}

// Restrict update and delete on audit events at the service level
annotate ReadinessService.ReadinessAuditEvents with @(
  Capabilities : {
    DeleteRestrictions : { Deletable : false },
    UpdateRestrictions : { Updatable : false }
  }
);
