// src/models/WaiverScheme.js
import mongoose, { Schema } from 'mongoose';

// --- Reusable Subdocument Schemas (omitted for brevity, no changes here) ---
const fieldSchema = new mongoose.Schema({
  field_id: { type: String, required: [true, 'Field ID is required'] },
  field_label: { type: String, required: [true, 'Field label is required'] },
  field_prompt: { type: String },
  min_value: { type: String },
  max_value: { type: String },
  type: {
    type: String,
    enum: {
      values: ['date', 'datetime', 'number', 'text', 'time', 'image', 'document', 'textarea', 'select', 'checkbox', 'multiselect'],
      message: '{VALUE} is not a supported field type'
    },
    required: [true, 'Field type is required']
  },
  options: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  required: { type: Boolean, default: false },
  auto_fill_sources: { type: [String], default: [] },
}, { _id: false });

const eligibilitySchema = new mongoose.Schema({
  min_age: { type: Number, required: [true, 'Minimum age is required'], min: [18, 'Minimum age must be at least 18 years'] },
  max_age: {
    type: Number,
    validate: {
      validator: function(v) { return !v || v >= this.min_age; },
      message: 'Maximum age must be greater than minimum age'
    }
  },
  min_income: { type: Number, required: [true, 'Minimum income is required'], min: [0, 'Minimum income cannot be negative'] },
  min_credit_score: { type: Number, min: [300, 'Minimum credit score must be at least 300'], max: [900, 'Maximum credit score cannot exceed 900'] }
}, { _id: false });

const documentRequirementSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Document name is required'] },
  description: String,
  schema_id: { type: String, required: [true, 'Document schema ID is required'] },
}, { _id: false });


// --- Main Waiver Scheme Schema ---
const waiverSchemeSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Waiver scheme title is required'], trim: true },
  description: { type: String, required: [true, 'Waiver scheme description is required'] },
  status: {
    type: String,
    enum: { values: ['draft', 'published', 'archived'], message: '{VALUE} is not a valid status' },
    default: 'draft'
  },
  target_loan_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    required: [true, 'Target loan ID is required'],
    comment: "The specific loan product this waiver scheme is applicable to."
  },
  waiver_type: {
    type: String,
    enum: { values: ['percentage', 'fixed_amount'], message: '{VALUE} is not a valid waiver type' },
    required: [true, 'Waiver type is required'],
    default: 'percentage'
  },
  // No custom field-level validator here
  waiver_value: {
    type: Number,
    required: [true, 'Waiver value is required'],
    min: [0, 'Waiver value cannot be negative'] // This validator IS run by findOneAndUpdate
  },
  applicable_on: {
    type: String,
    enum: { values: ['interest_due', 'principal_outstanding', 'total_outstanding_amount', 'specific_charges'], message: '{VALUE} is not a valid application target' },
    required: [true, 'Application target is required'],
    default: 'interest_due'
  },
  max_waiver_cap_amount: {
    type: Number,
    min: [0, 'Maximum waiver cap amount cannot be negative']
  },
  fields: { type: [fieldSchema], default: [] },
  eligibility: { type: eligibilitySchema, required: [true, 'Eligibility criteria are required'] },
  required_documents: { type: [documentRequirementSchema], default: [] },
  application_start_date: { type: Date, required: [true, 'Application start date is required'] },
  application_end_date: {
    type: Date,
    required: [true, 'Application end date is required'],
    validate: {
      validator: function(v) { return !this.application_start_date || v >= this.application_start_date; },
      message: 'Application end date must be on or after the start date'
    }
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  // Ensure middleware runs on updates
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// --- Indexes ---
waiverSchemeSchema.index({ status: 1 });
waiverSchemeSchema.index({ application_start_date: 1, application_end_date: 1 });
waiverSchemeSchema.index({ target_loan_id: 1 });


// --- Middleware & Validation ---

// THIS IS THE CORRECT MIDDLEWARE FOR VALIDATING 'findOneAndUpdate'
waiverSchemeSchema.pre('findOneAndUpdate', async function(next) {
  // `this` is the query object.
  // Get the updates using this.getUpdate()
  const updates = this.getUpdate();

  // If waiver_value is not being updated, we don't need to do anything.
  if (updates.waiver_value === undefined) {
    return next();
  }

  // To validate waiver_value, we need waiver_type.
  // It might be in the update, or it might already be in the document.
  const waiver_type = updates.waiver_type || (await this.model.findOne(this.getQuery())).waiver_type;

  if (waiver_type === 'percentage' && (updates.waiver_value < 0 || updates.waiver_value > 100)) {
    // If validation fails, we throw an error. Mongoose catches this
    // and aborts the transaction, rejecting the promise.
    throw new Error(`Validation failed: Waiver percentage (${updates.waiver_value}) must be between 0 and 100.`);
  }

  // For 'fixed_amount', the `min: 0` schema validator handles the check,
  // which will be run because we use `runValidators: true` in the query.

  // Don't forget to call next() if validation passes!
  next();
});

// Middleware for updating the 'updated_at' timestamp on save
waiverSchemeSchema.pre('save', function(next) {
  // Note: the timestamps option on the schema now handles this automatically
  // for both save and findOneAndUpdate, but leaving this here is fine.
  this.updated_at = new Date();
  next();
});

export default mongoose.model('WaiverScheme', waiverSchemeSchema);