// src/controllers/auth.controller.js
import User from '../database/models/UserModel.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

// Basic email format check (tests on lowercase version)
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

export async function register(req, res) {
  let { name, role: type, email, password } = req.body;

  if (email) {
    email = String(email).toLowerCase();
  }

  console.log('Register attempt with email:', email);
  console.log('Register attempt with name:', name);
  console.log('Register attempt with type:', type);
  console.log('Register attempt with password:', password);

  try {
    // Validate inputs
    if (!name || name.length < 2 || name.length > 50) {
      return res.status(400).json({ error: 'Name must be between 2 and 50 characters.' });
    }
    if (!type || !['user', 'manager', 'staff'].includes(type)) {
      return res.status(400).json({ error: 'Type must be one of user, manager, or staff.' });
    }
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
    // Changed password length validation to 6 as requested.
    // REMEMBER: Your User.js model also has password length validation (minlength: 8).
    // You MUST update User.js model's password minlength to 6 if you want this to be effective.
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ email: email });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use.' });
    }

    const mpin = (type === 'user') ? randomDigits(4) : undefined;

    // Create user with PLAIN password. Model's pre('save') hook will hash it.
    const newUser = new User({
      name,
      type,
      email: email,
      password: password, // Pass PLAIN password
      // account_number will use default from model if not provided
      mpin: mpin
    });
    await newUser.save(); // Model's pre-save hook will hash the password

    if (type === 'user') {
      return res.status(201).json({
        message: 'User registered successfully.',
        account_number: newUser.account_number,
        mpin: newUser.mpin,
      });
    }

    return res.status(201).json({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} registered successfully.`,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        type: newUser.type
      }
    });

  } catch (err) {
    console.error('Register error:', err); // Keep essential error logging for server issues
    if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
      return res.status(400).json({ error: 'Email already in use.' });
    }
    if (err.name === 'ValidationError') {
        let errors = {};
        for (let field in err.errors) {
            errors[field] = err.errors[field].message;
        }
        return res.status(400).json({ error: 'Validation failed', errors });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function login(req, res) {
  let { type, email, password, account_number, mpin } = req.body;

  if (email) {
    email = String(email).toLowerCase();
  }

  try {
    if (!type) {
      return res.status(400).json({ error: 'Login type is required.' });
    }

    let user;
    let payloadBase = {};
    let isMatch = false;

    if (type === 'user') {
      if (!account_number || !mpin) {
        return res.status(400).json({ error: 'Account number and MPIN are required.' });
      }
      if (!/^\d{16}$/.test(account_number) || !/^\d{4}$/.test(mpin)) {
        return res.status(400).json({ error: 'Invalid account number or MPIN format.' });
      }

      user = await User.findOne({ account_number, type: 'user' });

      if (!user) {
        return res.status(400).json({ error: 'Invalid account number or MPIN.' });
      }
      
      if (user.mpin !== mpin) {
          return res.status(400).json({ error: 'Invalid account number or MPIN.' });
      }
      isMatch = true;
      payloadBase = { account_number: user.account_number };

    } else if (type === 'staff' || type === 'manager') {
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }
      if (!validateEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }

      user = await User.findOne({ email: email, type });

      if (!user) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

      isMatch = await user.comparePassword(password); // Using model's method

      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }
      payloadBase = { email: user.email, name: user.name };

    } else {
      return res.status(400).json({ error: 'Invalid login type.' });
    }

    if(!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials.' });
    }
    
    const payload = { _id: user._id, type: user.type, ...payloadBase, name: user.name };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        type: user.type,
        ...(user.type === 'user' && { account_number: user.account_number }),
        ...( (user.type === 'staff' || user.type === 'manager') && { email: user.email } )
      }
    });

  } catch (err) {
    console.error('Login error:', err); // Keep essential error logging for server issues
    return res.status(500).json({ error: 'Internal server error.' });
  }
}