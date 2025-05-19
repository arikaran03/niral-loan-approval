// src/models/WaiverScheme.js
import mongoose, { Schema } from 'mongoose';

// --- Reusable Subdocument Schemas (assuming they are defined elsewhere or copy them here if not) ---

// If these schemas are in separate files, you would import them.
// For this example, I'll redefine them for clarity, but in a real project, you'd share them.

const fieldSchema = new mongoose.Schema({
  field_id: { type: String, required: true },
  field_label: { type: String, required: true },
  field_prompt: { type: String },
  min_value: { type: String }, // Can be number or date string depending on 'type'
  max_value: { type: String }, // Can be number or date string depending on 'type'
  type: {
    type: String,
    enum: ['date', 'datetime', 'number', 'text', 'time', 'image', 'document', 'textarea', 'select', 'checkbox', 'multiselect'],
    required: true
  },
  options: { type: [mongoose.Schema.Types.Mixed], default: undefined }, // For select, checkbox, multiselect
  required: { type: Boolean, default: false },
  auto_fill_sources: { type: [String], default: [] }, // e.g., "aadhaar_card.name"
}, { _id: false });

const eligibilitySchema = new mongoose.Schema({
  min_age: { type: Number, required: true, min: 18 },
  max_age: { type: Number },
  min_income: { type: Number, required: true, min: 0 },
  min_credit_score: { type: Number, min: 300, max: 900 }
  // You can add other waiver-specific eligibility criteria here
}, { _id: false });

const documentRequirementSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., 'income_proof', 'loan_statement'
  description: String,
  schema_id: { type: String, required: true }, // Reference to a generic document schema definition if you have one
}, { _id: false });


// --- Main Waiver Scheme Schema ---
const waiverSchemeSchema = new mongoose.Schema({
  // --- Basic Metadata ---
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true }, // Rich HTML content allowed

  // --- Status of the Scheme ---
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'], // Possible statuses for a waiver scheme
    default: 'draft',
    index: true
  },

  // --- Waiver Details ---
  waiver_type: {
    type: String,
    enum: ['percentage', 'fixed_amount'],
    required: true,
    default: 'percentage'
  },
  waiver_value: { // Stores the percentage (e.g., 10 for 10%) or the fixed amount
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        if (this.waiver_type === 'percentage') {
          return v >= 0 && v <= 100;
        }
        return v >= 0;
      },
      message: props => {
        if (props.path === 'waiver_value' && this.waiver_type === 'percentage') {
          return `Waiver percentage (${props.value}) must be between 0 and 100.`;
        }
        return `Waiver amount (${props.value}) must be non-negative.`;
      }
    }
  },
  applicable_on: { // What the waiver applies to (e.g., outstanding interest, a portion of principal)
    type: String,
    enum: ['interest_due', 'principal_outstanding', 'total_outstanding_amount', 'specific_charges'],
    required: true,
    default: 'interest_due'
  },
  max_waiver_cap_amount: { // Optional: A maximum monetary cap for the waiver, even if percentage-based
    type: Number,
    min: 0
  },

  // --- Custom Application Fields (for waiver application if any) ---
  fields: { type: [fieldSchema], default: [] },

  // --- Eligibility Criteria for the Waiver Scheme ---
  eligibility: { type: eligibilitySchema, required: true },

  // --- Document Requirements for applying for the waiver ---
  required_documents: { type: [documentRequirementSchema], default: [] },

  // --- Scheme Active Period ---
  application_start_date: { type: Date, required: true },
  application_end_date: { type: Date, required: true },

  // --- Audit Timestamps ---
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// --- Indexes ---
waiverSchemeSchema.index({ status: 1 });
waiverSchemeSchema.index({ application_start_date: 1, application_end_date: 1 });
// waiverSchemeSchema.index({ 'fields.field_id': 1 }); // Optional, if you query by specific custom field IDs

// --- Middleware & Validation ---
waiverSchemeSchema.pre('save', function(next) {
  // Validate date consistency
  if (this.isModified('application_start_date') || this.isModified('application_end_date')) {
    if (this.application_start_date && this.application_end_date && this.application_end_date < this.application_start_date) {
      return next(new Error('Scheme application end date must be on or after the start date.'));
    }
  }

  // Validate waiver_value based on waiver_type
  if (this.isModified('waiver_type') || this.isModified('waiver_value')) {
    if (this.waiver_type === 'percentage' && (this.waiver_value < 0 || this.waiver_value > 100)) {
      return next(new Error('Waiver percentage must be between 0 and 100.'));
    }
    if (this.waiver_type === 'fixed_amount' && this.waiver_value < 0) {
      return next(new Error('Waiver fixed amount must be non-negative.'));
    }
  }

  // Ensure status is valid if being set (though enum should handle this)
  if (this.isModified('status') && !['draft', 'published', 'archived'].includes(this.status)) {
    return next(new Error(`Invalid status value: ${this.status}`));
  }

  // Auto-update updated_at timestamp
  this.updated_at = new Date();
  next();
});

export default mongoose.model('WaiverScheme', waiverSchemeSchema);
