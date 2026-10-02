namespace com.sap.masterdata.readiness;

using { cuid, managed } from '@sap/cds/common';

/**
 * Represents a single readiness session for a master data object.
 * One session per object creation event.
 */
entity ReadinessSession : cuid, managed {
  objectId        : String(50) not null;
  objectType      : String(20) not null; // MATERIAL / PLANT / CUSTOMER_BP
  persona         : String(50);
  plantType       : String(20); // OWN / THIRD_PARTY / IN_TRANSIT
  materialType    : String(20);
  accountGroup    : String(10);
  startedAt       : Timestamp not null;
  declaredReadyAt : Timestamp;
  overallStatus   : String(30) default 'IN_PROGRESS';
  // overallStatus: IN_PROGRESS / READY / BLOCKED
}

/**
 * Immutable audit trail event for every agent action and user decision.
 * Records are write-once; READINESS_DECLARED events must never be overwritten.
 */
entity ReadinessAuditEvent : cuid {
  session         : Association to ReadinessSession;
  objectId        : String(50) not null;
  stepId          : String(100);
  actionType      : String(50) not null;
  // CHECKLIST_RETRIEVED / STEP_VALIDATED / FORM_SUBMITTED / WRITE_EXECUTED /
  // WRITE_FAILED / STEP_DECLARED_COMPLETE / EVIDENCE_ATTACHED /
  // READINESS_DECLARED / STEP_CANCELLED / STEP_BLOCKED
  actor           : String(100) not null;
  timestamp       : Timestamp not null;
  status          : String(50);
  evidenceRef     : String(500); // BTP Object Store blob URL
  errorDetail     : String(1000);
  fieldValuesJson : LargeString; // JSON string of field values for write events
  isImmutable     : Boolean default false;
}

// Index hint for objectId queries
annotate ReadinessAuditEvent with @(
  cds.persistence : { journal : false }
);
