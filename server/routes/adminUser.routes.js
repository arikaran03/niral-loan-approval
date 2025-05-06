// src/routes/adminUser.routes.js
import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.js';
import {
  listUsers,
  getUserById,
  updateUser,
  deleteUser
} from '../controllers/adminUser.controller.js';

const router = Router();

// All admin/user management routes require auth + manager/staff
router.use(requireRole(['manager','staff']));

// GET    /api/admin/users        -> list all users
// GET    /api/admin/users/:id    -> get user details
// PATCH  /api/admin/users/:id    -> update user (type/mpin)
// DELETE /api/admin/users/:id    -> delete user
router.get('/', listUsers);
router.get('/:id', getUserById);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
