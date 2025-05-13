import React, { useState, useEffect } from "react";
import {
  Form,
  Button,
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Dropdown,
  DropdownButton,
} from "react-bootstrap";
import { axiosInstance } from "../../../config.js"; // Assuming axiosInstance is correctly configured

// Helper function to determine the HTML input type for standard types
const getHtmlInputType = (fieldType) => {
  switch (fieldType) {
    case "number":
      return "number";
    case "date":
      return "date";
    case "datetime":
      return "datetime-local";
    case "time":
      return "time";
    case "email": // Assuming you might add these types
      return "email";
    case "password": // Assuming you might add these types
      return "password";
    default:
      return "text";
  }
};

// --- Dynamic Document Submission Form Component ---
const DynamicDocumentSubmissionForm = () => {
  // State for the list of available schemas (definitions)
  const [availableSchemas, setAvailableSchemas] = useState([]);
  const [loadingSchemas, setLoadingSchemas] = useState(true);
  const [fetchSchemasError, setFetchSchemasError] = useState(null);

  // State for the currently selected schema ID and its definition
  const [selectedSchemaId, setSelectedSchemaId] = useState("");
  const [currentSchemaDefinition, setCurrentSchemaDefinition] = useState(null);
  const [loadingSchemaDefinition, setLoadingSchemaDefinition] = useState(false);
  const [fetchSchemaDefinitionError, setFetchSchemaDefinitionError] =
    useState(null);

  // State for the form data (user's input for the fields)
  const [formData, setFormData] = useState({});

  // State for validation errors
  const [validationErrors, setValidationErrors] = useState({});

  // State for submission status and message
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("idle"); // 'idle', 'loading', 'success', 'error'
  const [statusMessage, setStatusMessage] = useState("");

  // --- Effects ---

  // Effect to fetch available schemas on component mount
  useEffect(() => {
    const fetchSchemas = async () => {
      setLoadingSchemas(true);
      setFetchSchemasError(null);
      try {
        // Adjust the API endpoint based on your backend route for listing schemas
        const response = await axiosInstance.get(
          "/api/document/schema-definitions"
        );
        if (response.status >= 200 && response.status < 300) {
          setAvailableSchemas(response.data); // Assuming backend returns an array of schema objects { _id, schema_id, name }
        } else {
          setFetchSchemasError(
            `Failed to fetch schemas: Server returned status ${response.status}`
          );
          console.error("Fetch schemas error:", response);
        }
      } catch (error) {
        setFetchSchemasError(
          `An error occurred while fetching schemas: ${
            error.response?.data?.message || error.message
          }`
        );
        console.error("Fetch schemas catch error:", error);
      } finally {
        setLoadingSchemas(false);
      }
    };

    fetchSchemas();
  }, []); // Empty dependency array means this runs once on mount

  // Effect to fetch the specific schema definition when a schema is selected
  useEffect(() => {
    if (!selectedSchemaId) {
      setCurrentSchemaDefinition(null);
      setFormData({}); // Clear form data when no schema is selected
      setValidationErrors({}); // Clear errors
      return;
    }

    const fetchSchemaDefinition = async () => {
      setLoadingSchemaDefinition(true);
      setFetchSchemaDefinitionError(null);
      setCurrentSchemaDefinition(null); // Clear previous definition
      setFormData({}); // Clear form data
      setValidationErrors({}); // Clear errors

      try {
        // Adjust the API endpoint based on your backend route for getting a specific schema
        const response = await axiosInstance.get(
          `/api/document/schema-definition/${selectedSchemaId}`
        );
        if (response.status >= 200 && response.status < 300) {
          const definition = response.data; // Assuming backend returns the full schema definition object
          setCurrentSchemaDefinition(definition);
          // Initialize formData based on the fetched definition fields
          const initialFormData = {};
          definition.fields.forEach((field) => {
            if (field.type === "checkbox") {
              initialFormData[field.key] = false; // Default for checkbox
            } else if (field.type === "multiselect") {
              initialFormData[field.key] = []; // Default for multiselect
            } else if (field.type === "image" || field.type === "document") {
              initialFormData[field.key] = null; // Store File object(s)
            } else {
              initialFormData[field.key] = ""; // Default for other types
            }
          });
          setFormData(initialFormData);
        } else {
          setFetchSchemaDefinitionError(
            `Failed to fetch schema definition: Server returned status ${response.status}`
          );
          console.error("Fetch definition error:", response);
        }
      } catch (error) {
        setFetchSchemaDefinitionError(
          `An error occurred while fetching schema definition: ${
            error.response?.data?.message || error.message
          }`
        );
        console.error("Fetch definition catch error:", error);
      } finally {
        setLoadingSchemaDefinition(false);
      }
    };

    fetchSchemaDefinition();
  }, [selectedSchemaId]); // Rerun when selectedSchemaId changes

  // --- Handlers ---

  // Handle schema selection from dropdown
  const handleSchemaSelect = (schemaId) => {
    setSelectedSchemaId(schemaId);
    // Reset submission status when selecting a new schema
    setSubmitStatus("idle");
    setStatusMessage("");
  };

  // Handle changes in form input fields
  const handleInputChange = (fieldKey, event) => {
    const fieldDefinition = currentSchemaDefinition?.fields.find(
      (field) => field.key === fieldKey
    );
    if (!fieldDefinition) return; // Should not happen if rendering is based on definition

    const { type, checked, value, files } = event.target;

    setFormData((prevFormData) => {
      const newFormData = { ...prevFormData };
      if (type === "checkbox") {
        newFormData[fieldKey] = checked;
      } else if (
        fieldDefinition.type === "image" ||
        fieldDefinition.type === "document"
      ) {
        // Store the FileList or the first File object
        newFormData[fieldKey] = files.length > 0 ? files[0] : null; // Assuming single file upload per field
      } else {
        newFormData[fieldKey] = value;
      }
      return newFormData;
    });

    // Clear error for this field on change
    setValidationErrors((prevErrors) => {
      const newErrors = { ...prevErrors };
      delete newErrors[fieldKey];
      return newErrors;
    });
  };

  // Handle validation
  const validateForm = () => {
    const errors = {};
    let isValid = true;

    if (!currentSchemaDefinition) {
      // Cannot validate without a schema
      return false;
    }

    currentSchemaDefinition.fields.forEach((field) => {
      const value = formData[field.key];

      // 1. Check Required Fields
      if (field.required) {
        if (field.type === "checkbox") {
          if (!value) {
            // Checkbox must be checked if required
            errors[field.key] = `${field.label} is required.`;
            isValid = false;
          }
        } else if (field.type === "multiselect") {
          if (!value || value.length === 0) {
            errors[field.key] = `${field.label} is required.`;
            isValid = false;
          }
        } else if (field.type === "image" || field.type === "document") {
          if (!value) {
            // Check if a file has been selected
            errors[field.key] = `${field.label} is required.`;
            isValid = false;
          }
        } else if (
          !value ||
          (typeof value === "string" && value.trim() === "")
        ) {
          errors[field.key] = `${field.label} is required.`;
          isValid = false;
        }
      }

      // 2. Check min_value and max_value constraints (as strings)
      // The backend schema stores min/max as strings. Frontend validation should align.
      // More specific validation (e.g., number range, date range) can be added here
      // based on the field.type if needed, parsing the string min/max values.

      if (
        field.type === "number" &&
        value !== "" &&
        value !== null &&
        value !== undefined
      ) {
        const numValue = parseFloat(value);
        const minNum =
          field.min_value !== "" ? parseFloat(field.min_value) : -Infinity;
        const maxNum =
          field.max_value !== "" ? parseFloat(field.max_value) : Infinity;

        if (isNaN(numValue)) {
          errors[field.key] = `${field.label} must be a valid number.`;
          isValid = false;
        } else if (numValue < minNum && minNum !== -Infinity) {
          errors[
            field.key
          ] = `${field.label} must be at least ${field.min_value}.`;
          isValid = false;
        } else if (numValue > maxNum && maxNum !== Infinity) {
          errors[
            field.key
          ] = `${field.label} must be at most ${field.max_value}.`;
          isValid = false;
        }
      }
      // Add date validation if needed, comparing Date objects parsed from value, min_value, max_value strings

      // For string types (text, textarea), maybe validate length if min/max are treated as min/max length
      if (
        (field.type === "text" || field.type === "textarea") &&
        value &&
        typeof value === "string"
      ) {
        const strValue = value.trim();
        const minLength =
          field.min_value !== "" ? parseInt(field.min_value, 10) : 0; // Treat min_value as minLength
        const maxLength =
          field.max_value !== "" ? parseInt(field.max_value, 10) : Infinity; // Treat max_value as maxLength

        if (!isNaN(minLength) && strValue.length < minLength) {
          errors[
            field.key
          ] = `${field.label} must be at least ${minLength} characters long.`;
          isValid = false;
        }
        if (!isNaN(maxLength) && strValue.length > maxLength) {
          errors[
            field.key
          ] = `${field.label} must be at most ${maxLength} characters long.`;
          isValid = false;
        }
      }
    });

    setValidationErrors(errors);
    return isValid;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous submission status
    setSubmitStatus("idle");
    setStatusMessage("");

    if (!currentSchemaDefinition) {
      setSubmitStatus("error");
      setStatusMessage("No schema selected or loaded.");
      return;
    }

    if (!validateForm()) {
      console.log("Form validation failed.");
      setSubmitStatus("error");
      setStatusMessage("Please fix the errors in the form before submitting.");
      return;
    }

    setSubmitting(true);
    setSubmitStatus("loading");
    setStatusMessage("Submitting document data...");

    // Prepare FormData for submission (handles files and non-file data)
    const formDataToSubmit = new FormData();

    // Append schema details and placeholder user IDs
    formDataToSubmit.append("schema_id", selectedSchemaId);
    // NOTE: Replace with actual user IDs from your authentication context
    formDataToSubmit.append("user_id", "placeholder_user_id"); // Replace with actual user ID
    formDataToSubmit.append("created_by", "placeholder_created_by"); // Replace with actual user ID

    // Prepare the array of field data (excluding file objects themselves)
    const submissionFieldsData = [];

    currentSchemaDefinition.fields.forEach((field) => {
      const value = formData[field.key];

      if (field.type === "image" || field.type === "document") {
        // If it's a file field and a file is selected, append the file to FormData
        if (value instanceof File) {
          formDataToSubmit.append(field.key, value); // Append the file object using field key
          // Add a placeholder/identifier in submissionFieldsData indicating a file for this field
          submissionFieldsData.push({
            field_id: field.key,
            field_label: field.label,
            type: field.type,
            // value and fileRef will be handled by the backend receiving the file
          });
        } else {
          // If it was required but no file, validation should have caught it.
          // If not required and no file, just add the structure without value/fileRef
          submissionFieldsData.push({
            field_id: field.key,
            field_label: field.label,
            type: field.type,
          });
        }
      } else {
        // For non-file types, add the value directly to submissionFieldsData
        submissionFieldsData.push({
          field_id: field.key,
          field_label: field.label,
          type: field.type,
          value: value, // The actual user input value
        });
      }
    });

    // Append the non-file field data (stringified JSON array)
    formDataToSubmit.append("fieldsData", JSON.stringify(submissionFieldsData));
    // Backend needs to parse 'fieldsData' and match appended files by their keys

    try {
      // Adjust the API endpoint based on your backend route for submitting data
      const response = await axiosInstance.post(
        "/api/document/submission", // POST to /api/document/submission
        formDataToSubmit, // Send FormData
        {
          headers: {
            "Content-Type": "multipart/form-data", // Essential for sending files
          },
        }
      );

      if (response.status >= 200 && response.status < 300) {
        setSubmitStatus("success");
        setStatusMessage("Document data submitted successfully!");
        // Optionally reset form or selected schema after success
        setFormData({}); // Clear form fields
        // Keep selected schema or reset: setSelectedSchemaId('');
      } else {
        setSubmitStatus("error");
        setStatusMessage(
          `Submission failed: ${
            response.data.message || `Server error (Status: ${response.status})`
          }`
        );
        console.error("Submission error:", response);
      }
    } catch (error) {
      setSubmitStatus("error");
      if (error.response) {
        setStatusMessage(
          `An error occurred: ${error.response.data.message || error.message}`
        );
        console.error("Submission error response:", error.response.data);
      } else if (error.request) {
        setStatusMessage(
          `An error occurred: No response received from server.`
        );
        console.error("Submission error request:", error.request);
      } else {
        setStatusMessage(`An error occurred: ${error.message}`);
        console.error("Submission error message:", error.message);
      }
      console.error("Submission config:", error.config);
    } finally {
      setSubmitting(false); // End loading state
    }
  };

  // Helper to render different form control types
  const renderFormControl = (field) => {
    const fieldKey = field.key;
    const value = formData[fieldKey];
    const isInvalid = !!validationErrors[fieldKey];

    switch (field.type) {
      case "textarea":
        return (
          <Form.Control
            as="textarea"
            name={fieldKey}
            value={value || ""}
            onChange={(e) => handleInputChange(fieldKey, e)}
            isInvalid={isInvalid}
            rows={3}
          />
        );
      case "select":
        return (
          <Form.Select
            name={fieldKey}
            value={value || ""}
            onChange={(e) => handleInputChange(fieldKey, e)}
            isInvalid={isInvalid}
          >
            <option value="">Select...</option> {/* Optional default option */}
            {field.options &&
              field.options.map((option, optIndex) => (
                <option key={optIndex} value={option}>
                  {option}
                </option>
              ))}
          </Form.Select>
        );
      case "multiselect":
        // React-Bootstrap's Form.Select doesn't directly support multiselect with array value
        // A custom component or handling multiple selections manually is needed.
        // For simplicity here, we'll use a standard select with 'multiple' prop,
        // but managing state (an array) and change events is more complex.
        // A more robust approach might involve a series of checkboxes or a dedicated library.
        // Using a standard select with 'multiple':
        return (
          <Form.Select
            name={fieldKey}
            // Value needs to be an array for multiple selects
            // Requires a more complex onChange handler to manage the array state
            value={value || []}
            onChange={(e) => {
              const options = e.target.options;
              const selectedValues = [];
              for (let i = 0; i < options.length; i++) {
                if (options[i].selected) {
                  selectedValues.push(options[i].value);
                }
              }
              setFormData((prev) => ({ ...prev, [fieldKey]: selectedValues }));
              // Clear error for this field on change
              setValidationErrors((prevErrors) => {
                const newErrors = { ...prevErrors };
                delete newErrors[fieldKey];
                return newErrors;
              });
            }}
            isInvalid={isInvalid}
            multiple // Add the multiple prop
          >
            {field.options &&
              field.options.map((option, optIndex) => (
                <option key={optIndex} value={option}>
                  {option}
                </option>
              ))}
          </Form.Select>
        );
      case "checkbox":
        return (
          <Form.Check
            type="checkbox"
            name={fieldKey}
            label={field.label} // Label is often part of the checkbox itself
            checked={value || false}
            onChange={(e) => handleInputChange(fieldKey, e)}
            // isInvalid feedback for checkbox is less common visually, but possible
            isInvalid={isInvalid}
          />
        );
      case "image":
      case "document":
        // Note: The 'value' in state for file inputs is the File object(s)
        // The input itself doesn't use the 'value' prop for files
        return (
          <>
            <Form.Control
              type="file"
              name={fieldKey}
              onChange={(e) => handleInputChange(fieldKey, e)}
              isInvalid={isInvalid}
              // Optional: accept specific file types
              accept={field.type === "image" ? "image/*" : "*/*"}
            />
            {/* Display name of selected file */}
            {formData[fieldKey] && formData[fieldKey].name && (
              <div className="form-text text-muted mt-1">
                Selected file: {formData[fieldKey].name}
              </div>
            )}
          </>
        );
      default:
        // Default to text input for number, date, text, etc.
        return (
          <Form.Control
            type={getHtmlInputType(field.type)} // Use helper to get HTML type
            name={fieldKey}
            value={value || ""}
            onChange={(e) => handleInputChange(fieldKey, e)}
            isInvalid={isInvalid}
            // Add step="any" for number inputs to allow decimals
            step={field.type === "number" ? "any" : undefined}
            // Min/Max attributes on input for native browser validation (optional alongside JS validation)
            min={field.min_value || undefined}
            max={field.max_value || undefined}
          />
        );
    }
  };

  return (
    <Container className="my-4">
      <h2 className="mb-4">Submit Government Document Data</h2>

      {/* Schema Selection */}
      <Card className="mb-4">
        <Card.Header>Select Document Type</Card.Header>
        <Card.Body>
          {loadingSchemas ? (
            <div className="text-center">
              <Spinner animation="border" size="sm" className="me-2" /> Loading
              Document Types...
            </div>
          ) : fetchSchemasError ? (
            <Alert variant="danger">{fetchSchemasError}</Alert>
          ) : availableSchemas.length > 0 ? (
            <Form.Group controlId="selectSchema">
              <Form.Label>Choose a Document Type:</Form.Label>
              <Form.Select
                value={selectedSchemaId}
                onChange={(e) => handleSchemaSelect(e.target.value)}
              >
                <option value="">-- Select Document Type --</option>
                {availableSchemas.map((schema) => (
                  <option key={schema._id} value={schema._id}>
                    {schema.name} ({schema.schema_id})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          ) : (
            <Alert variant="info">No document types defined yet.</Alert>
          )}
        </Card.Body>
      </Card>

      {/* Dynamic Form Section */}
      {selectedSchemaId && (
        <Card className="mb-4">
          <Card.Header>
            Enter Data for: {currentSchemaDefinition?.name || selectedSchemaId}
          </Card.Header>
          <Card.Body>
            {loadingSchemaDefinition ? (
              <div className="text-center">
                <Spinner animation="border" size="sm" className="me-2" />{" "}
                Loading Schema Definition...
              </div>
            ) : fetchSchemaDefinitionError ? (
              <Alert variant="danger">{fetchSchemaDefinitionError}</Alert>
            ) : currentSchemaDefinition &&
              currentSchemaDefinition.fields.length > 0 ? (
              <Form onSubmit={handleSubmit} noValidate>
                {currentSchemaDefinition.fields.map((field, index) => (
                  <Form.Group
                    className="mb-3"
                    controlId={`field-${field.key}-${index}`}
                    key={field.key} // Using field.key as key if unique within schema
                  >
                    {/* Render label differently for checkbox type */}
                    {field.type !== "checkbox" && (
                      <Form.Label>
                        {field.label}{" "}
                        {field.required && (
                          <span className="text-danger">*</span>
                        )}
                      </Form.Label>
                    )}

                    {/* Render the appropriate form control */}
                    {renderFormControl(field)}

                    {/* Display validation feedback */}
                    <Form.Control.Feedback type="invalid">
                      {validationErrors[field.key]}
                    </Form.Control.Feedback>

                    {/* Optional help text using field.prompt */}
                    {field.prompt && (
                      <Form.Text className="text-muted">
                        {field.prompt}
                      </Form.Text>
                    )}
                  </Form.Group>
                ))}

                {/* Submission status messages (Alerts) */}
                {submitStatus !== "idle" && submitStatus !== "loading" && (
                  <Alert
                    variant={submitStatus === "success" ? "success" : "danger"}
                    onClose={() => setSubmitStatus("idle")} // Allow dismissing
                    dismissible
                    className="mt-3"
                  >
                    {statusMessage}
                  </Alert>
                )}

                {/* Submission button */}
                <Button
                  variant="primary"
                  type="submit"
                  disabled={submitting}
                  className="mt-3"
                >
                  {submitting ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                        className="me-2"
                      />
                      Submitting...
                    </>
                  ) : (
                    "Submit Document Data"
                  )}
                </Button>
              </Form>
            ) : (
              <Alert variant="info">
                No fields defined for this document type.
              </Alert>
            )}
          </Card.Body>
        </Card>
      )}
      {/* Message if no schema is selected */}
      {!selectedSchemaId &&
        !loadingSchemas &&
        !fetchSchemasError &&
        availableSchemas.length > 0 && (
          <Alert variant="info">
            Please select a document type above to enter data.
          </Alert>
        )}
    </Container>
  );
};

export default DynamicDocumentSubmissionForm;
