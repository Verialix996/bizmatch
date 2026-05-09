const multer = require('multer');
const { photoStorage, docStorage, videoStorage, ndaStorage } = require('../config/cloudinary');

const MB = 1024 * 1024;

const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: 5 * MB } }).single('photo');

const uploadDoc = multer({ storage: docStorage, limits: { fileSize: 20 * MB } }).single('document');

const uploadDeck = multer({ storage: docStorage, limits: { fileSize: 20 * MB } }).single('deck');

const uploadVideo = multer({ storage: videoStorage, limits: { fileSize: 100 * MB } }).single('video');

const uploadNda = multer({ storage: ndaStorage, limits: { fileSize: 5 * MB } }).single('nda');

module.exports = { uploadPhoto, uploadDoc, uploadDeck, uploadVideo, uploadNda };
