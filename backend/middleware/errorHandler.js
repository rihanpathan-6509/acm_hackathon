// middleware/errorHandler.js
//
// Generic Express error-handling middleware — catches anything thrown or
// passed to next(err) in any route and returns a consistent JSON error
// shape instead of Express's default HTML error page.

function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
}

module.exports = { errorHandler };
