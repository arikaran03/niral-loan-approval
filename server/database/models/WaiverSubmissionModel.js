import mongoose from 'mongoose';

// Subdocument Schemas remain the same
const submissionFieldSchema = new mongoose.Schema({
  field_id:    { type: String, required: true },
  field_label: { type: String, required: true },
  type:        { type: String, required: true },
  value:       { type: mongoose.Schema.Types.Mixed },
  fileRef:     { type: mongoose.Schema.Types.ObjectId, ref: 'File' }
}, { _id: false });

const requiredDocumentRefSchema = new mongoose.Schema({
    documentTypeKey: { type: String, required: true },
    fileRef:         { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
}, { _id: false });

const stageHistorySchema = new mongoose.Schema({
  stage:      { type: String, enum: ['draft', 'pending_review', 'approved', 'rejected'], required: true },
  changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changed_at: { type: Date, default: Date.now },
  comment:    { type: String } // Admin notes for this specific stage change will be stored here
}, { _id: false });


// Main Waiver Submission Schema
const WaiverSubmissionSchema = new mongoose.Schema({
  waiver_scheme_id: { type: mongoose.Schema.Types.ObjectId, ref: 'WaiverScheme', required: true, index: true },
  user_id:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  stage: {
    type: String,
    enum: ['draft', 'pending_review', 'approved', 'rejected'],
    default: 'draft',
    index: true
  },
  aadhaar_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  pan_data:     { type: mongoose.Schema.Types.Mixed, default: {} },
  fields:             { type: [submissionFieldSchema], default: [] },
  requiredDocumentRefs: { type: [requiredDocumentRefSchema], default: [] },
  isFaceVerified:     { type: Boolean, default: false },
  annexureDocumentRef:  { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: false },
  history:            { type: [stageHistorySchema], default: [] },
  processed_by:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Renamed from reviewer_id for clarity
  processed_at:       { type: Date }, // Renamed from review_date
  rejection_reason:   { type: String },
  application_notes:  { type: String },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// The complex pre-save middleware has been removed. Logic is now in the controller.

WaiverSubmissionSchema.index({ user_id: 1, waiver_scheme_id: 1 });

export default mongoose.model('WaiverSubmission', WaiverSubmissionSchema);