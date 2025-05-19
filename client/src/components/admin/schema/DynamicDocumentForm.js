// src/components/admin/DynamicDocumentForm.js (or your actual path)
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
} from "react-bootstrap";
import { FaPlusCircle, FaTrashAlt, FaInfoCircle, FaKey } from "react-icons/fa";
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

// --- Date Helper Functions ---
// Converts YYYY-MM-DD to DD-MM-YYYY
const formatDateToDDMMYYYY = (isoDateString) => {
  if (!isoDateString || !/^\d{4}-\d{2}-\d{2}$/.test(isoDateString)) return isoDateString; // Return original if not valid YYYY-MM-DD
  const parts = isoDateString.split('-');
  if (parts.length !== 3) return isoDateString;
  const [year, month, day] = parts;
  return `${day}-${month}-${year}`;
};

// Converts DD-MM-YYYY to YYYY-MM-DD
const formatDateToYYYYMMDD = (ddmmyyyyString) => {
  if (!ddmmyyyyString || !/^\d{2}-\d{2}-\d{4}$/.test(ddmmyyyyString)) return ddmmyyyyString; // Return original if not valid DD-MM-YYYY
  const parts = ddmmyyyyString.split('-');
  if (parts.length !== 3) return ddmmyyyyString;
  const [day, month, year] = parts;
  return `${year}-${month}-${day}`;
};


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
            delete newState.fields[index].unique_identifier_prompt;
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
        is_unique_identifier: false,
        unique_identifier_prompt: "",
      },
    ]);
  };

  // Handle removing a field
  const handleRemoveField = (index) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
    setValidationErrors((prev) => {
      const newState = { ...prev };
      if (newState.fields && newState.fields.length > index) {
        const updatedFieldErrors = [...(newState.fields || [])];
        updatedFieldErrors.splice(index, 1);
        
        if (updatedFieldErrors.length > 0) {
            newState.fields = updatedFieldErrors;
        } else {
            delete newState.fields;
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

    const fieldErrors = fields.map((field) => { 
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
      
      if (field.type === "number" && field.min_value && field.max_value) {
        const minNum = parseFloat(field.min_value);
        const maxNum = parseFloat(field.max_value);
        if (isNaN(minNum) || isNaN(maxNum)) {
          // Errors for non-numeric min/max would ideally be caught by input type or more specific validation
        } else if (minNum > maxNum) {
          currentFieldErrors.min_value = "Min value cannot be greater than max value.";
        }
      }

      if (field.type === "date" && field.min_value && field.max_value) {
        try {
            const minDate = new Date(formatDateToYYYYMMDD(field.min_value));
            const maxDate = new Date(formatDateToYYYYMMDD(field.max_value));
            // Check if dates are valid after conversion
            if (isNaN(minDate.getTime()) || isNaN(maxDate.getTime())) {
                // Handle invalid date strings for min/max if necessary
                // currentFieldErrors.min_value = "Invalid Min Date format."; // Or similar
            } else if (minDate > maxDate) {
                currentFieldErrors.min_value = "Min Date cannot be after Max Date.";
            }
        } catch (e) {
            console.warn("Error parsing min/max date for validation:", e);
        }
      }


      if (field.is_unique_identifier === true) {
        uniqueIdentifierFound = true; 
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

    if (!uniqueIdentifierFound && fields.length > 0) { 
        errors.form = "At least one field must be marked as a unique identifier.";
        isValid = false;
    }
    
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
    setValidationErrors({}); 
    setSubmitStatus("idle");
    setStatusMessage("");

    if (!validateForm()) {
      console.log("Form validation failed. Showing errors.");
      setSubmitStatus("error");
      setStatusMessage("Please fix the errors in the form before submitting.");
      const firstErrorKey = Object.keys(validationErrors)[0];
      if (firstErrorKey && validationErrors[firstErrorKey]) { // Check if error message exists
          const element = document.getElementById(firstErrorKey) || document.getElementsByName(firstErrorKey)[0];
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (validationErrors.fields) { // Check for first field error
          const firstFieldErrorIndex = validationErrors.fields.findIndex(fErr => Object.keys(fErr).length > 0);
          if (firstFieldErrorIndex !== -1) {
              const firstFieldErrorKey = Object.keys(validationErrors.fields[firstFieldErrorIndex])[0];
              const elementId = `field${firstFieldErrorKey.charAt(0).toUpperCase() + firstFieldErrorKey.slice(1)}_${firstFieldErrorIndex}`; // e.g. fieldKey_0
              const element = document.getElementById(elementId);
              element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
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
      fields: fields.map((field) => { // 'field' is the parameter for this first map callback
        // This 'valueForSubmission' is not actually used in the returned object for schema definition.
        // The 'field.value' in the `fields` state holds the admin's input for min_value, max_value, etc.
        // not a default data value for the schema field itself.
        // let valueForSubmission = field.value; 
        // if (field.type === "date" && field.value) {
        //   valueForSubmission = formatDateToDDMMYYYY(field.value);
        // }

        return {
          key: field.key.trim(),
          label: field.label.trim(),
          prompt: field.prompt.trim(),
          type: field.type,
          required: field.required,
          options: field.options && field.options.length > 0 ? field.options : undefined,
          min_value: String(field.min_value || "").trim(), // Send as string, backend handles type
          max_value: String(field.max_value || "").trim(), // Send as string, backend handles type
          is_unique_identifier: field.is_unique_identifier || false,
          unique_identifier_prompt: field.is_unique_identifier ? String(field.unique_identifier_prompt || '').trim() : undefined,
        };
      }),
    };

     // Second map to further refine fields if necessary (e.g. default values if min/max are empty)
     submissionData.fields = submissionData.fields.map(f => { // 'f' is the parameter for this second map callback
        const { ...rest } = f; // Create a copy to modify

        // If min_value/max_value are not applicable for the type, ensure they are empty strings
        if (!["text", "textarea", "number", "date", "datetime", "time"].includes(f.type)) {
            rest.min_value = "";
            rest.max_value = "";
        } else {
            // For applicable types, if they are still the placeholder defaults from the first map AND
            // the original input was empty, ensure they are empty strings.
            // The first map already handles String(field.min_value || "").trim()
            // This logic might be redundant or could be simplified depending on desired default behavior.
            // Example: if admin leaves number min_value blank, it becomes "" not "0".
             if (rest.min_value === "0" && String(fields.find(origField => origField.key === f.key)?.min_value || "").trim() === "") {
                 rest.min_value = "";
             }
             if (rest.max_value === "100000000000000000000000" && String(fields.find(origField => origField.key === f.key)?.max_value || "").trim() === "") {
                 rest.max_value = "";
             }
        }
        // For date types, ensure min_value and max_value are sent in DD-MM-YYYY if that's the convention for storing schema definitions
        // The admin inputs them into text or date fields. If they are date pickers, they are YYYY-MM-DD.
        // If they are text fields, they are as-typed.
        // The current code sends String(field.min_value || "").trim() which is the as-typed value.
        // If admin is expected to type DD-MM-YYYY for date min/max, then this is correct.
        // If admin uses a date picker for min/max (type="date"), then field.min_value would be YYYY-MM-DD.
        // Let's assume for schema definition, we store min/max for dates as DD-MM-YYYY if provided in that format by admin.
        // The `getMinMaxValueInputType` makes the min/max inputs themselves date pickers.
        // So, `field.min_value` for a date type's min_value field will be YYYY-MM-DD.
        // We need to convert it to DD-MM-YYYY for submission if that's the desired storage format.
        if (f.type === "date") {
            if (rest.min_value) rest.min_value = formatDateToDDMMYYYY(rest.min_value); // Convert YYYY-MM-DD from input to DD-MM-YYYY
            if (rest.max_value) rest.max_value = formatDateToDDMMYYYY(rest.max_value); // Convert YYYY-MM-DD from input to DD-MM-YYYY
        }


        return rest;
    });


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
        if (error.response.data.errors) { 
            const backendErrors = {};
            error.response.data.errors.forEach(err => {
                // This is a simplified error display. For field-specific errors from backend,
                // you'd need to parse err.path or err.param to map to validationErrors.fields[index].key
                if (!backendErrors.form) backendErrors.form = err.msg || err; // Adjust based on backend error structure
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

  // Helper to get input type for min/max fields based on selected field type
  const getMinMaxValueInputType = (fieldType) => {
    switch (fieldType) {
      case "number": return "number";
      case "date": return "date"; // Admin will use date picker, value is YYYY-MM-DD
      case "datetime": return "datetime-local";
      case "time": return "time";
      default: return "text"; // For text/textarea, min/max are lengths
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
                        <Form.Group className="mb-3" controlId="schema_id_form_control"> {/* Unique controlId */}
                        <Form.Label>
                            Schema ID <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                            type="text"
                            name="schema_id" // Matches state key
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
                        <Form.Group className="mb-3" controlId="name_form_control"> {/* Unique controlId */}
                        <Form.Label>
                            Document Name <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                            type="text"
                            name="name" // Matches state key
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
                    <Form.Group className="mb-3" controlId="description_form_control"> {/* Unique controlId */}
                    <Form.Label>
                        Description <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                        as="textarea"
                        name="description" // Matches state key
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
                    {fields.map((fieldItem, index) => { // Changed 'field' to 'fieldItem' to avoid conflict
                    const isMinMaxApplicable = ["text", "textarea", "number", "date", "datetime", "time"].includes(fieldItem.type);
                    const fieldErrorObject = validationErrors.fields && validationErrors.fields[index] ? validationErrors.fields[index] : {};
                    
                    // For min/max attributes on date inputs, ensure they are YYYY-MM-DD
                    // The value in fieldItem.min_value is what the admin types for the schema definition
                    let minDateForInput = fieldItem.min_value;
                    let maxDateForInput = fieldItem.max_value;
                    // If the admin is using a date picker to *define* the min/max for a date field in the schema
                    if (getMinMaxValueInputType(fieldItem.type) === "date") {
                         minDateForInput = fieldItem.min_value; // This is already YYYY-MM-DD from the input
                         maxDateForInput = fieldItem.max_value; // This is already YYYY-MM-DD from the input
                    }


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
                                aria-label={`Remove field ${fieldItem.label || index + 1}`}
                            >
                                <FaTrashAlt/> Remove
                            </Button>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={6}>
                            <Form.Group className="mb-3" controlId={`fieldKey_${index}`}>
                                <Form.Label>Field Key <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" name="key" value={fieldItem.key}
                                onChange={(e) => handleFieldChange(index, e)}
                                isInvalid={!!fieldErrorObject.key} placeholder="e.g., aadhaar_number"/>
                                <Form.Control.Feedback type="invalid">{fieldErrorObject.key}</Form.Control.Feedback>
                            </Form.Group>
                            </Col>
                            <Col md={6}>
                            <Form.Group className="mb-3" controlId={`fieldLabel_${index}`}>
                                <Form.Label>Field Label <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" name="label" value={fieldItem.label}
                                onChange={(e) => handleFieldChange(index, e)}
                                isInvalid={!!fieldErrorObject.label} placeholder="e.g., Aadhaar Number"/>
                                <Form.Control.Feedback type="invalid">{fieldErrorObject.label}</Form.Control.Feedback>
                            </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group className="mb-3" controlId={`fieldPrompt_${index}`}>
                            <Form.Label>Prompt <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" name="prompt" value={fieldItem.prompt}
                            onChange={(e) => handleFieldChange(index, e)}
                            isInvalid={!!fieldErrorObject.prompt} placeholder="e.g., Enter your 12-digit Aadhaar number"/>
                            <Form.Control.Feedback type="invalid">{fieldErrorObject.prompt}</Form.Control.Feedback>
                        </Form.Group>
                        <Row>
                            <Col md={4}>
                            <Form.Group className="mb-3" controlId={`fieldType_${index}`}>
                                <Form.Label>Type <span className="text-danger">*</span></Form.Label>
                                <Form.Select name="type" value={fieldItem.type} onChange={(e) => handleFieldChange(index, e)}
                                isInvalid={!!fieldErrorObject.type}>
                                {FIELD_TYPES.map((type) => (<option key={type} value={type}>{type}</option>))}
                                </Form.Select>
                                <Form.Control.Feedback type="invalid">{fieldErrorObject.type}</Form.Control.Feedback>
                            </Form.Group>
                            </Col>
                            <Col md={4} className="d-flex align-items-center pt-3"> 
                                <Form.Group controlId={`fieldRequired_${index}`} className="mb-3">
                                    <Form.Check type="switch" label="Required" name="required"
                                    checked={fieldItem.required} onChange={(e) => handleFieldChange(index, e)}/>
                                </Form.Group>
                            </Col>
                             <Col md={4} className="d-flex align-items-center pt-3">
                                <Form.Group controlId={`fieldIsUniqueIdentifier_${index}`} className="mb-3">
                                    <Form.Check type="switch" label={<><FaKey className="me-1"/> Is Unique Identifier?</>} name="is_unique_identifier"
                                    checked={fieldItem.is_unique_identifier} onChange={(e) => handleFieldChange(index, e)}
                                    isInvalid={!!fieldErrorObject.is_unique_identifier}
                                    title="Mark if this field can uniquely identify the document (e.g., Aadhaar No.). Must be a 'text' type and 'Required'."/>
                                     <Form.Control.Feedback type="invalid">{fieldErrorObject.is_unique_identifier}</Form.Control.Feedback>
                                </Form.Group>
                            </Col>
                        </Row>

                        {fieldItem.is_unique_identifier && (
                            <Form.Group className="mb-3" controlId={`fieldUniqueIdentifierPrompt_${index}`}>
                                <Form.Label>Unique Identifier Prompt <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" name="unique_identifier_prompt" value={fieldItem.unique_identifier_prompt}
                                onChange={(e) => handleFieldChange(index, e)}
                                isInvalid={!!fieldErrorObject.unique_identifier_prompt}
                                placeholder="e.g., Enter 12-digit number without spaces"/>
                                <Form.Control.Feedback type="invalid">{fieldErrorObject.unique_identifier_prompt}</Form.Control.Feedback>
                            </Form.Group>
                        )}

                        {(fieldItem.type === "select" || fieldItem.type === "multiselect") && (
                            <Form.Group className="mb-3" controlId={`fieldOptions_${index}`}>
                            <Form.Label>Options (comma-separated) <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" value={Array.isArray(fieldItem.options) ? fieldItem.options.join(", ") : ""}
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
                                    <Form.Control 
                                        type={getMinMaxValueInputType(fieldItem.type)} 
                                        name="min_value" 
                                        value={fieldItem.min_value} // Value admin types for schema definition
                                        onChange={(e) => handleFieldChange(index, e)}
                                        isInvalid={!!fieldErrorObject.min_value}
                                        step={fieldItem.type === "number" ? "any" : undefined}
                                    />
                                    <Form.Control.Feedback type="invalid">{fieldErrorObject.min_value}</Form.Control.Feedback>
                                </Form.Group>
                                </Col>
                                <Col md={6}>
                                <Form.Group className="mb-3" controlId={`fieldMaxValue_${index}`}>
                                    <Form.Label>Max Value/Length <span className="text-danger">*</span></Form.Label>
                                    <Form.Control 
                                        type={getMinMaxValueInputType(fieldItem.type)} 
                                        name="max_value" 
                                        value={fieldItem.max_value} // Value admin types for schema definition
                                        onChange={(e) => handleFieldChange(index, e)}
                                        isInvalid={!!fieldErrorObject.max_value}
                                        step={fieldItem.type === "number" ? "any" : undefined}
                                    />
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
