// src/controllers/auth.controller.js
import User from '../database/models/User.js';
import bcrypt from 'bcryptjs';         // use bcryptjs to match your model
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

// Basic email format check
function validateEmail(email) {
  const re = /\S+@\S+\.\S+/;
  return re.test(email);
}

export const login = async (req, res) => {
  const { email, password } = req.body;
  const lowerEmail = email ? email.toLowerCase() : null; // Normalize email

  // 1) Validate inputs
  if (!lowerEmail || !password) { // Use lowerEmail
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (!validateEmail(lowerEmail)) { // Use lowerEmail
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  try {

    console.log('Login attempt with email:', lowerEmail);
    // 2) Find user using normalized email
    const user = await User.findOne({ email: lowerEmail });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    console.log('User found:', user);

    // ... rest of the function remains the same
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const payload = { id: user._id, email: user.email, type: user.type }; // user.email will be the lowercase email from DB
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        account_number: user.account_number,
        type: user.type
      }
    });
  } catch (err) {
    console.error('Error during login:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const register = async (req, res) => {
  const { name, email, password } = req.body;
  const lowerEmail = email ? email.toLowerCase() : null; // Normalize email

  // 1) Validate inputs
  if (!name || name.length < 2 || name.length > 50) {
    return res.status(400).json({ error: 'Name must be between 2 and 50 characters.' });
  }
  // Use lowerEmail for validation and operations
  if (!lowerEmail || !validateEmail(lowerEmail)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    // 2) Check for existing user using normalized email
    const existing = await User.findOne({ email: lowerEmail });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered. Please log in.' });
    }

    // 3) Hash password & create user with normalized email
    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email: lowerEmail, password: hashed }); // Store lowercase email
    await newUser.save();

    // 4) (Optional) Auto-login: issue JWT
    const payload = { id: newUser._id, email: newUser.email, type: newUser.type }; // newUser.email is already lowercase
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email, // This will be the lowercase email
        account_number: newUser.account_number,
        type: newUser.type
      }
    });
  } catch (err) {
    console.error('Error during registration:', err);
    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(400).json({ error: 'Email already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
};