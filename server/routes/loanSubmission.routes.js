// src/routes/loanSubmission.routes.js
import { Router } from 'express';
import addTimestamps from '../middlewares/timestamp.js';
import {
  getDraft,
  saveDraft,
  createSubmission,
  listByLoan,
  getSubmission,
  updateSubmission,
  filterSubmissions,
  changeSubmissionStage
} from '../controllers/loanSubmission.controller.js';
import { requireRole } from '../middlewares/auth.js';

const router = Router();

// === Draft endpoints (user) ===
router
  .get('/:loanId/submissions/draft', getDraft)
  .post(
    '/:loanId/submissions/draft',
    addTimestamps,
    saveDraft
  );

// === Create final submission (user) ===
router.post(
  '/:loanId/submissions',
  addTimestamps,
  createSubmission
);

// === User-facing listing & detail ===
router.get('/:loanId/submissions', listByLoan);
router.get('/submissions/:id', getSubmission);
router.get('/submissions', filterSubmissions);

// === Update submission (manager/staff) ===
router.patch(
  '/submissions/:id',
  requireRole(['manager', 'staff']),
  addTimestamps,
  updateSubmission
);

// === Change stage only (manager/staff) ===
router.patch(
  '/submissions/:id/change-stage',
  requireRole(['manager', 'staff']),
  addTimestamps,
  changeSubmissionStage
);

export default router;
