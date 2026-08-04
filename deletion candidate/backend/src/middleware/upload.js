const multer = require('multer');
const { photoStorage, cvStorage, deckStorage, videoStorage } = require('../config/cloudinary');

const MB = 1024 * 1024;

const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: 5 * MB } }).single('photo');

// CV and deck go to Cloudinary (raw); backend proxy fixes Content-Type on serve
const uploadCv   = multer({ storage: cvStorage,   limits: { fileSize: 20 * MB } }).single('cv');
const uploadDeck = multer({ storage: deckStorage,  limits: { fileSize: 20 * MB } }).single('deck');

// ID document upload — only checks presence, no persistent storage needed
const uploadDoc = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * MB } }).single('document');

const uploadVideo = multer({ storage: videoStorage, limits: { fileSize: 100 * MB } }).single('video');

module.exports = { uploadPhoto, uploadCv, uploadDeck, uploadDoc, uploadVideo };
