const multer = require('multer');
const { cvStorage, deckStorage, videoStorage } = require('../config/cloudinary');

const MB = 1024 * 1024;

// CV and deck go to Cloudinary (raw); backend proxy fixes Content-Type on serve
const uploadCv   = multer({ storage: cvStorage,   limits: { fileSize: 20 * MB } }).single('cv');
const uploadDeck = multer({ storage: deckStorage,  limits: { fileSize: 20 * MB } }).single('deck');

const uploadVideo = multer({ storage: videoStorage, limits: { fileSize: 100 * MB } }).single('video');

module.exports = { uploadCv, uploadDeck, uploadVideo };
