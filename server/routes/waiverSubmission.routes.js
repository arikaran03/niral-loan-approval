// src/routes/waiverSubmission.routes.js  // Or src/routes/user/waiverSubmission.routes.js if user-facing
import express from 'express';
import waiverSubmissionController from '../controllers/waiverSubmission.controller.js'; // Adjust path as needed
import mongoose from 'mongoose';
// import authMiddleware from '../middleware/auth.middleware.js'; // Example: if you have auth middleware

const router = express.Router();

// Middleware to validate ObjectId for routes with :id param
const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid Submission ID format provided.' });
  }
  next();
};

// --- CRUD Routes for Waiver Submissions using the Controller ---

// 1. CREATE a new Waiver Submission (User action)
// POST /api/waiver-submissions
// router.post('/', authMiddleware.authenticateUser, waiverSubmissionController.create); // Example with auth
router.post('/', waiverSubmissionController.create);


// 2. LIST Waiver Submissions
// GET /api/waiver-submissions
// Could be for an admin to see all, or for a user to see their own.
// Filtering logic would be in the controller based on req.query or req.user.
// router.get('/', authMiddleware.authenticateAdminOrUser, waiverSubmissionController.list); // Example with auth
router.get('/', waiverSubmissionController.list);


// 3. GET a single Waiver Submission by ID
// GET /api/waiver-submissions/:id
// router.get('/:id', authMiddleware.authenticateAdminOrOwner, validateObjectId, waiverSubmissionController.getById); // Example with auth
router.get('/:id', validateObjectId, waiverSubmissionController.getById);


// 4. UPDATE a Waiver Submission by ID (Admin/System action, e.g., change stage)
// PATCH /api/waiver-submissions/:id
// router.patch('/:id', authMiddleware.authenticateAdmin, validateObjectId, waiverSubmissionController.update); // Example with auth
router.patch('/:id', validateObjectId, waiverSubmissionController.update);


// 5. CANCEL/CLOSE a Waiver Submission by ID (User or Admin action, depending on rules)
// This is often a status change rather than a hard delete.
// The controller's 'remove' or a specific 'cancel' method would handle this.
// DELETE /api/waiver-submissions/:id
// router.delete('/:id', authMiddleware.authenticateAdminOrOwner, validateObjectId, waiverSubmissionController.removeOrCancel); // Example with auth
router.delete('/:id', validateObjectId, waiverSubmissionController.removeOrCancel); // Assuming controller has a method for this

// --- Additional User-Specific Routes (Examples) ---

// GET all submissions for a specific Waiver Scheme (Admin or public, depending on needs)
// GET /api/waiver-submissions/scheme/:schemeId
router.get('/scheme/:schemeId', waiverSubmissionController.listByScheme);

// GET all submissions by a specific User (Admin or the user themselves)
// GET /api/waiver-submissions/user/:userId (or typically just /user/me from authenticated route)
// router.get('/user/me', authMiddleware.authenticateUser, waiverSubmissionController.listByUser); // Example

export default router;
