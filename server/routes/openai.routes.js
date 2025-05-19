// src/routes/openai.routes.js

import express from 'express';
import multer from 'multer';
import openaiController from "../controllers/openai.controller.js";
// Optional: Add authentication middleware if needed
// import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();

// Configure Multer for file uploads (using memory storage)
// Adjust limits as needed
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Example: 10MB limit
    fileFilter: (req, file, cb) => {
        // Accept common image types
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images are allowed.'), false);
        }
    }
});

// Define the route for entity extraction
// POST /api/openai/extract-entity
router.post(
    '/extract-entity',
    // authMiddleware.authenticate, // Add authentication if required
    upload.single('file'), // Middleware to handle single file upload named 'document'
    openaiController.extractEntitiesFromImage
);

// Middleware to handle multer errors specifically
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading.
        console.error("Multer error:", err);
        return res.status(400).json({ error: `File upload error: ${err.message}` });
    } else if (err) {
        // An unknown error occurred when uploading.
        console.error("Unknown upload error:", err);
         if (err.message === 'Invalid file type. Only images are allowed.') {
            return res.status(400).json({ error: err.message });
         }
        return res.status(500).json({ error: 'An unexpected error occurred during file upload.' });
    }
    // Everything went fine.
    next();
});


export default router;
