// --- KycDocumentSection.js ---
// src/components/applicant/applications/KycDocumentSection.js
import React from 'react';
import PropTypes from 'prop-types';
import { Card, Alert, Spinner, Badge } from 'react-bootstrap';
import { FaIdCard, FaFileSignature, FaCheckCircle, FaFileUpload } from 'react-icons/fa'; 
import { Check, XCircle } from 'lucide-react';
import FieldRenderer from './FieldRenderer'; 

const KycDocumentSection = ({
    docSchemaDef,
    docFormData,
    sectionName, 
    docValidationState, 
    existingFileRefs,
    onFieldChange,
    onFileChange,
    getFieldError,
    getSectionGeneralError,
    isSubmitting, // Overall form submitting state
    isSavingDraft, // Overall form saving draft state
    showValidationErrors,
    autoFilledKycFields, 
}) => {
    if (!docSchemaDef) return <Alert variant="warning">Document schema definition is missing for {sectionName}.</Alert>;

    const IconComponent = sectionName === 'aadhaar' ? FaIdCard : FaFileSignature;
    const currentStatus = docValidationState?.status;

    return (
        <Card className="mb-4 shadow-sm">
            <Card.Header className="bg-light">
                <h4 className="mb-0 card-form-title d-flex align-items-center">
                    <IconComponent className="me-2 text-primary" /> {docSchemaDef.name} (Mandatory)
                    {/* Status Badges reflecting the process from ApplicationForm.js */}
                    {currentStatus === 'verified_db_match' && <Badge bg="success-subtle" text="success-emphasis" className="ms-2"><Check size={14} /> Verified (DB Match)</Badge>}
                    {currentStatus === 'image_extracted' && <Badge bg="info-subtle" text="info-emphasis" className="ms-2"><FaCheckCircle size={12} /> Image Extracted</Badge>}
                    {(currentStatus === 'image_extracting' || currentStatus === 'db_lookup') && <Spinner animation="border" size="sm" className="ms-2 text-info" title={docValidationState?.message || "Processing..."} />}
                    {currentStatus === 'db_match_not_found' && <Badge bg="warning-subtle" text="warning-emphasis" className="ms-2"><XCircle size={14} /> Not in DB (Manual Entry Required)</Badge>}
                    {currentStatus === 'db_data_mismatch' && <Badge bg="danger-subtle" text="danger-emphasis" className="ms-2"><XCircle size={14} /> Data Mismatch (Manual Entry Required)</Badge>}
                    {currentStatus === 'unique_id_missing_from_image' && <Badge bg="warning-subtle" text="warning-emphasis" className="ms-2"><XCircle size={14} /> Unique ID Not Found in Image (Manual Entry Required)</Badge>}
                    {currentStatus === 'error' && <Badge bg="danger-subtle" text="danger-emphasis" className="ms-2"><XCircle size={14} /> Error (Manual Entry Required)</Badge>}
                    {currentStatus === 'submitted' && <Badge bg="primary-subtle" text="primary-emphasis" className="ms-2"><FaFileUpload size={12} /> Submitted</Badge>}
                    {currentStatus !== 'verified_db_match' && currentStatus !== 'image_extracting' && currentStatus !== 'db_lookup' && currentStatus !== 'submitted' && <Badge bg="secondary-subtle" text="secondary-emphasis" className="ms-2"><FaFileUpload size={12} /> Not Submitted</Badge>}
                </h4>
                {getSectionGeneralError(sectionName) && <Alert variant="danger" size="sm" className="mt-2 mb-0 py-1">{getSectionGeneralError(sectionName)}</Alert>}
            </Card.Header>
            <Card.Body>
                {(docSchemaDef.fields || []).map(field => {
                    let fieldShouldBeDisabled = isSubmitting || isSavingDraft; // Base disable state

                    if (!fieldShouldBeDisabled) { // Only evaluate further if not already disabled by form actions
                        if (field.type === 'image' || field.type === 'document') {
                            // The file upload field itself
                            // Disable if successfully verified & matched, or actively processing, or submitted
                            if (currentStatus === 'verified_db_match' || 
                                currentStatus === 'image_extracting' || 
                                currentStatus === 'db_lookup' ||
                                currentStatus === 'submitted') {
                                fieldShouldBeDisabled = true;
                            } else {
                                fieldShouldBeDisabled = false; // Allow upload/re-upload in other states (initial, error, mismatch, etc.)
                            }
                        } else {
                            // Data fields (text, select, date, etc.)
                            // These are disabled by default and only enabled if manual entry is explicitly required.
                            const statesRequiringManualEntry = [
                                'db_data_mismatch', 
                                'db_match_not_found', 
                                'unique_id_missing_from_image', 
                                'error' 
                            ];
                            if (currentStatus && statesRequiringManualEntry.includes(currentStatus)) {
                                fieldShouldBeDisabled = false; // Enable for manual input
                            } else {
                                // Disabled in initial state (no status), during processing, or if successfully verified from DB
                                fieldShouldBeDisabled = true; 
                            }
                        }
                    }

                    return (
                        <FieldRenderer
                            key={`${sectionName}-${field.key}`}
                            field={field}
                            sectionData={docFormData}
                            onFieldChange={onFieldChange}
                            onFileChange={onFileChange} 
                            sectionName={sectionName}
                            error={getFieldError(sectionName, field.key)}
                            disabled={fieldShouldBeDisabled} // Pass the calculated disabled state
                            existingFileUrl={existingFileRefs[`${sectionName}_${field.key}`]}
                            showValidationErrors={showValidationErrors}
                            isAutoFilled={!!autoFilledKycFields[field.key]} 
                            isPotentiallyAutoFill={false} 
                        />
                    );
                })}
            </Card.Body>
        </Card>
    );
};

KycDocumentSection.propTypes = {
    docSchemaDef: PropTypes.object.isRequired,
    docFormData: PropTypes.object.isRequired,
    sectionName: PropTypes.string.isRequired,
    docValidationState: PropTypes.object,
    existingFileRefs: PropTypes.object.isRequired,
    onFieldChange: PropTypes.func.isRequired,
    onFileChange: PropTypes.func.isRequired,
    getFieldError: PropTypes.func.isRequired,
    getSectionGeneralError: PropTypes.func.isRequired,
    isSubmitting: PropTypes.bool.isRequired,
    isSavingDraft: PropTypes.bool.isRequired,
    showValidationErrors: PropTypes.bool.isRequired,
    autoFilledKycFields: PropTypes.object.isRequired, 
};

export default KycDocumentSection;
