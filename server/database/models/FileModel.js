// src/models/File.js
import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  // Binary file data stored in MongoDB
  data: {
    type: Buffer,
    required: true
  },
  // MIME type, restricted to common image types and PDF
  contentType: {
    type: String,
    required: true,
    trim: true,
    enum: [
        'image/jpeg', 
        'image/png', 
        'application/pdf'
    ], // Add or remove MIME types as needed
    comment: "MIME type of the file. Restricted to specific images and PDFs."
  },
  // Original filename for reference
  filename: {
    type: String,
    required: true, // Make filename required for better identification
    trim: true
  },
  // Size in bytes
  size: {
    type: Number,
    min: 0,
    required: true // Make size required
  },
  // Optional: reference to the uploading user
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Optional: A field to categorize the file if needed, e.g., 'profile_picture', 'loan_document'
  category: {
    type: String,
    trim: true,
    index: true // Index if you plan to query by category
  }
}, {
  // Automatically add createdAt and updatedAt
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// Index by creation time for efficient retrieval
fileSchema.index({ createdAt: -1 });
fileSchema.index({ uploadedBy: 1, category: 1 }); // Example compound index

fileSchema.pre('save', function(next) {
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB example limit
  if (this.size > MAX_FILE_SIZE_BYTES) {
    return next(new Error(`File size (${this.size} bytes) exceeds the maximum limit of ${MAX_FILE_SIZE_BYTES / (1024*1024)}MB.`));
  }
  next();
});

export default mongoose.model('File', fileSchema); // Renamed model from 'Image' to 'File'
