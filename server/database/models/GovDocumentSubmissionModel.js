// src/models/GovDocumentSubmission.js
import mongoose from "mongoose";
// We need to import GovDocumentDefinitionModel to fetch the schema definition for validation
import GovDocumentDefinitionModel from './GovDocumentDefinitionModel.js';

// --- The Subdocument Schema (submissionFieldSchema) ---
const submissionFieldSchema = new mongoose.Schema(
  {
    field_id: { type: String, required: true, comment: "Matches 'key' from the GovDocumentDefinition's fields array." }, 
    field_label: { type: String, required: true, comment: "Label of the field at the time of submission." },
    type: {
      type: String,
      enum: [
        "image", "document", "text", "number", "date",
        "datetime", "time", "textarea", "select", "checkbox", "multiselect",
      ],
      required: true,
      comment: "Data type of the field as defined in the GovDocumentDefinition."
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: function () {
        return this.type !== "image" && this.type !== "document";
      },
      comment: "Value for non-file type fields."
    },
    fileRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File", 
      required: function () {
        return this.type === "image" || this.type === "document";
      },
      comment: "Reference to the uploaded file in the 'Files' collection for image/document types."
    },
  },
  { _id: false, comment: "Subdocument for individual field submissions." } 
);

// --- Parent Schema: GovDocumentSubmissionSchema ---
const GovDocumentSubmissionSchema = new mongoose.Schema(
  {
    schema_id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "GovDocumentDefinition", 
      required: [true, "Schema definition ID is required."],
      index: true,
      comment: "Reference to the GovDocumentDefinition used for this submission."
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", 
      required: [true, "User ID for the owner of the submission is required."],
      index: true,
      comment: "User who owns this submission."
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", 
      required: [true, "Creator user ID is required."],
      comment: "User account that initiated the submission creation."
    },
    fields: {
      type: [submissionFieldSchema], 
      default: [],
      comment: "Array of submitted field data."
    },
    // *** MODIFIED: Store an array of submitted unique identifiers ***
    submitted_unique_identifiers: [
      {
        _id: false, // No need for individual _id for these sub-objects
        key: { type: String, required: true, trim: true, comment: "The 'key' of the unique identifier field from GovDocumentDefinition." },
        value: { type: String, required: true, trim: true, comment: "The submitted value for this unique identifier." }
      }
    ]
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    comment: "Schema for storing submissions made against a GovDocumentDefinition."
  }
);

// --- Middleware for GovDocumentSubmissionSchema ---
GovDocumentSubmissionSchema.pre("save", async function (next) { 
  console.log("GovDocumentSubmission document is about to be saved/updated. Performing validations...");

  this.fields.forEach(field => {
    if (field.type === "image" || field.type === "document") {
      field.value = undefined; 
    } else {
      field.fileRef = undefined;
    }
  });

  if (this.isNew || this.isModified('fields') || this.isModified('schema_id')) { // Also run if schema_id changes, though unlikely
    try {
      const documentDefinition = await GovDocumentDefinitionModel.findById(this.schema_id);
      if (!documentDefinition) {
        return next(new Error(`Document definition with ID '${this.schema_id}' not found. Cannot validate submission.`));
      }

      const uniqueIdentifierDefFields = documentDefinition.fields.filter(
        (defField) => defField.is_unique_identifier === true
      );

      // Clear existing submitted_unique_identifiers to repopulate
      this.submitted_unique_identifiers = []; 
      let atLeastOneUniqueIdentifierSubmittedWithValue = false;

      if (uniqueIdentifierDefFields.length === 0) {
        console.warn(`The document definition '${documentDefinition.name}' (ID: ${this.schema_id}) has no fields marked as unique identifiers. Skipping unique value check for submission.`);
      } else {
        for (const defField of uniqueIdentifierDefFields) {
          const submittedField = this.fields.find(
            (subField) => subField.field_id === defField.key 
          );

          if (submittedField && submittedField.value !== null && submittedField.value !== undefined && String(submittedField.value).trim() !== "") {
            // Add to our array of submitted unique identifiers
            this.submitted_unique_identifiers.push({
                key: defField.key,
                value: String(submittedField.value).trim()
            });
            atLeastOneUniqueIdentifierSubmittedWithValue = true;
          } else if (defField.required && !submittedField) { 
            console.warn(`Required unique identifier field '${defField.label}' (key: ${defField.key}) was not found in submission fields.`);
            // This specific field was required by definition but not submitted.
            // The overall check below will ensure at least one *other* unique ID was submitted if this one was missed.
          }
        }

        if (!atLeastOneUniqueIdentifierSubmittedWithValue) {
          const uniqueFieldLabels = uniqueIdentifierDefFields.map(f => `"${f.label}" (key: ${f.key})`).join(" or ");
          return next(new Error(`Submission requires at least one of the defined unique identifier fields (${uniqueFieldLabels}) to have a non-empty value.`));
        }
      }
    } catch (error) {
      console.error("Error during unique identifier validation in GovDocumentSubmission:", error);
      return next(error);
    }
  }

  next(); 
});

// --- Indexes for GovDocumentSubmissionSchema ---
GovDocumentSubmissionSchema.index({ user_id: 1, schema_id: 1 }); 
// Index for querying by specific submitted unique identifiers
GovDocumentSubmissionSchema.index({ schema_id: 1, "submitted_unique_identifiers.key": 1, "submitted_unique_identifiers.value": 1 });


// --- Creating the Model ---
const GovDocumentSubmissionModel = mongoose.model(
  "GovDocumentSubmission",
  GovDocumentSubmissionSchema
);

export default GovDocumentSubmissionModel;
