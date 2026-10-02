/**
 * Health check endpoint for CF readiness/liveness probes.
 * Mounted at /health by server.js bootstrap.
 */
module.exports = (app) => {
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'UP',
      service: 'master-data-readiness-cap',
      timestamp: new Date().toISOString()
    });
  });
};
