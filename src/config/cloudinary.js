'use strict';

/**
 * config/cloudinary.js
 * ─────────────────────
 * Cloudinary setup + multer-storage-cloudinary for GCash receipt uploads.
 * Reads credentials from .env — never hardcode.
 *
 * Required .env keys:
 *   CLOUDINARY_CLOUD_NAME=
 *   CLOUDINARY_API_KEY=
 *   CLOUDINARY_API_SECRET=
 */

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── GCash receipt storage ──────────────────────────────────────────────────────
// Uploads go to: bingnondo/gcash_receipts/<public_id>
// public_id = gcash_<orderId>_<timestamp> (set dynamically in controller)

const receiptStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:          'bingnondo/gcash_receipts',
    public_id:       `gcash_${req.params.orderId}_${Date.now()}`,
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation:  [{ quality: 'auto', fetch_format: 'auto' }],
  }),
});

const uploadReceipt = multer({
  storage: receiptStorage,
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images are allowed.'));
    }
  },
});

module.exports = { cloudinary, uploadReceipt };