// src/models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Helper to generate a random 16-digit numeric string
function generateAccountNumber() {
  let num = '';
  for (let i = 0; i < 16; i++) {
    num += Math.floor(Math.random() * 10).toString();
  }
  return num;
}

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
  },
  email: {
    type: String,
    unique: true,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/.+@.+\..+/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 8 characters']
  },
  account_number: {
    type: String,
    unique: true,
    default: generateAccountNumber,
    validate: {
      validator: v => /^\d{16}$/.test(v),
      message: props => `${props.value} is not a valid 16-digit account number!`
    }
  },
  mpin: {
    type: String,
    minlength: [4, 'MPIN must be 4 digits'],
    maxlength: [4, 'MPIN cannot exceed 4 digits'],
    match: [/^\d{4}$/, 'MPIN must consist of exactly 4 digits']
  },
  type: {
    type: String,
    enum: ['manager', 'staff', 'user'],
    default: 'user'
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Instance method to compare passwords
userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
