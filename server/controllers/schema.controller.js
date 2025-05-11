// schema.controller.js
import GovDocumentDefinitionModel from "../database/models/GovDocumentSchemaDefinitionModel"; // Adjust path as needed

// --- Controller function to handle creating a new Schema Definition ---
// This function will be called by the router when a POST request hits /api/document/schema-definition
export const createSchemaDefinition = async (req, res) => {
  // Use named export
  console.log(
    "Received POST request for /api/document/schema-definition (in controller)"
  );
  console.log("Request Body:", req.body);

  // Extract data from the request body.
  const { schema_id, name, description, fields } = req.body;

  // --- Server-side Validation ---
  // Perform basic validation before attempting to create the Mongoose document.
  // Mongoose schema validation will provide more detailed error messages upon saving.

  if (
    !schema_id ||
    !name ||
    !description ||
    !fields ||
    !Array.isArray(fields)
  ) {
    console.error(
      "Validation Error: Missing required top-level fields or fields is not an array."
    );
    return res
      .status(400)
      .json({
        message:
          "Missing required fields: schema_id, name, description, or fields array.",
      });
  }

  // Basic validation for fields array content
  for (const field of fields) {
    // Check for the presence of required properties in each field object
    if (
      !field.key ||
      !field.label ||
      !field.type ||
      field.min_value === undefined ||
      field.max_value === undefined
    ) {
      console.error(
        "Validation Error: Missing required field properties in fields array.",
        field
      );
      return res
        .status(400)
        .json({
          message:
            "Each field in the fields array must have key, label, type, min_value, and max_value.",
        });
    }
    // Optional: Add more specific validation based on field.type if needed
    // For select/multiselect, check if options array is present, is an array, and is not empty
    if (
      (field.type === "select" || field.type === "multiselect") &&
      (!field.options ||
        !Array.isArray(field.options) ||
        field.options.length === 0)
    ) {
      console.error(
        "Validation Error: Options are required for select/multiselect types.",
        field
      );
      return res
        .status(400)
        .json({
          message: `Field "${field.label}" (key: ${field.key}) requires options for type "${field.type}".`,
        });
    }
    // You could add checks here for min_value/max_value format based on type if they were not strictly strings
  }

  try {
    // Create a new document instance using the Mongoose model
    // Mongoose will handle schema validation based on GovDocumentSchemaDefinitionModel
    const newSchemaDefinition = new GovDocumentDefinitionModel({
      schema_id: schema_id.trim(), // Trim whitespace from schema_id
      name: name.trim(), // Trim whitespace from name
      description: description.trim(), // Trim whitespace from description
      // Map over the fields array to ensure data matches the subdocument schema structure
      fields: fields.map((field) => ({
        key: field.key.trim(), // Trim whitespace from field key
        label: field.label.trim(), // Trim whitespace from field label
        type: field.type, // Use the provided type
        required: field.required || false, // Default required to false if not provided
        options: field.options, // Pass the options array directly
        min_value: field.min_value.trim(), // Trim whitespace from min_value
        max_value: field.max_value.trim(), // Trim whitespace from max_value
      })),
    });

    // Save the document to the database
    const savedSchemaDefinition = await newSchemaDefinition.save();

    console.log("Schema Definition saved successfully:", savedSchemaDefinition);

    // Send a success response back to the client
    // Respond with the created document and a 201 Created status code
    res.status(201).json({
      message: "Schema definition created successfully!",
      schemaDefinition: savedSchemaDefinition, // Include the saved document in the response
    });
  } catch (error) {
    console.error("Error saving schema definition:", error);

    // --- Error Handling ---
    // Check if the error is a Mongoose validation error
    if (error.name === "ValidationError") {
      // Mongoose validation failed (e.g., required fields missing, invalid types)
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: "Validation failed", errors: messages });
    }

    // Check if the error is a MongoDB duplicate key error (code 11000)
    // This typically happens for unique indexes, like the schema_id
    if (error.code === 11000) {
      // Duplicate key error (likely schema_id unique constraint violation)
      return res
        .status(409)
        .json({ message: `Schema with ID '${schema_id}' already exists.` });
    }

    // Handle any other unexpected errors (e.g., database connection issues)
    res
      .status(500)
      .json({
        message: "An error occurred while saving the schema definition.",
        error: error.message,
      });
  }
};
