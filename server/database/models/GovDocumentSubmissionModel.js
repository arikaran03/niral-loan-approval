import mongoose from "mongoose";

// Assume 'Image' model stores file metadata (_id, filename, contentType, path/buffer, uploadedBy, etc.)
// import Image from './Image'; // Ensure you have your file model imported or defined elsewhere

// --- The Subdocument Schema (Remains the same) ---
const submissionFieldSchema = new mongoose.Schema(
  {
    field_id: { type: String, required: true },
    field_label: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "image",
        "document",
        "text",
        "number",
        "date",
        "datetime",
        "time",
        "textarea",
        "select",
        "checkbox",
        "multiselect",
      ],
      required: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: function () {
        return this.type !== "image" && this.type !== "document";
      },
    },
    fileRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Image", // *** CHANGE 'Image' TO YOUR ACTUAL FILE MODEL NAME ***
      required: function () {
        return this.type === "image" || this.type === "document";
      },
    },
  },
  { _id: false }
); // _id: false is crucial for subdocuments

// --- Parent Schema renamed to GovDocumentSubmissionSchema ---
// This schema contains the array of submission fields using submissionFieldSchema.
const GovDocumentSubmissionSchema = new mongoose.Schema(
  {
    // Added schema_id field
    schema_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GovSchema",
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // User who is submitting
    // Added created_by field
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // User account that initiated the creation

    // Removed submission_date and status

    // This is where the submissionFieldSchema is used as an array of subdocuments
    fields: {
      type: [submissionFieldSchema], // Array of subdocuments using the schema
      default: [],
    },

    // ... other fields relevant to this submission type ...
  },
  {
    // Use timestamps to automatically add created_at and updated_at
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// --- Middleware (Applied to the PARENT Schema: GovDocumentSubmissionSchema) ---
// Middleware functions are attached to this top-level schema.
// The previous middleware logic related to 'status' and 'submission_date' has been removed.
GovDocumentSubmissionSchema.pre("save", function (next) {
  console.log(
    "GovDocumentSubmission document is being saved. Checking fields..."
  );

  // Example middleware logic: Ensure 'value' is not null for certain types/fields
  // This logic runs when a GovDocumentSubmission document is saved.
  for (const field of this.fields) {
    if (
      field.type === "text" &&
      (field.value === null ||
        field.value === undefined ||
        field.value.toString().trim() === "")
    ) {
      // Example validation: Prevent saving if a required text field is empty
      // return next(new Error(`Field "${field.field_label}" (ID: ${field.field_id}) of type 'text' requires a non-empty value.`));
      // Or just log a warning
      console.warn(
        `Field "${field.field_label}" (ID: ${field.field_id}) is text type but has no value.`
      );
    }
    // Add other validation logic for other field types or specific field_ids as needed
  }

  // Add any new middleware logic related to schema_id, created_by, or other fields here

  next(); // Continue the save operation
});

// --- Indexes (Defined on the PARENT Schema: GovDocumentSubmissionSchema) ---
// Indexes are defined on this top-level schema to optimize queries.

// Index on the schema_id for efficient lookups of submissions for a specific schema
GovDocumentSubmissionSchema.index({ schema_id: 1 });

// Index on user_id for efficient lookups of submissions by a specific user
GovDocumentSubmissionSchema.index({ user_id: 1 });

// Example of an index on a field *within* the subdocument array:
GovDocumentSubmissionSchema.index({ "fields.field_id": 1 });

// Query submissions for a schema based on a specific field value within the fields array
GovDocumentSubmissionSchema.index({ schema_id: 1, "fields.field_id": 1 });

// You could add more indexes depending on your query patterns.

// --- Creating the Parent Model ---
// You create a Mongoose model from the PARENT schema.
const GovDocumentSubmissionModel = mongoose.model(
  "GovDocumentSubmission",
  GovDocumentSubmissionSchema
);

// You typically export the parent model for use in your application.
// export default GovDocumentSubmissionModel;

// Exporting all for demonstration purposes if needed elsewhere
export default GovDocumentSubmissionModel;
