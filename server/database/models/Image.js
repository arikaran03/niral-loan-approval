// src/models/Image.js
import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
  // Binary image data stored in MongoDB
  data: {
    type: Buffer,
    required: true
  },
  // MIME type, e.g. "image/png"
  contentType: {
    type: String,
    required: true,
    trim: true
  },
  // Original filename for reference
  filename: {
    type: String,
    trim: true
  },
  // Size in bytes
  size: {
    type: Number,
    min: 0
  },
  // Optional: reference to the uploading user
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  // Automatically add createdAt and updatedAt
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// Index by creation time for efficient retrieval
imageSchema.index({ createdAt: -1 });

export default mongoose.model('Image', imageSchema);
