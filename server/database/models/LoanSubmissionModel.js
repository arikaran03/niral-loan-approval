// src/models/LoanSubmission.js
import mongoose from 'mongoose';
// Assuming File model is in the same directory or adjust path
// import File from './FileModel.js'; 
// Assuming GovDocumentDefinition model for loan schema lookups in pre-save
// import GovDocumentDefinitionModel from './GovDocumentDefinitionModel.js'; 

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
  value: { // For non-file types
    type: mongoose.Schema.Types.Mixed,
    // Required only if the field itself is required and it's not a file type
    // This basic check might need to be augmented by looking up the original field's 'required' status from LoanDefinition
    required: function() { 
      return this.type !== 'image' && this.type !== 'document'; 
    }
  },
  fileRef: { // For file types (image, document) in custom fields
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File', 
    // Required only if the field itself is required and it IS a file type
    required: function() { 
      return (this.type === 'image' || this.type === 'document'); 
    }
  }
}, { _id: false });

// Schema for linking REQUIRED documents (from Loan.required_documents, including Aadhaar & PAN files) to their uploaded files
const requiredDocumentRefSchema = new mongoose.Schema({
    documentTypeKey: { // e.g., "aadhaar_card", "pan_card", "bank_statement"
        type: String,
        required: true 
    },
    fileRef: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File', 
        required: true
    },
}, { _id: false });


// Stage history entries
const stageHistorySchema = new mongoose.Schema({
  stage:      {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'paid_to_applicant', 'closed'], 
    required: true
  },
  changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changed_at: { type: Date, default: Date.now },
  comment: {type: String} 
}, { _id: false });

// --- Main Loan Submission Schema ---
const LoanSubmissionSchema = new mongoose.Schema({
  loan_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
  user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount:     { type: Number, required: true, min: 0 },
  stage: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'paid_to_applicant', 'closed'],
    default: 'draft',
    index: true
  },

  // Extracted/Verified data from Aadhaar Card
  aadhaar_data: {
    type: mongoose.Schema.Types.Mixed, // Stores { name: "...", dob: "...", address: "..." etc. }
    required: [true, 'Aadhaar data is mandatory for submission.'], // This data comes from auto-fill or GovDB
    default: {}
  },
  // Extracted/Verified data from PAN Card
  pan_data: {
    type: mongoose.Schema.Types.Mixed, // Stores { pan_number: "...", name: "..." etc. }
    required: [true, 'PAN data is mandatory for submission.'], // This data comes from auto-fill or GovDB
    default: {}
  },

  fields: { // Responses for CUSTOM fields defined in Loan.fields
    type: [submissionFieldSchema],
    default: []
  },
  
  // References for ALL required documents, INCLUDING Aadhaar & PAN files
  requiredDocumentRefs: {
    type: [requiredDocumentRefSchema],
    default: []
  },

  isFaceVerified: {
    type: Boolean,
    default: false,
    // This should be true if stage moves to 'pending' and face verification was triggered
  },

  annexureDocumentRef: { // For annexure PDF if name/address mismatches occurred
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: false // Conditionally required based on frontend logic and mismatches
  },

  history: { type: [stageHistorySchema], default: [] },
  approver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approval_date: { type: Date },
  rejection_reason: { type: String },
  
  changed_by_user_id_for_stage_change: { type: mongoose.Schema.Types.ObjectId, select: false },


}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// --- Middleware ---
LoanSubmissionSchema.pre('save', async function(next) { 
  if (this.isNew || this.isModified('stage')) {
    const changer = this.changed_by_user_id_for_stage_change || this.user_id; 
    if (!changer) {
        return next(new Error('User ID for stage change audit is missing.'));
    }
    if (!this.history) this.history = [];
    
    const lastHistoryEntry = this.history.length > 0 ? this.history[this.history.length - 1] : null;
    if (!lastHistoryEntry || lastHistoryEntry.stage !== this.stage) {
        this.history.push({
            stage: this.stage,
            changed_by: changer, 
            changed_at: new Date()
        });
    }
  }
  this.changed_by_user_id_for_stage_change = undefined; 

  // Validation for transitioning to 'pending' (i.e., final submission by user)
  if (this.isModified('stage') && this.stage === 'pending') {
     try {
        const loan = await mongoose.model('Loan').findById(this.loan_id).select('required_documents aadhaar_card_definition pan_card_definition'); // Fetch necessary loan details
        if (!loan) return next(new Error('Associated Loan definition not found for validation.'));


        console.log(this);
        // 1. Check for Aadhaar Card file reference in requiredDocumentRefs
        const aadhaarFileRefEntry = this.requiredDocumentRefs.find(ref => ref.documentTypeKey === 'aadhaar_card');
        if (!aadhaarFileRefEntry || !aadhaarFileRefEntry.fileRef) {
            return next(new Error('Aadhaar Card document upload is mandatory.'));
        }
        // 2. Check for PAN Card file reference in requiredDocumentRefs
        const panFileRefEntry = this.requiredDocumentRefs.find(ref => ref.documentTypeKey === 'pan_card');
        if (!panFileRefEntry || !panFileRefEntry.fileRef) {
            return next(new Error('PAN Card document upload is mandatory.'));
        }
        
        // 3. Check for populated aadhaar_data and pan_data (basic check)
        // These should be populated by the auto-fill logic on the frontend from verified sources or OCR.
        if (!this.aadhaar_data || Object.keys(this.aadhaar_data).length === 0) {
            return next(new Error('Processed Aadhaar data is missing or empty. Ensure Aadhaar document was verified.'));
        }
        if (!this.pan_data || Object.keys(this.pan_data).length === 0) {
            return next(new Error('Processed PAN data is missing or empty. Ensure PAN document was verified.'));
        }

        // 4. Check other required documents (as defined in the Loan schema, excluding Aadhaar/PAN)
        const otherRequiredDocDefinitions = (loan.required_documents || []).filter(
            docDef => docDef.name !== 'aadhaar_card' && docDef.name !== 'pan_card'
        );

        if (otherRequiredDocDefinitions.length > 0) {
            const requiredOtherDocTypeKeys = otherRequiredDocDefinitions.map(doc => doc.name);
            const submittedOtherDocTypeKeys = this.requiredDocumentRefs
                .filter(ref => ref.documentTypeKey !== 'aadhaar_card' && ref.documentTypeKey !== 'pan_card')
                .map(ref => ref.documentTypeKey);
            
            const missingDocs = requiredOtherDocTypeKeys.filter(name => !submittedOtherDocTypeKeys.includes(name));

            if (missingDocs.length > 0) {
                return next(new Error(`Missing other required document uploads: ${missingDocs.join(', ')}`));
            }
        }

        // 5. Check face verification status if Aadhaar definition implies a photo for verification
        // This assumes that if an Aadhaar definition exists and has a photo field, face verification is triggered.
        // The frontend controls `showFaceVerificationModule` based on `aadhaarPhotoIdForVerification`.
        // If `aadhaarPhotoIdForVerification` was set, then `isFaceVerified` must be true.
        let aadhaarRequiresFaceVerification = false;
        if (loan.aadhaar_card_definition && loan.aadhaar_card_definition.fields) {
            aadhaarRequiresFaceVerification = loan.aadhaar_card_definition.fields.some(f => f.key === 'photo'); // Or however you identify the photo field
        }
        
        if (aadhaarRequiresFaceVerification && !this.isFaceVerified) {
             return next(new Error('Face verification is mandatory and not completed.'));
        }

        // 6. Annexure: The frontend logic primarily handles if annexure is needed.
        // If `annexureDocumentRef` is present, it implies the frontend determined it was necessary.
        // No specific validation here unless you want to cross-check against a flag indicating mismatches were indeed present.
        // For now, if it's provided, we assume it's for a valid reason.

        next();
     } catch (err) {
        console.error("Error in LoanSubmission pre-save validation for 'pending' stage:", err);
        next(err);
     }
  } else {
      next();
  }
});


// --- Indexes ---
LoanSubmissionSchema.index({ user_id: 1, loan_id: 1 });

export default mongoose.model('LoanSubmission', LoanSubmissionSchema);
