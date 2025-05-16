// --- OtherDocumentsSection.js ---
// src/components/applicant/applications/OtherDocumentsSection.js
import React from 'react';
import PropTypes from 'prop-types';
import { Card, ListGroup, Row, Col, Form } from 'react-bootstrap';
import { FaCheckCircle, FaFileUpload } from 'react-icons/fa';

const OtherDocumentsSection = ({
    loanSchemaData,
    otherRequiredDocFiles,
    handleOtherRequiredDocFileChange, 
    getFieldError,
    isSubmitting,
    isSavingDraft,
    existingFileRefs,
    showValidationErrors,
    aadhaarSchemaDef, 
    panSchemaDef,     
}) => {
    // Ensure all necessary schema definitions are loaded before proceeding
    if (!loanSchemaData || !aadhaarSchemaDef || !panSchemaDef) return null; 

    // Filter out Aadhaar and PAN documents from the list of required documents
    const otherDocs = (loanSchemaData.required_documents || []).filter(doc =>
        doc.name.toLowerCase() !== aadhaarSchemaDef.name.toLowerCase() &&
        doc.name.toLowerCase() !== panSchemaDef.name.toLowerCase()
    );

    // If there are no other documents required, don't render the section
    if (otherDocs.length === 0) return null;

    return (
        <Card className="mb-4 shadow-sm">
            <Card.Header className="bg-light"><h5 className='mb-0 section-title'>Other Required Documents</h5></Card.Header>
            <Card.Body>
                <ListGroup variant="flush" className='required-docs-listgroup'>
                    {otherDocs.map((doc) => {
                        // Create a key for managing state and errors for this document
                        const docNameKey = doc.name.replace(/\s+/g, '_');
                        const fileInputError = getFieldError('otherRequiredDocs', docNameKey);
                        
                        // Check if there's an existing file reference (e.g., from a saved draft)
                        const existingFileKey = `otherDoc_${docNameKey}`;
                        const hasExisting = !!existingFileRefs[existingFileKey];
                        
                        // Check if a new file has been selected in the current session
                        const hasNew = !!otherRequiredDocFiles[docNameKey];
                        
                        let existingFileName = '';
                        if (hasExisting && existingFileRefs[existingFileKey]) {
                            try {
                                // Attempt to decode and display a user-friendly file name from the URL/ref
                                existingFileName = decodeURIComponent(new URL(existingFileRefs[existingFileKey]).pathname.split('/').pop()) || existingFileRefs[existingFileKey];
                            } catch (_) {
                                // Fallback for non-URL refs or if decoding fails; truncate long strings
                                existingFileName = typeof existingFileRefs[existingFileKey] === 'string' && existingFileRefs[existingFileKey].length > 30 
                                    ? existingFileRefs[existingFileKey].substring(0,15)+'...' 
                                    : existingFileRefs[existingFileKey];
                            }
                        }

                        return (
                            <ListGroup.Item 
                                key={doc.name} 
                                className={`required-doc-item p-3 border rounded mb-3 ${showValidationErrors && fileInputError ? 'is-invalid-doc' : ''}`}
                            >
                                <Row className="align-items-center g-3">
                                    <Col md={5} className="doc-info">
                                        {/* Display document name and description */}
                                        <strong className="d-block">{doc.name} *</strong> 
                                        <small className="text-muted d-block">{doc.description}</small> 
                                    </Col>
                                    <Col md={7} className="doc-input">
                                        <Form.Control
                                            type="file"
                                            id={`otherDoc_${docNameKey}`}
                                            onChange={(e) => handleOtherRequiredDocFileChange(docNameKey, e.target.files ? e.target.files[0] : null)}
                                            disabled={isSubmitting || isSavingDraft} // Disable if form is being submitted or saved
                                            isInvalid={showValidationErrors && !!fileInputError} // Show validation state
                                            size="sm"
                                            className="document-file-input" 
                                        />
                                        {/* Display info about existing or newly selected files */}
                                        {hasExisting && !hasNew && 
                                            <small className='text-success d-block mt-1'>
                                                <FaCheckCircle size={12} className="me-1" />Current file: {existingFileName}
                                            </small>
                                        }
                                        {hasNew && 
                                            <small className='text-info d-block mt-1'>
                                                <FaFileUpload size={12} className="me-1" />New: {otherRequiredDocFiles[docNameKey]?.name}
                                            </small>
                                        }
                                        {/* Display validation error message for this file input */}
                                        {showValidationErrors && fileInputError && 
                                            <Form.Text className="text-danger d-block mt-1">{fileInputError}</Form.Text>
                                        }
                                    </Col>
                                </Row>
                            </ListGroup.Item>
                        );
                    })}
                </ListGroup>
            </Card.Body>
        </Card>
    );
};

OtherDocumentsSection.propTypes = {
    loanSchemaData: PropTypes.object.isRequired,
    otherRequiredDocFiles: PropTypes.object.isRequired,
    handleOtherRequiredDocFileChange: PropTypes.func.isRequired,
    getFieldError: PropTypes.func.isRequired,
    isSubmitting: PropTypes.bool.isRequired,
    isSavingDraft: PropTypes.bool.isRequired,
    existingFileRefs: PropTypes.object.isRequired,
    showValidationErrors: PropTypes.bool.isRequired,
    aadhaarSchemaDef: PropTypes.object, // Used to filter out Aadhaar from the list
    panSchemaDef: PropTypes.object,     // Used to filter out PAN from the list
};

export default OtherDocumentsSection;
