// src/models/Loan.js
import mongoose, { Schema } from 'mongoose';

// Subdocument Schemas with enhanced validation
const fieldSchema = new mongoose.Schema({
  field_id: { 
    type: String, 
    required: [true, 'Field ID is required'],
    trim: true
  },
  field_label: { 
    type: String, 
    required: [true, 'Field label is required'],
    trim: true
  },
  field_prompt: { type: String },
  min_value: { type: String },
  max_value: { type: String },
  type: { 
    type: String, 
    enum: {
      values: ['date', 'datetime', 'number', 'text', 'time', 'image', 'document', 'textarea', 'select', 'checkbox', 'multiselect'],
      message: '{VALUE} is not a valid field type'
    },
    required: [true, 'Field type is required']
  },
  options: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  required: { type: Boolean, default: false },
  auto_fill_sources: { type: [String], default: [] },
}, { _id: false });

const eligibilitySchema = new mongoose.Schema({
  min_age: { 
    type: Number, 
    required: [true, 'Minimum age is required'], 
    min: [18, 'Minimum age cannot be less than 18'],
    validate: {
      validator: Number.isInteger,
      message: 'Minimum age must be a whole number'
    }
  },
  max_age: { 
    type: Number,
    validate: {
      validator: function(v) {
        return v === null || v === undefined || (Number.isInteger(v) && v >= this.min_age);
      },
      message: 'Maximum age must be greater than or equal to minimum age'
    }
  },
  min_income: { 
    type: Number, 
    required: [true, 'Minimum income is required'], 
    min: [0, 'Minimum income cannot be negative']
  },
  min_credit_score: { 
    type: Number, 
    min: [300, 'Credit score must be at least 300'], 
    max: [900, 'Credit score cannot exceed 900'],
    validate: {
      validator: Number.isInteger,
      message: 'Credit score must be a whole number'
    }
  }
}, { _id: false });

const documentRequirementSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Document name is required'],
    trim: true
  },
  description: String,
  schema_id: { 
    type: String, 
    required: [true, 'Schema ID is required'],
    trim: true
  },
}, { _id: false });

// Main Loan Schema with enhanced validation
const loanSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: [true, 'Loan title is required'],
    trim: true
  },
  description: { 
    type: String, 
    required: [true, 'Loan description is required']
  },
  
  status: {
    type: String,
    enum: {
      values: ['draft', 'published', 'archived'],
      message: '{VALUE} is not a valid status'
    },
    default: 'draft',
    index: true
  },

  min_amount: { 
    type: Number, 
    required: [true, 'Minimum loan amount is required'], 
    min: [0, 'Minimum amount cannot be negative']
  },
  max_amount: { 
    type: Number, 
    required: [true, 'Maximum loan amount is required'], 
    min: [0, 'Maximum amount cannot be negative']
  },
  interest_rate: { 
    type: Number, 
    required: [true, 'Interest rate is required'], 
    min: [0, 'Interest rate cannot be negative']
  },
  tenure_months: { 
    type: Number, 
    required: [true, 'Loan tenure is required'], 
    min: [1, 'Tenure must be at least 1 month'],
    validate: {
      validator: Number.isInteger,
      message: 'Tenure must be a whole number'
    }
  },
  processing_fee: { 
    type: Number, 
    default: 0, 
    min: [0, 'Processing fee cannot be negative']
  },
  collateral_required: { type: Boolean, default: false },

  fields: { type: [fieldSchema], default: [] },

  eligibility: { 
    type: eligibilitySchema, 
    required: [true, 'Eligibility criteria are required']
  },

  required_documents: { type: [documentRequirementSchema], default: [] },

  application_start: { 
    type: Date, 
    required: [true, 'Application start date is required'],
    validate: {
      validator: function(v) {
        return v instanceof Date && !isNaN(v);
      },
      message: 'Application start date must be a valid date'
    }
  },
  application_end: { 
    type: Date, 
    required: [true, 'Application end date is required'],
    validate: {
      validator: function(v) {
        return v instanceof Date && !isNaN(v);
      },
      message: 'Application end date must be a valid date'
    }
  },

  disbursement_date: { 
    type: Date,
    validate: {
      validator: function(v) {
        return v === null || v === undefined || (v instanceof Date && !isNaN(v));
      },
      message: 'Disbursement date must be a valid date'
    }
  },

  applicable_waiver_scheme_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WaiverScheme',
    default: null,
    required: false,
    validate: {
      validator: function(v) {
        return v === null || mongoose.isValidObjectId(v);
      },
      message: 'Invalid waiver scheme ID format'
    }
  },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Indexes
loanSchema.index({ application_start: 1, application_end: 1 });
loanSchema.index({ applicable_waiver_scheme_id: 1 });

// Enhanced middleware & validation
loanSchema.pre('save', function(next) {
    // Validate amount consistency
    if (this.max_amount < this.min_amount) {
      return next(new Error('Maximum amount cannot be less than minimum amount.'));
    }
    
    // Validate date consistency
    if (this.application_start && this.application_end && this.application_end < this.application_start) {
      return next(new Error('Application end date must be on or after the start date.'));
    }
    
    if (this.application_end && this.disbursement_date && this.disbursement_date < this.application_end) {
      return next(new Error('Disbursement date cannot be before the application end date.'));
    }

    // Validate select/multiselect fields have options
    if (this.fields && this.fields.length > 0) {
      for (const field of this.fields) {
        if (['select', 'multiselect', 'checkbox'].includes(field.type) && 
            (!field.options || field.options.length === 0)) {
          return next(new Error(`Field "${field.field_label}" of type ${field.type} must have options defined.`));
        }
      }
    }
    
    // Ensure status is valid
    if (!['draft', 'published', 'archived'].includes(this.status)) {
      return next(new Error(`Invalid status value: ${this.status}`));
    }

    // Auto-update updated_at timestamp
    this.updated_at = new Date();
    next();
});

export default mongoose.model('Loan', loanSchema);
