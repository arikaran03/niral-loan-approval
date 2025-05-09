import mongoose from "mongoose";

// Schema to define the structure of a dynamic government document type
// This will be created by the admin when they add a new required document type dynamically.
const GvtDocumentSchemaDefinition = new mongoose.Schema(
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
    },
    // Array of fields required for this document type.
    // Each field will have a key (the field name/label) and potentially validation rules or type hints.
    // We'll store these as key-value pairs to allow flexibility.
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
        // Add more validation/configuration fields here as needed by the admin UI
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Schema to store the actual user-submitted data for a specific dynamic government document
// This will be embedded within the LoanSubmission schema.
const GvtDocumentSubmission = new mongoose.Schema(
  {
    // Reference to the schema definition for this document type
    schema_id: {
      type: String, // Storing schema_id directly for easier lookup/embedding
      required: true,
      ref: "GvtDocumentSchemaDefinition", // Optional: Can add a ref if you need to populate the definition
    },
    // The actual data submitted by the user for the fields defined in the schema definition.
    // Stored as a Map or Object for flexible key-value storage.
    // Using Map is generally preferred in Mongoose for arbitrary keys.
    submitted_data: {
      type: Map, // Use Map to store key-value pairs dynamically
      of: mongoose.Schema.Types.Mixed, // Allows storing various data types (string, number, boolean, etc.)
    },
    // Optional: Reference to an uploaded file if the document type involves a file upload
    fileRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File", // *** CHANGE 'File' TO YOUR ACTUAL FILE MODEL NAME ***
      required: function () {
        // This field is required if the corresponding GvtDocumentSchemaDefinition
        // has any field with type 'image' or 'document'.
        // This check might be better handled in application logic before saving.
        return false; // Default to false, handle required check in service layer
      },
    },
    // Optional: Add status related to this specific dynamic document upload/verification
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "failed"],
      default: "pending",
    },
    verifiedAt: {
      type: Date,
    },
    // Optional: Any notes or reasons for verification status
    verificationNotes: {
      type: String,
    },
  },
  {
    _id: false, // Prevent Mongoose from creating an _id for subdocuments if embedded
  }
);

// --- Main Loan Submission Schema (Modified) ---
// Assuming you have a main LoanSubmission schema similar to the one in your template,
// we will add the GvtDocumentSubmission array to it.

// Assuming existing sub-schemas like submissionFieldSchema, requiredDocumentRefSchema, stageHistorySchema
// (These are based on the schemas provided in your image)

const submissionFieldSchema = new mongoose.Schema(
  {
    field_id: {
      type: String,
      required: true,
    },
    field_label: {
      type: String,
      required: true,
    },
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
      ref: "File", // *** CHANGE 'File' TO YOUR ACTUAL FILE MODEL NAME ***
      required: function () {
        return this.type === "image" || this.type === "document";
      },
    },
  },
  {
    _id: false,
  }
);

const requiredDocumentRefSchema = new mongoose.Schema(
  {
    documentName: {
      // The 'name' of the required document (e.g., "PAN Card")
      type: String,
      required: true,
    },
    fileRef: {
      // The ObjectId referencing the uploaded file
      type: mongoose.Schema.Types.ObjectId,
      ref: "File", // *** CHANGE 'File' TO YOUR ACTUAL FILE MODEL NAME ***
      required: true,
    },
    // Optional: Add status related to this specific document upload/verification if needed
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "failed"],
    },
    verifiedAt: Date,
  },
  {
    _id: false,
  }
);

const stageHistorySchema = new mongoose.Schema(
  {
    stage: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      required: true,
    },
    changed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changed_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const LoanSubmissionSchema = new mongoose.Schema(
  {
    loan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    stage: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "draft",
      index: true,
    },
    // Responses for CUSTOM fields defined in Loan.fields
    fields: {
      type: [submissionFieldSchema],
      default: [],
    },
    // References for STANDARD required documents (like Aadhar, PAN based on your description)
    requiredDocumentRefs: {
      type: [requiredDocumentRefSchema],
      default: [],
    },
    // *** NEW FIELD: References for DYNAMIC government documents ***
    dynamicGvtDocuments: {
      type: [GvtDocumentSubmission], // Array of submitted dynamic government documents
      default: [],
    },
    history: {
      type: [stageHistorySchema],
      default: [],
    },
    approver_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approval_date: {
      type: Date,
    },
    rejection_reason: {
      type: String,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// Create the models
const GvtDocumentSchemaDefinitionModel = mongoose.model(
  "GvtDocumentSchemaDefinition",
  GvtDocumentSchemaDefinition
);
const LoanSubmissionModel = mongoose.model(
  "LoanSubmission",
  LoanSubmissionSchema
);

// You would also need models for 'Loan', 'User', and 'File' if they don't exist yet.
// const LoanModel = mongoose.model('Loan', LoanSchema); // Assuming LoanSchema exists from your template
// const UserModel = mongoose.model('User', UserSchema); // Assuming UserSchema exists
// const FileModel = mongoose.model('File', FileSchema); // Assuming FileSchema exists for file uploads

export {
  GvtDocumentSchemaDefinitionModel,
  LoanSubmissionModel,
  // Export other models as needed
};