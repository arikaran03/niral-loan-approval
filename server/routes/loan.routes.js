// src/routes/loan.routes.js
import { Router } from 'express';
import addTimestamps from '../middlewares/timestamp.js';
import loanController from '../controllers/loan.controller.js';
import { requireRole } from '../middlewares/auth.js';

const router = Router();

// Public: list & get
router
  .route('/')
  .get(loanController.list)        // any logged in user
  .post(
    requireRole(['manager','staff']),
    addTimestamps,
    loanController.create
  );

router
  .route('/:id')
  .get(loanController.getById)      // any logged in user
  .put(
    requireRole(['manager','staff']),
    addTimestamps,
    loanController.update
  )
  .patch(
    requireRole(['manager','staff']),
    addTimestamps,
    loanController.update
  )
  .delete(
    requireRole(['manager','staff']),
    loanController.remove
  );

export default router;
