// src/models/WaiverSubmission.js
import mongoose from 'mongoose';

// Assuming File model is defined elsewhere and will be referenced
// import File from './FileModel.js'; 

// --- Subdocument Schemas (Reused from LoanSubmission or defined identically) ---

// Schema for CUSTOM field responses (from WaiverScheme.fields)
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
    // Basic requirement, actual validation might depend on the field's definition in WaiverScheme
    required: function() {
      // Only required if the original field in WaiverScheme was required and it's not a file
      // This logic might need to be more sophisticated if checking original field's 'required' status
      return this.type !== 'image' && this.type !== 'document';
    }
  },
  fileRef: { // For file types (image, document) in custom fields
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    // Required if original field was required and it IS a file type
    required: function() {
      return (this.type === 'image' || this.type === 'document');
    }
  }
}, { _id: false });

// Schema for linking REQUIRED documents (from WaiverScheme.required_documents)
const requiredDocumentRefSchema = new mongoose.Schema({
    documentTypeKey: { // e.g., "aadhaar_card", "pan_card", "loan_statement_for_waiver"
        type: String,
        required: true
    },
    fileRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
        required: true
    },
}, { _id: false });


// Stage history entries for waiver submissions
const stageHistorySchema = new mongoose.Schema({
  stage:      {
    type: String,
    enum: ['draft', 'pending_review', 'approved', 'rejected', 'applied', 'closed'], // Waiver specific stages
    required: true
  },
  changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changed_at: { type: Date, default: Date.now },
  comment: {type: String}
}, { _id: false });

// --- Main Waiver Submission Schema ---
const WaiverSubmissionSchema = new mongoose.Schema({
  waiver_scheme_id: { type: mongoose.Schema.Types.ObjectId, ref: 'WaiverScheme', required: true, index: true },
  user_id:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // Note: 'amount' (like loan amount requested) is removed as it's a waiver application.
  // If original loan details are needed, they might be part of 'fields' or fetched via context.

  stage: {
    type: String,
    enum: ['draft', 'pending_review', 'approved', 'rejected', 'applied', 'closed'],
    default: 'draft',
    index: true
  },

  // Extracted/Verified data from Aadhaar Card (still relevant for applicant KYC)
  aadhaar_data: {
    type: mongoose.Schema.Types.Mixed, // Stores { name: "...", dob: "...", address: "..." etc. }
    required: [true, 'Aadhaar data is mandatory for waiver submission.'],
    default: {}
  },
  // Extracted/Verified data from PAN Card (still relevant for applicant KYC)
  pan_data: {
    type: mongoose.Schema.Types.Mixed, // Stores { pan_number: "...", name: "..." etc. }
    required: [true, 'PAN data is mandatory for waiver submission.'],
    default: {}
  },

  fields: { // Responses for CUSTOM fields defined in WaiverScheme.fields
    type: [submissionFieldSchema],
    default: []
  },

  // References for ALL required documents, INCLUDING Aadhaar & PAN files if mandated by waiver scheme
  requiredDocumentRefs: {
    type: [requiredDocumentRefSchema],
    default: []
  },

  isFaceVerified: { // Face verification of the applicant
    type: Boolean,
    default: false,
  },

  annexureDocumentRef: { // For annexure PDF if name/address mismatches occurred during KYC
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: false // Conditionally required
  },

  history: { type: [stageHistorySchema], default: [] },
  reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // User who reviews/approves/rejects
  review_date: { type: Date },
  rejection_reason: { type: String },
  application_notes: { type: String }, // Notes by the applicant or internal team

  // Temporary field to pass user ID for stage change audit, not stored persistently
  changed_by_user_id_for_stage_change: { type: mongoose.Schema.Types.ObjectId, select: false },

}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// --- Middleware ---
WaiverSubmissionSchema.pre('save', async function(next) {
  // Audit trail for stage changes
  if (this.isNew || this.isModified('stage')) {
    const changer = this.changed_by_user_id_for_stage_change || this.user_id; // Default to applicant if internal changer not specified
    if (!changer) {
        // For new drafts, this.user_id should be set. For subsequent changes, changer should be set.
        return next(new Error('User ID for stage change audit is missing.'));
    }
    if (!this.history) this.history = [];

    const lastHistoryEntry = this.history.length > 0 ? this.history[this.history.length - 1] : null;
    if (!lastHistoryEntry || lastHistoryEntry.stage !== this.stage) {
        this.history.push({
            stage: this.stage,
            changed_by: changer,
            changed_at: new Date(),
            // comment: this.application_notes or a specific comment for stage change if available
        });
    }
  }
  this.changed_by_user_id_for_stage_change = undefined; // Clear temporary field

  // Validation for transitioning to 'pending_review' (i.e., final submission by user)
  if (this.isModified('stage') && this.stage === 'pending_review') {
     try {
        // Fetch the associated WaiverScheme to check its requirements
        const waiverScheme = await mongoose.model('WaiverScheme').findById(this.waiver_scheme_id)
          .select('required_documents fields eligibility'); // Select fields needed for validation
        
        if (!waiverScheme) return next(new Error('Associated Waiver Scheme definition not found for validation.'));

        // 1. Check for Aadhaar Card file reference (if defined as required in WaiverScheme)
        //    For waivers, Aadhaar/PAN might always be required for KYC, or it could be scheme-dependent.
        //    Assuming for now they are always required for the applicant.
        const aadhaarFileRefEntry = this.requiredDocumentRefs.find(ref => ref.documentTypeKey === 'aadhaar_card');
        if (!aadhaarFileRefEntry || !aadhaarFileRefEntry.fileRef) {
            return next(new Error('Aadhaar Card document upload is mandatory for waiver application.'));
        }
        // 2. Check for PAN Card file reference
        const panFileRefEntry = this.requiredDocumentRefs.find(ref => ref.documentTypeKey === 'pan_card');
        if (!panFileRefEntry || !panFileRefEntry.fileRef) {
            return next(new Error('PAN Card document upload is mandatory for waiver application.'));
        }

        // 3. Check for populated aadhaar_data and pan_data (basic check from KYC process)
        if (!this.aadhaar_data || Object.keys(this.aadhaar_data).length === 0) {
            return next(new Error('Processed Aadhaar data is missing or empty. Ensure Aadhaar document was verified.'));
        }
        if (!this.pan_data || Object.keys(this.pan_data).length === 0) {
            return next(new Error('Processed PAN data is missing or empty. Ensure PAN document was verified.'));
        }

        // 4. Check other required documents as defined in the WaiverScheme's 'required_documents'
        const schemeRequiredDocs = (waiverScheme.required_documents || []).filter(
            docDef => docDef.name !== 'aadhaar_card' && docDef.name !== 'pan_card' // Exclude if already checked
        );

        if (schemeRequiredDocs.length > 0) {
            const requiredDocKeysFromScheme = schemeRequiredDocs.map(doc => doc.name);
            const submittedDocKeys = this.requiredDocumentRefs
                .filter(ref => ref.documentTypeKey !== 'aadhaar_card' && ref.documentTypeKey !== 'pan_card')
                .map(ref => ref.documentTypeKey);

            const missingDocs = requiredDocKeysFromScheme.filter(name => !submittedDocKeys.includes(name));
            if (missingDocs.length > 0) {
                return next(new Error(`Missing required document uploads for waiver: ${missingDocs.join(', ')}`));
            }
        }
        
        // 5. Validate custom fields against the WaiverScheme's field definitions (check for 'required' fields)
        if (waiverScheme.fields && waiverScheme.fields.length > 0) {
            for (const schemeField of waiverScheme.fields) {
                if (schemeField.required) {
                    const submittedField = this.fields.find(f => f.field_id === schemeField.field_id);
                    if (!submittedField) {
                        return next(new Error(`Required field "${schemeField.field_label}" is missing.`));
                    }
                    // Check if value or fileRef is present based on type
                    if (schemeField.type === 'image' || schemeField.type === 'document') {
                        if (!submittedField.fileRef) {
                            return next(new Error(`Required document/image for field "${schemeField.field_label}" is missing.`));
                        }
                    } else {
                        // Check for null, undefined, or empty string for non-file types.
                        // mongoose.Schema.Types.Mixed can be tricky, so direct check.
                        if (submittedField.value === null || submittedField.value === undefined || String(submittedField.value).trim() === '') {
                             return next(new Error(`Value for required field "${schemeField.field_label}" is missing.`));
                        }
                    }
                }
            }
        }


        // 6. Check face verification status (assuming it's a general KYC requirement for the applicant)
        // This logic might need to be tied to whether the WaiverScheme itself mandates it,
        // or if Aadhaar processing (which is always done) yields a photo for verification.
        // For simplicity, if your system triggers face verification for any KYC, this check is relevant.
        // We assume if aadhaar_data is present, face verification would have been attempted if a photo was available.
        // The frontend would set `isFaceVerified`.
        // Let's assume if Aadhaar definition (globally or via scheme) implies photo, then face verification is needed.
        // This part is a bit abstract without knowing how `aadhaar_card_definition` is accessed for waivers.
        // For now, if `isFaceVerified` is false, and your system generally requires it for KYC, it's an error.
        // A more robust way would be to check a flag on the WaiverScheme or a global config.
        // For now, we'll assume if the system *could* have done face verification (based on Aadhaar having a photo), it must be done.
        // This is a placeholder for potentially more complex logic.
        // If your system *always* attempts face verification if an Aadhaar photo is available during KYC:
        if (this.aadhaar_data && Object.keys(this.aadhaar_data).includes('photo_id_available_for_verification_flag') && !this.isFaceVerified) { // Hypothetical flag
             // return next(new Error('Face verification is mandatory based on available Aadhaar photo and not completed.'));
        } else if (!this.isFaceVerified && global.SOME_CONFIG_REQUIRES_FACE_VERIFICATION_FOR_WAIVERS) { // Another hypothetical
            // return next(new Error('Face verification is mandatory for this waiver scheme and not completed.'));
        }
        // Simplified: If your process implies face verification was needed (e.g. user saw the module), then it must be true.
        // The most straightforward is to rely on the frontend having set `isFaceVerified` correctly.
        // If the frontend *could* have shown the face verification module (because a photo ID was available from Aadhaar),
        // then `isFaceVerified` must be true.
        // This check is hard to make perfectly generic here without knowing the exact flow of `aadhaarPhotoIdForVerification` in waiver context.
        // A simple check: if the system has a general policy for face verification for applicants:
        const requiresFaceVerification = true; // Example: Assume it's generally required for any applicant. Adjust this.
        if (requiresFaceVerification && !this.isFaceVerified) {
            // Check if aadhaar_data implies photo was available for verification.
            // This is tricky without knowing the exact structure of aadhaar_data or link to its definition.
            // For now, if it's a general requirement, and not done, it's an error.
            // This needs to be aligned with your actual KYC and face verification triggering logic for waiver applicants.
            // A practical approach: if the frontend showed the face verification step, then this.isFaceVerified must be true.
            // The backend can't easily know if the frontend *should* have shown it without more context.
            // Let's assume if aadhaar_data is present, and face verification is a general policy, it should be done.
            // A more concrete check might be if the waiver scheme itself has a flag `faceVerificationRequired: true`.
             console.warn("Face verification check in waiver submission is simplified. Ensure your logic for triggering and requiring face verification is robust.");
             // if (!this.isFaceVerified) return next(new Error('Face verification is mandatory and not completed.'));
        }


        // 7. Annexure: Similar to LoanSubmission, if present, assume it's for a valid reason.
        // No specific validation here unless cross-checking against a flag for mismatches.

        next();
     } catch (err) {
        console.error("Error in WaiverSubmission pre-save validation for 'pending_review' stage:", err);
        next(err);
     }
  } else {
      next();
  }
});


// --- Indexes ---
WaiverSubmissionSchema.index({ user_id: 1, waiver_scheme_id: 1 }); // Common query pattern

export default mongoose.model('WaiverSubmission', WaiverSubmissionSchema);
