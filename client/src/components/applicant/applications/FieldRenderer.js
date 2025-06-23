import PropTypes from 'prop-types';
import { Row, Col, Form, Badge } from 'react-bootstrap';
import { Lock } from 'react-bootstrap-icons';
import { FaCheckCircle, FaExclamationTriangle, FaFileUpload, FaHourglassStart, FaQuestionCircle } from 'react-icons/fa';
import { Spinner } from 'react-bootstrap';


// --- Helper: FieldRenderer (Placeholder if not imported - replace with your actual component) ---
const FieldRenderer = ({
    field, value, onChange, error, disabled, onFileChange, existingFileUrl,
    isAutoFilled, isPotentiallyAutoFill, showValidationErrors,
    autoFillSources, autoFilledDetail, docValidationStatus, allDocSchemasForSourceLookup,
    requiredDocFiles,
}) => {
    const { field_id, field_label, type, required, options, field_prompt, min_value, max_value } = field;
    const label = `${field_label}${required ? ' *' : ''}`;
    const controlId = `custom_${field_id}`;

    const isDisabled = disabled || (isPotentiallyAutoFill && !isAutoFilled);
    const isReadOnlyVisually = isAutoFilled;

    const handleChange = (e) => {
        if (!isDisabled) {
            onChange(field_id, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
        }
    };

    const handleFile = (e) => {
        const file = e.target.files ? e.target.files[0] : null;
        if (onFileChange && !isDisabled) {
            onFileChange(field_id, file);
        }
    };

    const renderExistingFile = () => { if (!existingFileUrl) return null; let d = existingFileUrl; try { d = decodeURIComponent(new URL(existingFileUrl).pathname.split('/').pop())||d; } catch (_) { if(typeof d==='string'&&d.length>30) d=d.substring(0,15)+'...';} return <span className="text-muted d-block mt-1 existing-file-info"><FaCheckCircle size={12} className="me-1 text-success"/>Current: {d}</span>; };

    const renderAutoFillSourceInfo = () => {
        if (!isPotentiallyAutoFill || !autoFillSources || autoFillSources.length === 0 || (!allDocSchemasForSourceLookup?.documentDefinitions && !allDocSchemasForSourceLookup?.aadhaar_card_definition && !allDocSchemasForSourceLookup?.pan_card_definition) ) {
            return null;
        }
        const getDefinition = (docTypeKey) => {
            if (docTypeKey === 'aadhaar_card' && allDocSchemasForSourceLookup.aadhaar_card_definition) return allDocSchemasForSourceLookup.aadhaar_card_definition;
            if (docTypeKey === 'pan_card' && allDocSchemasForSourceLookup.pan_card_definition) return allDocSchemasForSourceLookup.pan_card_definition;
            return allDocSchemasForSourceLookup.documentDefinitions?.[docTypeKey];
        }


        const getDocInfo = (docTypeKeyFromSource) => { 
            const docDefinition = getDefinition(docTypeKeyFromSource);
            const docDisplayName = docDefinition?.label || docTypeKeyFromSource;
            const docKeyForStatus = docTypeKeyFromSource;
            let statusText = 'Pending Upload';
            let statusKey = 'pending_upload';
            let icon = <FaHourglassStart size={10} className="me-1 text-muted" />;
            const validationState = docValidationStatus[docKeyForStatus];
            const isUploaded = (requiredDocFiles && requiredDocFiles[docKeyForStatus]) ||
                               (allDocSchemasForSourceLookup.existingGlobalFileRefs && allDocSchemasForSourceLookup.existingGlobalFileRefs[`reqDoc_${docKeyForStatus}`]);

            if (autoFilledDetail && autoFilledDetail.verifiedByDocType === docTypeKeyFromSource) {
                statusText = 'Auto-filled'; statusKey = 'autofilled_used';
                icon = <FaCheckCircle size={10} className="me-1 text-success" />;
            } else if (validationState) {
                if (validationState.status === 'verified') {
                    statusText = 'Verified'; statusKey = 'verified_not_used';
                    icon = <FaCheckCircle size={10} className="me-1 text-secondary" />;
                } else if (validationState.status === 'validating') {
                    statusText = 'Validating'; statusKey = 'validating';
                    icon = <Spinner as="span" animation="border" size="xs" className="me-1 text-info" />;
                } else if (validationState.status === 'error') {
                    statusText = 'Error'; statusKey = 'error';
                    icon = <FaExclamationTriangle size={10} className="me-1 text-danger" />;
                } else if (isUploaded) {
                    statusText = 'Uploaded'; statusKey = 'uploaded_pending_verification';
                    icon = <FaFileUpload size={10} className="me-1 text-primary" />;
                }
            } else if (isUploaded) {
                statusText = 'Uploaded'; statusKey = 'uploaded_pending_verification';
                icon = <FaFileUpload size={10} className="me-1 text-primary" />;
            } else if (!docDefinition) { 
                 statusText = 'Source Info N/A'; statusKey = 'info_na';
                 icon = <FaQuestionCircle size={10} className="me-1 text-warning" />;
            }
            return { name: docDisplayName, statusText, icon, statusKey };
        };

        return (
            <div className="text-muted small mt-1 autofill-sources-info">
                <strong className="me-1 small">Expected from:</strong>
                {autoFillSources.map((sourceStr, index) => {
                    const docTypeKey = sourceStr.split('.')[0]; 
                    const info = getDocInfo(docTypeKey);
                    return (
                        <Badge pill bg="light" text="dark" className="me-1 mb-1 autofill-source-badge" key={index} title={`${info.name}: ${info.statusText}`}>
                            {info.icon} {info.name}
                            {info.statusKey === 'autofilled_used' && <span className="fw-bold"> (Used)</span>}
                        </Badge>
                    );
                })}
            </div>
        );
    };

    const getAutoFillSourceDocLabel = () => {
        if (isAutoFilled && autoFilledDetail) {
            const typeKey = autoFilledDetail.verifiedByDocType;
            let docDefinition;
            if (typeKey === 'aadhaar_card' && allDocSchemasForSourceLookup.aadhaar_card_definition) docDefinition = allDocSchemasForSourceLookup.aadhaar_card_definition;
            else if (typeKey === 'pan_card' && allDocSchemasForSourceLookup.pan_card_definition) docDefinition = allDocSchemasForSourceLookup.pan_card_definition;
            else docDefinition = allDocSchemasForSourceLookup?.documentDefinitions?.[typeKey];
            return docDefinition?.label || typeKey;
        }
        return "auto-verified source";
    };
    
    const formatDateToYYYYMMDDHelper = (dateStr) => { 
        if (!dateStr || typeof dateStr !== "string") return dateStr;
        const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (!match) return dateStr; 
        const [_, day, month, year] = match;
        return `${year}-${month}-${day}`;
    };


    return (
        <Form.Group as={Row} className={`mb-3 field-renderer-group ${isAutoFilled ? 'field-autofilled' : ''} ${isPotentiallyAutoFill && !isAutoFilled ? 'field-potentially-autofill' : ''}`} controlId={controlId}>
            <Form.Label column sm={4} className="field-label">
                {label}
                {isAutoFilled && <Lock size={12} className="ms-2 text-success autofill-lock-icon" title={`Auto-filled & Verified by ${getAutoFillSourceDocLabel()}`}/>}
                {field_prompt && <div className="text-muted small fst-italic field-prompt">{field_prompt}</div>}
                {isPotentiallyAutoFill && renderAutoFillSourceInfo()}
            </Form.Label>
            <Col sm={8}>
                {type === 'textarea' ? (
                    <Form.Control as="textarea" rows={3} value={value || ''} onChange={handleChange} required={required} disabled={isDisabled} readOnly={isReadOnlyVisually} className={isReadOnlyVisually ? 'is-autofilled' : ''} minLength={min_value} maxLength={max_value} isInvalid={showValidationErrors && !!error}/>
                ) : type === 'select' || type === 'multiselect' ? (
                    <Form.Select value={value || (type === 'multiselect' ? [] : '')} onChange={handleChange} required={required} disabled={isDisabled} className={isReadOnlyVisually ? 'is-autofilled' : ''} isInvalid={showValidationErrors && !!error} multiple={type === 'multiselect'}>
                        <option value="">-- Select --</option>
                        {(options[0].split(",") || []).map((opt, i) => (<option key={i} value={typeof opt === 'object' ? opt.value : opt}>{typeof opt === 'object' ? opt.label : opt}</option>))}
                    </Form.Select>
                ) : type === 'checkbox' ? (
                     <Form.Check className='mt-2' type="checkbox" label={field_prompt || 'Confirm'} checked={!!value} onChange={handleChange} disabled={isDisabled} isInvalid={showValidationErrors && !!error}/>
                ) : type === 'image' || type === 'document' ? (
                    <>
                        <Form.Control type="file" onChange={handleFile} required={required && !existingFileUrl} disabled={isDisabled} accept={type === 'image' ? 'image/*' : undefined} isInvalid={showValidationErrors && !!error} size="sm"/>
                        {renderExistingFile()}
                    </>
                ) : (
                    <Form.Control
                        type={type === 'datetime' ? 'datetime-local' : type === 'time' ? 'time' : type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
                        onWheel={(e) => e.target.blur()}
                        value={value || ''} onChange={handleChange} required={required} disabled={isDisabled}
                        min={type === 'number' ? min_value : (type === 'date' ? formatDateToYYYYMMDDHelper(min_value) : (type === 'datetime-local' ? min_value : undefined) )} 
                        max={type === 'number' ? max_value : (type === 'date' ? formatDateToYYYYMMDDHelper(max_value) : (type === 'datetime-local' ? max_value : undefined) )}
                        minLength={type === 'text' || type === 'textarea' ? min_value : undefined} 
                        maxLength={type === 'text' || type === 'textarea' ? max_value : undefined} 
                        step={type === 'number' ? 'any' : undefined} isInvalid={showValidationErrors && !!error}
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
    field: PropTypes.object.isRequired, value: PropTypes.any, onChange: PropTypes.func.isRequired,
    error: PropTypes.string, disabled: PropTypes.bool, onFileChange: PropTypes.func,
    existingFileUrl: PropTypes.string, isAutoFilled: PropTypes.bool,
    isPotentiallyAutoFill: PropTypes.bool,
    showValidationErrors: PropTypes.bool.isRequired,
    autoFillSources: PropTypes.array,
    autoFilledDetail: PropTypes.object,
    docValidationStatus: PropTypes.object,
    allDocSchemasForSourceLookup: PropTypes.shape({
        documentDefinitions: PropTypes.object, 
        aadhaar_card_definition: PropTypes.object, 
        pan_card_definition: PropTypes.object,     
        required: PropTypes.array, 
        existingGlobalFileRefs: PropTypes.object
    }),
    requiredDocFiles: PropTypes.object,
};

export default FieldRenderer;