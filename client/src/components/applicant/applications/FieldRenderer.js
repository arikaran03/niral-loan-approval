// --- FieldRenderer.js ---
// src/components/applicant/applications/FieldRenderer.js
import React from 'react';
import PropTypes from 'prop-types';
import { Form, Row, Col, Spinner, Badge, InputGroup } from 'react-bootstrap';
import { FaCheckCircle, FaHourglassStart, FaFileUpload, FaLock } from 'react-icons/fa'; 
import { UserCheck, UserX } from 'lucide-react';
import { AADHAAR_SCHEMA_ID_CONST, PAN_SCHEMA_ID_CONST } from '../../../constants'; // Adjust the import path as necessary

const FieldRenderer = ({
    field,
    sectionData,
    onFieldChange,
    onFileChange,
    sectionName,
    error,
    disabled,
    existingFileUrl,
    isAutoFilled, 
    isPotentiallyAutoFill, 
    showValidationErrors,
    autoFillSources, 
    autoFilledDetail, 
    docValidationStatus, 
    allDocSchemasForSourceLookup, 
}) => {
    const idKey = field.field_id || field.key;
    const labelKey = field.field_label || field.label;
    const promptKey = field.field_prompt || field.prompt;
    const typeKey = field.type;
    const requiredKey = field.required;
    const optionsKey = field.options;
    const minValueKey = field.min_value;
    const maxValueKey = field.max_value;

    const label = `${labelKey}${requiredKey ? ' *' : ''}`;
    const controlId = `${sectionName}_${idKey}`;
    const value = sectionData[idKey];

    const isDisabledByMainLoanAutoFill = sectionName === 'mainLoan' && isAutoFilled && isPotentiallyAutoFill;
    const finalDisabled = disabled || isDisabledByMainLoanAutoFill;
    const isReadOnlyVisually = sectionName === 'mainLoan' && isAutoFilled;

    const autoFilledClass = sectionName === 'mainLoan' && isAutoFilled ? 'field-autofilled' : '';
    const kycAutoFilledClass = (sectionName === 'aadhaar' || sectionName === 'pan') && isAutoFilled ? 'field-autofilled-kyc' : '';
    const potentiallyAutoFillClass = sectionName === 'mainLoan' && isPotentiallyAutoFill && !isAutoFilled ? 'field-potentially-autofill' : '';

    const handleChange = (e) => {
        if (!finalDisabled) {
            onFieldChange(sectionName, idKey, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
        }
    };

    const handleFile = (e) => {
        const file = e.target.files ? e.target.files[0] : null;
        if (onFileChange && !finalDisabled) {
            onFileChange(sectionName, idKey, file);
        }
    };

    const renderExistingFileDisplay = () => {
        if (!existingFileUrl) return null;
        let d = existingFileUrl;
        try {
            d = decodeURIComponent(new URL(existingFileUrl).pathname.split('/').pop()) || d;
        } catch (_) {
            if (typeof d === 'string' && d.length > 30) d = d.substring(0, 15) + '...';
        }
        return <span className="text-muted d-block mt-1 existing-file-info"><FaCheckCircle size={12} className="me-1 text-success" />Current: {d}</span>;
    };

    const renderLoanFieldAutoFillSourceInfo = () => {
        if (sectionName !== 'mainLoan' || !isPotentiallyAutoFill || !autoFillSources || autoFillSources.length === 0 || !allDocSchemasForSourceLookup) {
            return null;
        }
        const getDocInfo = (docSchemaIdFromSource) => { 
            let docDisplayName = docSchemaIdFromSource;
            let docKeyForStatus = null; 
            if (allDocSchemasForSourceLookup.docNameToTypeMap) {
                for (const [name, type] of Object.entries(allDocSchemasForSourceLookup.docNameToTypeMap)) {
                    if (type === docSchemaIdFromSource) {
                        docKeyForStatus = name;
                        break;
                    }
                }
            }
            if (docSchemaIdFromSource === AADHAAR_SCHEMA_ID_CONST && allDocSchemasForSourceLookup.aadhaarSchemaDef) {
                docDisplayName = allDocSchemasForSourceLookup.aadhaarSchemaDef.name;
            } else if (docSchemaIdFromSource === PAN_SCHEMA_ID_CONST && allDocSchemasForSourceLookup.panSchemaDef) {
                docDisplayName = allDocSchemasForSourceLookup.panSchemaDef.name;
            } else if(docKeyForStatus) { 
                docDisplayName = docKeyForStatus;
            }
            let statusText = 'Pending Upload/Verification';
            let statusIcon = <FaHourglassStart size={10} className="me-1 text-muted" />;
            const validationState = docKeyForStatus ? docValidationStatus[docKeyForStatus] : null;
            if (autoFilledDetail && autoFilledDetail.verifiedByDocType === docSchemaIdFromSource) {
                statusText = 'Auto-filled';
                statusIcon = <FaCheckCircle size={10} className="me-1 text-success" />;
            } else if (validationState) {
                if (validationState.status === 'verified') {
                    statusText = 'Verified (Data Available)';
                    statusIcon = <UserCheck size={10} className="me-1 text-secondary" />;
                } else if (validationState.status === 'validating' || validationState.status === 'db_lookup') {
                    statusText = 'Validating';
                    statusIcon = <Spinner as="span" animation="border" size="xs" className="me-1 text-info" />;
                } else if (validationState.status === 'error' || validationState.status === 'db_match_not_found') {
                    statusText = 'Verification Error';
                    statusIcon = <UserX size={10} className="me-1 text-danger" />;
                } else if (validationState.status === 'submitted') {
                    statusText = 'Submitted (Pending Verification)';
                    statusIcon = <FaFileUpload size={10} className="me-1 text-primary" />;
                }
            }
            return { name: docDisplayName, statusText, icon: statusIcon };
        };
        return (
            <div className="text-muted small mt-1 autofill-sources-info">
                <strong className="me-1 small">Sources:</strong>
                {autoFillSources.map((sourceStr, index) => {
                    const docSchemaId = sourceStr.split('.')[0]; 
                    const info = getDocInfo(docSchemaId);
                    return (
                        <Badge pill bg="light" text="dark" className="me-1 mb-1 autofill-source-badge" key={index} title={`${info.name}: ${info.statusText}`}>
                            {info.icon} {info.name}
                        </Badge>
                    );
                })}
            </div>
        );
    };

    return (
        <Form.Group 
            as={Row} 
            className={`mb-3 field-renderer-group ${autoFilledClass} ${kycAutoFilledClass} ${potentiallyAutoFillClass}`} 
            controlId={controlId}
        >
            <Form.Label column sm={4} className="field-label">
                {label}
                {sectionName === 'mainLoan' && isAutoFilled && isPotentiallyAutoFill && <FaLock size={12} className="ms-2 text-success autofill-lock-icon" title={`Auto-filled & Verified`} />}
                {promptKey && <div className="text-muted small fst-italic field-prompt">{promptKey}</div>}
                {isPotentiallyAutoFill && sectionName === 'mainLoan' && renderLoanFieldAutoFillSourceInfo()}
            </Form.Label>
            <Col sm={8}>
                {typeKey === 'textarea' ? (
                    <Form.Control as="textarea" rows={3} value={value || ''} onChange={handleChange} required={requiredKey} disabled={finalDisabled} readOnly={isReadOnlyVisually} className={isReadOnlyVisually ? 'is-autofilled' : ''} minLength={minValueKey} maxLength={maxValueKey} isInvalid={showValidationErrors && !!error} />
                ) : typeKey === 'select' || typeKey === 'multiselect' ? (
                    <Form.Select value={value || ''} onChange={handleChange} required={requiredKey} disabled={finalDisabled} className={isReadOnlyVisually ? 'is-autofilled' : ''} isInvalid={showValidationErrors && !!error} multiple={typeKey === 'multiselect'}>
                        <option value="">-- Select --</option>
                        {(optionsKey || []).map((opt, i) => {
                            const optionValue = typeof opt === 'object' ? opt.value : opt;
                            const optionLabel = typeof opt === 'object' ? opt.label : opt;
                            return <option key={i} value={optionValue}>{optionLabel}</option>;
                        })}
                    </Form.Select>
                ) : typeKey === 'checkbox' ? (
                    <Form.Check className='mt-2' type="checkbox" label={promptKey || 'Confirm'} checked={!!value} onChange={handleChange} disabled={finalDisabled} isInvalid={showValidationErrors && !!error} />
                ) : typeKey === 'image' || typeKey === 'document' ? (
                    <>
                        <Form.Control type="file" onChange={handleFile} required={requiredKey && !existingFileUrl} disabled={finalDisabled} accept={typeKey === 'image' ? 'image/jpeg,image/png' : 'application/pdf'} isInvalid={showValidationErrors && !!error} size="sm" />
                        {renderExistingFileDisplay()}
                    </>
                ) : (
                    <Form.Control
                        type={typeKey === 'datetime' ? 'datetime-local' : typeKey === 'time' ? 'time' : typeKey === 'date' ? 'date' : typeKey === 'number' ? 'number' : 'text'}
                        value={value || ''} onChange={handleChange} required={requiredKey} disabled={finalDisabled}
                        min={typeKey === 'number' ? minValueKey : (typeKey === 'date' || typeKey === 'datetime' ? minValueKey : undefined)}
                        max={typeKey === 'number' ? maxValueKey : (typeKey === 'date' || typeKey === 'datetime' ? maxValueKey : undefined)}
                        minLength={typeKey === 'text' ? minValueKey : undefined} maxLength={typeKey === 'text' ? maxValueKey : undefined}
                        step={typeKey === 'number' ? 'any' : undefined} isInvalid={showValidationErrors && !!error}
                        readOnly={isReadOnlyVisually} 
                        className={isReadOnlyVisually ? 'is-autofilled' : ''} 
                    />
                )}
                {showValidationErrors && error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
            </Col>
        </Form.Group>
    );
};

FieldRenderer.propTypes = {
    field: PropTypes.object.isRequired,
    sectionData: PropTypes.object.isRequired,
    onFieldChange: PropTypes.func.isRequired,
    onFileChange: PropTypes.func.isRequired,
    sectionName: PropTypes.string.isRequired,
    error: PropTypes.string,
    disabled: PropTypes.bool,
    existingFileUrl: PropTypes.string,
    isAutoFilled: PropTypes.bool,
    isPotentiallyAutoFill: PropTypes.bool,
    showValidationErrors: PropTypes.bool.isRequired,
    autoFillSources: PropTypes.array,
    autoFilledDetail: PropTypes.object,
    docValidationStatus: PropTypes.object,
    allDocSchemasForSourceLookup: PropTypes.object,
};

export default FieldRenderer;