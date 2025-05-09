// src/models/LoanSubmission.js
import mongoose from 'mongoose';

// Assume 'Image' model stores file metadata (_id, filename, contentType, path/buffer, uploadedBy, etc.)
// import Image from './Image';

// --- Subdocument Schemas ---

// Schema for CUSTOM field responses (from Loan.fields)
const submissionFieldSchema = new mongoose.Schema({
  field_id:    { type: String, required: true }, // Matches field_id from Loan schema's fields array
  field_label: { type: String, required: true }, // Label at the time of submission
  type: {                                       // Data type defined in the Loan schema's field
    type: String,
    enum: ['image', 'document', 'text', 'number', 'date', 'datetime', 'time', 'textarea', 'select', 'checkbox', 'multiselect'],
    required: true
  },
  // Value for non-file types (text, number, date, boolean, selected option(s))
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: function() { return this.type !== 'image' && this.type !== 'document'; }
  },
  // Reference to the uploaded file IF this custom field is of type 'image' or 'document'
  fileRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Image', // *** CHANGE 'Image' TO YOUR ACTUAL FILE MODEL NAME ***
    required: function() { return this.type === 'image' || this.type === 'document'; }
  }
}, { _id: false });

// Schema for linking REQUIRED documents (from Loan.required_documents) to their uploaded files
const requiredDocumentRefSchema = new mongoose.Schema({
    documentName: { // The 'name' of the required document (e.g., "PAN Card")
        type: String,
        required: true
    },
    fileRef: { // The ObjectId referencing the uploaded file in the 'Image'/'Document' collection
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Image', // *** CHANGE 'Image' TO YOUR ACTUAL FILE MODEL NAME ***
        required: true
    },
    // Optional: Add status related to this specific document upload/verification if needed
    // verificationStatus: { type: String, enum: ['pending', 'verified', 'failed'] },
    // verifiedAt: Date,
}, { _id: false });


// Stage history entries
const stageHistorySchema = new mongoose.Schema({
  stage:      {
    type: String,
    // MODIFIED: Added 'paid_to_applicant'
    enum: ['draft', 'pending', 'approved', 'rejected', 'paid_to_applicant'],
    required: true
  },
  changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changed_at: { type: Date, default: Date.now }
}, { _id: false });

// --- Main Loan Submission Schema ---
const LoanSubmissionSchema = new mongoose.Schema({
  loan_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
  user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount:     { type: Number, required: true, min: 0 },
  stage: {
    type: String,
    // MODIFIED: Added 'paid_to_applicant'
    enum: ['draft', 'pending', 'approved', 'rejected', 'paid_to_applicant'],
    default: 'draft',
    index: true
  },
  // Responses for CUSTOM fields defined in Loan.fields
  fields: {
    type: [submissionFieldSchema],
    // Not strictly required if a loan has no custom fields, but the array should exist
    default: []
  },
  // References for STANDARD required documents
  requiredDocumentRefs: {
    type: [requiredDocumentRefSchema],
    // This array should contain one entry for each document listed in Loan.required_documents
    // Validation that all required docs are present might happen in controller or pre-save hook
    default: []
  },

  history: { type: [stageHistorySchema], default: [] },
  approver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approval_date: { type: Date },
  rejection_reason: { type: String },
  // Optional: You might want a specific date for when payment was made
  // payment_date: { type: Date },

}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// --- Middleware ---
LoanSubmissionSchema.pre('save', function(next) {
  // Add initial history entry or update history on stage change
  if (this.isNew || this.isModified('stage')) {
    if (this.isNew && this.history.length === 0) { // Only for absolutely new documents without history
        this.history = []; // Ensure history is an array
        this.history.push({
            stage: this.stage || 'draft', // Use current stage or default to draft
            changed_by: this.user_id, // Assuming user_id is set at this point for new docs
            changed_at: new Date()
        });
    } else if (this.isModified('stage')) { // For existing documents where stage is modified
        // Ensure changed_by is available. It might need to be explicitly set before saving
        // if the user_id on the document isn't necessarily the one making the stage change.
        // For simplicity, using this.user_id or a placeholder if not available.
        const changer = this.changed_by_user_id_for_stage_change || this.user_id; // You might need a transient field
        if (!changer) {
            // Handle cases where the changer is not identified; perhaps log or skip history
            // For now, let's proceed but ideally, this should be robustly handled.
        }
        this.history.push({
            stage: this.stage,
            changed_by: changer, // This should be the ID of the user who made this specific stage change
            changed_at: new Date()
        });
    }
  }


  // Optional: Add validation to ensure all required documents have references upon moving to 'pending'
  if (this.isModified('stage') && this.stage === 'pending') {
     // Ensure this.loan_id is populated if it's a ref. If not, you might need to load it.
     // If loan_id is just an ObjectId and not populated, this works.
     mongoose.model('Loan').findById(this.loan_id).select('required_documents').then(loan => {
         if (!loan) return next(new Error('Associated Loan definition not found for validation.'));

         const requiredDocNames = loan.required_documents.map(doc => doc.name);
         const submittedDocNames = this.requiredDocumentRefs.map(ref => ref.documentName);
         const missingDocs = requiredDocNames.filter(name => !submittedDocNames.includes(name));

         if (missingDocs.length > 0) {
             return next(new Error(`Missing required document uploads: ${missingDocs.join(', ')}`));
         }
         next();
     }).catch(err => next(err));
  } else {
      next();
  }
});


// --- Indexes ---
LoanSubmissionSchema.index({ user_id: 1, loan_id: 1 });

export default mongoose.model('LoanSubmission', LoanSubmissionSchema);