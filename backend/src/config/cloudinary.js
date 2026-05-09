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

const docStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'bizmatch/docs', allowed_formats: ['pdf', 'pptx', 'ppt'], resource_type: 'raw' },
});

const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'bizmatch/videos', allowed_formats: ['mp4', 'mov'], resource_type: 'video' },
});

const ndaStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'bizmatch/ndas', allowed_formats: ['pdf'], resource_type: 'raw' },
});

module.exports = { cloudinary, photoStorage, docStorage, videoStorage, ndaStorage };
