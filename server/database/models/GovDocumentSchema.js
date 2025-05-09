// src/models/GovDocumentSchema.js
import mongoose from 'mongoose';

const govFieldSchema = new mongoose.Schema({
  field_id: { type: String, required: true },
  field_label: String,
  min_value: String,
  max_value: String,
  type: { type: String, enum: ['date','datetime','number','text','time','image'], required: true },
  created_at: Date,
  updated_at: Date
});

const govDocumentSchema = new mongoose.Schema({
  document_name: { type: String, required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fields: [govFieldSchema],
  created_at: Date,
  updated_at: Date
});

export default mongoose.model('GovDocumentSchema', govDocumentSchema);