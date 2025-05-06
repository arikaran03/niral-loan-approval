// src/routes/admin.routes.js
import { Router } from 'express';
import { requireRole } from '../middlewares/auth.js';
import { getDashboardStats } from '../controllers/admin.controller.js';

const router = Router();

// All routes here require manager or staff
router.use(requireRole(['manager','staff']));

// GET /api/admin/stats/dashboard
router.get('/dashboard', getDashboardStats);

export default router;
