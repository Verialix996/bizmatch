const multer = require('multer');

const MB = 1024 * 1024;

// Memory storage — controllers upload the buffer to Supabase Storage
// themselves (see config/storage.js) after multer parses the multipart body.
const uploadCv    = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * MB } }).single('cv');
const uploadDeck  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * MB } }).single('deck');
const uploadVideo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * MB } }).single('video');

module.exports = { uploadCv, uploadDeck, uploadVideo };
