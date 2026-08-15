// middleware/auth.js
//
// STUB — patient authentication strategy isn't decided yet (JWT? sessions?
// something else?). Not implementing a real one here since guessing wrong
// means thrown-away work — this is backend's call. Currently a pass-through
// so routes can require() this without breaking before the real strategy
// is picked.

function requireAuth(req, res, next) {
  // TODO: replace with real auth once the strategy is decided.
  next();
}

module.exports = { requireAuth };
