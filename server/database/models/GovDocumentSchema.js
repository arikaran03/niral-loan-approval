// src/models/GovDocumentSchema.js
import mongoose from 'mongoose';

 // src/models/GvtDocumentSchemaDefinition.js (Example file name)
import mongoose from "mongoose";
// import { GvtDocumentSchemaDefinition } from "./GvtDocumentSchemaDefinition";

// --- Subdocument Schema for defining a single field within a dynamic document type ---
// This schema defines the properties and constraints for a field in a dynamic document template.
const govFieldSchema = new mongoose.Schema({
  // Unique identifier for this field within the document type definition (e.g., 'tc_number', 'annual_income')
  field_key: {
    type: String,
    required: true,
    trim: true,
  },
  // Label displayed to the user for this field (e.g., 'Transfer Certificate Number', 'Annual Income')
  field_label: {
    type: String,
    required: true, // Making label required for clarity in UI
    trim: true,
  },
  // Optional prompt or help text for the user
  field_prompt: {
    type: String,
    trim: true,
  },

  // --- Constraint/Validation Definition Fields (Stored, Not Auto-Validated by Mongoose) ---
  // Validation: Minimum allowed value (for number or date types).
  // Admin sets this when defining the field. Using Mixed for flexibility.
  min_value: {
    type: String,
    required: true,
  },
  // Validation: Maximum allowed value (for number or date types).
  // Admin sets this when defining the field. Using Mixed for flexibility.
  max_value: {
    type: String,
    default: undefined,
  },
  // Validation: Number of decimal places allowed (for number types).
  // Admin sets this when defining the field.
  decimal_places: {
    type: Number,
    default: undefined,
  },

  // The expected data type for the user's input for this field.
  type: {
    type: String,
    enum: [
      "text",
      "number",
      "date",
      "textarea",
      "time",
      "datetime"
    ],
    required: true,
  },
  // Used for 'select', 'checkbox', 'multiselect' types to list options.
  options: {
    type: [mongoose.Schema.Types.Mixed], // Allow mixed types for options if needed
    default: undefined,
  },
  // Indicates if the user *must* provide data for this specific field.
  required: {
    type: Boolean,
    default: false,
  },
});

const govDocumentSchema = new mongoose.Schema({
  document_name: { type: String, required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fields: [govFieldSchema],
  created_at: Date,
  updated_at: Date
});

export default mongoose.model('GovDocumentSchema', govDocumentSchema);