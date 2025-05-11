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
      required: true,
      default: undefined, // Explicit default
    },
    // Array of fields required for this document type, using the dynamicDocumentFieldSchema
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
      trim: true, // Added trim
      // ref: "GvtDocumentSchemaDefinition", // Optional: Can add a ref if you need to populate. Removed for now.
    },
    // The actual data submitted by the user for the fields defined in the schema definition.
    submitted_data: {
      type: Map, // Use Map to store key-value pairs dynamically
      of: mongoose.Schema.Types.Mixed, // Allows storing various data types (string, number, boolean, etc.)
    },
    // Optional: Reference to an uploaded file (now a string/text identifier)
    fileRef: {
      type: String, // Changed from ObjectId to String
      trim: true, // Added trim for String type
      // ref: "File", // Removed ref
      required: false, // Simplified required condition, was a function returning false
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
      trim: true, // Added trim
    },
  },
  {
    _id: false, // Prevent Mongoose from creating an _id for subdocuments if embedded
  }
);

// --- Main Loan Submission Schema (Modified) ---
const submissionFieldSchema = new mongoose.Schema(
  {
    field_id: {
      type: String,
      required: true,
      trim: true, // Added trim
    },
    field_label: {
      type: String,
      required: true,
      trim: true, // Added trim
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
    // fileRef for custom fields, now a string/text identifier
    fileRef: {
      type: String, // Changed from ObjectId to String
      trim: true, // Added trim for String type
      // ref: "File", // Removed ref
      required: function () {
        // This logic remains: a file reference (string) is needed if type is image/document
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
      trim: true, // Added trim
    },
    // fileRef for standard required documents, now a string/text identifier
    fileRef: {
      type: String, // Changed from ObjectId to String
      required: true,
      trim: true, // Added trim for String type
      // ref: "File", // Removed ref
    },
    // Optional: Add status related to this specific document upload/verification if needed
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "failed"],
      default: "pending", // Added default
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
      type: mongoose.Schema.Types.ObjectId, // Assuming User ID is still an ObjectId
      ref: "User", // *** CHANGE 'User' TO YOUR ACTUAL USER MODEL NAME ***
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
      type: mongoose.Schema.Types.ObjectId, // Assuming Loan ID is still an ObjectId
      ref: "Loan", // *** CHANGE 'Loan' TO YOUR ACTUAL LOAN MODEL NAME ***
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId, // Assuming User ID is still an ObjectId
      ref: "User", // *** CHANGE 'User' TO YOUR ACTUAL USER MODEL NAME ***
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
      type: mongoose.Schema.Types.ObjectId, // Assuming User ID is still an ObjectId
      ref: "User", // *** CHANGE 'User' TO YOUR ACTUAL USER MODEL NAME ***
    },
    approval_date: {
      type: Date,
    },
    rejection_reason: {
      type: String,
      trim: true, // Added trim
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updated_at: "updated_at",
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
// const FileModel = mongoose.model('File', FileSchema); // Assuming FileSchema exists for file uploads (though fileRef is now String)

export {
  GvtDocumentSchemaDefinitionModel,
  LoanSubmissionModel,
  // Export other models as needed
};
