// src/models/LoanSubmission.js
import mongoose from 'mongoose';

// --- Subdocument Schemas ---

// Schema for CUSTOM field responses (from Loan.fields)
const submissionFieldSchema = new mongoose.Schema({
  field_id:    { type: String, required: true }, 
  field_label: { type: String, required: true }, 
  type: {                                       
    type: String,
    enum: ['image', 'document', 'text', 'number', 'date', 'datetime', 'time', 'textarea', 'select', 'checkbox', 'multiselect'],
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: function() { return this.type !== 'image' && this.type !== 'document'; }
  },
  fileRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File', // Updated to 'File' model
    required: function() { return this.type === 'image' || this.type === 'document'; }
  }
}, { _id: false });

// Schema for linking OTHER REQUIRED documents (from Loan.required_documents) to their uploaded files
// Aadhaar and PAN are now top-level fields.
const requiredDocumentRefSchema = new mongoose.Schema({
    documentName: { 
        type: String,
        required: true
    },
    fileRef: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File', // Updated to 'File' model
        required: true
    },
}, { _id: false });


// Stage history entries
const stageHistorySchema = new mongoose.Schema({
  stage:      {
    type: String,
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
    enum: ['draft', 'pending', 'approved', 'rejected', 'paid_to_applicant'],
    default: 'draft',
    index: true
  },

  // *** NEW MANDATORY KYC DOCUMENT SUBMISSION IDs ***
  aadhaar_document_submission_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GovDocumentSubmission', // References the model for Aadhaar/PAN data sets
    required: [true, 'Aadhaar document submission is mandatory.'],
    index: true,
    comment: "FK to the GovDocumentSubmission record for Aadhaar details."
  },
  pan_document_submission_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GovDocumentSubmission', // References the model for Aadhaar/PAN data sets
    required: [true, 'PAN document submission is mandatory.'],
    index: true,
    comment: "FK to the GovDocumentSubmission record for PAN details."
  },
  // *** END NEW FIELDS ***

  fields: { // Responses for CUSTOM fields defined in Loan.fields
    type: [submissionFieldSchema],
    default: []
  },
  // References for OTHER standard required documents (excluding Aadhaar/PAN which are now top-level)
  requiredDocumentRefs: {
    type: [requiredDocumentRefSchema],
    default: []
  },

  history: { type: [stageHistorySchema], default: [] },
  approver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approval_date: { type: Date },
  rejection_reason: { type: String },
  // disbursement_date: { type: Date }, // Optional: if you want to track when it was marked paid

}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// --- Middleware ---
LoanSubmissionSchema.pre('save', async function(next) { // Changed to async for potential awaits
  // Add initial history entry or update history on stage change
  if (this.isNew || this.isModified('stage')) {
    const changer = this.isNew ? this.user_id : (this.changed_by_user_id_for_stage_change || this.user_id); // changed_by_user_id_for_stage_change is a transient field set before save by controller
    if (!this.history) this.history = [];
    
    // Avoid duplicate history entries if stage isn't actually changing from the last history entry
    const lastHistoryEntry = this.history.length > 0 ? this.history[this.history.length - 1] : null;
    if (!lastHistoryEntry || lastHistoryEntry.stage !== this.stage) {
        this.history.push({
            stage: this.stage,
            changed_by: changer, 
            changed_at: new Date()
        });
    }
  }

  // Validation for OTHER required documents (Aadhaar/PAN are now top-level required fields)
  if (this.isModified('stage') && this.stage === 'pending') {
     try {
        const loan = await mongoose.model('Loan').findById(this.loan_id).select('required_documents');
        if (!loan) return next(new Error('Associated Loan definition not found for validation.'));

        // Filter out Aadhaar and PAN from loan.required_documents if they were previously there,
        // as they are now handled by top-level fields.
        const otherRequiredDocDefinitions = loan.required_documents.filter(
            docDef => !['aadhaar card', 'pan card', 'aadhaar', 'pan'].includes(docDef.name.toLowerCase())
        );

        if (otherRequiredDocDefinitions.length > 0) {
            const requiredDocNames = otherRequiredDocDefinitions.map(doc => doc.name);
            const submittedDocNames = this.requiredDocumentRefs.map(ref => ref.documentName);
            const missingDocs = requiredDocNames.filter(name => !submittedDocNames.includes(name));

            if (missingDocs.length > 0) {
                return next(new Error(`Missing other required document uploads: ${missingDocs.join(', ')}`));
            }
        }
        next();
     } catch (err) {
        next(err);
     }
  } else {
      next();
  }
});


// --- Indexes ---
LoanSubmissionSchema.index({ user_id: 1, loan_id: 1 });
// Indexes for new fields are already defined inline.

export default mongoose.model('LoanSubmission', LoanSubmissionSchema);