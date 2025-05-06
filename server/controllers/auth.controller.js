// src/controllers/auth.controller.js
import User from '../database/models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWT_SECRET } from '../config.js';

// basic email regex
function validateEmail(email) {
  const re = /\S+@\S+\.\S+/;
  return re.test(String(email).toLowerCase());
}

// Generate a random numeric string of given length
function randomDigits(length) {
  let s = '';
  for (let i = 0; i < length; i++) {
    s += Math.floor(Math.random() * 10);
  }
  return s;
}

// Ensure uniqueness in DB
async function generateUniqueAccountNumber() {
  let acct;
  let exists;
  do {
    acct = randomDigits(16);
    exists = await User.findOne({ account_number: acct });
  } while (exists);
  return acct;
}

async function generateUniqueMpin() {
  let mpin;
  let exists;
  do {
    mpin = randomDigits(4);
    exists = await User.findOne({ mpin });
  } while (exists);
  return mpin;
}

export async function register(req, res) {
  const { name, role: type, email, password } = req.body;

  try {
    // Validate inputs
    if (!name || name.length < 2 || name.length > 50) {
      return res.status(400).json({ error: 'Name must be between 2 and 50 characters.' });
    }
    if (!type || !['user','manager','staff'].includes(type)) {
      return res.status(400).json({ error: 'Type must be one of user, manager, or staff.' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check for existing email
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use.' });
    }

    // Generate account_number & mpin
    const account_number = await generateUniqueAccountNumber();
    const mpin = await generateUniqueMpin();

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      type,
      email,
      password: hashed,
      account_number,
      mpin
    });
    await user.save();

    // For 'user' we return the creds so they can log in with account_number/mpin
    if (type === 'user') {
      return res.status(201).json({
        message: 'User registered successfully.',
        account_number,
        mpin
      });
    }

    // For manager/staff we skip returning account_number/mpin
    return res.status(201).json({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} registered successfully.`
    });

  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function login(req, res) {
    console.log('Login request:', req.body);
  const { type } = req.body;

  try {
    if (!type) {
      return res.status(400).json({ error: 'Login type is required.' });
    }

    let user, payload;

    if (type === 'user') {
      const { account_number, mpin } = req.body;
      if (!account_number || !mpin) {
        return res.status(400).json({ error: 'account_number and mpin are required.' });
      }
      if (!/^\d{16}$/.test(account_number) || !/^\d{4}$/.test(mpin)) {
        return res.status(400).json({ error: 'Invalid account_number or mpin format.' });
      }
      user = await User.findOne({ account_number, type: 'user' });
      if (!user || user.mpin !== mpin) {
        return res.status(400).json({ error: 'Invalid account number or mpin.' });
      }
      payload = { _id: user._id, type: 'user' };

    } else if (type === 'staff' || type === 'manager') {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }
      if (!validateEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }
      user = await User.findOne({ email, type });
      if (!user) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }
      payload = { _id: user._id, type };

    } else {
      return res.status(400).json({ error: 'Invalid login type.' });
    }

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
    return res.status(200).json({ type: payload.type, token });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
