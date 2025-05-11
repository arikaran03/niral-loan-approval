import mongoose from "mongoose";

// Schema to define the structure of a dynamic government document type
// This will be created by the admin when they add a new required document type dynamically.
const GovDocumentSchemaDefinition = new mongoose.Schema(
  {
    // Unique identifier for the schema (e.g., 'tc' for Transfer Certificate, 'voter_id' for Voter ID)
    schema_id: {
      type: String,
      required: true,
      unique: true, // Ensure schema_id is unique
      trim: true,
    },
    // Human-readable name for the document type (e.g., 'Transfer Certificate', 'Voter ID')
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Description or purpose of the document
    description: {
      type: String,
      trim: true,
      required: true,
      default: undefined, // Explicit default
    },
    // Array of fields required for this document type, using an inline subdocument schema
    fields: [
      {
        // The key or name of the field (e.g., 'tc_number', 'student_name', 'issuing_authority')
        key: {
          type: String,
          required: true,
          trim: true,
        },
        // A user-friendly label for the field (e.g., 'Transfer Certificate Number', 'Student Full Name')
        label: {
          type: String,
          required: true,
          trim: true,
        },
        // Optional: Specify the expected data type (e.g., 'text', 'number', 'date')
        type: {
          type: String,
          enum: [
            "text",
            "number",
            "date",
            "textarea",
            "select",
            "checkbox",
            "multiselect",
            "image",
            "document",
          ], // Add other types as needed
          default: "text",
        },
        // Optional: Indicate if the field is required when submitting data
        required: {
          type: Boolean,
          default: false,
        },
        // Optional: For 'select', 'checkbox', 'multiselect' types
        options: {
          type: [String],
          default: undefined,
        },
        min_value: {
          type: String,
          required: true,
        },
        max_value: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

// --- Middleware (Applied to the GovDocumentSchemaDefinition schema) ---

// Example pre-save middleware
GovDocumentSchemaDefinition.pre("save", function (next) {
  console.log(`Saving document definition with schema_id: ${this.schema_id}`);

  // You can add validation or logic here.
  // For example, validate that min_value and max_value make sense for 'number' type fields.
  // Note: As requested, min_value/max_value are required strings on *all* field definitions.
  // You might need more specific validation logic depending on the field 'type'.

  for (const field of this.fields) {
    // Example check (since they are required strings as requested)
    if (!field.min_value || !field.max_value) {
      // This check is technically redundant because they are required, but demonstrates middleware access
      console.warn(
        `Field "${field.label}" (key: ${field.key}) is missing min_value or max_value (even though schema marks them required).`
      );
      // If they weren't required in schema but you needed validation here:
      // return next(new Error(`Field "${field.label}" requires both min_value and max_value.`));
    }

    // Example: If type is 'number', maybe try parsing min/max values?
    if (field.type === "number") {
      // Be cautious if they are defined as REQUIRED strings in the schema,
      // but you expect them to be numbers for validation here.
      // You might add logic to check if the string is a valid number representation.
      const minValueNum = parseFloat(field.min_value);
      const maxValueNum = parseFloat(field.max_value);

      if (isNaN(minValueNum) || isNaN(maxValueNum)) {
        console.warn(
          `Field "${field.label}" (key: ${field.key}) is type 'number', but min/max values are not valid numbers: "${field.min_value}", "${field.max_value}"`
        );
        // return next(new Error(`Min/max values for number field "${field.label}" must be valid numbers.`));
      } else if (minValueNum > maxValueNum) {
        console.warn(
          `Field "${field.label}" (key: ${field.key}) has min_value (${minValueNum}) greater than max_value (${maxValueNum}).`
        );
        // return next(new Error(`Min value cannot be greater than max value for field "${field.label}".`));
      }
    }
  }

  next();
});

// Example post-save middleware
GovDocumentSchemaDefinition.post("save", function (doc, next) {
  console.log(`Document definition with schema_id: ${doc.schema_id} saved.`);
  // You could perform actions after saving here, e.g., logging, sending notifications.
  next();
});

// --- Indexes (Defined on the GovDocumentSchemaDefinition schema) ---

// Index on schema_id for quick lookups by the unique identifier
GovDocumentSchemaDefinition.index({ schema_id: 1 }); // Unique index is implicitly created by schema definition, but explicit index is fine.

// Index on name for lookups by the human-readable name
GovDocumentSchemaDefinition.index({ name: 1 });

// Index on the 'key' field within the 'fields' subdocument array
// This helps in querying document definitions that contain a field with a specific key.
GovDocumentSchemaDefinition.index({ "fields.key": 1 });

// --- Creating the Model ---
// Create a Mongoose model from the schema definition
const GovDocumentDefinitionModel = mongoose.model(
  "GovDocumentDefinition",
  GovDocumentSchemaDefinition
);

// Export the model for use in your application
export default GovDocumentDefinitionModel;
