
// src/routes/user.routes.js
import { Router } from 'express';
import {
  getMyProfile,
  updateMyProfile,
  getUserTypeAndName
} from '../controllers/user.controller.js';
import { getMySubmissions } from '../controllers/loanSubmission.controller.js';

const router = Router();

// GET  /api/user/me        -> Get profile
// PATCH /api/user/me       -> Update profile (name, mpin)
router.get('/me', getMyProfile);
router.get('/me/navbar', getUserTypeAndName);
router.patch('/me', updateMyProfile);
router.get(
  '/my-submissions',
  getMySubmissions
);

export default router;
