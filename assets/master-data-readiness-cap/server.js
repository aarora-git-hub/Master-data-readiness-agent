"use strict";

/**
 * Custom CDS server bootstrap.
 * Mounts the /health endpoint before CDS takes over all routes.
 */
const cds = require("@sap/cds");
const express = require("express");

cds.on("bootstrap", (app) => {
  // Health check — used by CF liveness/readiness probes
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "UP",
      service: "master-data-readiness-cap",
      timestamp: new Date().toISOString(),
    });
  });
});

// Start CDS server
module.exports = cds.server;
