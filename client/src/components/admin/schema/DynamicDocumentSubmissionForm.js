import { useState, useEffect } from "react";
import {
  Form,
  Button,
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert
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
    case "email":
      return "email";
    case "password":
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
        const response = await axiosInstance.get(
          "/api/document/schema-definitions"
        );
        if (response.status >= 200 && response.status < 300) {
          setAvailableSchemas(response.data);
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
  }, []);

  // Effect to fetch the specific schema definition when a schema is selected
  useEffect(() => {
    if (!selectedSchemaId) {
      setCurrentSchemaDefinition(null);
      setFormData({});
      setValidationErrors({});
      return;
    }

    const fetchSchemaDefinition = async () => {
      setLoadingSchemaDefinition(true);
      setFetchSchemaDefinitionError(null);
      setCurrentSchemaDefinition(null);
      setFormData({});
      setValidationErrors({});

      try {
        const response = await axiosInstance.get(
          `/api/document/schema-definition/${selectedSchemaId}`
        );
        if (response.status >= 200 && response.status < 300) {
          const definition = response.data;
          setCurrentSchemaDefinition(definition);
          const initialFormData = {};
          definition.fields.forEach((field) => {
            if (field.type === "checkbox") {
              initialFormData[field.key] = false;
            } else if (field.type === "multiselect") {
              initialFormData[field.key] = [];
            } else if (field.type === "image" || field.type === "document") {
              initialFormData[field.key] = null; // Will store File object
            } else {
              initialFormData[field.key] = field.default_value !== undefined ? field.default_value : ""; // Use default_value if present
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
  }, [selectedSchemaId]);

  // --- Handlers ---

  const handleSchemaSelect = (schemaId) => {
    setSelectedSchemaId(schemaId);
    setSubmitStatus("idle");
    setStatusMessage("");
  };

  const handleInputChange = (fieldKey, event) => {
    const fieldDefinition = currentSchemaDefinition?.fields.find(
      (field) => field.key === fieldKey
    );
    if (!fieldDefinition) return;

    // For file inputs, event.target.files is used.
    // For others, event.target.value or event.target.checked.
    const { type, checked, value, files } = event.target;

    setFormData((prevFormData) => {
      const newFormData = { ...prevFormData };
      if (fieldDefinition.type === "checkbox") {
        newFormData[fieldKey] = checked;
      } else if (
        fieldDefinition.type === "image" ||
        fieldDefinition.type === "document"
      ) {
        newFormData[fieldKey] = files && files.length > 0 ? files[0] : null;
      } else {
        newFormData[fieldKey] = value;
      }
      return newFormData;
    });

    setValidationErrors((prevErrors) => {
      const newErrors = { ...prevErrors };
      delete newErrors[fieldKey];
      return newErrors;
    });
  };

  const validateForm = () => {
    const errors = {};
    let isValid = true;

    if (!currentSchemaDefinition) return false;

    currentSchemaDefinition.fields.forEach((field) => {
      const value = formData[field.key];

      if (field.required) {
        if (field.type === "checkbox") {
          if (!value) {
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
            errors[field.key] = `${field.label} is required.`;
            isValid = false;
          }
        } else if (
          value === null ||
          value === undefined ||
          (typeof value === "string" && value.trim() === "")
        ) {
          errors[field.key] = `${field.label} is required.`;
          isValid = false;
        }
      }

      // Type-specific validations (simplified for brevity, expand as needed)
      if (field.type === "number" && value) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          errors[field.key] = `${field.label} must be a valid number.`;
          isValid = false;
        } else {
            const minNum = field.min_value !== undefined && field.min_value !== "" ? parseFloat(field.min_value) : -Infinity;
            const maxNum = field.max_value !== undefined && field.max_value !== "" ? parseFloat(field.max_value) : Infinity;
            if (numValue < minNum) {
                errors[field.key] = `${field.label} must be at least ${field.min_value}.`;
                isValid = false;
            }
            if (numValue > maxNum) {
                errors[field.key] = `${field.label} must be at most ${field.max_value}.`;
                isValid = false;
            }
        }
      }
      // Add more specific validations for date, text length based on min_value/max_value if they represent length etc.
    });

    setValidationErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus("idle");
    setStatusMessage("");

    if (!currentSchemaDefinition) {
      setSubmitStatus("error");
      setStatusMessage("No schema selected or loaded.");
      return;
    }

    if (!validateForm()) {
      setSubmitStatus("error");
      setStatusMessage("Please fix the errors in the form before submitting.");
      return;
    }

    setSubmitting(true);
    setSubmitStatus("loading");
    setStatusMessage("Submitting document data...");

    const formDataToSubmit = new FormData();
    formDataToSubmit.append("schema_id", selectedSchemaId);
    // User ID and Created By should be handled by the backend via req.user (authentication)
    // DO NOT send placeholder_user_id or placeholder_created_by from here if backend uses req.user

    const submissionFieldsData = [];
    currentSchemaDefinition.fields.forEach((field) => {
      const value = formData[field.key]; // This is the File object for file types

      if (field.type === "image" || field.type === "document") {
        if (value instanceof File) {
          formDataToSubmit.append(field.key, value, value.name); // Append the actual File object
          submissionFieldsData.push({
            field_id: field.key,
            field_label: field.label,
            type: field.type,
          });
        } else if (field.required) {
            // This case should ideally be caught by validation, but as a safeguard:
            console.warn(`Required file for field ${field.key} is missing in formData state.`);
             submissionFieldsData.push({ // Still include in manifest if it's part of schema
                field_id: field.key,
                field_label: field.label,
                type: field.type,
            });
        } else {
             submissionFieldsData.push({ // Optional field, no file provided
                field_id: field.key,
                field_label: field.label,
                type: field.type,
            });
        }
      } else {
        submissionFieldsData.push({
          field_id: field.key,
          field_label: field.label,
          type: field.type,
          value: value,
        });
      }
    });

    formDataToSubmit.append("fieldsData", JSON.stringify(submissionFieldsData));

    try {
      const response = await axiosInstance.post(
        "/api/document/submission",
        formDataToSubmit,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.status >= 200 && response.status < 300) {
        setSubmitStatus("success");
        setStatusMessage("Document data submitted successfully!");
        setFormData({}); // Clear form
        // Optionally reset selectedSchemaId = "";
      } else {
        // This block might not be reached if axios throws for non-2xx status
        setSubmitStatus("error");
        setStatusMessage(
          `Submission failed: ${
            response.data.message || `Server error (Status: ${response.status})`
          }`
        );
        console.error("Submission error response:", response);
      }
    } catch (error) {
      setSubmitStatus("error");
      if (error.response) {
        setStatusMessage(
          `An error occurred: ${error.response.data.message || error.message} (Status: ${error.response.status})`
        );
        console.error("Submission error response:", error.response.data);
      } else if (error.request) {
        setStatusMessage(
          `An error occurred: No response received from server. Please check network.`
        );
        console.error("Submission error request:", error.request);
      } else {
        setStatusMessage(`An error occurred: ${error.message}`);
        console.error("Submission error message:", error.message);
      }
      console.error("Submission error object:", error);
    } finally {
      setSubmitting(false);
    }
  };

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
            required={field.required}
          />
        );
      case "select":
        return (
          <Form.Select
            name={fieldKey}
            value={value || ""}
            onChange={(e) => handleInputChange(fieldKey, e)}
            isInvalid={isInvalid}
            required={field.required}
          >
            <option value="">Select {field.label}...</option>
            {field.options &&
              field.options.map((option, optIndex) => (
                <option key={optIndex} value={option}>
                  {option}
                </option>
              ))}
          </Form.Select>
        );
      case "multiselect":
        return (
          <Form.Select
            name={fieldKey}
            value={value || []} // Expects array for multiple
            onChange={(e) => {
              const selectedValues = Array.from(
                e.target.selectedOptions,
                (option) => option.value
              );
              setFormData((prev) => ({ ...prev, [fieldKey]: selectedValues }));
              setValidationErrors((prevErrors) => {
                const newErrors = { ...prevErrors };
                delete newErrors[fieldKey];
                return newErrors;
              });
            }}
            isInvalid={isInvalid}
            multiple
            required={field.required}
            style={{ minHeight: '100px' }} // Make it easier to see multiple options
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
            label={field.label}
            checked={!!value} // Ensure it's a boolean
            onChange={(e) => handleInputChange(fieldKey, e)}
            isInvalid={isInvalid}
            // Required for checkbox is handled by validation logic, not native HTML 'required' easily
          />
        );
      case "image":
      case "document":
        return (
          <>
            <Form.Control
              type="file"
              name={fieldKey}
              onChange={(e) => handleInputChange(fieldKey, e)}
              isInvalid={isInvalid}
              accept={field.type === "image" ? "image/*" : field.accept || "*/*"} // Use field.accept if provided
              required={field.required}
            />
            {formData[fieldKey] && formData[fieldKey].name && (
              <div className="form-text text-muted mt-1">
                Selected file: {formData[fieldKey].name}
              </div>
            )}
          </>
        );
      default:
        return (
          <Form.Control
            type={getHtmlInputType(field.type)}
            name={fieldKey}
            value={value || ""}
            onChange={(e) => handleInputChange(fieldKey, e)}
            isInvalid={isInvalid}
            step={field.type === "number" ? "any" : undefined}
            min={field.type === "number" || field.type === "date" || field.type === "datetime-local" || field.type === "time" ? field.min_value : undefined}
            max={field.type === "number" || field.type === "date" || field.type === "datetime-local" || field.type === "time" ? field.max_value : undefined}
            minLength={field.type === "text" || field.type === "textarea" ? (field.min_value || undefined) : undefined } // Assuming min_value for text is minLength
            maxLength={field.type === "text" || field.type === "textarea" ? (field.max_value || undefined) : undefined } // Assuming max_value for text is maxLength
            required={field.required}
          />
        );
    }
  };

  return (
    <Container className="my-5"> {/* Increased top/bottom margin */}
      <Row className="justify-content-center">
        <Col md={8} lg={7}> {/* Adjusted column size for better centering on larger screens */}
          <Card className="shadow-lg"> {/* Added more shadow */}
            <Card.Header as="h3" className="text-center bg-primary text-white p-3"> {/* Enhanced header */}
              Submit Government Document Data
            </Card.Header>
            <Card.Body className="p-4"> {/* Increased padding */}
              {/* Schema Selection */}
              <Card className="mb-4 border-primary"> {/* Added border color */}
                <Card.Header className="bg-light text-primary">Select Document Type</Card.Header>
                <Card.Body>
                  {loadingSchemas ? (
                    <div className="text-center p-3">
                      <Spinner animation="border" variant="primary" className="me-2" /> Loading Document Types...
                    </div>
                  ) : fetchSchemasError ? (
                    <Alert variant="danger">{fetchSchemasError}</Alert>
                  ) : availableSchemas.length > 0 ? (
                    <Form.Group controlId="selectSchema">
                      <Form.Label className="fw-bold">Choose a Document Type:</Form.Label>
                      <Form.Select
                        value={selectedSchemaId}
                        onChange={(e) => handleSchemaSelect(e.target.value)}
                        aria-label="Select Document Type"
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
                <Card className="border-secondary"> {/* Added border color */}
                  <Card.Header className="bg-light text-secondary">
                    Enter Data for: {currentSchemaDefinition?.name || "Selected Document"}
                  </Card.Header>
                  <Card.Body>
                    {loadingSchemaDefinition ? (
                      <div className="text-center p-3">
                        <Spinner animation="border" variant="secondary" className="me-2" /> Loading Schema Definition...
                      </div>
                    ) : fetchSchemaDefinitionError ? (
                      <Alert variant="danger">{fetchSchemaDefinitionError}</Alert>
                    ) : currentSchemaDefinition &&
                      currentSchemaDefinition.fields.length > 0 ? (
                      <Form onSubmit={handleSubmit} noValidate>
                        {currentSchemaDefinition.fields.map((field, index) => (
                          <Form.Group
                            className="mb-4" // Increased bottom margin for fields
                            controlId={`field-${field.key}-${index}`}
                            key={field.key}
                          >
                            {field.type !== "checkbox" && (
                              <Form.Label className="fw-semibold"> {/* Bolder label */}
                                {field.label}
                                {field.required && <span className="text-danger ms-1">*</span>}
                              </Form.Label>
                            )}
                            {renderFormControl(field)}
                            <Form.Control.Feedback type="invalid">
                              {validationErrors[field.key]}
                            </Form.Control.Feedback>
                            {field.prompt && (
                              <Form.Text className="text-muted d-block mt-1"> {/* Ensure prompt is block */}
                                {field.prompt}
                              </Form.Text>
                            )}
                          </Form.Group>
                        ))}

                        {submitStatus !== "idle" && submitStatus !== "loading" && (
                          <Alert
                            variant={submitStatus === "success" ? "success" : "danger"}
                            onClose={() => {setSubmitStatus("idle"); setStatusMessage("");}}
                            dismissible
                            className="mt-4" // Increased top margin
                          >
                            {statusMessage}
                          </Alert>
                        )}

                        <div className="d-grid mt-4"> {/* d-grid for full-width button */}
                            <Button
                            variant="primary"
                            type="submit"
                            disabled={submitting}
                            size="lg" // Larger button
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
                        </div>
                      </Form>
                    ) : (
                      <Alert variant="info">
                        No fields defined for this document type, or an error occurred loading fields.
                      </Alert>
                    )}
                  </Card.Body>
                </Card>
              )}
              {!selectedSchemaId &&
                !loadingSchemas &&
                !fetchSchemasError &&
                availableSchemas.length > 0 && (
                  <Alert variant="info" className="mt-4 text-center">
                    Please select a document type above to begin.
                  </Alert>
                )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default DynamicDocumentSubmissionForm;
