"use strict";

/**
 * Custom CDS server bootstrap.
 * Mounts /health and /sessions REST endpoints before CDS takes over.
 */
const cds = require("@sap/cds");

cds.on("bootstrap", (app) => {
  // CORS — allow the Fiori UI to call this service
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "UP",
      service: "master-data-readiness-cap",
      timestamp: new Date().toISOString(),
    });
  });

  // Session REST API for the Fiori UI
  const sessionRouter = require("./srv/session-router");
  app.use("/sessions", sessionRouter);
});

// Actively start the CDS server (keeps process alive in CF)
cds.server({
  port: process.env.PORT || 4004
}).catch(err => {
  console.error("Failed to start CDS server:", err);
  process.exit(1);
});
