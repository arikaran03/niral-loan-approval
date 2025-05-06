// src/components/application/ApplicationForm.js

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  Container, Card, Form, Button, Spinner, Row, Col, Alert, ListGroup, Badge, InputGroup
} from 'react-bootstrap';
import { axiosInstance } from '../../config';
import {
    FaInfoCircle, FaDollarSign, FaPercentage, FaCalendarAlt, FaClock, FaCheckCircle,
    FaExclamationTriangle, FaSave, FaCloudUploadAlt, FaTrash, FaPlus, FaEdit, FaListOl, FaFileMedicalAlt, FaRegSave, FaUser, FaHashtag, FaFileSignature, FaFileUpload, FaTimes
} from 'react-icons/fa';
import { ArrowLeft, FileText, XCircle, Check, AlertCircle, Lock } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import "./ApplicationForm.css";

// Define PREDEFINED_DOCUMENTS directly or import if shared
const PREDEFINED_DOCUMENTS = {
    aadhaar: { label: 'Aadhaar Card', fields: [ { key: 'name', label: 'Full Name', prompt: 'Enter full name as on card, return in lowercase'}, { key: 'dob', label: 'Date of Birth', prompt: 'Format YYYY-MM-DD'}, { key: 'aadhaar_number', label: 'Aadhaar Number', prompt: '12 digit number, output the number without any space in-between'}, { key: 'address', label: 'Address', prompt: 'Full address'} ] },
    pan_card: { label: 'PAN Card', fields: [ { key: 'name', label: 'Full Name', prompt: "Enter full name as on card, return in lowercase"}, { key: 'pan_number', label: 'PAN Number', prompt: '10 character PAN, return without any space'}, { key: 'father_name', label: 'Father\'s Name'} ] },
    smart_card: { label: 'Smart Card (e.g., Driving License)', fields: [ { key: 'name', label: 'Full Name'}, { key: 'dob', label: 'Date of Birth'}, { key: 'card_number', label: 'Card Number, return without any space'}, { key: 'valid_until', label: 'Valid Until'} ] },
    bank_statement: { label: 'Bank Statement', fields: [ { key: 'account_number', label: 'Account Number'}, { key: 'ifsc_code', label: 'IFSC Code'}, { key: 'balance', label: 'Closing Balance'}, { key: 'statement_period', label: 'Statement Period'} ] }
};


// --- Helper: FieldRenderer ---
const FieldRenderer = ({ field, value, onChange, error, disabled, onFileChange, existingFileUrl, isAutoFilled, isPotentiallyAutoFill }) => {
    const { field_id, field_label, type, required, options, field_prompt, min_value, max_value } = field;
    const label = `${field_label}${required ? ' *' : ''}`;
    const controlId = `custom_${field_id}`;

    // --- Field Disabling Logic ---
    // Disable if globally disabled OR if it's potentially auto-fillable AND NOT YET verified/filled.
    const isDisabled = disabled || (isPotentiallyAutoFill && !isAutoFilled);
    // Mark as read-only visually only if successfully auto-filled/verified
    const isReadOnlyVisually = isAutoFilled;

    const handleChange = (e) => {
        // Allow change only if not effectively disabled (i.e., not waiting for auto-fill)
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

    const renderExistingFile = () => {
        if (!existingFileUrl) return null; let displayName = existingFileUrl; try { const urlParts = new URL(existingFileUrl); displayName = decodeURIComponent(urlParts.pathname.split('/').pop()) || existingFileUrl; } catch (_) { if (typeof existingFileUrl === 'string' && existingFileUrl.length > 30) { displayName = existingFileUrl.substring(0, 15) + '...'; } } return <span className="text-muted d-block mt-1 existing-file-info"><FaCheckCircle size={12} className="me-1 text-success"/>Current: {displayName}</span>;
     }

    return (
        <Form.Group as={Row} className={`mb-3 field-renderer-group ${isAutoFilled ? 'field-autofilled' : ''} ${isPotentiallyAutoFill && !isAutoFilled ? 'field-potentially-autofill' : ''}`} controlId={controlId}>
            <Form.Label column sm={4} className="field-label">
                {label}
                {isAutoFilled && <Lock size={12} className="ms-2 text-success autofill-lock-icon" title="Auto-filled & Verified"/>}
                {isPotentiallyAutoFill && !isAutoFilled && <FaInfoCircle size={12} className="ms-2 text-info autofill-info-icon" title="Auto-filled after document verification."/>}
                {field_prompt && <div className="text-muted small fst-italic field-prompt">{field_prompt}</div>}
            </Form.Label>
            <Col sm={8}>
                {type === 'textarea' ? (
                    <Form.Control as="textarea" rows={3} value={value || ''} onChange={handleChange} required={required} disabled={isDisabled} readOnly={isReadOnlyVisually} className={isReadOnlyVisually ? 'is-autofilled' : ''} minLength={min_value} maxLength={max_value} isInvalid={!!error}/>
                ) : type === 'select' || type === 'multiselect' ? (
                    <Form.Select value={value || ''} onChange={handleChange} required={required} disabled={isDisabled} className={isReadOnlyVisually ? 'is-autofilled' : ''} isInvalid={!!error}>
                        <option value="">-- Select --</option>
                        {(options || []).map((opt, i) => (<option key={i} value={typeof opt === 'object' ? opt.value : opt}>{typeof opt === 'object' ? opt.label : opt}</option>))}
                    </Form.Select>
                ) : type === 'checkbox' ? (
                     <Form.Check className='mt-2' type="checkbox" label={field_prompt || 'Confirm'} checked={!!value} onChange={handleChange} disabled={isDisabled} isInvalid={!!error}/>
                ) : type === 'image' || type === 'document' ? (
                    <>
                        <Form.Control type="file" onChange={handleFile} required={required && !existingFileUrl} disabled={isDisabled} accept={type === 'image' ? 'image/*' : undefined} isInvalid={!!error} size="sm"/>
                        {renderExistingFile()}
                    </>
                ) : (
                    <Form.Control
                        type={type === 'datetime' ? 'datetime-local' : type === 'time' ? 'time' : type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
                        value={value || ''} onChange={handleChange} required={required} disabled={isDisabled}
                        min={type === 'number' ? min_value : (type === 'date' || type === 'datetime' ? min_value : undefined) }
                        max={type === 'number' ? max_value : (type === 'date' || type === 'datetime' ? max_value : undefined) }
                        minLength={type === 'text' ? min_value : undefined} maxLength={type === 'text' ? max_value : undefined}
                        step={type === 'number' ? 'any' : undefined} isInvalid={!!error}
                        readOnly={isReadOnlyVisually} // Make auto-filled fields read-only visually
                        className={isReadOnlyVisually ? 'is-autofilled' : ''}
                    />
                )}
                {error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
            </Col>
        </Form.Group>
    );
};
FieldRenderer.propTypes = {
    field: PropTypes.object.isRequired, value: PropTypes.any, onChange: PropTypes.func.isRequired,
    error: PropTypes.string, disabled: PropTypes.bool, onFileChange: PropTypes.func,
    existingFileUrl: PropTypes.string, isAutoFilled: PropTypes.bool,
    isPotentiallyAutoFill: PropTypes.bool
};


// --- Main Application Form Component ---
export default function ApplicationForm() {
    const { loanId } = useParams();
    const navigate = useNavigate();

    // State
    const [loanSchemaData, setLoanSchemaData] = useState(null);
    const [formData, setFormData] = useState({});
    const [requiredDocFiles, setRequiredDocFiles] = useState({});
    const [customFieldFiles, setCustomFieldFiles] = useState({});
    const [existingFileRefs, setExistingFileRefs] = useState({});
    const [formErrors, setFormErrors] = useState({});
    const [loading, setLoading] = useState(true);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [draftSaveStatus, setDraftSaveStatus] = useState({ saved: false, time: null });
    const [submissionStatus, setSubmissionStatus] = useState('filling');
    const [apiError, setApiError] = useState("");
    const [autoFillError, setAutoFillError] = useState("");
    const [submissionId, setSubmissionId] = useState(null);
    const [docValidationStatus, setDocValidationStatus] = useState({});
    const [isFormValidForSubmit, setIsFormValidForSubmit] = useState(false);
    const [autoFilledFields, setAutoFilledFields] = useState({}); // Tracks VERIFIED auto-filled fields

    const formRef = useRef(null);

    // --- Helper Functions ---
    const getFieldKeyFromSource = (sourceString) => { if (!sourceString) return null; const p = sourceString.split('.'); return p.length > 1 ? p[p.length - 1] : null; };
    const formatDate = (dateString) => { const date = dateString ? parseISO(dateString) : null; return date && isValid(date) ? format(date, 'MMM d, colorChoice, h:mm a') : 'N/A'; }

    // --- Data Initialization ---
    const initializeForm = useCallback((loanDef, draftData = null) => { /* ... same ... */
        const initialFd = {}; const initialExistingRefs = {}; const customFields = loanDef?.fields || []; const reqDocs = loanDef?.required_documents || [];
        initialFd.amount = draftData?.amount ?? (loanDef?.min_amount || '');
        customFields.forEach(f => { const draftField = draftData?.fields?.find(df => df.field_id === f.field_id); initialFd[f.field_id] = draftField?.value ?? ''; if ((f.type === 'image' || f.type === 'document') && draftField?.value) { initialExistingRefs[f.field_id] = draftField.value; } });
        reqDocs.forEach(doc => { const draftRefKey = `reqDoc_${doc.name}`; if (draftData?.fileReferences?.[draftRefKey]) { initialExistingRefs[draftRefKey] = draftData.fileReferences[draftRefKey]; } });
        setFormData(initialFd); setRequiredDocFiles({}); setCustomFieldFiles({}); setExistingFileRefs(initialExistingRefs); setFormErrors({}); setApiError(""); setAutoFillError(""); setSubmissionStatus('filling'); setSubmissionId(null); setDocValidationStatus({}); setAutoFilledFields({});
     }, []);

    // --- Effect to Load Loan Schema and Draft ---
    useEffect(() => { /* ... same ... */
        if (!loanId) { setApiError("Loan ID is missing."); setLoading(false); return; }; let isMounted = true; setLoading(true);
        const loadData = async () => { try { const loanRes = await axiosInstance.get(`/api/loans/${loanId}`); if (!isMounted) return; const loanDef = loanRes.data; setLoanSchemaData(loanDef); let draftData = null; try { const draftRes = await axiosInstance.get(`/api/application/${loanId}/submissions/draft`); if (!isMounted) return; draftData = draftRes.data; console.log("Draft loaded:", draftData); } catch (draftErr) { if (draftErr.response?.status !== 404) console.error("Error loading draft:", draftErr); } initializeForm(loanDef, draftData); } catch (err) { console.error("Error loading loan definition:", err); if (isMounted) { setApiError(err.response?.data?.error || `Failed to load loan details (ID: ${loanId}).`); setLoanSchemaData(null); } } finally { if (isMounted) { setLoading(false); } } }; loadData(); return () => { isMounted = false; };
     }, [loanId, initializeForm]);

    // --- Input & File Handlers ---
    const handleInputChange = useCallback((fieldId, value) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
        setFormErrors(prev => { if (!prev[fieldId]) return prev; const n = {...prev}; delete n[fieldId]; return n; });
        // If user manually changes a field, remove the auto-filled status
        setAutoFilledFields(prev => { if (!prev[fieldId]) return prev; const n = {...prev}; delete n[fieldId]; return n; });
        if(apiError) setApiError(""); if(autoFillError) setAutoFillError("");
     }, [apiError, autoFillError]);

    const handleCustomFieldFileChange = useCallback((fieldId, file) => { /* ... same ... */
        setCustomFieldFiles(prev => { const n = {...prev}; if (file) n[fieldId] = file; else delete n[fieldId]; return n; });
        setExistingFileRefs(prev => { const n = {...prev}; delete n[fieldId]; return n; });
        handleInputChange(fieldId, file ? file.name : '');
     }, [handleInputChange]);

    // --- Validation Logic ---
    const validateField = useCallback((fieldSchema, value) => { /* ... same ... */
        const { required, type, min_value, max_value, field_label } = fieldSchema; const label = field_label || 'Field';
        if (required && type !== 'image' && type !== 'document') { if (value === null || value === undefined || value === '') return `${label} is required.`; if (type === 'checkbox' && !value) return `${label} must be checked.`; }
        if (!required && (value === null || value === undefined || value === '')) return null;
        switch (type) {
            case 'number': const n = parseFloat(value); if (isNaN(n)) return `${label} must be a valid number.`; if (min_value !== null && min_value !== undefined && n < parseFloat(min_value)) return `${label} must be at least ${min_value}.`; if (max_value !== null && max_value !== undefined && n > parseFloat(max_value)) return `${label} cannot exceed ${max_value}.`; break;
            case 'text': case 'textarea': const s = String(value || ''); if (min_value !== null && min_value !== undefined && s.length < parseInt(min_value, 10)) return `${label} must be at least ${min_value} characters long.`; if (max_value !== null && max_value !== undefined && s.length > parseInt(max_value, 10)) return `${label} cannot exceed ${max_value} characters.`; break;
            case 'date': case 'datetime': if (value && isNaN(Date.parse(value))) return `${label} must be a valid date.`; if (min_value && value && new Date(value) < new Date(min_value)) return `${label} cannot be earlier than ${format(new Date(min_value), 'P')}.`; if (max_value && value && new Date(value) > new Date(max_value)) return `${label} cannot be later than ${format(new Date(max_value), 'P')}.`; break;
            default: break;
        } return null;
     }, []);

   const runFullValidation = useCallback(() => { /* ... same validation logic ... */
        const errors = {}; let isValid = true;
        if (!loanSchemaData) return false;
        if (!formData.amount || isNaN(formData.amount) || Number(formData.amount) <= 0) { errors['amount'] = 'A valid positive amount is required.'; isValid = false; } else if (loanSchemaData.min_amount !== null && Number(formData.amount) < loanSchemaData.min_amount) { errors['amount'] = `Amount must be at least ₹${loanSchemaData.min_amount?.toLocaleString('en-IN')}.`; isValid = false; } else if (loanSchemaData.max_amount !== null && Number(formData.amount) > loanSchemaData.max_amount) { errors['amount'] = `Amount cannot exceed ₹${loanSchemaData.max_amount?.toLocaleString('en-IN')}.`; isValid = false; }
        loanSchemaData.fields.forEach(f => { const error = validateField(f, formData[f.field_id]); if (error) { errors[f.field_id] = error; isValid = false; } });
        loanSchemaData.required_documents.forEach(doc => { const docKey = `reqDoc_${doc.name}`; const hasUploadedFile = !!requiredDocFiles[doc.name]; const hasExistingFile = !!existingFileRefs[docKey]; if (!hasUploadedFile && !hasExistingFile) { errors[docKey] = `${doc.name} is required.`; isValid = false; } else { const statusInfo = docValidationStatus[doc.name]; if (!statusInfo || statusInfo.status !== 'verified') { errors[docKey] = `${doc.name} requires successful verification.`; isValid = false; } } });
        setFormErrors(errors); return isValid;
   }, [formData, loanSchemaData, requiredDocFiles, existingFileRefs, docValidationStatus, validateField]);

    // Effect to update submit button disabled state
    useEffect(() => { setIsFormValidForSubmit(runFullValidation()); }, [runFullValidation]);


    // --- Auto-Fill / Entity Extraction Logic ---
    const DOC_NAME_TO_TYPE_MAP = { /* ... same mapping ... */ 'Aadhaar Card': 'aadhaar', 'PAN Card': 'pan_card', 'Smart Card (e.g., Driving License)': 'smart_card', 'Bank Statement': 'bank_statement' };
    const triggerEntityExtraction = useCallback(async (docName, file, docTypePrefix) => {
        const docType = DOC_NAME_TO_TYPE_MAP[docName];
        if (!docType) { /* ... handle mapping error ... */ return; }

        console.log(`Triggering entity extraction for ${docName} (type: ${docType})`);
        setDocValidationStatus(prev => ({ ...prev, [docName]: { status: 'validating', mismatches: null } }));
        setAutoFillError(''); setApiError('');

        // Prepare the fields schema for the specific document type
        const docFieldsSchema = PREDEFINED_DOCUMENTS[docType]?.fields || [];
        if (docFieldsSchema.length === 0) {
             console.error(`No predefined fields found for docType: ${docType}`);
             setDocValidationStatus(prev => ({ ...prev, [docName]: { status: 'error', mismatches: [{ fieldLabel: 'Config Error', expected: '', actual: 'No fields defined for this doc type.' }] } }));
             return;
        }
        const fieldsPayload = JSON.stringify({
            label: PREDEFINED_DOCUMENTS[docType]?.label || docName,
            fields: docFieldsSchema.map(f => ({ key: f.key, label: f.label, prompt: f.prompt || '' })) // Send key, label, prompt
        });


        try {
            const apiFormData = new FormData();
            apiFormData.append('document', file);
            apiFormData.append('docType', docType);
            apiFormData.append('fields', fieldsPayload); // Send the relevant fields schema

            // *** ACTUAL API CALL ***
            console.log("Sending to /extract-entity:", { docType, fields: fieldsPayload });
            const response = await axiosInstance.post('/api/application/extract-entity', apiFormData, { headers: { 'Content-Type': 'multipart/form-data' } });
            const extractedPairs = response.data; if (!Array.isArray(extractedPairs)) { throw new Error("Invalid response format from extraction API."); }
            const extractedData = extractedPairs.reduce((acc, pair) => { if (pair.key) acc[pair.key] = pair.value; return acc; }, {});
            console.log("Extracted Data:", extractedData);
            // *** END API CALL ***

            // --- Strict Cross-Validation and Auto-Fill ---
            const mismatches = []; let canProceedWithFill = true;
            // Phase 1: Check mismatches against VERIFIED fields
            loanSchemaData?.fields.forEach(targetField => {
                const relevantSource = targetField.auto_fill_sources?.find(source => source.startsWith(`${docType}.`));
                if (relevantSource) {
                    const sourceKey = getFieldKeyFromSource(relevantSource);
                    if (sourceKey && extractedData.hasOwnProperty(sourceKey)) {
                        const extractedValueStr = String(extractedData[sourceKey] ?? '');
                        const targetFieldId = targetField.field_id;
                        // Check only if the target field was previously verified/auto-filled
                        if (autoFilledFields[targetFieldId]) {
                             const existingValueStr = String(formData[targetFieldId] ?? ''); // Get current value from formData
                             if (existingValueStr !== extractedValueStr) {
                                mismatches.push({ fieldLabel: targetField.field_label, expected: existingValueStr, actual: extractedValueStr });
                                canProceedWithFill = false;
                             }
                        }
                    }
                }
            });

            // Phase 2: Fill if no mismatches
            if (canProceedWithFill) {
                let updated = false;
                const currentAutoFilled = { ...autoFilledFields };
                setFormData(currentFormData => {
                    const fieldsToUpdate = { ...currentFormData };
                    loanSchemaData?.fields.forEach(targetField => {
                        const relevantSource = targetField.auto_fill_sources?.find(source => source.startsWith(`${docType}.`));
                        if (relevantSource) {
                            const sourceKey = getFieldKeyFromSource(relevantSource);
                            if (sourceKey && extractedData.hasOwnProperty(sourceKey)) {
                                const extractedValue = String(extractedData[sourceKey] ?? '');
                                const targetFieldId = targetField.field_id;
                                const existingValue = String(currentFormData[targetFieldId] ?? '');
                                // Fill only if empty
                                if (existingValue === '') {
                                    fieldsToUpdate[targetFieldId] = extractedValue;
                                    currentAutoFilled[targetFieldId] = true; // Mark as verified
                                    updated = true;
                                } else if (existingValue === extractedValue) {
                                     currentAutoFilled[targetFieldId] = true; // Also mark as verified if matches
                                }
                            }
                        }
                    });
                    return updated ? fieldsToUpdate : currentFormData;
                });
                setAutoFilledFields(currentAutoFilled);
                setDocValidationStatus(prev => ({ ...prev, [docName]: { status: 'verified', mismatches: null } }));
                console.log(`${docName} verified successfully.`);
            } else {
                // Mismatches found
                setDocValidationStatus(prev => ({ ...prev, [docName]: { status: 'error', mismatches: mismatches } }));
                setAutoFillError(`Data mismatches found for ${docName}. Values not auto-filled. Please review.`);
                console.error(`${docName} verification failed due to mismatches.`);
            }

        } catch (error) {
            console.error(`Entity extraction failed for ${docName}:`, error); const errorMsg = error.response?.data?.error || 'Failed to process document.';
            setDocValidationStatus(prev => ({ ...prev, [docName]: { status: 'error', mismatches: [{ fieldLabel: 'Processing Error', expected: '', actual: errorMsg }] } }));
            setApiError(`Error processing ${docName}: ${errorMsg}`);
        }
     }, [loanSchemaData, formData, autoFilledFields]); // Dependencies

     // Re-define handleRequiredDocFileChange using useCallback
     const handleRequiredDocFileChangeCallback = useCallback((docName, file) => {
         setRequiredDocFiles(prev => { const n = {...prev}; if (file) n[docName] = file; else delete n[docName]; return n; }); const refKey = `reqDoc_${docName}`; setExistingFileRefs(prev => { const n = {...prev}; delete n[refKey]; return n; });
        if (file) { let docTypePrefix = null; const ldn = docName.toLowerCase(); if (ldn.includes('aadhaar')) docTypePrefix = 'aadhaar.'; else if (ldn.includes('pan')) docTypePrefix = 'pan_card.'; else if (ldn.includes('smart card')) docTypePrefix = 'smart_card.'; else if (ldn.includes('bank statement')) docTypePrefix = 'bank_statement.'; if (docTypePrefix) { triggerEntityExtraction(docName, file, docTypePrefix); } }
        else { setDocValidationStatus(prev => { const n = {...prev}; delete n[docName]; return n; }); }
     }, [triggerEntityExtraction]);


    // --- Save Draft ---
    const saveDraft = useCallback(async () => { /* ... same logic ... */
        if (!loanId || !loanSchemaData || isSavingDraft) return; setIsSavingDraft(true); setApiError(""); console.log("Saving draft...");
        try {
            const payloadFields = loanSchemaData.fields.map(f => ({ field_id: f.field_id, field_label: f.field_label, type: f.type, value: (f.type === 'image' || f.type === 'document') ? (existingFileRefs[f.field_id] || (customFieldFiles[f.field_id] ? `local:${customFieldFiles[f.field_id].name}`: '')) : (formData[f.field_id] || '') }));
            const requiredDocRefs = {}; loanSchemaData.required_documents.forEach(doc => { const key = `reqDoc_${doc.name}`; if (existingFileRefs[key]) requiredDocRefs[key] = existingFileRefs[key]; else if (requiredDocFiles[doc.name]) requiredDocRefs[key] = `local:${requiredDocFiles[doc.name].name}`; });
            const payload = { amount: Number(formData.amount) || 0, fields: payloadFields, fileReferences: requiredDocRefs };
            const response = await axiosInstance.post(`/api/application/${loanId}/submissions/draft`, payload);
            setDraftSaveStatus({ saved: true, time: new Date() }); setExistingFileRefs(response.data?.fileReferences || {}); setTimeout(() => setDraftSaveStatus({ saved: false, time: null }), 3000); console.log("Draft saved.");
        } catch (err) { console.error("Error saving draft:", err); setApiError(err.response?.data?.error || "Draft save failed."); }
        finally { setIsSavingDraft(false); }
     }, [loanId, loanSchemaData, formData, customFieldFiles, requiredDocFiles, existingFileRefs, isSavingDraft]);


   // --- Submit Logic ---
    const handleSubmit = (e) => { /* ... same logic ... */
       e.preventDefault(); setApiError(""); setAutoFillError("");
       if(runFullValidation()) { submitApplication(); }
       else { console.log("Form validation failed on submit.", formErrors); alert("Please fill all required fields, upload required documents, and resolve any data mismatches before submitting."); window.scrollTo(0, 0); }
   };
   const submitApplication = async () => { /* ... same file upload and submission logic ... */
        if (isSubmitting) return; setIsSubmitting(true); setApiError(""); console.log("Submitting application...");
        try {
            const filesToUpload = []; Object.entries(customFieldFiles).forEach(([k, f]) => filesToUpload.push({ key: k, file: f, type: 'custom' })); Object.entries(requiredDocFiles).forEach(([n, f]) => filesToUpload.push({ key: `reqDoc_${n}`, file: f, type: 'required' }));
            const uploadedFileRefs = { ...existingFileRefs };
            const uploadPromises = filesToUpload.map(async ({ key, file, type }) => { const fieldSchema = type === 'custom' ? loanSchemaData?.fields.find(f => f.field_id === key) : null; const fileType = fieldSchema?.type || 'document'; const uploadUrl = fileType === 'image' ? "/api/image/upload" : "/api/document/upload"; const fieldLabel = fieldSchema?.field_label || key.replace('reqDoc_',''); console.log(`Uploading ${fileType} for ${key}...`); const fileFormData = new FormData(); fileFormData.append("file", file); try { const { data: uploadResult } = await axiosInstance.post(uploadUrl, fileFormData, { headers: { "Content-Type": "multipart/form-data" } }); uploadedFileRefs[key] = uploadResult.id || uploadResult.url || uploadResult._id; console.log(`Upload success for ${key}: ${uploadedFileRefs[key]}`); } catch (uploadError) { console.error(`Failed to upload file for ${key}:`, uploadError); throw new Error(`Failed to upload ${fieldLabel}. ${uploadError.response?.data?.error || ''}`); } });
            await Promise.all(uploadPromises); console.log("All new files uploaded. Final File Refs:", uploadedFileRefs);
            const finalSubmissionFields = loanSchemaData.fields.map(f => ({ field_id: f.field_id, field_label: f.field_label, type: f.type, value: (f.type === 'image' || f.type === 'document') ? (uploadedFileRefs[f.field_id] || '') : (formData[f.field_id] || '') }));
            const finalRequiredDocsRefs = {}; loanSchemaData.required_documents.forEach(doc => { const key = `reqDoc_${doc.name}`; if(uploadedFileRefs[key]) finalRequiredDocsRefs[doc.name] = uploadedFileRefs[key]; });
            const submissionPayload = { amount: Number(formData.amount), fields: finalSubmissionFields, /* requiredDocumentReferences: finalRequiredDocsRefs */ };
            console.log("Final Submission Payload:", submissionPayload);
            const { data: submissionResult } = await axiosInstance.post(`/api/application/${loanId}/submissions`, submissionPayload);
            const newId = submissionResult._id || submissionResult.id; setSubmissionId(newId); console.log("Submission successful:", newId);
            setSubmissionStatus('submitted');
        } catch (err) { console.error("Submission failed:", err); setApiError(err.message || err.response?.data?.error || "Submission failed. Please try again."); setSubmissionStatus('filling'); window.scrollTo(0, 0); }
        finally { setIsSubmitting(false); }
    };


    // --- Render Helpers ---
    const getDocStatusBadge = (docName) => { /* ... same ... */
        const refKey = `reqDoc_${docName}`; const hasNew = !!requiredDocFiles[docName]; const hasExisting = !!existingFileRefs[refKey]; const statusInfo = docValidationStatus[docName];
        if (statusInfo?.status === 'validating') return <Badge bg="light" text="dark" className="status-badge validating"><Spinner animation="border" size="sm" className="me-1"/> Validating...</Badge>;
        if (statusInfo?.status === 'verified') return <Badge bg="success-subtle" text="success-emphasis" className="status-badge verified"><Check size={14} className="me-1"/> Verified</Badge>;
        if (statusInfo?.status === 'error') return <Badge bg="danger-subtle" text="danger-emphasis" className="status-badge error"><AlertCircle size={14} className="me-1"/> Error</Badge>;
        if (hasNew) return <Badge bg="info-subtle" text="info-emphasis" className="status-badge">New File</Badge>;
        if (hasExisting) return <Badge bg="secondary-subtle" text="secondary-emphasis" className="status-badge">Uploaded</Badge>;
        if (formErrors[refKey]) return <Badge bg="danger-subtle" text="danger-emphasis" className="status-badge error">Missing</Badge>;
        return <Badge bg="light" text="dark" className="status-badge">Pending</Badge>;
     }


  // --- Main Render Logic ---
    if (loading) { /* ... loading ... */ return <Container fluid className="d-flex flex-column justify-content-center align-items-center page-loading-container"> <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} /> <p className="mt-3 text-muted fs-5">Loading Application Details...</p> </Container>; }
    if (!loanSchemaData && !loading) { /* ... error loading schema ... */ return <Container className="mt-5"><Alert variant="danger">{apiError || 'Could not load loan details.'}</Alert></Container>; }
    if (submissionStatus === 'submitted') { /* ... success screen ... */ return <Container className="mt-5 text-center"><Alert variant="success" className="shadow-sm"><h3><FaCheckCircle className="me-2"/>Application Submitted!</h3><p>Your application for "{loanSchemaData?.title}" has been received.</p><p>Submission ID: <strong>{submissionId}</strong></p><hr/><Button variant="primary" size="sm" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button></Alert></Container>; }


    return (
        <Container fluid className="my-4 application-form-container p-md-4">
             {/* Loan Info Header Card */}
             <Card className="shadow-sm mb-4 loan-info-card">
                <Card.Body>
                    <Row className="align-items-center">
                        <Col>
                            <h3 className="mb-1 loan-info-title">Apply for: <span className="text-primary fw-bold">{loanSchemaData.title}</span></h3>
                            {loanSchemaData.description && <div className="text-muted loan-info-description" dangerouslySetInnerHTML={{ __html: loanSchemaData.description }} />}
                        </Col>
                        <Col xs="auto" className="text-end loan-info-quick-details">
                            <div className="mb-1"><small className="text-muted">Rate:</small> <strong className="text-success">{loanSchemaData.interest_rate}%</strong></div>
                            <div><small className="text-muted">Max Tenure:</small> <strong>{loanSchemaData.tenure_months} mo</strong></div>
                        </Col>
                    </Row>
                     <div className="eligibility-info mt-3 pt-3 border-top">
                        <h6 className="eligibility-title mb-2">Eligibility Highlights:</h6>
                        <Badge pill bg="light" text="dark" className="me-2 mb-1 eligibility-badge">Min Age: {loanSchemaData.eligibility.min_age}</Badge>
                        {loanSchemaData.eligibility.max_age && <Badge pill bg="light" text="dark" className="me-2 mb-1 eligibility-badge">Max Age: {loanSchemaData.eligibility.max_age}</Badge>}
                        <Badge pill bg="light" text="dark" className="me-2 mb-1 eligibility-badge">Min Income: ₹{loanSchemaData.eligibility.min_income?.toLocaleString('en-IN')}</Badge>
                         {loanSchemaData.eligibility.min_credit_score && <Badge pill bg="light" text="dark" className="mb-1 eligibility-badge">Min C. Score: {loanSchemaData.eligibility.min_credit_score}</Badge>}
                    </div>
                </Card.Body>
            </Card>

            {/* Main Application Form Card */}
            <Card className="shadow-sm application-details-card">
                <Card.Header className="bg-light">
                    <h4 className="mb-0 card-form-title">Your Application Details</h4>
                </Card.Header>
                <Card.Body className="p-4">
                    {apiError && <Alert variant="danger" className="api-error-alert" onClose={() => setApiError("")} dismissible>{apiError}</Alert>}
                    {autoFillError && <Alert variant="warning" className="autofill-error-alert" onClose={() => setAutoFillError("")} dismissible><strong>Data Mismatch Found:</strong> {autoFillError}</Alert>}

                    <Form ref={formRef} onSubmit={handleSubmit} noValidate>
                        {/* Amount Field */}
                        <Form.Group as={Row} className="mb-4 align-items-center" controlId="amount">
                            <Form.Label column sm={3} className="fw-bold form-section-label">Loan Amount Requested*</Form.Label>
                            <Col sm={9}>
                                <InputGroup>
                                    <InputGroup.Text>₹</InputGroup.Text>
                                    <Form.Control type="number" value={formData.amount || ''} onChange={(e) => handleInputChange("amount", e.target.value)} required min={loanSchemaData.min_amount} max={loanSchemaData.max_amount} step="any" disabled={isSubmitting || isSavingDraft} isInvalid={!!formErrors.amount}/>
                                    <Form.Control.Feedback type="invalid">{formErrors.amount}</Form.Control.Feedback>
                                </InputGroup>
                                <Form.Text className="text-muted d-block mt-1"> Min: ₹{loanSchemaData.min_amount?.toLocaleString('en-IN')}, Max: ₹{loanSchemaData.max_amount?.toLocaleString('en-IN')} </Form.Text>
                            </Col>
                        </Form.Group>

                        {/* Custom Fields Section */}
                        {loanSchemaData.fields.length > 0 && <><hr className="my-4"/><h5 className='mb-3 section-title'>Additional Information</h5></>}
                        {loanSchemaData.fields.map((field) => (
                             <FieldRenderer
                                key={field.field_id} field={field} value={formData[field.field_id]}
                                onChange={handleInputChange} onFileChange={handleCustomFieldFileChange}
                                error={formErrors[field.field_id]} disabled={isSubmitting || isSavingDraft}
                                existingFileUrl={existingFileRefs[field.field_id]}
                                isAutoFilled={!!autoFilledFields[field.field_id]}
                                isPotentiallyAutoFill={field.auto_fill_sources && field.auto_fill_sources.length > 0}
                            />
                        ))}

                        {/* Required Documents Section */}
                        {loanSchemaData.required_documents.length > 0 && <><hr className="my-4"/><h5 className='mb-3 section-title'>Required Documents</h5></>}
                        <ListGroup variant="flush" className='mb-4 required-docs-listgroup'>
                             {loanSchemaData.required_documents.map((doc) => {
                                 const docKey = `reqDoc_${doc.name}`; const docStatusInfo = docValidationStatus[doc.name];
                                 const hasExisting = !!existingFileRefs[docKey]; const hasNew = !!requiredDocFiles[doc.name];
                                 const fileInputError = formErrors[docKey];
                                 return (
                                    <ListGroup.Item key={doc.name} className={`required-doc-item p-3 border rounded mb-3 ${fileInputError ? 'border-danger is-invalid-doc' : ''} ${docStatusInfo?.status === 'error' ? 'doc-error' : ''}`}>
                                        <Row className="align-items-center g-3">
                                            <Col md={4} className="doc-info"> <strong className="d-block">{doc.name} *</strong> <small className="text-muted d-block">{doc.description}</small> </Col>
                                            <Col md={5} className="doc-input">
                                                <Form.Control type="file" id={docKey} onChange={(e) => handleRequiredDocFileChangeCallback(doc.name, e.target.files ? e.target.files[0] : null)} disabled={isSubmitting || isSavingDraft || docStatusInfo?.status === 'validating'} isInvalid={!!fileInputError || docStatusInfo?.status === 'error'} size="sm"/>
                                                {hasExisting && !hasNew && <small className='text-success d-block mt-1'><FaCheckCircle size={12} className="me-1"/>Current file uploaded.</small>}
                                                {hasNew && <small className='text-info d-block mt-1'><FaFileUpload size={12} className="me-1"/>New: {requiredDocFiles[doc.name]?.name}</small>}
                                                {fileInputError && !docStatusInfo?.mismatches && <small className="text-danger d-block mt-1">{fileInputError}</small>}
                                            </Col>
                                            <Col md={3} className="doc-status text-md-end"> {getDocStatusBadge(doc.name)} </Col>
                                        </Row>
                                         {docStatusInfo?.status === 'error' && docStatusInfo.mismatches && (
                                            <Alert variant="danger" className="mismatches mt-2 p-2 small">
                                                <strong className="d-block mb-1"><FaExclamationTriangle size={14} className="me-1"/> Data Mismatch:</strong>
                                                {docStatusInfo.mismatches.map((mm, idx) => ( <div key={idx} className="mismatch-item"> - <strong>{mm.fieldLabel}:</strong> Expected "<code>{mm.expected || '(empty)'}</code>", Found "<code>{mm.actual}</code>" </div> ))}
                                            </Alert>
                                         )}
                                    </ListGroup.Item>
                                 );
                             })}
                        </ListGroup>

                        {/* Action Buttons */}
                        <Row>
                            <Col className="d-flex justify-content-end pt-3 mt-3 border-top">
                                <Button type="button" variant={draftSaveStatus.saved ? "outline-success" : "outline-secondary"} className="me-2 save-draft-button" onClick={saveDraft} disabled={isSavingDraft || isSubmitting}>
                                    {isSavingDraft ? <><Spinner as="span" animation="border" size="sm" /> Saving...</> : (draftSaveStatus.saved ? <><FaCheckCircle className="me-1"/>Draft Saved</> : <><FaRegSave className="me-1"/>Save Draft</>)}
                                </Button>
                                <Button
                                    type="submit" variant="primary" className="submit-button"
                                    disabled={isSubmitting || isSavingDraft || !isFormValidForSubmit}
                                    title={!isFormValidForSubmit ? "Please fix validation errors and verify all documents" : "Submit Application"}
                                >
                                    {isSubmitting ? <><Spinner as="span" animation="border" size="sm" className="me-1"/> Submitting...</> : <><FaCloudUploadAlt className="me-1"/>Submit Application</>}
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                </Card.Body>
            </Card>
        </Container>
    );
}