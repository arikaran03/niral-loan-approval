// src/components/admin/DynamicDocumentForm.js (or your actual path)
import React, { useState, useEffect } from "react";
import {
  Form,
  Button,
  Container,
  Row,
  Col,
  Card,
  InputGroup, // Kept for potential future use, not directly used in this version
  Spinner,
  Alert,
} from "react-bootstrap";
import { FaPlusCircle, FaTrashAlt, FaInfoCircle, FaKey } from "react-icons/fa"; // Added FaKey
import { axiosInstance } from "../../../config.js"; 

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
  const [submitStatus, setSubmitStatus] = useState("idle"); 
  const [statusMessage, setStatusMessage] = useState("");

  // Handle changes for main schema details
  const handleSchemaDetailsChange = (e) => {
    const { name, value } = e.target;
    setSchemaDetails((prev) => ({ ...prev, [name]: value }));
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
    const fieldToUpdate = { ...newFields[index] };

    if (type === "checkbox") {
      fieldToUpdate[name] = checked;
      // If 'is_unique_identifier' is unchecked, clear 'unique_identifier_prompt'
      if (name === "is_unique_identifier" && !checked) {
        fieldToUpdate.unique_identifier_prompt = "";
      }
    } else {
      fieldToUpdate[name] = value;
    }
    
    newFields[index] = fieldToUpdate;
    setFields(newFields);

    setValidationErrors((prev) => {
      const newState = { ...prev };
      if (newState.fields && newState.fields[index]) {
        delete newState.fields[index][name];
        if (name === "is_unique_identifier" && !checked) {
            delete newState.fields[index].unique_identifier_prompt; // Clear prompt error too
        }
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

  // Handle adding a new field
  const handleAddField = () => {
    setFields((prev) => [
      ...prev,
      {
        key: "",
        label: "",
        prompt: "", 
        type: "text", 
        required: false,
        options: [], 
        min_value: "", 
        max_value: "", 
        is_unique_identifier: false, // New field
        unique_identifier_prompt: "", // New field
      },
    ]);
  };

  // Handle removing a field
  const handleRemoveField = (index) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
    setValidationErrors((prev) => {
      const newState = { ...prev };
      if (newState.fields && newState.fields.length > index) {
        // Create a new array for field errors, removing the one at the specified index
        const updatedFieldErrors = [...(newState.fields || [])];
        updatedFieldErrors.splice(index, 1);
        
        if (updatedFieldErrors.length > 0) {
            newState.fields = updatedFieldErrors;
        } else {
            delete newState.fields; // Remove fields error object if no field errors remain
        }
      }
      return newState;
    });
  };

  // Handle changes for options array (for select/multiselect)
  const handleOptionsChange = (index, e) => {
    const newFields = [...fields];
    newFields[index].options = e.target.value
      .split(",")
      .map((option) => option.trim())
      .filter((option) => option !== "");
    setFields(newFields);
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
    let uniqueIdentifierFound = false;

    if (!schemaDetails.schema_id.trim()) {
      errors.schema_id = "Schema ID is required.";
      isValid = false;
    }
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

    const fieldErrors = fields.map((field, index) => { // Use map to keep indices aligned
      const currentFieldErrors = {};
      if (!field.key.trim()) currentFieldErrors.key = "Key is required.";
      if (field.key.trim() && !/^[a-z0-9_]+$/.test(field.key.trim())) {
        currentFieldErrors.key = "Field key can only contain lowercase letters, numbers, and underscores.";
      }
      if (!field.label.trim()) currentFieldErrors.label = "Label is required.";
      if (!field.prompt || !field.prompt.trim()) currentFieldErrors.prompt = "Prompt is required.";
      if (!field.type) currentFieldErrors.type = "Type is required.";

      if ((field.type === "select" || field.type === "multiselect") && (!field.options || field.options.length === 0)) {
        currentFieldErrors.options = "Options are required for select/multiselect types (comma-separated).";
      }

      const applicableTypesForMinMax = ["text", "textarea", "number", "date", "datetime", "time"];
      if (applicableTypesForMinMax.includes(field.type)) {
          if (field.min_value === undefined || field.min_value === null || String(field.min_value).trim() === '') {
              currentFieldErrors.min_value = `Min value is required for type '${field.type}'.`;
          }
          if (field.max_value === undefined || field.max_value === null || String(field.max_value).trim() === '') {
              currentFieldErrors.max_value = `Max value is required for type '${field.type}'.`;
          }
      }
      
      if (field.type === "number" && field.min_value !== "" && field.max_value !== "") {
        const minNum = parseFloat(field.min_value);
        const maxNum = parseFloat(field.max_value);
        if (isNaN(minNum) || isNaN(maxNum)) {
          // currentFieldErrors.min_value = currentFieldErrors.max_value = 'Must be valid numbers.';
        } else if (minNum > maxNum) {
          currentFieldErrors.min_value = "Min value cannot be greater than max value.";
        }
      }

      // Validations for unique identifier fields
      if (field.is_unique_identifier === true) {
        uniqueIdentifierFound = true; // Mark that at least one unique identifier is defined
        if (field.type !== "text") {
          currentFieldErrors.is_unique_identifier = "Unique identifier field must be of type 'text'.";
        }
        if (field.required !== true) {
          currentFieldErrors.is_unique_identifier = "Unique identifier field must also be marked as 'Required'.";
        }
        if (!field.unique_identifier_prompt || String(field.unique_identifier_prompt).trim() === "") {
          currentFieldErrors.unique_identifier_prompt = "Unique Identifier Prompt is required when 'Is Unique Identifier' is checked.";
        }
      }
      
      if (Object.keys(currentFieldErrors).length > 0) isValid = false;
      return currentFieldErrors;
    });

    if (!uniqueIdentifierFound && fields.length > 0) { // Only enforce if fields are defined
        errors.form = "At least one field must be marked as a unique identifier.";
        isValid = false;
    }
    
    // Check if any field has errors before assigning to errors.fields
    const hasFieldSpecificErrors = fieldErrors.some(err => Object.keys(err).length > 0);
    if (hasFieldSpecificErrors) {
        errors.fields = fieldErrors;
    }


    setValidationErrors(errors);
    return isValid;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationErrors({}); // Clear previous errors
    setSubmitStatus("idle");
    setStatusMessage("");

    if (!validateForm()) {
      console.log("Form validation failed. Showing errors.");
      setSubmitStatus("error");
      setStatusMessage("Please fix the errors in the form before submitting.");
      // Scroll to the first error
      const firstErrorKey = Object.keys(validationErrors)[0];
      if (firstErrorKey) {
          const element = document.getElementById(firstErrorKey) || document.getElementsByName(firstErrorKey)[0];
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setLoading(true);
    setSubmitStatus("loading");
    setStatusMessage("Creating schema definition...");

    const submissionData = {
      schema_id: schemaDetails.schema_id.trim(),
      name: schemaDetails.name.trim(),
      description: schemaDetails.description.trim(),
      fields: fields.map((field) => ({
        key: field.key.trim(),
        label: field.label.trim(),
        prompt: field.prompt.trim(),
        type: field.type,
        required: field.required,
        options: field.options && field.options.length > 0 ? field.options : undefined,
        min_value: String(field.min_value).trim(), // Ensure it's a string
        max_value: String(field.max_value).trim(), // Ensure it's a string
        is_unique_identifier: field.is_unique_identifier || false,
        unique_identifier_prompt: field.is_unique_identifier ? String(field.unique_identifier_prompt || '').trim() : undefined,
      })),
    };

    try {
      const response = await axiosInstance.post(
        "/api/document/schema-definition",
        submissionData
      ); 

      setSubmitStatus("success");
      setStatusMessage("Schema definition created successfully!");
      setSchemaDetails({ schema_id: "", name: "", description: "" });
      setFields([]);
      setValidationErrors({}); 
    } catch (error) {
      setSubmitStatus("error");
      if (error.response) {
        setStatusMessage(
          `An error occurred: ${error.response.data.message || error.message}`
        );
        if (error.response.data.errors) { // Handle structured validation errors from backend
            const backendErrors = {};
            error.response.data.errors.forEach(err => {
                // This needs to map backend error paths to frontend state structure
                // Example: if backend returns error for "fields[0].key"
                // For simplicity, just showing the first error for now
                if (!backendErrors.form) backendErrors.form = err;
            });
            setValidationErrors(prev => ({...prev, ...backendErrors}));
        }
      } else if (error.request) {
        setStatusMessage(`An error occurred: No response received from server.`);
      } else {
        setStatusMessage(`An error occurred: ${error.message}`);
      }
    } finally {
      setLoading(false); 
    }
  };

  const getMinMaxValueInputType = (fieldType) => {
    switch (fieldType) {
      case "number": return "number";
      case "date": return "date";
      case "datetime": return "datetime-local";
      case "time": return "time";
      default: return "text";
    }
  };

  return (
    <Container className="my-4 dynamic-document-form">
      <Card className="shadow-sm">
        <Card.Header as="h3" className="bg-primary text-white">
            <FaPlusCircle className="me-2"/> Define New Document Schema
        </Card.Header>
        <Card.Body>
            {submitStatus !== "idle" && submitStatus !== "loading" && (
                <Alert
                variant={submitStatus === "success" ? "success" : "danger"}
                onClose={() => setSubmitStatus("idle")} 
                dismissible 
                className="mb-3"
                >
                {statusMessage}
                </Alert>
            )}

            <Form onSubmit={handleSubmit} noValidate> 
                <Card className="mb-4">
                <Card.Header>
                    <FaInfoCircle className="me-2"/> Document Type Details
                </Card.Header>
                <Card.Body>
                    <Row>
                    <Col md={4}>
                        <Form.Group className="mb-3" controlId="schema_id"> {/* Changed ID */}
                        <Form.Label>
                            Schema ID <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                            type="text"
                            name="schema_id"
                            value={schemaDetails.schema_id}
                            onChange={handleSchemaDetailsChange}
                            isInvalid={!!validationErrors.schema_id}
                            placeholder="e.g., aadhaar_card, pan_card"
                        />
                        <Form.Control.Feedback type="invalid">
                            {validationErrors.schema_id}
                        </Form.Control.Feedback>
                        </Form.Group>
                    </Col>
                    <Col md={8}>
                        <Form.Group className="mb-3" controlId="name"> {/* Changed ID */}
                        <Form.Label>
                            Document Name <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                            type="text"
                            name="name"
                            value={schemaDetails.name}
                            onChange={handleSchemaDetailsChange}
                            isInvalid={!!validationErrors.name}
                            placeholder="e.g., Aadhaar Card, PAN Card"
                        />
                        <Form.Control.Feedback type="invalid">
                            {validationErrors.name}
                        </Form.Control.Feedback>
                        </Form.Group>
                    </Col>
                    </Row>
                    <Form.Group className="mb-3" controlId="description"> {/* Changed ID */}
                    <Form.Label>
                        Description <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                        as="textarea"
                        name="description"
                        value={schemaDetails.description}
                        onChange={handleSchemaDetailsChange}
                        isInvalid={!!validationErrors.description}
                        rows={2}
                        placeholder="Brief description of the document type"
                    />
                    <Form.Control.Feedback type="invalid">
                        {validationErrors.description}
                    </Form.Control.Feedback>
                    </Form.Group>
                </Card.Body>
                </Card>
                
                <Card className="mb-4">
                <Card.Header>Document Fields</Card.Header>
                <Card.Body>
                    {fields.map((field, index) => {
                    const isMinMaxApplicable = ["text", "textarea", "number", "date", "datetime", "time"].includes(field.type);
                    const fieldErrorObject = validationErrors.fields && validationErrors.fields[index] ? validationErrors.fields[index] : {};

                    return (
                        <Card key={index} className="mb-3 p-3 border field-definition-item">
                        <Row className="align-items-start">
                            <Col>
                                <h5 className="mb-3">Field #{index + 1}</h5>
                            </Col>
                            <Col xs="auto">
                            <Button
                                variant="outline-danger"
                                onClick={() => handleRemoveField(index)}
                                size="sm"
                                className="float-end"
                                aria-label={`Remove field ${field.label || index + 1}`}
                            >
                                <FaTrashAlt/> Remove
                            </Button>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={6}>
                            <Form.Group className="mb-3" controlId={`fieldKey_${index}`}>
                                <Form.Label>Field Key <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" name="key" value={field.key}
                                onChange={(e) => handleFieldChange(index, e)}
                                isInvalid={!!fieldErrorObject.key} placeholder="e.g., aadhaar_number"/>
                                <Form.Control.Feedback type="invalid">{fieldErrorObject.key}</Form.Control.Feedback>
                            </Form.Group>
                            </Col>
                            <Col md={6}>
                            <Form.Group className="mb-3" controlId={`fieldLabel_${index}`}>
                                <Form.Label>Field Label <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" name="label" value={field.label}
                                onChange={(e) => handleFieldChange(index, e)}
                                isInvalid={!!fieldErrorObject.label} placeholder="e.g., Aadhaar Number"/>
                                <Form.Control.Feedback type="invalid">{fieldErrorObject.label}</Form.Control.Feedback>
                            </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group className="mb-3" controlId={`fieldPrompt_${index}`}>
                            <Form.Label>Prompt <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" name="prompt" value={field.prompt}
                            onChange={(e) => handleFieldChange(index, e)}
                            isInvalid={!!fieldErrorObject.prompt} placeholder="e.g., Enter your 12-digit Aadhaar number"/>
                            <Form.Control.Feedback type="invalid">{fieldErrorObject.prompt}</Form.Control.Feedback>
                        </Form.Group>
                        <Row>
                            <Col md={4}>
                            <Form.Group className="mb-3" controlId={`fieldType_${index}`}>
                                <Form.Label>Type <span className="text-danger">*</span></Form.Label>
                                <Form.Select name="type" value={field.type} onChange={(e) => handleFieldChange(index, e)}
                                isInvalid={!!fieldErrorObject.type}>
                                {FIELD_TYPES.map((type) => (<option key={type} value={type}>{type}</option>))}
                                </Form.Select>
                                <Form.Control.Feedback type="invalid">{fieldErrorObject.type}</Form.Control.Feedback>
                            </Form.Group>
                            </Col>
                            <Col md={4} className="d-flex align-items-center pt-3"> {/* Adjusted for alignment */}
                                <Form.Group controlId={`fieldRequired_${index}`} className="mb-3">
                                    <Form.Check type="switch" label="Required" name="required"
                                    checked={field.required} onChange={(e) => handleFieldChange(index, e)}/>
                                </Form.Group>
                            </Col>
                             <Col md={4} className="d-flex align-items-center pt-3">
                                <Form.Group controlId={`fieldIsUniqueIdentifier_${index}`} className="mb-3">
                                    <Form.Check type="switch" label={<><FaKey className="me-1"/> Is Unique Identifier?</>} name="is_unique_identifier"
                                    checked={field.is_unique_identifier} onChange={(e) => handleFieldChange(index, e)}
                                    isInvalid={!!fieldErrorObject.is_unique_identifier}
                                    title="Mark if this field can uniquely identify the document (e.g., Aadhaar No.). Must be a 'text' type and 'Required'."/>
                                     <Form.Control.Feedback type="invalid">{fieldErrorObject.is_unique_identifier}</Form.Control.Feedback>
                                </Form.Group>
                            </Col>
                        </Row>

                        {field.is_unique_identifier && (
                            <Form.Group className="mb-3" controlId={`fieldUniqueIdentifierPrompt_${index}`}>
                                <Form.Label>Unique Identifier Prompt <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" name="unique_identifier_prompt" value={field.unique_identifier_prompt}
                                onChange={(e) => handleFieldChange(index, e)}
                                isInvalid={!!fieldErrorObject.unique_identifier_prompt}
                                placeholder="e.g., Enter 12-digit number without spaces"/>
                                <Form.Control.Feedback type="invalid">{fieldErrorObject.unique_identifier_prompt}</Form.Control.Feedback>
                            </Form.Group>
                        )}

                        {(field.type === "select" || field.type === "multiselect") && (
                            <Form.Group className="mb-3" controlId={`fieldOptions_${index}`}>
                            <Form.Label>Options (comma-separated) <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" value={Array.isArray(field.options) ? field.options.join(", ") : ""}
                                onChange={(e) => handleOptionsChange(index, e)}
                                isInvalid={!!fieldErrorObject.options}
                                placeholder="Option 1, Option 2, Option 3"/>
                            <Form.Control.Feedback type="invalid">{fieldErrorObject.options}</Form.Control.Feedback>
                            </Form.Group>
                        )}

                        {isMinMaxApplicable && (
                            <Row>
                                <Col md={6}>
                                <Form.Group className="mb-3" controlId={`fieldMinValue_${index}`}>
                                    <Form.Label>Min Value/Length <span className="text-danger">*</span></Form.Label>
                                    <Form.Control type={getMinMaxValueInputType(field.type)} name="min_value" value={field.min_value}
                                    onChange={(e) => handleFieldChange(index, e)}
                                    isInvalid={!!fieldErrorObject.min_value}
                                    step={field.type === "number" ? "any" : undefined}/>
                                    <Form.Control.Feedback type="invalid">{fieldErrorObject.min_value}</Form.Control.Feedback>
                                </Form.Group>
                                </Col>
                                <Col md={6}>
                                <Form.Group className="mb-3" controlId={`fieldMaxValue_${index}`}>
                                    <Form.Label>Max Value/Length <span className="text-danger">*</span></Form.Label>
                                    <Form.Control type={getMinMaxValueInputType(field.type)} name="max_value" value={field.max_value}
                                    onChange={(e) => handleFieldChange(index, e)}
                                    isInvalid={!!fieldErrorObject.max_value}
                                    step={field.type === "number" ? "any" : undefined}/>
                                    <Form.Control.Feedback type="invalid">{fieldErrorObject.max_value}</Form.Control.Feedback>
                                </Form.Group>
                                </Col>
                            </Row>
                        )}
                        </Card>
                    );
                    })}

                    <Button variant="outline-primary" onClick={handleAddField} className="mt-2">
                    <FaPlusCircle className="me-2"/>Add Another Field
                    </Button>
                    {validationErrors.form && <Alert variant="danger" className="mt-3">{validationErrors.form}</Alert>}
                </Card.Body>
                </Card>
                
                <Button variant="success" type="submit" disabled={loading} className="mt-3 w-100 py-2 fs-5">
                {loading ? (
                    <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2"/>Creating Schema...</>
                ) : ( "Create Schema Definition" )}
                </Button>
            </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default DynamicDocumentForm;