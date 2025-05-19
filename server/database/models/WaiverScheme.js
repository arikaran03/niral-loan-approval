// src/models/WaiverScheme.js
import mongoose, { Schema } from 'mongoose';

// --- Reusable Subdocument Schemas ---
const fieldSchema = new mongoose.Schema({
  field_id: { type: String, required: true },
  field_label: { type: String, required: true },
  field_prompt: { type: String },
  min_value: { type: String },
  max_value: { type: String },
  type: {
    type: String,
    enum: ['date', 'datetime', 'number', 'text', 'time', 'image', 'document', 'textarea', 'select', 'checkbox', 'multiselect'],
    required: true
  },
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
  schema_id: { type: String, required: true },
}, { _id: false });


// --- Main Waiver Scheme Schema ---
const waiverSchemeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true
  },

  // --- NEW: Link to the specific Loan product this waiver applies to ---
  target_loan_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan', // This must match the model name of your Loan schema
    required: true, // Make this true if a waiver scheme MUST be tied to a loan
    comment: "The specific loan product this waiver scheme is applicable to."
  },
  // --- End of New Field ---

  waiver_type: {
    type: String,
    enum: ['percentage', 'fixed_amount'],
    required: true,
    default: 'percentage'
  },
  waiver_value: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        // Access waiver_type using `this` only if it's a direct property,
        // or ensure it's passed correctly if this validator is part of a sub-schema.
        // For a top-level schema, `this.waiver_type` should work.
        const type = this.get('waiver_type'); // Safer way to get sibling field value
        if (type === 'percentage') {
          return v >= 0 && v <= 100;
        }
        return v >= 0;
      },
      message: props => {
        // Need to access waiver_type carefully here as well.
        // This part of the message might need adjustment or to fetch waiver_type differently
        // if `this` context isn't as expected during validation message generation.
        // For simplicity, assuming it can be determined or a generic message is okay.
        if (props.path === 'waiver_value' /* && this.waiver_type === 'percentage' - this context might be tricky */) {
          return `Waiver percentage (${props.value}) must be between 0 and 100 if type is percentage.`;
        }
        return `Waiver amount (${props.value}) must be non-negative.`;
      }
    }
  },
  applicable_on: {
    type: String,
    enum: ['interest_due', 'principal_outstanding', 'total_outstanding_amount', 'specific_charges'],
    required: true,
    default: 'interest_due'
  },
  max_waiver_cap_amount: {
    type: Number,
    min: 0
  },
  fields: { type: [fieldSchema], default: [] },
  eligibility: { type: eligibilitySchema, required: true },
  required_documents: { type: [documentRequirementSchema], default: [] },
  application_start_date: { type: Date, required: true },
  application_end_date: { type: Date, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// --- Indexes ---
waiverSchemeSchema.index({ status: 1 });
waiverSchemeSchema.index({ application_start_date: 1, application_end_date: 1 });
waiverSchemeSchema.index({ target_loan_id: 1 }); // Index the new field

// --- Middleware & Validation ---
waiverSchemeSchema.pre('save', function(next) {
  if (this.isModified('application_start_date') || this.isModified('application_end_date')) {
    if (this.application_start_date && this.application_end_date && this.application_end_date < this.application_start_date) {
      return next(new Error('Scheme application end date must be on or after the start date.'));
    }
  }

  // Re-check validator logic for waiver_value as `this.waiver_type` might not be set yet if creating
  // The custom validator is better for this.
  // if (this.isModified('waiver_type') || this.isModified('waiver_value')) {
  //   if (this.waiver_type === 'percentage' && (this.waiver_value < 0 || this.waiver_value > 100)) {
  //     return next(new Error('Waiver percentage must be between 0 and 100.'));
  //   }
  //   if (this.waiver_type === 'fixed_amount' && this.waiver_value < 0) {
  //     return next(new Error('Waiver fixed amount must be non-negative.'));
  //   }
  // }

  if (this.isModified('status') && !['draft', 'published', 'archived'].includes(this.status)) {
    return next(new Error(`Invalid status value: ${this.status}`));
  }
  if (this.isNew && !this.target_loan_id) { // Ensure target_loan_id is provided if required
    // This check might be redundant if `required: true` is on the field,
    // but can be an explicit check if needed.
    // return next(new Error('Target loan ID is required for a waiver scheme.'));
  }

  this.updated_at = new Date();
  next();
});

export default mongoose.model('WaiverScheme', waiverSchemeSchema);
