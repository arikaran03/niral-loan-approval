import React, { useState, useEffect } from "react";
import {
  Form,
  Button,
  Container,
  Row,
  Col,
  Card,
  InputGroup,
  Spinner,
  Alert,
} from "react-bootstrap";
import { axiosInstance } from "../../../config.js"; // Assuming axiosInstance is correctly configured

// Define the possible field types based on your schema
const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "textarea",
  "select",
  "checkbox",
  "multiselect",
  "image",
  "document",
];

// --- Admin Schema Definition Form Component ---
const DynamicDocumentForm = () => {
  // State for the main schema details
  const [schemaDetails, setSchemaDetails] = useState({
    schema_id: "",
    name: "",
    description: "",
  });

  // State for the array of field definitions
  const [fields, setFields] = useState([]);

  // State for validation errors
  const [validationErrors, setValidationErrors] = useState({});

  // State for loading during submission
  const [loading, setLoading] = useState(false);

  // State for submission status and message
  const [submitStatus, setSubmitStatus] = useState("idle"); // 'idle', 'loading', 'success', 'error'
  const [statusMessage, setStatusMessage] = useState("");

  // Handle changes for main schema details
  const handleSchemaDetailsChange = (e) => {
    const { name, value } = e.target;
    setSchemaDetails((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field on change
    setValidationErrors((prev) => {
      const newState = { ...prev };
      delete newState[name];
      return newState;
    });
  };

  // Handle changes for a specific field in the fields array
  const handleFieldChange = (index, e) => {
    const { name, value, type, checked } = e.target;
    const newFields = [...fields];

    // Handle checkbox input specifically
    if (type === "checkbox") {
      newFields[index][name] = checked;
    } else {
      // Handle other input types
      newFields[index][name] = value;
    }

    setFields(newFields);

    // Clear error for this specific field input on change
    setValidationErrors((prev) => {
      const newState = { ...prev };
      if (newState.fields && newState.fields[index]) {
        delete newState.fields[index][name];
        // If no more errors for this field index, clean up the field index entry
        if (Object.keys(newState.fields[index]).length === 0) {
          // Use delete operator to remove the property
          delete newState.fields[index];
          // If no more errors in fields array, clean up the fields entry
          if (Object.keys(newState.fields).length === 0) {
            delete newState.fields;
          }
        }
      }
      return newState;
    });
  };

  // Handle adding a new field
  const handleAddField = () => {
    setFields((prev) => [
      ...prev,
      {
        key: "",
        label: "",
        prompt: "", // Added prompt field
        type: "text", // Default type
        required: false,
        options: [], // Initialize options array
        min_value: "", // Initialize min_value as empty string
        max_value: "", // Initialize max_value as empty string
      },
    ]);
  };

  // Handle removing a field
  const handleRemoveField = (index) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
    // Also remove any validation errors associated with this field index
    setValidationErrors((prev) => {
      const newState = { ...prev };
      if (newState.fields) {
        // Filter out the error entry for the removed index
        const newFieldErrors = newState.fields.filter((_, i) => i !== index);
        // Mongoose validation errors are typically an object keyed by path, not an array
        // Adjusting cleanup to match potential Mongoose error structure (though client validation structure is array-based here)
        const cleanedFieldErrors = {};
        newFieldErrors.forEach((err, newIndex) => {
          // Assuming the original errors were fieldErrors[index] = { key: '...', ... }
          // This part of error cleanup is complex with array index changes and might need re-thinking
          // A simpler approach might be to just re-validate after removing a field, but that might be jarring.
          // For now, we'll try filtering the array structure:
          if (prev.fields && prev.fields[index]) {
            // This is a simplified attempt to clean up the old index's errors
            // A more robust solution might involve re-indexing errors or a different error state structure
            // For this example, let's remove the error for the index that was removed
            const errorsAfterRemoval = prev.fields.filter(
              (_, i) => i !== index
            );
            // Note: This might not correctly align errors if indices shift significantly
            // Keeping it simple for the demo
            newState.fields = errorsAfterRemoval;
            if (newState.fields.length === 0) {
              delete newState.fields;
            }
          }
        });
        if (Object.keys(cleanedFieldErrors).length > 0) {
          newState.fields = cleanedFieldErrors;
        } else if (newState.fields && newState.fields.length === 0) {
          delete newState.fields;
        }
      }
      return newState;
    });
  };

  // Handle changes for options array (for select/multiselect)
  const handleOptionsChange = (index, e) => {
    const newFields = [...fields];
    // Split the comma-separated string into an array, trim whitespace
    newFields[index].options = e.target.value
      .split(",")
      .map((option) => option.trim())
      .filter((option) => option !== "");
    setFields(newFields);
    // Clear error for options on change
    setValidationErrors((prev) => {
      const newState = { ...prev };
      if (newState.fields && newState.fields[index]) {
        delete newState.fields[index].options;
        if (Object.keys(newState.fields[index]).length === 0) {
          delete newState.fields[index];
          if (Object.keys(newState.fields).length === 0) {
            delete newState.fields;
          }
        }
      }
      return newState;
    });
  };

  // Client-side validation logic
  const validateForm = () => {
    const errors = {};
    let isValid = true;

    // Validate main schema details
    if (!schemaDetails.schema_id.trim()) {
      errors.schema_id = "Schema ID is required.";
      isValid = false;
    }
    // Basic format check for schema_id (e.g., no spaces, lowercase) - optional
    if (
      schemaDetails.schema_id.trim() &&
      !/^[a-z0-9_]+$/.test(schemaDetails.schema_id.trim())
    ) {
      errors.schema_id =
        "Schema ID can only contain lowercase letters, numbers, and underscores.";
      isValid = false;
    }
    if (!schemaDetails.name.trim()) {
      errors.name = "Name is required.";
      isValid = false;
    }
    if (!schemaDetails.description.trim()) {
      errors.description = "Description is required.";
      isValid = false;
    }

    // Validate fields array
    const fieldErrors = [];
    fields.forEach((field, index) => {
      const currentFieldErrors = {};
      if (!field.key.trim()) {
        currentFieldErrors.key = "Key is required.";
        isValid = false;
      }
      // Basic format check for field key - optional
      if (field.key.trim() && !/^[a-z0-9_]+$/.test(field.key.trim())) {
        currentFieldErrors.key =
          "Field key can only contain lowercase letters, numbers, and underscores.";
        isValid = false;
      }
      if (!field.label.trim()) {
        currentFieldErrors.label = "Label is required.";
        isValid = false;
      }
      // Prompt is generally expected if a field exists
      if (!field.prompt || !field.prompt.trim()) {
        currentFieldErrors.prompt = "Prompt is required for the field.";
        isValid = false;
      }
      // Type is required by schema, default is text, so this check might be redundant if default works
      if (!field.type) {
        currentFieldErrors.type = "Type is required.";
        isValid = false;
      }

      // Validate options for select/multiselect
      if (
        (field.type === "select" || field.type === "multiselect") &&
        (!field.options || field.options.length === 0)
      ) {
        currentFieldErrors.options =
          "Options are required for select/multiselect types (comma-separated).";
        isValid = false;
      }

      // --- MODIFIED VALIDATION FOR min_value/max_value ---
      // min_value and max_value are required strings only if type is NOT image or document
      const isImageOrDocument =
        field.type === "image" || field.type === "document";

      if (!isImageOrDocument && field.min_value === "") {
        currentFieldErrors.min_value = "Min value is required.";
        isValid = false;
      }
      if (!isImageOrDocument && field.max_value === "") {
        currentFieldErrors.max_value = "Max value is required.";
        isValid = false;
      }
      // --- END MODIFIED VALIDATION ---

      // Optional: Add more specific validation based on field.type and min/max values
      // This part remains the same, but will only apply if min_value/max_value are provided (not empty)
      if (
        field.type === "number" &&
        field.min_value !== "" && // Only validate format/range if values are not empty
        field.max_value !== ""
      ) {
        const minNum = parseFloat(field.min_value);
        const maxNum = parseFloat(field.max_value);
        if (isNaN(minNum) || isNaN(maxNum)) {
          // Consider adding format validation even if not strictly required by backend schema
          // currentFieldErrors.min_value = currentFieldErrors.max_value = 'Must be valid numbers.';
          // isValid = false;
        } else if (minNum > maxNum) {
          currentFieldErrors.min_value =
            "Min value cannot be greater than max value.";
          isValid = false;
        }
      }
      // Add date validation if needed

      if (Object.keys(currentFieldErrors).length > 0) {
        fieldErrors[index] = currentFieldErrors; // Store errors at the field's index
      }
    });

    // Filter out empty error objects before assigning
    const filteredFieldErrors = fieldErrors.filter(
      (err) => Object.keys(err).length > 0
    );
    if (filteredFieldErrors.length > 0) {
      errors.fields = filteredFieldErrors; // Assign filtered errors
      isValid = false; // Form is invalid if there are any field errors
    } else {
      // If no field errors, ensure the fields key is not present or is empty
      if (errors.fields) delete errors.fields;
    }

    setValidationErrors(errors);
    // Return true only if there are no errors at all
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      console.log("Form validation failed. Showing errors.");
      setSubmitStatus("error");
      setStatusMessage("Please fix the errors in the form before submitting.");
      return;
    }

    setLoading(true);
    setSubmitStatus("loading");
    setStatusMessage("Creating schema definition...");

    // Prepare data for submission - matches your GovDocumentSchemaDefinition schema
    const submissionData = {
      schema_id: schemaDetails.schema_id.trim(),
      name: schemaDetails.name.trim(),
      description: schemaDetails.description.trim(),
      fields: fields.map((field) => ({
        key: field.key.trim(),
        label: field.label.trim(),
        prompt: field.prompt.trim(), // Include prompt field
        type: field.type,
        required: field.required,
        options:
          field.options && field.options.length > 0 ? field.options : undefined, // Send options only if present and not empty
        // Send min_value/max_value as empty string if type is image/document,
        // or trimmed value otherwise.
        min_value:
          field.type === "image" || field.type === "document"
            ? ""
            : field.min_value.trim(),
        max_value:
          field.type === "image" || field.type === "document"
            ? ""
            : field.max_value.trim(),
      })),
    };

    try {
      // Make the API call using the axios instance
      const response = await axiosInstance.post(
        "/api/document/schema-definition",
        submissionData
      ); // POST to /api/document/schema-definition

      if (response.status >= 200 && response.status < 300) {
        // Check for success status codes
        setSubmitStatus("success");
        setStatusMessage("Schema definition created successfully!");
        // Optionally reset the form after success
        setSchemaDetails({ schema_id: "", name: "", description: "" });
        setFields([]);
        setValidationErrors({}); // Clear errors
      } else {
        // Handle non-2xx status codes
        setSubmitStatus("error");
        setStatusMessage(
          `Submission failed: ${
            response.data.message || `Server error (Status: ${response.status})`
          }`
        );
        console.error("Submission error:", response);
      }
    } catch (error) {
      // Handle network errors, request errors, etc.
      setSubmitStatus("error");
      // Check if it's an axios error with a response
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        setStatusMessage(
          `An error occurred: ${error.response.data.message || error.message}`
        );
        console.error("Submission error response:", error.response.data);
        console.error("Submission error status:", error.response.status);
        console.error("Submission error headers:", error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        setStatusMessage(
          `An error occurred: No response received from server.`
        );
        console.error("Submission error request:", error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        setStatusMessage(`An error occurred: ${error.message}`);
        console.error("Submission error message:", error.message);
      }
      console.error("Submission config:", error.config);
    } finally {
      setLoading(false); // End loading state
    }
  };

  // Helper function to determine the HTML input type for min/max values
  // This function returns 'number' for number fields, 'date' for date fields,
  // and 'text' for all other field types, leveraging browser native inputs.
  const getMinMaxValueInputType = (fieldType) => {
    switch (fieldType) {
      case "number":
        return "number";
      case "date":
        return "date";
      case "datetime": // Assuming datetime might use min/max
        return "datetime-local";
      case "time": // Assuming time might use min/max
        return "time";
      default:
        // For image/document/text/textarea/select/multiselect, min/max might represent size or length.
        // Keeping as text input is flexible.
        return "text";
    }
  };

  return (
    <Container className="my-4">
      <h2 className="mb-4">Define New Government Document Schema</h2>

      {/* Submission status messages (Alerts) */}
      {submitStatus !== "idle" && submitStatus !== "loading" && (
        <Alert
          variant={submitStatus === "success" ? "success" : "danger"}
          onClose={() => setSubmitStatus("idle")} // Allow dismissing the alert
          dismissible // Add close button
          className="mb-3"
        >
          {statusMessage}
        </Alert>
      )}

      <Form onSubmit={handleSubmit} noValidate>
        {" "}
        {/* noValidate to rely on JS validation */}
        {/* --- Main Schema Details --- */}
        <Card className="mb-4">
          <Card.Header>Document Type Details</Card.Header>
          <Card.Body>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3" controlId="schemaId">
                  <Form.Label>
                    Schema ID <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="schema_id"
                    value={schemaDetails.schema_id}
                    onChange={handleSchemaDetailsChange}
                    isInvalid={!!validationErrors.schema_id}
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.schema_id}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={8}>
                <Form.Group className="mb-3" controlId="schemaName">
                  <Form.Label>
                    Document Name <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={schemaDetails.name}
                    onChange={handleSchemaDetailsChange}
                    isInvalid={!!validationErrors.name}
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.name}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3" controlId="schemaDescription">
              <Form.Label>
                Description <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                as="textarea"
                name="description"
                value={schemaDetails.description}
                onChange={handleSchemaDetailsChange}
                isInvalid={!!validationErrors.description}
                rows={3}
              />
              <Form.Control.Feedback type="invalid">
                {validationErrors.description}
              </Form.Control.Feedback>
            </Form.Group>
          </Card.Body>
        </Card>
        {/* --- Fields Definition --- */}
        <Card className="mb-4">
          <Card.Header>Document Fields</Card.Header>
          <Card.Body>
            {fields.map((field, index) => {
              // Determine if min/max should be treated as required for UI/Validation
              const isMinMaxRequired =
                field.type !== "image" && field.type !== "document";

              return (
                <Card key={index} className="mb-3 p-3 border">
                  <Row className="align-items-center">
                    <Col md={5}>
                      <Form.Group
                        className="mb-3"
                        controlId={`fieldKey_${index}`}
                      >
                        <Form.Label>
                          Field Key <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          name="key"
                          value={field.key}
                          onChange={(e) => handleFieldChange(index, e)}
                          isInvalid={
                            !!(
                              validationErrors.fields &&
                              validationErrors.fields[index] &&
                              validationErrors.fields[index].key
                            )
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.fields &&
                            validationErrors.fields[index] &&
                            validationErrors.fields[index].key}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group
                        className="mb-3"
                        controlId={`fieldLabel_${index}`}
                      >
                        <Form.Label>
                          Field Label <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          name="label"
                          value={field.label}
                          onChange={(e) => handleFieldChange(index, e)}
                          isInvalid={
                            !!(
                              validationErrors.fields &&
                              validationErrors.fields[index] &&
                              validationErrors.fields[index].label
                            )
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.fields &&
                            validationErrors.fields[index] &&
                            validationErrors.fields[index].label}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={1} className="d-flex justify-content-end">
                      {/* Remove Field Button */}
                      <Button
                        variant="outline-danger"
                        onClick={() => handleRemoveField(index)}
                        size="sm"
                        aria-label={`Remove field ${field.label || index + 1}`}
                      >
                        &times; {/* Simple 'x' icon */}
                      </Button>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={12}>
                      {" "}
                      {/* Prompt field takes full width */}
                      <Form.Group
                        className="mb-3"
                        controlId={`fieldPrompt_${index}`}
                      >
                        <Form.Label>
                          Prompt <span className="text-danger">*</span>{" "}
                          {/* Assuming prompt is required */}
                        </Form.Label>
                        <Form.Control
                          type="text"
                          name="prompt"
                          value={field.prompt}
                          onChange={(e) => handleFieldChange(index, e)}
                          isInvalid={
                            !!(
                              validationErrors.fields &&
                              validationErrors.fields[index] &&
                              validationErrors.fields[index].prompt
                            )
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.fields &&
                            validationErrors.fields[index] &&
                            validationErrors.fields[index].prompt}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={4}>
                      <Form.Group
                        className="mb-3"
                        controlId={`fieldType_${index}`}
                      >
                        <Form.Label>
                          Type <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Select
                          name="type"
                          value={field.type}
                          onChange={(e) => handleFieldChange(index, e)}
                          isInvalid={
                            !!(
                              validationErrors.fields &&
                              validationErrors.fields[index] &&
                              validationErrors.fields[index].type
                            )
                          }
                        >
                          {FIELD_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </Form.Select>
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.fields &&
                            validationErrors.fields[index] &&
                            validationErrors.fields[index].type}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group
                        className="mb-3"
                        controlId={`fieldRequired_${index}`}
                      >
                        <Form.Check
                          type="checkbox"
                          label="Required"
                          name="required"
                          checked={field.required}
                          onChange={(e) => handleFieldChange(index, e)}
                          // isInvalid prop is less common for checkboxes
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Conditional Options Input for Select/Multiselect */}
                  {(field.type === "select" ||
                    field.type === "multiselect") && (
                    <Form.Group
                      className="mb-3"
                      controlId={`fieldOptions_${index}`}
                    >
                      <Form.Label>
                        Options (comma-separated){" "}
                        <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={field.options.join(", ")} // Display options as comma-separated string
                        onChange={(e) => handleOptionsChange(index, e)} // Special handler for options
                        isInvalid={
                          !!(
                            validationErrors.fields &&
                            validationErrors.fields[index] &&
                            validationErrors.fields[index].options
                          )
                        }
                        placeholder="Option 1, Option 2, Option 3"
                      />
                      <Form.Control.Feedback type="invalid">
                        {validationErrors.fields &&
                          validationErrors.fields[index] &&
                          validationErrors.fields[index].options}
                      </Form.Control.Feedback>
                    </Form.Group>
                  )}

                  {/* min_value and max_value inputs - Dynamically change type and required indicator */}
                  <Row>
                    <Col md={6}>
                      <Form.Group
                        className="mb-3"
                        controlId={`fieldMinValue_${index}`}
                      >
                        <Form.Label>
                          Min Value{" "}
                          {isMinMaxRequired && (
                            <span className="text-danger">*</span>
                          )}
                          {/* <--- Conditional Required */}
                        </Form.Label>
                        <Form.Control
                          // Dynamically set the input type based on the field's selected type
                          type={getMinMaxValueInputType(field.type)}
                          name="min_value"
                          value={field.min_value}
                          onChange={(e) => handleFieldChange(index, e)}
                          isInvalid={
                            !!(
                              validationErrors.fields &&
                              validationErrors.fields[index] &&
                              validationErrors.fields[index].min_value
                            )
                          }
                          // Add step="any" for number inputs to allow decimals
                          step={field.type === "number" ? "any" : undefined}
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.fields &&
                            validationErrors.fields[index] &&
                            validationErrors.fields[index].min_value}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group
                        className="mb-3"
                        controlId={`fieldMaxValue_${index}`}
                      >
                        <Form.Label>
                          Max Value{" "}
                          {isMinMaxRequired && (
                            <span className="text-danger">*</span>
                          )}
                          {/* <--- Conditional Required */}
                        </Form.Label>
                        <Form.Control
                          // Dynamically set the input type based on the field's selected type
                          type={getMinMaxValueInputType(field.type)}
                          name="max_value"
                          value={field.max_value}
                          onChange={(e) => handleFieldChange(index, e)}
                          isInvalid={
                            !!(
                              validationErrors.fields &&
                              validationErrors.fields[index] &&
                              validationErrors.fields[index].max_value
                            )
                          }
                          // Add step="any" for number inputs to allow decimals
                          step={field.type === "number" ? "any" : undefined}
                        />
                        <Form.Control.Feedback type="invalid">
                          {validationErrors.fields &&
                            validationErrors.fields[index] &&
                            validationErrors.fields[index].max_value}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                  </Row>
                </Card>
              );
            })}

            {/* Button to add a new field */}
            <Button variant="secondary" onClick={handleAddField}>
              Add Field
            </Button>
          </Card.Body>
        </Card>
        {/* Submission button */}
        <Button
          variant="primary"
          type="submit"
          disabled={loading}
          className="mt-3"
        >
          {loading ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
                className="me-2"
              />
              Creating Schema...
            </>
          ) : (
            "Create Schema Definition"
          )}
        </Button>
      </Form>
    </Container>
  );
};

// PropTypes (optional but good practice)
DynamicDocumentForm.propTypes = {
  // No props needed for this component as it's for creating a new definition
};

export default DynamicDocumentForm;
