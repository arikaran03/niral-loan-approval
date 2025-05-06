
// src/routes/user.routes.js
import { Router } from 'express';
import {
  getMyProfile,
  updateMyProfile
} from '../controllers/user.controller.js';

const router = Router();

// GET  /api/user/me        -> Get profile
// PATCH /api/user/me       -> Update profile (name, mpin)
router.get('/me', getMyProfile);
router.patch('/me', updateMyProfile);

export default router;
