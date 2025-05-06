// src/models/LoanSubmission.js
import mongoose from 'mongoose';

// Schema for individual field responses
const submissionFieldSchema = new mongoose.Schema({
  field_id:    { type: String, required: true },
  field_label: { type: String, required: true },
  // allow strings, numbers, dates, or ObjectId refs for images
  value:       { type: mongoose.Schema.Types.Mixed, required: true },
  type: {
    type: String,
    enum: ['image','text','number','date','datetime','time'],
    required: true
  }
}, { _id: false });

// Stage history entries
const stageHistorySchema = new mongoose.Schema({
  stage:      { type: String, enum: ['draft','pending','approved','rejected'], required: true },
  changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changed_at: { type: Date, default: Date.now }
}, { _id: false });

// Main loan submission schema
const LoanSubmission = new mongoose.Schema({
  loan_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true },
  user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  amount:     { type: Number, required: true, min: 0 },
  stage: {
    type: String,
    enum: ['draft','pending','approved','rejected'],
    default: 'draft'
  },
  // Keep all responses in an array
  fields: {
    type: [submissionFieldSchema],
    required: true,
    validate: fields => Array.isArray(fields) && fields.length > 0
  },

  // History of stage changes
  history: {
    type: [stageHistorySchema],
    default: []
  },

  // Optional approver and comments
  approver_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approval_date:    { type: Date },
  rejection_reason: { type: String },

}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Pre-save: push initial history entry if new
LoanSubmission.pre('save', function(next) {
  if (this.isNew) {
    this.history.push({
      stage: this.stage,
      changed_by: this.user_id,
      changed_at: this.created_at
    });
  }
  next();
});

export default mongoose.model('LoanSubmission', LoanSubmission);
