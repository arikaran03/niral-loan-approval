// src/routes/file.routes.js // Renamed file for clarity, adjust if needed
import express from 'express';
import multer from 'multer';
import File from '../database/models/FileModel.js'; // Updated model import
import { requireRole } from '../middlewares/auth.js'; // Assuming you have a middleware for role checking
import mongoose from 'mongoose'; // Import mongoose for ObjectId validation

const router = express.Router();

// Multer in-memory storage for direct buffer access
const storage = multer.memoryStorage();

// Configure multer:
// Add file filter to only accept allowed MIME types from the File model schema
const allowedMimeTypes = [
    'image/jpeg', 
    'image/png', 
    'application/pdf'
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG images and PDF files are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // Example: 10MB file size limit
  }
});

// Upload file endpoint
// Requires authentication middleware to set req.user._id (assuming this is handled elsewhere)
router.post('/', upload.single('file'), async (req, res) => { // Changed 'image' to 'file'
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // The fileFilter in multer should have already validated the mimetype.
    // However, an additional check here can be a safeguard, though typically redundant if multer is configured correctly.
    // if (!allowedMimeTypes.includes(req.file.mimetype)) {
    //   return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG images and PDF files are allowed.' });
    // }

    const newFile = new File({ // Renamed variable
      data: req.file.buffer,
      contentType: req.file.mimetype,
      filename: req.file.originalname,
      size: req.file.size,
      uploadedBy: req.user?._id // Assumes req.user is populated by auth middleware
      // category: req.body.category // Optional: if you want to pass category from client
    });

    const savedFile = await newFile.save(); // Renamed variable
    return res.status(201).json({
      message: 'File uploaded successfully',
      id: savedFile._id,
      filename: savedFile.filename,
      contentType: savedFile.contentType,
      size: savedFile.size
    });
  } catch (err) {
    console.error('Upload error:', err);
    // Handle multer specific errors (e.g., file too large)
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File is too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ error: `Multer error: ${err.message}` });
    }
    // Handle Mongoose validation errors (e.g., invalid contentType if enum is violated)
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ error: messages.join(', ') });
    }
    return res.status(500).json({ error: 'Upload failed due to a server error.' });
  }
});

// Retrieve file by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid file ID format.' });
    }

    const file = await File.findById(id); // Renamed variable
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    res.set('Content-Type', file.contentType);
    // Optional: set Content-Disposition to suggest filename for download
    res.set('Content-Disposition', `inline; filename="${file.filename}"`); // For displaying in browser
    res.set('Content-Disposition', `attachment; filename="${file.filename}"`); // For forcing download
    
  
    return res.send(file.data);
  } catch (err) {
    console.error('File retrieval error:', err);
    return res.status(500).json({ error: 'Error retrieving file.' });
  }
});

// Optional: Delete file by ID (ensure proper authorization)
router.delete('/:id', requireRole(['admin']), async (req, res) => { // Example with role check
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid file ID format.' });
    }
    const file = await File.findByIdAndDelete(id);
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }
    return res.status(200).json({ message: 'File deleted successfully.' });
  } catch (err) {
    console.error('File deletion error:', err);
    return res.status(500).json({ error: 'Error deleting file.' });
  }
});

export default router;
