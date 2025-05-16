// src/models/GovDocumentDefinition.js
import mongoose from "mongoose";

// Schema to define the structure of a dynamic government document type
const GovDocumentSchemaDefinition = new mongoose.Schema(
  {
    schema_id: {
      type: String,
      required: [true, "Schema ID is required."],
      unique: true, 
      trim: true,
      comment: "Unique identifier for the schema (e.g., 'aadhaar_card', 'pan_card')."
    },
    name: {
      type: String,
      required: [true, "Document name is required."],
      trim: true,
      comment: "Human-readable name for the document type (e.g., 'Aadhaar Card', 'PAN Card')."
    },
    description: {
      type: String,
      trim: true,
      required: [true, "Document description is required."],
      comment: "Description or purpose of the document."
    },
    fields: [
      {
        key: {
          type: String,
          required: [true, "Field key is required."],
          trim: true,
          comment: "The key or name of the field (e.g., 'aadhaar_number', 'pan_id')."
        },
        label: {
          type: String,
          required: [true, "Field label is required."],
          trim: true,
          comment: "A user-friendly label for the field (e.g., 'Aadhaar Number', 'PAN')."
        },
        prompt: { // General prompt for data entry
          type: String,
          required: [true, "Field prompt is required."],
          trim: true,
          comment: "General prompt guiding the user for data entry for this field."
        },
        type: {
          type: String,
          enum: [
            "text", "number", "date", "textarea", "select",
            "checkbox", "multiselect", "image", "document",
          ],
          default: "text",
          comment: "Expected data type for the field."
        },
        required: { // Whether this field must be filled by the user
          type: Boolean,
          default: false,
          comment: "Indicates if the field is mandatory for submission."
        },
        options: { // For 'select', 'checkbox', 'multiselect' types
          type: [String],
          default: undefined,
          comment: "Array of options for select, checkbox, or multiselect types."
        },
        min_value: { // Renamed from min_length for consistency if it represents numeric/date min
          type: String, // Kept as String as per original schema, but consider Number/Date for type:'number'/'date'
          // MODIFIED: Conditional requirement based on type
          required: function () {
            const applicableTypes = ["text", "textarea", "number", "date", "datetime", "time"];
            return applicableTypes.includes(this.type);
          },
          comment: "Minimum value or length constraint, applicable based on field type."
        },
        max_value: { // Renamed from max_length
          type: String, // Kept as String
          // MODIFIED: Conditional requirement based on type
          required: function () {
            const applicableTypes = ["text", "textarea", "number", "date", "datetime", "time"];
            return applicableTypes.includes(this.type);
          },
          comment: "Maximum value or length constraint, applicable based on field type."
        },
        // *** NEW FIELD for marking unique identifiers ***
        is_unique_identifier: {
          type: Boolean,
          default: false,
          comment: "Marks this field as a unique identifier for fetching the submitted document. Must be of type 'text' and required."
        },
        // *** NEW FIELD for specific prompt for unique identifiers ***
        unique_identifier_prompt: {
            type: String,
            trim: true,
            // Required only if is_unique_identifier is true
            required: function() { return this.is_unique_identifier === true; },
            comment: "Specific prompt for unique identifier fields, e.g., 'Enter 12-digit number without spaces'."
        }
      },
    ],
  },
  {
    timestamps: true, 
  }
);

// --- Middleware ---
GovDocumentSchemaDefinition.pre("save", function (next) {
  console.log(`Validating document definition with schema_id: ${this.schema_id}`);

  let uniqueIdentifierFound = false;
  const errors = [];

  for (const field of this.fields) {
    // Validate min_value and max_value based on type (example for numbers)
    if (field.type === "number") {
      if (field.required && (field.min_value === undefined || field.max_value === undefined)) {
         // This check is now handled by the conditional required on min_value/max_value itself.
         // However, you might want to ensure they are parseable as numbers here.
      }
      if (field.min_value !== undefined && field.max_value !== undefined) {
        const minValueNum = parseFloat(field.min_value);
        const maxValueNum = parseFloat(field.max_value);
        if (isNaN(minValueNum) || isNaN(maxValueNum)) {
          errors.push(`Min/max values for number field "${field.label}" must be valid numbers.`);
        } else if (minValueNum > maxValueNum) {
          errors.push(`Min value cannot be greater than max value for number field "${field.label}".`);
        }
      }
    }

    // Validations for unique identifier fields
    if (field.is_unique_identifier === true) {
      uniqueIdentifierFound = true;
      if (field.type !== "text") {
        errors.push(`Field "${field.label}" is marked as a unique identifier but is not of type 'text'. Unique identifiers must be text-based.`);
      }
      if (field.required !== true) {
        errors.push(`Field "${field.label}" is marked as a unique identifier and therefore must be 'required'.`);
      }
      if (!field.unique_identifier_prompt || field.unique_identifier_prompt.trim() === "") {
        errors.push(`Field "${field.label}" is marked as a unique identifier and requires a 'unique_identifier_prompt'.`);
      }
    } else {
        // If not a unique identifier, unique_identifier_prompt should not be set or should be empty
        if (field.unique_identifier_prompt && field.unique_identifier_prompt.trim() !== "") {
            // Optionally, clear it or raise a warning/error if it's set for non-unique fields
            // field.unique_identifier_prompt = undefined; 
            // console.warn(`Field "${field.label}" has a unique_identifier_prompt but is not marked as a unique identifier.`);
        }
    }
  }

  if (!uniqueIdentifierFound) {
    errors.push("At least one field must be marked as a unique identifier (is_unique_identifier: true).");
  }

  if (errors.length > 0) {
    return next(new Error(errors.join("\n")));
  }

  next();
});

GovDocumentSchemaDefinition.post("save", function (doc, next) {
  console.log(`Document definition with schema_id: ${doc.schema_id} saved successfully.`);
  next();
});

// --- Indexes ---
GovDocumentSchemaDefinition.index({ name: 1 });
GovDocumentSchemaDefinition.index({ "fields.key": 1 });
GovDocumentSchemaDefinition.index({ "fields.is_unique_identifier": 1 }); // Index for finding schemas with unique ID fields

const GovDocumentDefinitionModel = mongoose.model(
  "GovDocumentDefinition", // Consider renaming to GovDocumentSchema if it defines the schema structure
  GovDocumentSchemaDefinition
);

export default GovDocumentDefinitionModel;
