// src/components/admin/FormBuilder.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Form, Button, Card, Row, Col, Spinner, InputGroup, ListGroup, Badge, Alert
} from 'react-bootstrap';
import {
    FaInfoCircle, FaDollarSign, FaPercentage, FaCalendarAlt, FaClock, FaCheckCircle,
    FaExclamationTriangle, FaSave, FaCloudUploadAlt, FaTrash, FaPlus, FaEdit, FaListOl, FaFileMedicalAlt, FaRegSave, FaRedo
} from 'react-icons/fa';

// Assuming LoanFormBuilder.css exists in the same directory or path is correct
import './LoanFormBuilder.css';

// --- Configs & Helpers ---
const PREDEFINED_DOCUMENTS = {
    aadhaar: { label: 'Aadhaar Card', fields: [ { key: 'name', label: 'Full Name'}, { key: 'dob', label: 'Date of Birth'}, { key: 'aadhaar_number', label: 'Aadhaar Number'}, { key: 'address', label: 'Address'} ] },
    pan_card: { label: 'PAN Card', fields: [ { key: 'name', label: 'Full Name'}, { key: 'pan_number', label: 'PAN Number'}, { key: 'father_name', label: 'Father\'s Name'} ] },
    smart_card: { label: 'Smart Card (e.g., Driving License)', fields: [ { key: 'name', label: 'Full Name'}, { key: 'dob', label: 'Date of Birth'}, { key: 'card_number', label: 'Card Number'}, { key: 'valid_until', label: 'Valid Until'} ] },
    bank_statement: { label: 'Bank Statement', fields: [ { key: 'account_number', label: 'Account Number'}, { key: 'ifsc_code', label: 'IFSC Code'}, { key: 'balance', label: 'Closing Balance'}, { key: 'statement_period', label: 'Statement Period'} ] }
};
const generateDocumentDescription = (docKey) => { if (!PREDEFINED_DOCUMENTS[docKey]) return ''; const fields = PREDEFINED_DOCUMENTS[docKey].fields.map(f => f.label).join(', '); return `Expected Fields: ${fields}`; };
const generateAutoFillOptions = () => { const opts = []; for (const dk in PREDEFINED_DOCUMENTS) { PREDEFINED_DOCUMENTS[dk].fields.forEach(f => opts.push({ value: `${dk}.${f.key}`, label: `${PREDEFINED_DOCUMENTS[dk].label} - ${f.label}`, key: f.key })); } return opts; };
const ALL_AUTO_FILL_SOURCE_OPTIONS = generateAutoFillOptions();
const getFieldKeyFromSource = (sourceString) => { if (!sourceString) return null; const p = sourceString.split('.'); return p.length > 1 ? p[p.length - 1] : null; };
// ---

const AUTOSAVE_INTERVAL = 10000; // 10 seconds

const LoanFormBuilder = ({
    initialData = null,
    onPublish,
    onSaveDraft,
    isSaving: parentIsSaving
}) => {

    // --- State Definitions ---
    const getInitialState = useCallback(() => ({
        title: initialData?.title || '',
        description: initialData?.description || '',
        min_amount: initialData?.min_amount ?? '',
        max_amount: initialData?.max_amount ?? '',
        interest_rate: initialData?.interest_rate ?? '',
        tenure_months: initialData?.tenure_months ?? '',
        processing_fee: initialData?.processing_fee ?? 0,
        collateral_required: initialData?.collateral_required || false,
        fields: Array.isArray(initialData?.fields) ? initialData.fields.map(f => ({
            ...f,
            // Ensure options are always an array internally, convert comma string if needed
            options: typeof f.options === 'string' ? f.options.split(',').map(opt => opt.trim()).filter(Boolean) : (f.options || [])
        })) : [],
        eligibility: {
            min_age: initialData?.eligibility?.min_age ?? 18,
            max_age: initialData?.eligibility?.max_age ?? '',
            min_income: initialData?.eligibility?.min_income ?? '',
            min_credit_score: initialData?.eligibility?.min_credit_score ?? ''
        },
        required_documents: Array.isArray(initialData?.required_documents) ? initialData.required_documents.map(d => ({...d})) : [],
        application_start: initialData?.application_start ? new Date(initialData.application_start).toISOString().split('T')[0] : '',
        application_end: initialData?.application_end ? new Date(initialData.application_end).toISOString().split('T')[0] : '',
        disbursement_date: initialData?.disbursement_date ? new Date(initialData.disbursement_date).toISOString().split('T')[0] : '',
    }), [initialData]);

    const [loanData, setLoanData] = useState(getInitialState());
    const [errors, setErrors] = useState({});
    const [selectedDocumentType, setSelectedDocumentType] = useState(Object.keys(PREDEFINED_DOCUMENTS)[0]);
    const [internalIsSaving, setInternalIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [lastSaveTime, setLastSaveTime] = useState(initialData?.updated_at ? new Date(initialData.updated_at) : null);
    const [timeSinceLastSave, setTimeSinceLastSave] = useState('');
    const autoSaveTimerRef = useRef(null);
    const initialDataRef = useRef(JSON.stringify(getInitialState()));
    const formRef = useRef(null);
    const [isPublishing, setIsPublishing] = useState(false);

    // --- Effects ---
    useEffect(() => { setInternalIsSaving(parentIsSaving || false); }, [parentIsSaving]);

    useEffect(() => {
        const newState = getInitialState();
        setLoanData(newState);
        const newStateString = JSON.stringify(newState);
        // Update initial ref only if data actually changes
        // Prevents unnecessary resetting of dirty state on parent re-renders if initialData object ref changes but content doesn't
        if (newStateString !== initialDataRef.current) {
            initialDataRef.current = newStateString;
            setIsDirty(false); // Reset dirty state when initial data changes
            if(initialData?.updated_at) {
                setLastSaveTime(new Date(initialData.updated_at));
            } else {
                setLastSaveTime(null); // Reset if no date provided
            }
        }
        setErrors({}); // Clear errors on data load/reset
    }, [initialData, getInitialState]); // Rerun if initialData ref changes or the getInitialState function itself changes


    // Effect to calculate time since last save (updates every second)
    useEffect(() => {
        let intervalId = null;
        const updateRelativeTime = () => {
            if (lastSaveTime) {
                const now = Date.now();
                const secondsAgo = Math.round((now - lastSaveTime.getTime()) / 1000);
                setTimeSinceLastSave(`${Math.max(0, secondsAgo)} second${secondsAgo !== 1 ? 's' : ''} ago`);
            } else {
                setTimeSinceLastSave('');
            }
        };
        updateRelativeTime();
        intervalId = setInterval(updateRelativeTime, 1000);
        return () => clearInterval(intervalId);
    }, [lastSaveTime]);


    // --- Auto-Save Logic ---
    const handleAutoSave = useCallback(async () => {
        const currentStateString = JSON.stringify(loanData);
        const isStillDirty = currentStateString !== initialDataRef.current;

        if (!isStillDirty || internalIsSaving) return;
        if (!loanData.title?.trim()) {
            console.log("Auto-save skipped: Title is required.");
            return; // Don't save if title is missing
        }

        console.log('Auto-saving draft...');
        setInternalIsSaving(true);
        try {
            const dataToSave = { ...loanData };
            const idToSave = initialData?._id;
            await onSaveDraft(dataToSave, idToSave); // Assuming onSaveDraft returns a promise
            const now = new Date();
            setLastSaveTime(now);
            setIsDirty(false); // Mark as not dirty *after* successful save
            initialDataRef.current = JSON.stringify(loanData); // Update baseline to current saved state
            console.log('Auto-save request successful.');
        } catch (error) {
            console.error("Auto-save failed:", error);
            // Optionally: set an error state to show the user
        } finally {
            setInternalIsSaving(false);
        }
     }, [loanData, internalIsSaving, onSaveDraft, initialData?._id]); // Add initialData?._id as dependency

    // Auto-Save Timer Effect
    useEffect(() => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }
        const currentStateString = JSON.stringify(loanData);
        const isActuallyDirty = currentStateString !== initialDataRef.current;
        setIsDirty(isActuallyDirty); // Update dirty state whenever loanData changes

        // Schedule auto-save only if dirty and not currently saving
        if (isActuallyDirty && !internalIsSaving) {
            autoSaveTimerRef.current = setTimeout(handleAutoSave, AUTOSAVE_INTERVAL);
        }

        // Cleanup function to clear timeout if component unmounts or dependencies change
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
     }, [loanData, internalIsSaving, handleAutoSave, initialDataRef]); // Rerun when data or saving status changes


    // --- Mark Dirty Wrapper (simplified, dirtiness is checked in effect) ---
    // We rely on the useEffect above to set isDirty based on comparison
    const updateLoanDataState = (updater) => {
        setLoanData(updater);
        // Clear specific error when field is changed
        // This requires knowing which field changed, more complex than just setting state
    };

    // --- Validation Function ---
    const validate = (isPublishing = false) => {
        const newErrors = {};
        const requirePublish = isPublishing;

        // Basic Metadata
        if (!loanData.title?.trim()) newErrors.title = 'Title is required.';
        if (requirePublish && !loanData.description?.trim()) newErrors.description = 'Description is required for publishing.';

        // Financial Details
        if ((requirePublish || loanData.min_amount !== '') && (isNaN(loanData.min_amount) || parseFloat(loanData.min_amount) < 0)) newErrors.min_amount = 'Minimum amount must be a non-negative number.';
        if ((requirePublish || loanData.max_amount !== '') && (isNaN(loanData.max_amount) || parseFloat(loanData.max_amount) < 0)) newErrors.max_amount = 'Maximum amount must be a non-negative number.';
        if (loanData.min_amount !== '' && loanData.max_amount !== '' && !isNaN(loanData.min_amount) && !isNaN(loanData.max_amount) && parseFloat(loanData.min_amount) > parseFloat(loanData.max_amount)) newErrors.max_amount = 'Maximum amount cannot be less than minimum amount.';
        if ((requirePublish || loanData.interest_rate !== '') && (isNaN(loanData.interest_rate) || parseFloat(loanData.interest_rate) < 0)) newErrors.interest_rate = 'Interest rate must be a non-negative number.';
        if ((requirePublish || loanData.tenure_months !== '') && (isNaN(loanData.tenure_months) || parseInt(loanData.tenure_months, 10) < 1)) newErrors.tenure_months = 'Tenure must be at least 1 month.';
        if (loanData.processing_fee !== '' && loanData.processing_fee !== null && (isNaN(loanData.processing_fee) || parseFloat(loanData.processing_fee) < 0)) newErrors.processing_fee = 'Processing fee must be a non-negative number.';

        // Eligibility
        const el = loanData.eligibility;
        if ((requirePublish || el.min_age !== '') && (isNaN(el.min_age) || parseInt(el.min_age, 10) < 18)) newErrors['eligibility.min_age'] = 'Minimum age must be at least 18.';
        if (el.max_age !== '' && el.max_age !== null && (isNaN(el.max_age) || parseInt(el.max_age, 10) <= parseInt(el.min_age || 0, 10))) newErrors['eligibility.max_age'] = 'Maximum age must be greater than minimum age.';
        if ((requirePublish || el.min_income !== '') && (isNaN(el.min_income) || parseFloat(el.min_income) < 0)) newErrors['eligibility.min_income'] = 'Minimum income must be a non-negative number.';
        if (el.min_credit_score !== '' && el.min_credit_score !== null && (isNaN(el.min_credit_score) || parseInt(el.min_credit_score, 10) < 300 || parseInt(el.min_credit_score, 10) > 900)) newErrors['eligibility.min_credit_score'] = 'Credit score must be between 300 and 900.';

        // Dates
        if (requirePublish && !loanData.application_start) newErrors.application_start = 'Application start date is required for publishing.';
        if (requirePublish && !loanData.application_end) newErrors.application_end = 'Application end date is required for publishing.';
        if (loanData.application_start && loanData.application_end && new Date(loanData.application_start) > new Date(loanData.application_end)) newErrors.application_end = 'Application end date must be after start date.';
        if (loanData.disbursement_date && loanData.application_end && new Date(loanData.disbursement_date) < new Date(loanData.application_end)) newErrors.disbursement_date = 'Disbursement date cannot be before the application end date.';

        // Custom Fields
        const fieldIds = new Set();
        loanData.fields.forEach((field, index) => {
            const prefix = `fields[${index}]`;
            let currentFieldId = field.field_id; // Assume manual entry first
            let isDerived = false;
            if (field.auto_fill_sources?.length > 0) {
                const derivedKey = getFieldKeyFromSource(field.auto_fill_sources[0]);
                // Use derived key ONLY if manual field ID is empty
                if (!currentFieldId?.trim() && derivedKey) {
                    currentFieldId = derivedKey;
                    isDerived = true;
                } else if (currentFieldId?.trim() && derivedKey && currentFieldId.trim() === derivedKey) {
                    // It matches the derived key, treat as derived for validation checks
                    isDerived = true;
                }
            }

            // Validate Field ID requirement (required if not derived)
            if (!isDerived && !currentFieldId?.trim()) {
                newErrors[`${prefix}.field_id`] = 'Field ID is required (or select an auto-fill source).';
            }

            // Validate uniqueness
            if (currentFieldId && fieldIds.has(currentFieldId.trim())) {
                newErrors[`${prefix}.field_id`] = `Field ID "${currentFieldId}" is already used or derived multiple times. IDs must be unique.`;
            } else if (currentFieldId) {
                fieldIds.add(currentFieldId.trim());
            }

            // Other field validations
            if (!field.field_label?.trim()) newErrors[`${prefix}.field_label`] = 'Field Label is required.';
            if (!field.type) newErrors[`${prefix}.type`] = 'Field Type is required.';
            // Ensure options are checked correctly (as array)
            if ((field.type === 'select' || field.type === 'multiselect') && (!field.options || field.options.length === 0)) {
                newErrors[`${prefix}.options`] = 'Options are required for select/multiselect types (comma-separated).';
            }
        });

        // Required Docs
        if (isPublishing && loanData.required_documents.length === 0) {
            newErrors['required_documents'] = 'At least one required document must be specified for publishing.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
     };

    // --- Input Handlers ---
    const handleInputChange = (event) => {
        const { name, value, type, checked } = event.target;
        const val = type === 'checkbox' ? checked : value;

        // Clear the error for this specific field as the user types
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
        if (name.startsWith('eligibility.') && errors[name]) {
             setErrors(prev => ({ ...prev, [name]: null }));
        }

        updateLoanDataState(prev => {
            if (name.startsWith('eligibility.')) {
                const field = name.split('.')[1];
                return { ...prev, eligibility: { ...prev.eligibility, [field]: val } };
            } else {
                return { ...prev, [name]: val };
            }
        });
    };

    const handleCustomFieldChange = (index, event) => {
        const { name, value, type, checked, multiple: isMultiSelectTarget } = event.target; // Get name from event.target
        const fieldName = name; // Use name directly
        const isCheckbox = type === 'checkbox';
        const isMultiSelect = isMultiSelectTarget && fieldName === 'auto_fill_sources'; // Check if it's the multi-select target

        // Clear errors for the specific field being changed
        const errorKey = `fields[${index}].${fieldName}`;
        if (errors[errorKey]) {
            setErrors(prev => ({ ...prev, [errorKey]: null }));
        }
        // Also clear field_id error if auto_fill_sources changes
        if (fieldName === 'auto_fill_sources' && errors[`fields[${index}].field_id`]) {
            setErrors(prev => ({ ...prev, [`fields[${index}].field_id`]: null }));
        }

        updateLoanDataState(prev => {
            const updatedFields = [...prev.fields];
            const fieldToUpdate = { ...updatedFields[index] };
            const oldAutoFillSources = fieldToUpdate.auto_fill_sources || [];
            let newFieldValue;

            if (isMultiSelect) {
                const selectedValues = Array.from(event.target.selectedOptions, option => option.value);
                newFieldValue = selectedValues;
                const currentManualId = fieldToUpdate.field_id?.trim();
                const wasDerived = oldAutoFillSources.length > 0 && currentManualId === getFieldKeyFromSource(oldAutoFillSources[0]);

                // Auto-update field_id ONLY if it's currently empty or was previously derived
                if (selectedValues.length > 0) {
                    const firstSource = selectedValues[0];
                    const derivedKey = getFieldKeyFromSource(firstSource);
                    if (derivedKey && (!currentManualId || wasDerived)) {
                        fieldToUpdate['field_id'] = derivedKey;
                    }
                } else if (oldAutoFillSources.length > 0 && selectedValues.length === 0) {
                    // Clear field_id only if it was derived
                    if (wasDerived) {
                        fieldToUpdate['field_id'] = '';
                    }
                }
            } else if (fieldName === 'options') {
                // Always store options as an array internally
                newFieldValue = value.split(',').map(opt => opt.trim()).filter(Boolean);
            } else {
                newFieldValue = isCheckbox ? checked : value;
            }

            fieldToUpdate[fieldName] = newFieldValue; // Use fieldName here
            updatedFields[index] = fieldToUpdate;
            return { ...prev, fields: updatedFields };
        });
    };


    // --- Add/Remove Handlers ---
    const handleAddCustomField = () => {
        updateLoanDataState(prev => ({
            ...prev,
            fields: [
                ...prev.fields,
                { field_id: '', field_label: '', field_prompt: '', type: 'text', required: false, min_value: '', max_value: '', options: [], auto_fill_sources: [] }
            ]
        }));
    };
    const handleRemoveCustomField = (indexToRemove) => {
        updateLoanDataState(prev => ({
            ...prev,
            fields: prev.fields.filter((_, index) => index !== indexToRemove)
        }));
        // Clear errors related to the removed field and subsequent fields
        setErrors(prev => {
            const newErrors = { ...prev };
            Object.keys(newErrors).forEach(key => {
                if (key.startsWith('fields[')) {
                    const match = key.match(/fields\[(\d+)\]/);
                    if (match) {
                        const errorIndex = parseInt(match[1], 10);
                        if (errorIndex === indexToRemove) {
                            delete newErrors[key]; // Remove error for the deleted field
                        } else if (errorIndex > indexToRemove) {
                             delete newErrors[key]; // Optionally clear errors for fields after the removed one as indices shift (safer to re-validate)
                        }
                    }
                }
            });
            return newErrors;
        });
    };
    const handleAddDocumentRequirement = () => {
        if (!selectedDocumentType) return;
        const docConfig = PREDEFINED_DOCUMENTS[selectedDocumentType];
        if (!docConfig || loanData.required_documents.some(doc => doc.name === docConfig.label)) return; // Prevent duplicates

        const newRequirement = {
            name: docConfig.label,
            description: generateDocumentDescription(selectedDocumentType)
        };
        updateLoanDataState(prev => ({
            ...prev,
            required_documents: [...prev.required_documents, newRequirement]
        }));
         // Clear potential "at least one document" error
        if (errors.required_documents) {
             setErrors(prev => ({ ...prev, required_documents: null }));
        }
    };
    const handleRemoveDocumentRequirement = (indexToRemove) => {
        updateLoanDataState(prev => ({
            ...prev,
            required_documents: prev.required_documents.filter((_, index) => index !== indexToRemove)
        }));
    };


    // --- Form Submission/Action Handlers ---
    const handlePublish = async (event) => {
        event.preventDefault();
        if (internalIsSaving) return;

        if (validate(true)) { // Validate for publishing
            console.log('Form Validated for Publishing. Submitting:', loanData);
            setInternalIsSaving(true);
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

            try {
                // Prepare data, ensuring types are correct for API
                const dataToSubmit = {
                     ...loanData,
                     min_amount: loanData.min_amount !== '' ? parseFloat(loanData.min_amount) : null,
                     max_amount: loanData.max_amount !== '' ? parseFloat(loanData.max_amount) : null,
                     interest_rate: loanData.interest_rate !== '' ? parseFloat(loanData.interest_rate) : null,
                     tenure_months: loanData.tenure_months !== '' ? parseInt(loanData.tenure_months, 10) : null,
                     processing_fee: loanData.processing_fee !== '' && loanData.processing_fee !== null ? parseFloat(loanData.processing_fee) : 0,
                     eligibility: {
                        min_age: loanData.eligibility.min_age !== '' ? parseInt(loanData.eligibility.min_age, 10) : null,
                        max_age: loanData.eligibility.max_age !== '' && loanData.eligibility.max_age !== null ? parseInt(loanData.eligibility.max_age, 10) : null,
                        min_income: loanData.eligibility.min_income !== '' ? parseFloat(loanData.eligibility.min_income) : null,
                        min_credit_score: loanData.eligibility.min_credit_score !== '' && loanData.eligibility.min_credit_score !== null ? parseInt(loanData.eligibility.min_credit_score, 10) : null,
                     },
                     application_start: loanData.application_start ? new Date(loanData.application_start) : null,
                     application_end: loanData.application_end ? new Date(loanData.application_end) : null,
                     disbursement_date: loanData.disbursement_date ? new Date(loanData.disbursement_date) : null,
                     // Ensure fields are processed correctly
                     fields: loanData.fields.map(field => ({
                        ...field,
                        // Convert options back to string IF your backend expects a string
                        // options: Array.isArray(field.options) ? field.options.join(',') : field.options,
                        min_value: (field.type === 'number' && field.min_value !== '') ? parseFloat(field.min_value) : field.min_value,
                        max_value: (field.type === 'number' && field.max_value !== '') ? parseFloat(field.max_value) : field.max_value,
                     }))
                };
                const idToSave = initialData?._id;
                await onPublish(dataToSubmit, idToSave); // Call the publish function from props
                const now = new Date();
                setLastSaveTime(now);
                setIsDirty(false);
                initialDataRef.current = JSON.stringify(loanData); // Update baseline
            } catch (error) {
                console.error("Failed to publish loan:", error);
                // Optionally set a global error message for the user
            } finally {
                setInternalIsSaving(false);
            }
        } else { // Validation failed
             console.log('Publish Validation Failed:', errors);
             alert('Please fix the errors marked in red before publishing.');
             // Focus on the first error
             const firstErrorKey = Object.keys(errors)[0];
             if(firstErrorKey && formRef.current) {
                 // Attempt to find by name first, then ID patterns
                 const selector = `[name="${firstErrorKey}"], [id^="field_${firstErrorKey.replace('.', '_')}"]`;
                 const element = formRef.current.querySelector(selector);
                 if (element) {
                    element.focus({ preventScroll: true });
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 }
             }
        }
    };

    const handleManualSaveDraft = async () => {
        if (internalIsSaving) return;
        if (!loanData.title?.trim()) {
            setErrors(prev => ({...prev, title: 'Title is required to save a draft.'}));
            alert('Please enter a Title before saving the draft.');
            const titleElement = formRef.current?.querySelector('[name="title"]');
            titleElement?.focus();
            return;
        }
        // Clear title error if it existed
        if (errors.title) {
            setErrors(prev => ({...prev, title: null}));
        }

        console.log('Manual saving draft...');
        setInternalIsSaving(true);
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); // Stop auto-save timer

        try {
            const dataToSave = { ...loanData }; // Save current state
            const idToSave = initialData?._id;
            await onSaveDraft(dataToSave, idToSave); // Call save draft function from props
            const now = new Date();
            setLastSaveTime(now);
            setIsDirty(false); // Mark as clean
            initialDataRef.current = JSON.stringify(loanData); // Update baseline
        } catch (error) {
            console.error("Manual save draft failed:", error);
            // Optionally show error to user
        } finally {
            setInternalIsSaving(false);
        }
    };


    // --- Rendering Helpers ---
    const renderInput = (name, label, type = 'text', options = {}, valueOverride = undefined) => {
        const actualValue = valueOverride !== undefined ? valueOverride : loanData[name];
        // Ensure value is not null/undefined for controlled components
        const value = actualValue ?? '';
        const fieldId = name.includes('.') ? name.replace(/\./g,'_') : `field_${name}`; // Make ID safe
        const isInvalid = !!errors[name];
        return (
            <Form.Group as={Col} md={options.md || 6} className="mb-3" key={fieldId} controlId={fieldId}>
                <Form.Label>{label}{options.required ? ' *' : ''}</Form.Label>
                <Form.Control
                    type={type}
                    name={name}
                    value={value} // Use safe value
                    onChange={handleInputChange}
                    // Use checked only for checkboxes, value for others
                    checked={type === 'checkbox' ? !!value : undefined}
                    required={options.required} // Pass required for HTML5 validation indication
                    min={options.min}
                    max={options.max}
                    step={options.step}
                    placeholder={options.placeholder}
                    isInvalid={isInvalid}
                    disabled={internalIsSaving}
                />
                <Form.Control.Feedback type="invalid">{errors[name]}</Form.Control.Feedback>
            </Form.Group>
        );
    };
    const renderTextArea = (name, label, options = {}, valueOverride = undefined) => {
        const actualValue = valueOverride !== undefined ? valueOverride : loanData[name];
        const value = actualValue ?? '';
        const fieldId = name.includes('.') ? name.replace(/\./g,'_') : `field_${name}`;
        const isInvalid = !!errors[name];
        return (
            <Form.Group as={Col} md={options.md || 12} className="mb-3" key={fieldId} controlId={fieldId}>
                <Form.Label>{label}{options.required ? ' *' : ''}</Form.Label>
                <Form.Control
                    as="textarea"
                    name={name}
                    value={value}
                    onChange={handleInputChange}
                    rows={options.rows}
                    placeholder={options.placeholder}
                    required={options.required}
                    isInvalid={isInvalid}
                    disabled={internalIsSaving}
                />
                <Form.Control.Feedback type="invalid">{errors[name]}</Form.Control.Feedback>
            </Form.Group>
        );
    };
    const renderEligibilityInput = (name, label, type = 'number', options = {}) => {
        const fieldName = `eligibility.${name}`;
        // Pass eligibility value correctly
        return renderInput(fieldName, label, type, { ...options, md: options.md || 6}, loanData.eligibility[name]);
    };

    // --- Custom Field Renderers ---
    const renderCustomFieldInput = (index, fieldName, label, type = 'text', options = {}) => {
        const fullFieldName = `fields[${index}].${fieldName}`; // Used for error lookup
        const controlId = `field_${index}_${fieldName}`; // Unique ID for label/input linking
        const fieldData = loanData.fields[index];
        const value = fieldData?.[fieldName] ?? ''; // Ensure value is not undefined/null
        const isInvalid = !!errors[fullFieldName];
        const isIdField = fieldName === 'field_id';

        // Determine if the field is derived (and should be read-only)
        const isDerived = isIdField &&
                          fieldData?.auto_fill_sources?.length > 0 &&
                          value === getFieldKeyFromSource(fieldData.auto_fill_sources[0]);


        // --- Checkbox Rendering ---
        if (type === 'checkbox') {
            return (
                // Wrap in a Col matching the grid structure
                <Col md={options.md || 6} className="mb-3">
                    {/* The Form.Group inside helps with alignment */}
                    <Form.Group className="h-100 d-flex align-items-end" key={controlId} controlId={controlId}>
                       <div> {/* Extra div prevents label stretching */}
                         <Form.Check
                            type="switch" // Or "checkbox"
                            name={fieldName} // Use fieldName directly for handleCustomFieldChange
                            label={label}
                            checked={!!value} // Ensure boolean
                            onChange={(e) => handleCustomFieldChange(index, e)}
                            isInvalid={isInvalid} // Mark control if invalid
                            disabled={internalIsSaving}
                            // Feedback needs to be displayed separately for Form.Check
                         />
                         {isInvalid && <div className="invalid-feedback d-block" style={{ marginTop: '-0.25rem' }}>{errors[fullFieldName]}</div>}
                       </div>
                    </Form.Group>
                </Col>
            );
        }
        // --- End Checkbox Rendering ---

        // --- Standard Input Rendering ---
        return (
             <Form.Group as={Col} md={options.md || 6} className="mb-3" key={controlId} controlId={controlId}>
                <Form.Label>
                    {label}
                    {/* Show required asterisk only if required AND not derived */}
                    {options.required && !isDerived ? ' *' : ''}
                </Form.Label>
                <Form.Control
                    type={type}
                    name={fieldName} // Use fieldName for handleCustomFieldChange
                    value={value}
                    onChange={(e) => handleCustomFieldChange(index, e)}
                    readOnly={isDerived} // Use readOnly for derived fields
                    className={isDerived ? 'read-only-input' : ''} // Apply style for readonly
                    required={options.required && !isDerived} // HTML5 required if needed
                    min={options.min}
                    max={options.max}
                    step={options.step}
                    placeholder={options.placeholder}
                    isInvalid={isInvalid}
                    disabled={internalIsSaving} // Only disable based on saving state
                />
                {/* Show derived text only if it's the ID field and is derived */}
                {isIdField && isDerived && <Form.Text className="derived-text">Derived from Auto-Fill Source.</Form.Text>}
                <Form.Control.Feedback type="invalid">{errors[fullFieldName]}</Form.Control.Feedback>
            </Form.Group>
        );
    };

    const renderCustomFieldTextarea = (index, fieldName, label, options = {}) => {
        const fullFieldName = `fields[${index}].${fieldName}`;
        const controlId = `field_${index}_${fieldName}`;
        let value = loanData.fields[index]?.[fieldName];

        // Convert options array back to comma-separated string for display
        if (fieldName === 'options' && Array.isArray(value)) {
            value = value.join(', ');
        }
        value = value ?? ''; // Ensure not null/undefined

        const isInvalid = !!errors[fullFieldName];
        return (
            <Form.Group as={Col} md={options.md || 12} className="mb-3" key={controlId} controlId={controlId}>
                <Form.Label>{label}{options.required ? ' *' : ''}</Form.Label>
                <Form.Control
                    as="textarea"
                    name={fieldName} // Use fieldName for handler
                    value={value}
                    onChange={(e) => handleCustomFieldChange(index, e)}
                    rows={options.rows}
                    placeholder={options.placeholder}
                    required={options.required}
                    isInvalid={isInvalid}
                    disabled={internalIsSaving}
                />
                <Form.Control.Feedback type="invalid">{errors[fullFieldName]}</Form.Control.Feedback>
            </Form.Group>
        );
    };

    const renderCustomFieldSelect = (index, fieldName, label, optionsArray = [], fieldOptions = {}) => {
        const fullFieldName = `fields[${index}].${fieldName}`;
        const controlId = `field_${index}_${fieldName}`;
        const value = loanData.fields[index]?.[fieldName] ?? ''; // Ensure not null/undefined
        const isInvalid = !!errors[fullFieldName];
        return (
            <Form.Group as={Col} md={fieldOptions.md || 6} className="mb-3" key={controlId} controlId={controlId}>
                <Form.Label>{label}{fieldOptions.required ? ' *' : ''}</Form.Label>
                <Form.Select
                    name={fieldName} // Use fieldName for handler
                    value={value}
                    onChange={(e) => handleCustomFieldChange(index, e)}
                    required={fieldOptions.required}
                    isInvalid={isInvalid}
                    disabled={internalIsSaving}
                >
                    <option value="">-- Select --</option>
                    {optionsArray.map(opt => (
                        <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>
                    ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">{errors[fullFieldName]}</Form.Control.Feedback>
            </Form.Group>
        );
    };

    const renderCustomFieldMultiSelect = (index, fieldName, label, baseOptionsArray = [], fieldOptions = {}) => {
        const fullFieldName = `fields[${index}].${fieldName}`;
        const controlId = `field_${index}_${fieldName}`;
        const currentField = loanData.fields[index];
        // Ensure selectedSources is always an array
        const selectedSources = Array.isArray(currentField?.[fieldName]) ? currentField[fieldName] : [];
        const isInvalid = !!errors[fullFieldName];

        // Filtering logic (same as before)
        const baseKey = selectedSources.length > 0 ? getFieldKeyFromSource(selectedSources[0]) : null;
        let filteredOptions;
        if (baseKey) {
            filteredOptions = baseOptionsArray.filter(opt => opt.key === baseKey || selectedSources.includes(opt.value));
        } else {
            filteredOptions = baseOptionsArray;
        }

        return (
            <Form.Group as={Col} md={fieldOptions.md || 12} className="mb-3" key={controlId} controlId={controlId}>
                <Form.Label>{label}{fieldOptions.required ? ' *' : ''}</Form.Label>
                <Form.Select
                    multiple
                    name={fieldName} // Use fieldName for handler
                    value={selectedSources} // Bind value to the array
                    onChange={(e) => handleCustomFieldChange(index, e)}
                    required={fieldOptions.required}
                    // Apply isInvalid class directly for styling hook provided by CSS
                    className={`multi-select ${isInvalid ? 'is-invalid' : ''}`}
                    style={{minHeight: '120px'}}
                    disabled={internalIsSaving}
                >
                    {/* Consider optgroup for better organization if keys differ */}
                    {filteredOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </Form.Select>
                {/* Display feedback correctly */}
                <Form.Control.Feedback type="invalid" className={isInvalid ? 'd-block' : ''}>{errors[fullFieldName]}</Form.Control.Feedback>
                <Form.Text muted>Hold Ctrl/Cmd to select multiple.</Form.Text>
            </Form.Group>
        );
    };


    // --- Component Render ---
    return (
        <div className="loan-form-builder-component">
            {/* Fixed Saving Indicator */}
            {internalIsSaving && !isDirty && <div className="saving-indicator saving-success"> <FaCheckCircle /> Saved</div>}
            {internalIsSaving && isDirty && <div className="saving-indicator saving-progress"> <Spinner animation="grow" size="sm" /> Saving...</div>}

            {/* The main form element */}
            <Form ref={formRef} onSubmit={handlePublish} className="loan-form-builder-content needs-validation" noValidate>

                {/* ----- Card Sections ----- */}

                {/* Basic Info Card */}
                <Card className="mb-4 shadow-sm">
                    <Card.Header><FaInfoCircle className="me-2 text-primary"/>Basic Information</Card.Header>
                    <Card.Body>
                        <Row>
                            {renderInput('title', 'Loan Title', 'text', { required: true, md: 12, placeholder: 'Enter a clear title for the loan scheme' })}
                            {renderTextArea('description', 'Description (HTML supported)', { rows: 5, md: 12, required: isPublishing, placeholder: 'Describe the loan details, benefits, target audience...' })}
                        </Row>
                     </Card.Body>
                </Card>

                {/* Financial Details Card */}
                <Card className="mb-4 shadow-sm">
                    <Card.Header><FaDollarSign className="me-2 text-success"/>Financial Details</Card.Header>
                     <Card.Body className="bg-light-subtle">
                       <Row>
                            {renderInput('min_amount', 'Minimum Amount', 'number', { required: true, min: 0, step: 0.01 })}
                            {renderInput('max_amount', 'Maximum Amount', 'number', { required: true, min: 0, step: 0.01 })}
                            {renderInput('interest_rate', 'Interest Rate (%)', 'number', { required: true, min: 0, step: 0.01 })}
                            {renderInput('tenure_months', 'Tenure (Months)', 'number', { required: true, min: 1, step: 1 })}
                            {renderInput('processing_fee', 'Processing Fee ($)', 'number', { min: 0, step: 0.01 })}
                            {/* Collateral Checkbox */}
                            <Col md={12} className="mb-3 mt-2">
                                <Form.Check
                                    type="switch"
                                    id="field_collateral_required"
                                    name="collateral_required" // Use name for handleInputChange
                                    label="Collateral Required?"
                                    checked={!!loanData.collateral_required}
                                    onChange={handleInputChange} // Use standard handler
                                    disabled={internalIsSaving}
                                />
                            </Col>
                       </Row>
                     </Card.Body>
                </Card>

                 {/* Eligibility Card */}
                <Card className="mb-4 shadow-sm">
                    <Card.Header><FaCheckCircle className="me-2 text-info"/>Eligibility Criteria</Card.Header>
                    <Card.Body>
                        <Row>
                            {renderEligibilityInput('min_age', 'Minimum Age', 'number', { required: true, min: 18 })}
                            {renderEligibilityInput('max_age', 'Maximum Age', 'number', { min: 18 })}
                            {renderEligibilityInput('min_income', 'Minimum Income ($)', 'number', { required: true, min: 0, step: 0.01 })}
                            {renderEligibilityInput('min_credit_score', 'Min Credit Score', 'number', { min: 300, max: 900 })}
                        </Row>
                    </Card.Body>
                </Card>

                {/* Custom Fields Card */}
                <Card className="mb-4 shadow-sm">
                    <Card.Header><FaEdit className="me-2 text-secondary"/>Custom Application Fields</Card.Header>
                    <Card.Body className="bg-light-subtle">
                         {loanData.fields.length === 0 && <p className="text-muted text-center py-3 mb-0">No custom fields added yet.</p>}

                         {loanData.fields.map((field, index) => (
                            <div className="custom-field-item p-3 mb-3 border rounded bg-white position-relative" key={`custom-field-${index}`}> {/* Unique key */}
                                 {/* Header */}
                                 <div className="custom-field-header d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                                    <h6 className="text-primary mb-0 fw-bold">Custom Field #{index + 1}</h6>
                                    <Button variant="link" size="sm" className="p-0 text-danger remove-button-inline" onClick={() => handleRemoveCustomField(index)} aria-label={`Remove Custom Field ${index + 1}`} disabled={internalIsSaving} title="Remove Field"> <FaTrash /> </Button>
                                 </div>

                                 {/* --- Form Rows for Custom Field --- */}
                                <Row>
                                    {renderCustomFieldInput(index, 'field_id', 'Field ID', 'text', { required: !field.auto_fill_sources?.length > 0, md: 6 })}
                                    {renderCustomFieldInput(index, 'field_label', 'Field Label', 'text', { required: true, md: 6 })}
                                </Row>
                                {/* Row with alignment fix for Checkbox */}
                                <Row className="align-items-end">
                                    {renderCustomFieldSelect(index, 'type', 'Field Type', [ { value: 'text', label: 'Text'}, { value: 'textarea', label: 'Text Area'}, { value: 'number', label: 'Number'}, { value: 'date', label: 'Date'}, { value: 'datetime', label: 'Date & Time'}, { value: 'time', label: 'Time'}, { value: 'select', label: 'Dropdown (Single)'}, { value: 'multiselect', label: 'Dropdown (Multi)'}, { value: 'checkbox', label: 'Checkbox'}, { value: 'image', label: 'Image Upload'}, { value: 'document', label: 'Document Upload'}, ], { required: true, md: 6 })}
                                    {/* Checkbox is now rendered within its Col by the helper */}
                                    {renderCustomFieldInput(index, 'required', 'Required Field?', 'checkbox', { md: 6 })}
                                </Row>
                                <Row>
                                    {renderCustomFieldTextarea(index, 'field_prompt', 'Field Prompt/Hint', {rows: 2, md: 12})}
                                </Row>
                                {/* Conditional Rows */}
                                {(field.type === 'number' || field.type === 'text' || field.type === 'textarea') && (
                                    <Row>
                                        {renderCustomFieldInput(index, 'min_value', 'Min Value / Length', field.type === 'number' ? 'number' : 'text', {md: 6})}
                                        {renderCustomFieldInput(index, 'max_value', 'Max Value / Length', field.type === 'number' ? 'number' : 'text', {md: 6})}
                                    </Row>
                                )}
                                {(field.type === 'select' || field.type === 'multiselect') && (
                                    <Row>
                                        {renderCustomFieldTextarea(index, 'options', 'Options (Comma-separated)', { required: true, placeholder: "e.g., Option 1, Option 2", md: 12 })}
                                    </Row>
                                )}
                                {field.type !== 'image' && field.type !== 'document' && (
                                    <Row>
                                        {renderCustomFieldMultiSelect(index, 'auto_fill_sources', 'Potential Auto-Fill Sources', ALL_AUTO_FILL_SOURCE_OPTIONS, {md: 12})}
                                    </Row>
                                )}
                                {/* --- End Form Rows --- */}
                            </div>
                         ))}

                         {/* Add Custom Field Button */}
                         <div className="mt-2 text-end">
                            <Button type="button" variant="outline-primary" size="sm" onClick={handleAddCustomField} disabled={internalIsSaving}> <FaPlus className="me-1"/> Add Custom Field </Button>
                         </div>
                    </Card.Body>
                </Card>

                 {/* Required Documents Card */}
                <Card className="mb-4 shadow-sm">
                     <Card.Header><FaFileMedicalAlt className="me-2 text-danger"/>Standard Document Requirements</Card.Header>
                    <Card.Body>
                        <Row className="g-3 align-items-center mb-3 pb-3 border-bottom">
                            <Col xs={12} sm>
                                <Form.Select size="sm" value={selectedDocumentType} onChange={(e) => setSelectedDocumentType(e.target.value)} disabled={internalIsSaving} aria-label="Select document type to add">
                                    {Object.entries(PREDEFINED_DOCUMENTS).map(([key, doc]) => (
                                        <option key={key} value={key}>{doc.label}</option>
                                     ))}
                                 </Form.Select>
                            </Col>
                            <Col xs={12} sm="auto">
                                <Button type="button" variant="secondary" size="sm" onClick={handleAddDocumentRequirement} disabled={internalIsSaving} className="w-100"> Add Requirement </Button>
                            </Col>
                             {/* Display error for required documents */}
                             {errors.required_documents && <Col xs={12}><small className="text-danger d-block mt-1">{errors.required_documents}</small></Col>}
                        </Row>
                         <ListGroup variant="flush">
                            {loanData.required_documents.length === 0 && <ListGroup.Item className="text-muted text-center py-3">No standard documents added yet.</ListGroup.Item>}
                             {loanData.required_documents.map((doc, index) => (
                                <ListGroup.Item key={`req-doc-${index}`} className="d-flex justify-content-between align-items-center ps-1 pe-1"> {/* Unique key */}
                                    <div className="flex-grow-1 me-2">
                                        <strong className="d-block">{doc.name}</strong>
                                        <small className="text-muted fst-italic">{doc.description || 'No description'}</small>
                                    </div>
                                    <Button variant="outline-danger" size="sm" className="p-1 remove-button-inline flex-shrink-0" onClick={() => handleRemoveDocumentRequirement(index)} aria-label={`Remove ${doc.name}`} disabled={internalIsSaving}> <FaTrash /> </Button>
                                </ListGroup.Item>
                             ))}
                        </ListGroup>
                    </Card.Body>
                </Card>

                {/* Dates Card */}
                <Card className="mb-4 shadow-sm">
                    <Card.Header><FaCalendarAlt className="me-2 text-warning"/>Application Window & Dates</Card.Header>
                     <Card.Body className="bg-light-subtle">
                        <Row>
                            {renderInput('application_start', 'Application Start Date', 'date', { required: true })}
                            {renderInput('application_end', 'Application End Date', 'date', { required: true })}
                            {renderInput('disbursement_date', 'Disbursement Date (Optional)', 'date')}
                        </Row>
                    </Card.Body>
                </Card>

                {/* --- Action Buttons & Status Bar --- */}
                <div className="form-status-bar sticky-bottom bg-dark text-light p-2 shadow-lg">
                    <Row className="align-items-center">
                        <Col md={6} className="text-center text-md-start mb-2 mb-md-0">
                             <div className={`status-indicator status-${internalIsSaving ? 'saving' : isDirty ? 'unsaved' : (lastSaveTime ? 'saved' : 'neutral')}`}>
                                {internalIsSaving ? ( <><Spinner animation="border" size="sm" className="me-2"/>Saving...</> )
                                : isDirty ? ( <><FaExclamationTriangle className="me-1"/> Unsaved changes</> )
                                : lastSaveTime ? ( <><FaCheckCircle className="me-1"/> Last saved: {timeSinceLastSave}</> )
                                : ( 'No changes yet.' )}
                             </div>
                        </Col>
                         <Col md={6} className="text-center text-md-end">
                             <div className="action-buttons d-inline-flex gap-2">
                                <Button type="button" variant="outline-light" size="sm" onClick={handleManualSaveDraft} disabled={!isDirty || internalIsSaving} >
                                    {/* Show spinner only when actively saving this action */}
                                    {internalIsSaving && !isDirty ? <Spinner as="span" size="sm" animation="border" className="me-1"/> : <FaRegSave className="me-1"/>} Save Draft
                                </Button>
                                <Button type="submit" variant="success" size="sm" disabled={internalIsSaving || initialData?.status === 'published'} >
                                    {internalIsSaving && isDirty ? <Spinner as="span" size="sm" animation="border" className="me-1"/> : <FaCloudUploadAlt className="me-1"/>}
                                    {initialData?.status === 'published' ? 'Published' : 'Publish Loan'}
                                </Button>
                            </div>
                        </Col>
                    </Row>
                </div>

            </Form>
        </div>
    );
};

export default LoanFormBuilder;