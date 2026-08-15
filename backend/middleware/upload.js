// middleware/upload.js
//
// Multer setup for multipart image uploads (prescription/lab report
// photos), memory storage so the buffer can be base64-encoded and handed
// to extractController without writing to disk first.
//
// NOTE: extractController.js currently expects `req.body.base64Image` as
// raw JSON (see FRONTEND_HANDOFF.md), not a multipart file. If the upload
// flow switches to this middleware, extractController needs a small change
// to read `req.file.buffer.toString("base64")` instead — flagging that,
// not changing it without confirming that's the direction you want.

const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB, matches index.js's JSON body limit
});

module.exports = { upload };
