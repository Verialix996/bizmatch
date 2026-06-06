const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const photoStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'bizmatch/photos', allowed_formats: ['jpg', 'jpeg', 'png'], resource_type: 'image' },
});

const cvStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: 'bizmatch/cvs',
    resource_type: 'raw',
    public_id: `cv_${Date.now()}`,
    format: 'pdf',
  }),
});

const deckStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: 'bizmatch/decks',
    resource_type: 'raw',
    public_id: `deck_${Date.now()}`,
    format: 'pdf',
  }),
});

const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'bizmatch/videos', allowed_formats: ['mp4', 'mov'], resource_type: 'video' },
});

module.exports = { cloudinary, photoStorage, cvStorage, deckStorage, videoStorage };
