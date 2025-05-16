// src/controllers/user.controller.js
import User from '../database/models/UserModel.js';

/**
 * Get current user's profile (from req.user)
 */
export async function getMyProfile(req, res) {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json(user);
  } catch (err) {
    console.error('getMyProfile error', err);
    return res.status(500).json({ error: 'Failed to fetch profile.' });
  }
}

/**
 * Update current user's profile fields
 */
export async function updateMyProfile(req, res) {
  try {
    const updates = {};
    const allowed = ['name', 'mpin'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
      context: 'query'
    }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json(user);
  } catch (err) {
    console.error('updateMyProfile error', err);
    return res.status(400).json({ error: err.message });
  }
}

export async function getUserTypeAndName(req, res) {
  try {
    const user = await User.findById(req.user._id).select('type name');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json({ type: user.type, name: user.name });
  }
  catch (err) {
    console.error('getUserTypeAndName error', err);
    return res.status(500).json({ error: 'Failed to fetch user type and name.' });
  }
}
