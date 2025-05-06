// src/models/GovDocument.js
import mongoose from 'mongoose';

const govDocFieldValueSchema = new mongoose.Schema({
  field_id: { type: String, required: true },
  field_label: String,
  value: String,   // if image, stores Image._id
  type: { type: String, enum: ['image'], required: true },
  created_at: Date,
  updated_at: Date
});

const govDocumentSchemaRecord = new mongoose.Schema({
  document_id: { type: mongoose.Schema.Types.ObjectId, ref: 'GovDocumentSchema', required: true },
  fields: [govDocFieldValueSchema],
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: Date,
  updated_at: Date
});

export default mongoose.model('GovDocument', govDocumentSchemaRecord);
