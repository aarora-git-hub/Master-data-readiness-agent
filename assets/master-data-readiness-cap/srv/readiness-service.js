"use strict";

const cds = require("@sap/cds");

module.exports = class ReadinessService extends cds.ApplicationService {
  async init() {
    const { ReadinessAuditEvents, ReadinessSessions } = this.entities;

    // Prevent update and delete on audit events (belt-and-suspenders on top of CDS annotations)
    this.before(["UPDATE", "DELETE"], ReadinessAuditEvents, () => {
      throw new cds.error("Audit events are immutable and cannot be updated or deleted.", 403);
    });

    // Enforce immutability: if isImmutable is true, block any subsequent write
    this.before("CREATE", ReadinessAuditEvents, async (req) => {
      const { ID, actionType } = req.data;
      if (actionType === "READINESS_DECLARED") {
        req.data.isImmutable = true;
      }
    });

    // getAuditTrailByObject: return all events for an object sorted by timestamp
    this.on("getAuditTrailByObject", async (req) => {
      const { objectId } = req.data;
      if (!objectId) {
        req.error(400, "objectId is required.");
        return;
      }
      return await SELECT.from(ReadinessAuditEvents)
        .where({ objectId })
        .orderBy("timestamp asc");
    });

    // Update session overallStatus to READY when a READINESS_DECLARED event is persisted
    this.after("CREATE", ReadinessAuditEvents, async (result) => {
      if (result && result.actionType === "READINESS_DECLARED" && result.objectId) {
        await UPDATE(ReadinessSessions)
          .set({ overallStatus: "READY", declaredReadyAt: result.timestamp })
          .where({ objectId: result.objectId });
      }
    });

    await super.init();
  }
};
