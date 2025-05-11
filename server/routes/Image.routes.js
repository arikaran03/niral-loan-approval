// src/routes/image.routes.js
import express from 'express';
import multer from 'multer';
import Image from '../database/models/ImageModel.js';

const router = express.Router();
// Multer in-memory storage for direct buffer access
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload image endpoint
// Requires authentication middleware to set req.user._id
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const image = new Image({
      data: req.file.buffer,
      contentType: req.file.mimetype,
      filename: req.file.originalname,
      size: req.file.size,
      uploadedBy: req.user?._id
    });

    const savedImage = await image.save();
    return res.status(201).json({
      message: 'Image uploaded successfully',
      id: savedImage._id
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Upload failed.' });
  }
});

// Retrieve image by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found.' });
    }

    res.set('Content-Type', image.contentType);
    return res.send(image.data);
  } catch (err) {
    console.error('Retrieval error:', err);
    return res.status(500).json({ error: 'Error retrieving image.' });
  }
});

export default router;
