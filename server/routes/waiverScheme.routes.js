// src/routes/admin/waiverScheme.routes.js
import express from 'express';
import waiverSchemeController from '../controllers/waiverScheme.controller.js'
import mongoose from 'mongoose'; // Keep for ObjectId validation if not handled solely in controller

const router = express.Router();

// Middleware to validate ObjectId for routes with :id param
// This can be kept here or moved entirely into the controller if preferred,
// but it's common to have such validation at the routing layer.
const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid ID format provided.' });
  }
  next();
};

// --- CRUD Routes using the Controller ---

// 1. CREATE a new Waiver Scheme
// POST /api/waiver-schemes
router.post('/', waiverSchemeController.create);

// 2. READ all Waiver Schemes
// GET /api/waiver-schemes
router.get('/', waiverSchemeController.list);

// 3. READ a single Waiver Scheme by ID
// GET /api/waiver-schemes/:id
// The controller's getById method already handles ObjectId validation and 404s.
router.get('/:id', waiverSchemeController.getById);

// 4. UPDATE a Waiver Scheme by ID (can be partial update - PATCH)
// PATCH /api/waiver-schemes/:id
// The controller's update method already handles ObjectId validation and 404s.
router.patch('/:id', waiverSchemeController.update);

// 5. DELETE (Archive) a Waiver Scheme by ID
// DELETE /api/waiver-schemes/:id
// The controller's remove method already handles ObjectId validation and 404s.
router.delete('/:id', waiverSchemeController.remove);

export default router;
