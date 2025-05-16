
// --- LoanDetailsSection.js ---
// src/components/applicant/applications/LoanDetailsSection.js
import React from 'react';
import PropTypes from 'prop-types';
import { Card, Form, Row, Col, InputGroup } from 'react-bootstrap';
import FieldRenderer from './FieldRenderer'; // Used directly
import { AADHAAR_SCHEMA_ID_CONST, PAN_SCHEMA_ID_CONST } from '../../../constants'; 


const LoanDetailsSection = ({
    loanSchemaData,
    mainFormData,
    handleSectionFieldChange,
    handleMainLoanCustomFileChange, 
    getFieldError,
    isSubmitting,
    isSavingDraft,
    existingFileRefs,
    autoFilledFields, // This is for mainLoan fields sourced from KYC
    docValidationStatus, 
    aadhaarSchemaDef,   
    panSchemaDef,       
    showValidationErrors,
}) => {
    if (!loanSchemaData) return null;
    
    const allDocSchemasForSourceLookup = {
        aadhaarSchemaDef: aadhaarSchemaDef,
        panSchemaDef: panSchemaDef,
        docNameToTypeMap: {},
    };
    if (aadhaarSchemaDef) {
        allDocSchemasForSourceLookup.docNameToTypeMap[aadhaarSchemaDef.name] = AADHAAR_SCHEMA_ID_CONST;
    }
    if (panSchemaDef) {
        allDocSchemasForSourceLookup.docNameToTypeMap[panSchemaDef.name] = PAN_SCHEMA_ID_CONST;
    }


    return (
        <Card className="shadow-sm application-details-card mb-4">
            <Card.Header className="bg-light"> <h4 className="mb-0 card-form-title">Loan Application Details</h4> </Card.Header>
            <Card.Body className="p-4">
                <Form.Group as={Row} className="mb-4 align-items-center" controlId="mainLoan_amount">
                    <Form.Label column sm={3} className="fw-bold form-section-label">Loan Amount Requested*</Form.Label>
                    <Col sm={9}>
                        <InputGroup>
                            <InputGroup.Text>₹</InputGroup.Text>
                            <Form.Control
                                type="number"
                                value={mainFormData.amount || ''}
                                onChange={(e) => handleSectionFieldChange("mainLoan", "amount", e.target.value)}
                                required
                                min={loanSchemaData.min_amount}
                                max={loanSchemaData.max_amount}
                                step="any"
                                disabled={isSubmitting || isSavingDraft}
                                isInvalid={showValidationErrors && !!getFieldError('mainLoan', 'amount')} />
                            <Form.Control.Feedback type="invalid">{getFieldError('mainLoan', 'amount')}</Form.Control.Feedback>
                        </InputGroup>
                        <Form.Text className="text-muted d-block mt-1"> Min: ₹{loanSchemaData.min_amount?.toLocaleString('en-IN')}, Max: ₹{loanSchemaData.max_amount?.toLocaleString('en-IN')} </Form.Text>
                    </Col>
                </Form.Group>

                {(loanSchemaData.fields || []).length > 0 && <><hr className="my-4" /><h5 className='mb-3 section-title'>Additional Information</h5></>}
                {(loanSchemaData.fields || []).map((field) => (
                    <FieldRenderer
                        key={`mainLoan-${field.field_id}`}
                        field={field}
                        sectionData={mainFormData}
                        onFieldChange={handleSectionFieldChange}
                        onFileChange={handleMainLoanCustomFileChange} 
                        sectionName="mainLoan"
                        error={getFieldError('mainLoan', field.field_id)}
                        disabled={isSubmitting || isSavingDraft}
                        existingFileUrl={existingFileRefs[`mainLoan_${field.field_id}`]}
                        isAutoFilled={!!autoFilledFields[field.field_id]} // For main loan fields sourced from KYC
                        autoFilledDetail={autoFilledFields[field.field_id]}
                        isPotentiallyAutoFill={field.auto_fill_sources && field.auto_fill_sources.length > 0}
                        autoFillSources={field.auto_fill_sources}
                        docValidationStatus={docValidationStatus}
                        allDocSchemasForSourceLookup={allDocSchemasForSourceLookup}
                        showValidationErrors={showValidationErrors}
                    />
                ))}
            </Card.Body>
        </Card>
    );
};

LoanDetailsSection.propTypes = {
    loanSchemaData: PropTypes.object.isRequired,
    mainFormData: PropTypes.object.isRequired,
    handleSectionFieldChange: PropTypes.func.isRequired,
    handleMainLoanCustomFileChange: PropTypes.func.isRequired,
    getFieldError: PropTypes.func.isRequired,
    isSubmitting: PropTypes.bool.isRequired,
    isSavingDraft: PropTypes.bool.isRequired,
    existingFileRefs: PropTypes.object.isRequired,
    autoFilledFields: PropTypes.object.isRequired,
    docValidationStatus: PropTypes.object.isRequired,
    aadhaarSchemaDef: PropTypes.object,
    panSchemaDef: PropTypes.object,
    showValidationErrors: PropTypes.bool.isRequired,
};

export default LoanDetailsSection;