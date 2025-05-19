// src/models/Loan.js (or similar)
import mongoose, { Schema } from 'mongoose';

// Subdocument Schemas (remain the same)
const fieldSchema = new mongoose.Schema({
  field_id: { type: String, required: true },
  field_label: { type: String, required: true },
  field_prompt: { type: String },
  min_value: { type: String },
  max_value: { type: String },
  type: { type: String, enum: ['date', 'datetime', 'number', 'text', 'time', 'image', 'document', 'textarea', 'select', 'checkbox', 'multiselect'], required: true },
  options: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  required: { type: Boolean, default: false },
  auto_fill_sources: { type: [String], default: [] },
}, { _id: false });

const eligibilitySchema = new mongoose.Schema({
  min_age: { type: Number, required: true, min: 18 },
  max_age: { type: Number },
  min_income: { type: Number, required: true, min: 0 },
  min_credit_score: { type: Number, min: 300, max: 900 }
}, { _id: false });

const documentRequirementSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  schema_id: { type: String, required: true }, // Reference to the schema definition
}, { _id: false });

// --- Main Loan Schema (MODIFIED) ---
const loanSchema = new mongoose.Schema({
  // --- Basic Metadata ---
  title:       { type: String, required: true },
  description: { type: String, required: true },  // rich HTML allowed
  

  // --- Status ---
  status: {
    type: String,
    enum: ['draft', 'published'], // Define possible statuses
    default: 'draft',            // Default to draft
    index: true                  // Index for faster status filtering
  },

  // --- Financial Details ---
  min_amount:    { type: Number, required: true, min: 0 },
  max_amount:    { type: Number, required: true, min: 0 },
  interest_rate: { type: Number, required: true, min: 0 }, // Annual percentage
  tenure_months: { type: Number, required: true, min: 1 }, // Duration in months
  processing_fee: { type: Number, default: 0, min: 0 },
  collateral_required: { type: Boolean, default: false },

  // --- Custom Application Fields (Embedded) ---
  fields: { type: [fieldSchema], default: [] },

  // --- Eligibility Criteria ---
  eligibility:   { type: eligibilitySchema, required: true },

  // --- Standard Document Requirements ---
  required_documents: { type: [documentRequirementSchema], default: [] },

  // --- Application Window ---
  application_start: { type: Date, required: true },
  application_end:   { type: Date, required: true },

  // --- Optional Scheduling ---
  disbursement_date: { type: Date }, // Planned date for disbursing funds

  // --- Audit Timestamps ---
  created_at:  { type: Date, default: Date.now },
  updated_at:  { type: Date, default: Date.now }
});

// --- Indexes ---
loanSchema.index({ application_start: 1, application_end: 1 });
// loanSchema.index({ 'fields.field_id': 1 }); // Optional

// --- Middleware & Validation ---
loanSchema.pre('save', function(next) {
    // Don't run full validation logic on drafts? Or maybe just basic checks?
    // For now, keeping validation, but you might adjust based on draft requirements.

    // Validate amount consistency
    if (this.isModified('min_amount') || this.isModified('max_amount')) {
        if (this.max_amount < this.min_amount) {
          return next(new Error('Maximum amount cannot be less than minimum amount.'));
        }
    }
    // Validate date consistency
    if (this.isModified('application_start') || this.isModified('application_end')) {
        if (this.application_start && this.application_end && this.application_end < this.application_start) {
            return next(new Error('Application end date must be on or after the start date.'));
        }
    }
    if (this.isModified('application_end') || this.isModified('disbursement_date')) {
        if (this.application_end && this.disbursement_date && this.disbursement_date < this.application_end) {
            return next(new Error('Disbursement date cannot be before the application end date.'));
        }
    }

  // Ensure status is valid if being set (though enum should handle this)
   if (this.isModified('status') && !['draft', 'published'].includes(this.status)) {
        return next(new Error(`Invalid status value: ${this.status}`));
    }

  // Auto-update updated_at timestamp
  this.updated_at = new Date();
  next();
});

export default mongoose.model('Loan', loanSchema);