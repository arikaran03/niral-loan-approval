// src/controllers/adminUser.controller.js
import User from '../database/models/User.js';

/**
 * List all users (admin only)
 */
export async function listUsers(req, res) {
  try {
    const users = await User.find().select('-password');
    return res.json(users);
  } catch (err) {
    console.error('listUsers error', err);
    return res.status(500).json({ error: 'Failed to fetch users.' });
  }
}

/**
 * Get single user by ID (admin only)
 */
export async function getUserById(req, res) {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json(user);
  } catch (err) {
    console.error('getUserById error', err);
    return res.status(400).json({ error: 'Invalid user ID.' });
  }
}

/**
 * Update user's role or MPIN (admin only)
 */
export async function updateUser(req, res) {
  try {
    const allowed = ['type', 'mpin'];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
        context: 'query'
      }
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json(user);
  } catch (err) {
    console.error('updateUser error', err);
    // Handle unique constraint failure on mpin or other validation errors
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join('; ');
      return res.status(400).json({ error: msg });
    }
    return res.status(400).json({ error: err.message });
  }
}

/**
 * Delete user (admin only)
 */
export async function deleteUser(req, res) {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.status(204).end();
  } catch (err) {
    console.error('deleteUser error', err);
    return res.status(400).json({ error: 'Invalid user ID.' });
  }
}
