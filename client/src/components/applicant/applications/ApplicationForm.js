// --- ApplicationForm.js (Main Component) ---
// src/components/applicant/applications/ApplicationForm.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Alert, Form, Spinner, Button } from 'react-bootstrap';
import { axiosInstance } from '../../../config'; // UNCOMMENTED: Assuming this path is correct
import { FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa'; 

// Assuming child components are in the same directory or adjust paths
import LoanInfoHeader from './LoanInfoHeader';
import KycDocumentSection from './KycDocumentSection';
import LoanDetailsSection from './LoanDetailsSection';
import OtherDocumentsSection from './OtherDocumentsSection';
import ActionButtons from './ActionButtons';

// Assuming constants.js is at src/constants.js
import { AADHAAR_SCHEMA_ID_CONST, PAN_SCHEMA_ID_CONST } from '../../../constants'; // UNCOMMENTED: Assuming this path is correct


export default function ApplicationForm() {
    const { loanId } = useParams();
    const navigate = useNavigate();

    // State for schemas
    const [loanSchemaData, setLoanSchemaData] = useState(null);
    const [aadhaarSchemaDef, setAadhaarSchemaDef] = useState(null);
    const [panSchemaDef, setPanSchemaDef] = useState(null);

    // State for form data sections
    const [mainFormData, setMainFormData] = useState({});
    const [aadhaarFormData, setAadhaarFormData] = useState({});
    const [panFormData, setPanFormData] = useState({});

    // State for files
    const [customFieldFiles, setCustomFieldFiles] = useState({});
    const [otherRequiredDocFiles, setOtherRequiredDocFiles] = useState({});
    const [aadhaarFieldFiles, setAadhaarFieldFiles] = useState({});
    const [panFieldFiles, setPanFieldFiles] = useState({});
    
    const [existingFileRefs, setExistingFileRefs] = useState({});

    // State for UI and submission flow
    const [formErrors, setFormErrors] = useState({});
    const [loading, setLoading] = useState(true);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionStatus, setSubmissionStatus] = useState('filling');
    const [apiError, setApiError] = useState("");
    const [autoFillError, setAutoFillError] = useState("");
    const [finalLoanSubmissionId, setFinalLoanSubmissionId] = useState(null);
    const [draftSaveStatus, setDraftSaveStatus] = useState({ saved: false, error: null, message: '' });
    
    // State for document validation and auto-fill
    const [docValidationStatus, setDocValidationStatus] = useState({});
    const [autoFilledFields, setAutoFilledFields] = useState({}); // For mainLoan fields sourced from KYC
    const [kycAutoFilledFields, setKycAutoFilledFields] = useState({ aadhaar: {}, pan: {} }); // For specific KYC fields auto-filled from DB
    
    const [showValidationErrors, setShowValidationErrors] = useState(false);
    const [isFormValidForSubmit, setIsFormValidForSubmit] = useState(false);

    const formRef = useRef(null);

    // Initialize form data from schemas and potentially a draft
    const initializeFormData = useCallback((loanDef, aadhaarDef, panDef, draftData = null) => {
        // Initialize mainFormData (amount and custom fields)
        const initialMainFormData = { amount: draftData?.amount ?? (loanDef?.min_amount || '') };
        (loanDef?.fields || []).forEach(f => {
            const draftField = draftData?.fields?.find(df => df.field_id === f.field_id);
            initialMainFormData[f.field_id] = draftField?.value ?? (f.type === 'checkbox' ? false : '');
            if ((f.type === 'image' || f.type === 'document') && draftField?.value) {
                setExistingFileRefs(prev => ({ ...prev, [`mainLoan_${f.field_id}`]: draftField.value }));
            }
        });
        setMainFormData(initialMainFormData);

        // Initialize Aadhaar FormData
        const initialAadhaarData = {};
        (aadhaarDef?.fields || []).forEach(f => {
            const draftValue = draftData?.aadhaarFormData?.[f.key];
            initialAadhaarData[f.key] = draftValue ?? (f.type === 'checkbox' ? false : '');
            if ((f.type === 'image' || f.type === 'document') && draftValue && typeof draftValue === 'string') {
                 setExistingFileRefs(prev => ({ ...prev, [`aadhaar_${f.key}`]: draftValue }));
            }
        });
        setAadhaarFormData(initialAadhaarData);
        
        // Initialize PAN FormData
        const initialPanData = {};
        (panDef?.fields || []).forEach(f => {
            const draftValue = draftData?.panFormData?.[f.key];
            initialPanData[f.key] = draftValue ?? (f.type === 'checkbox' ? false : '');
            if ((f.type === 'image' || f.type === 'document') && draftValue && typeof draftValue === 'string') {
                 setExistingFileRefs(prev => ({ ...prev, [`pan_${f.key}`]: draftValue }));
            }
        });
        setPanFormData(initialPanData);
        
        // Initialize other required docs from draft
        (loanDef?.required_documents || []).forEach(doc => {
            if (aadhaarDef && doc.name.toLowerCase() === aadhaarDef.name.toLowerCase()) return;
            if (panDef && doc.name.toLowerCase() === panDef.name.toLowerCase()) return;
            const docNameKey = doc.name.replace(/\s+/g, '_');
            const draftRefKey = `otherDoc_${docNameKey}`;
            if (draftData?.fileReferences?.[draftRefKey]) {
                setExistingFileRefs(prev => ({ ...prev, [draftRefKey]: draftData.fileReferences[draftRefKey] }));
            }
        });

        // Restore statuses from draft if available
        if (draftData?.docValidationStatus) setDocValidationStatus(draftData.docValidationStatus);
        if (draftData?.autoFilledFields) setAutoFilledFields(draftData.autoFilledFields);
        if (draftData?.kycAutoFilledFields) setKycAutoFilledFields(draftData.kycAutoFilledFields);
        else setKycAutoFilledFields({ aadhaar: {}, pan: {} }); // Ensure reset if not in draft

        // Reset file input states and other UI states
        setCustomFieldFiles({});
        setOtherRequiredDocFiles({});
        setAadhaarFieldFiles({});
        setPanFieldFiles({});
        setFormErrors({});
        setApiError("");
        setAutoFillError("");
        setSubmissionStatus('filling');
        setFinalLoanSubmissionId(null);
        setShowValidationErrors(false);
        setDraftSaveStatus({ saved: false, error: null, message: '' });
    }, []); 


    // Effect to load initial schemas and draft data
    useEffect(() => {
        let isMounted = true;
        const loadInitialData = async () => {
            setLoading(true);
            setApiError('');
            let localAadhaarSchemaDef = null;
            let localPanSchemaDef = null;
            let localLoanDef = null;
            try {
                // Fetch Loan Schema
                const loanRes = await axiosInstance.get(`/api/loans/${loanId}`);
                if (!isMounted) return;
                localLoanDef = loanRes.data;
                setLoanSchemaData(localLoanDef);

                // Fetch Aadhaar Schema
                try {
                    const aadhaarRes = await axiosInstance.get(`/api/document/schema-definition/by-schema-id/${AADHAAR_SCHEMA_ID_CONST}`);
                    if (isMounted) {
                        localAadhaarSchemaDef = aadhaarRes.data;
                        setAadhaarSchemaDef(localAadhaarSchemaDef);
                    }
                } catch (e) { console.error("Failed to load Aadhaar schema", e); if (isMounted) setApiError(prev => prev + "\nFailed to load Aadhaar definition."); }

                // Fetch PAN Schema
                try {
                    const panRes = await axiosInstance.get(`/api/document/schema-definition/by-schema-id/${PAN_SCHEMA_ID_CONST}`);
                    if (isMounted) {
                        localPanSchemaDef = panRes.data;
                        setPanSchemaDef(localPanSchemaDef);
                    }
                } catch (e) { console.error("Failed to load PAN schema", e); if (isMounted) setApiError(prev => prev + "\nFailed to load PAN definition."); }
                
                // Load Draft Data
                let draftData = null;
                try {
                    const draftRes = await axiosInstance.get(`/api/application/${loanId}/submissions/draft`);
                    if (isMounted) draftData = draftRes.data;
                } catch (draftErr) {
                    if (draftErr.response?.status !== 404) console.error("Error loading draft:", draftErr);
                }

                // Initialize form with all fetched data
                if (isMounted) initializeFormData(localLoanDef, localAadhaarSchemaDef, localPanSchemaDef, draftData);

            } catch (err) {
                console.error("Error loading initial data:", err);
                if (isMounted) setApiError(err.response?.data?.error || `Failed to load initial application data.`);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        if (loanId) loadInitialData();
        return () => { isMounted = false; };
    }, [loanId, initializeFormData]); 


    // Handles changes to regular form fields (text, select, etc.)
    const handleSectionFieldChange = useCallback((sectionName, fieldId, value) => {
        const setSectionData = {
            mainLoan: setMainFormData,
            aadhaar: setAadhaarFormData,
            pan: setPanFormData,
        }[sectionName];

        if (setSectionData) {
            setSectionData(prev => ({ ...prev, [fieldId]: value }));
        }

        // Clear auto-fill status if user manually edits
        if (sectionName === 'mainLoan' && autoFilledFields[fieldId]) {
            setAutoFilledFields(prev => {
                const newState = { ...prev };
                delete newState[fieldId];
                return newState;
            });
        } else if ((sectionName === 'aadhaar' || sectionName === 'pan') && kycAutoFilledFields[sectionName]?.[fieldId]) {
            setKycAutoFilledFields(prev => ({
                ...prev,
                [sectionName]: {
                    ...(prev[sectionName] || {}), 
                    [fieldId]: false 
                }
            }));
        }

        // Clear specific field error if shown and then edited
        if (showValidationErrors && formErrors[sectionName]?.[fieldId]) {
            setFormErrors(prev => {
                const newSectionErrors = { ...(prev[sectionName] || {}) };
                delete newSectionErrors[fieldId];
                return { ...prev, [sectionName]: newSectionErrors };
            });
        }
        setApiError(""); 
        setAutoFillError(""); 
        setDraftSaveStatus(prev => ({ ...prev, saved: false, message: '' })); 
    }, [autoFilledFields, kycAutoFilledFields, showValidationErrors, formErrors]); 

    // Handles file changes for custom loan fields
    const handleMainLoanCustomFileChange = useCallback((fieldId, file) => { 
        setCustomFieldFiles(prev => file ? { ...prev, [fieldId]: file } : (({ [fieldId]: _, ...rest }) => rest)(prev));
        setExistingFileRefs(prev => (({ [`mainLoan_${fieldId}`]: _, ...rest }) => rest)(prev)); 
        setDraftSaveStatus(prev => ({ ...prev, saved: false, message: '' }));
    }, []);
    
    // Handles file changes for "Other Required Documents"
    const handleOtherRequiredDocFileChange = useCallback((docNameKey, file) => {
        setOtherRequiredDocFiles(prev => file ? { ...prev, [docNameKey]: file } : (({ [docNameKey]: _, ...rest }) => rest)(prev));
        setExistingFileRefs(prev => (({ [`otherDoc_${docNameKey}`]: _, ...rest }) => rest)(prev)); 
        setDraftSaveStatus(prev => ({ ...prev, saved: false, message: '' }));
    }, []);

    // Logic for extracting data from KYC document image and then fetching verified data from DB
    // This function must be defined before handleKycFileChange which uses it.
    const triggerEntityExtraction = useCallback(async (docDisplayName, file, docDefinition) => {
        console.log(`Attempting entity extraction for ${docDisplayName}`);
        setDocValidationStatus(prev => ({ ...prev, [docDisplayName]: { status: 'image_extracting', message: 'Extracting data from image...' } }));
        setAutoFillError(''); 
        setApiError('');
        const kycSectionKey = docDefinition.schema_id === AADHAAR_SCHEMA_ID_CONST ? 'aadhaar' : 'pan';
        setKycAutoFilledFields(prevKyc => ({ ...prevKyc, [kycSectionKey]: {} })); 

        if (!docDefinition || !docDefinition.fields) {
            setDocValidationStatus(prev => ({ ...prev, [docDisplayName]: { status: 'error', message: 'Document definition not found.' } }));
            return;
        }

        let extractedDataFromImage;
        try { // Phase 1: Image Extraction
            const imageExtractFormData = new FormData();
            imageExtractFormData.append('document', file);
            imageExtractFormData.append('docType', docDefinition.schema_id);
            imageExtractFormData.append('fields', JSON.stringify({
                label: docDefinition.name,
                fields: docDefinition.fields.map(f => ({ key: f.key, label: f.label, prompt: f.prompt || '' }))
            }));

            const imageResponse = await axiosInstance.post('/api/application/extract-entity', imageExtractFormData, { headers: { 'Content-Type': 'multipart/form-data' } });
            const { entities: extractedPairs, doc_name: detectedDocTypeApi } = imageResponse.data;

            if (detectedDocTypeApi !== docDefinition.schema_id) {
                setDocValidationStatus(prev => ({ ...prev, [docDisplayName]: { status: 'error', message: `Incorrect document type. Expected ${docDefinition.name}, got ${detectedDocTypeApi || 'Unknown'}.` } }));
                setAutoFillError(`Incorrect document type for ${docDisplayName}. Please upload the correct document.`);
                return;
            }
            extractedDataFromImage = extractedPairs.reduce((acc, pair) => { if (pair.key) acc[pair.key] = pair.value; return acc; }, {});
            setDocValidationStatus(prev => ({ ...prev, [docDisplayName]: { status: 'image_extracted', message: 'Data extracted from image. Looking up in database...' } }));

        } catch (imageError) {
            console.error(`Image entity extraction failed for ${docDisplayName}:`, imageError);
            const errorMsg = imageError.response?.data?.error || 'Failed to process document image.';
            setDocValidationStatus(prev => ({ ...prev, [docDisplayName]: { status: 'error', message: errorMsg } }));
            setApiError(`Error processing ${docDisplayName} image: ${errorMsg}`);
            return;
        }

        // Phase 2: Identify unique key and its value from extracted data
        const uniqueFieldDef = docDefinition.fields.find(f => f.is_unique_identifier === true);
        if (!uniqueFieldDef) {
            setDocValidationStatus(prev => ({ ...prev, [docDisplayName]: { status: 'error', message: 'No unique identifier field defined in schema.' } }));
            setAutoFillError(`Configuration error: No unique identifier defined for ${docDisplayName} to perform database lookup.`);
            return;
        }

        const uniqueFieldValueFromImage = extractedDataFromImage[uniqueFieldDef.key];
        if (!uniqueFieldValueFromImage) {
            setDocValidationStatus(prev => ({ ...prev, [docDisplayName]: { status: 'unique_id_missing_from_image', message: `Could not extract unique ID (${uniqueFieldDef.label}) from the document image.` } }));
            setAutoFillError(`Could not extract unique ID (${uniqueFieldDef.label}) from ${docDisplayName} image. Please ensure the image is clear or enter data manually.`);
            return;
        }
        
        setDocValidationStatus(prev => ({ ...prev, [docDisplayName]: { status: 'db_lookup', message: `Found Unique ID: ${uniqueFieldValueFromImage}. Checking database...` } }));

        // Phase 3: Call backend to fetch verified data from DB using the unique ID
        try {
            const dbResponse = await axiosInstance.get('/api/document/fetch-verified-data-by-unique-id', {
                params: {
                    schema_id_string: docDefinition.schema_id,
                    unique_field_key: uniqueFieldDef.key,
                    unique_field_value: uniqueFieldValueFromImage
                }
            });

            const { verifiedData } = dbResponse.data; 
            
            if (verifiedData && verifiedData.fields) {
                // Compare extracted data with DB data before filling
                let allMatch = true;
                const mismatches = [];
                docDefinition.fields.forEach(fieldDef => {
                    if (fieldDef.type !== 'image' && fieldDef.type !== 'document') {
                        const extractedVal = extractedDataFromImage[fieldDef.key];
                        const dbVal = verifiedData.fields[fieldDef.key];
                        if (verifiedData.fields.hasOwnProperty(fieldDef.key)) {
                            if (extractedDataFromImage.hasOwnProperty(fieldDef.key)) {
                                if (String(extractedVal).trim() !== String(dbVal).trim()) {
                                    allMatch = false;
                                    mismatches.push({ field: fieldDef.label, extracted: extractedVal, database: dbVal });
                                }
                            } else {
                                console.warn(`Field "${fieldDef.label}" found in DB but not in image extraction for ${docDisplayName}.`);
                            }
                        }
                    }
                });

                if (allMatch) {
                    const setRelevantFormData = kycSectionKey === 'aadhaar' ? setAadhaarFormData : setPanFormData;
                    const newKycAutoFilledForThisSection = {};

                    setRelevantFormData(prevData => {
                        const newSectionData = { ...prevData };
                        Object.keys(verifiedData.fields).forEach(dbFieldKey => {
                            if (newSectionData.hasOwnProperty(dbFieldKey)) { 
                                newSectionData[dbFieldKey] = verifiedData.fields[dbFieldKey];
                                newKycAutoFilledForThisSection[dbFieldKey] = true;
                            }
                        });
                        return newSectionData;
                    });

                    if (Object.keys(newKycAutoFilledForThisSection).length > 0) {
                        setKycAutoFilledFields(prevKyc => ({ 
                            ...prevKyc, 
                            [kycSectionKey]: { ...(prevKyc[kycSectionKey] || {}), ...newKycAutoFilledForThisSection } 
                        }));
                    }
                    setDocValidationStatus(prev => ({ ...prev, [docDisplayName]: { status: 'verified_db_match', message: 'Data auto-filled from verified database record. Extracted data matches DB.' } }));
                    console.log(`${docDisplayName} data auto-filled from DB for unique ID ${uniqueFieldValueFromImage}. Data matches image extraction.`);

                    // Auto-fill mainLoan fields (using DB verified data)
                    setAutoFilledFields(prevAutoFilled => {
                        const newAutoFilledForMainLoan = {};
                        let mainFormUpdate = {};
                        (loanSchemaData?.fields || []).forEach(loanField => {
                            if (loanField.auto_fill_sources && loanField.auto_fill_sources.length > 0) {
                                loanField.auto_fill_sources.forEach(sourceStr => {
                                    const [sourceDocSchemaId, sourceFieldKey] = sourceStr.split('.');
                                    if (sourceDocSchemaId === docDefinition.schema_id && verifiedData.fields.hasOwnProperty(sourceFieldKey)) {
                                        const dbValueForSource = verifiedData.fields[sourceFieldKey];
                                        mainFormUpdate[loanField.field_id] = dbValueForSource;
                                        newAutoFilledForMainLoan[loanField.field_id] = { value: dbValueForSource, verifiedByDocType: docDefinition.schema_id };
                                    }
                                });
                            }
                        });
                        if(Object.keys(mainFormUpdate).length > 0) {
                            setMainFormData(prevMain => ({...prevMain, ...mainFormUpdate}));
                        }
                        return Object.keys(newAutoFilledForMainLoan).length > 0 ? {...prevAutoFilled, ...newAutoFilledForMainLoan} : prevAutoFilled;
                    });

                } else { // Mismatch found
                    setDocValidationStatus(prev => ({ ...prev, [docDisplayName]: { status: 'db_data_mismatch', message: 'Data extracted from image does not match verified database record. Please review and fill manually.', mismatches: mismatches } }));
                    setAutoFillError(`Data mismatch for ${docDisplayName}. Extracted: ${JSON.stringify(mismatches.map(m => ({field: m.field, extracted: m.extracted})))}. DB values were not auto-filled. Please correct manually.`);
                }

            } else { // No verifiedData.fields from DB
                setDocValidationStatus(prev => ({ ...prev, [docDisplayName]: { status: 'db_match_not_found', message: 'Verified record not found in database. Please fill manually.' } }));
                setAutoFillError(`No verified record found in database for ${docDisplayName} with ID ${uniqueFieldValueFromImage}. Please fill details manually.`);
            }
        } catch (dbError) {
            console.error(`Database lookup failed for ${docDisplayName}:`, dbError);
            const errorMsg = dbError.response?.data?.message || 'Failed to fetch verified data from database.';
            if (dbError.response?.status === 404) {
                 setDocValidationStatus(prev => ({ ...prev, [docDisplayName]: { status: 'db_match_not_found', message: errorMsg } }));
                 setAutoFillError(`No verified record found for ${docDisplayName} with ID ${uniqueFieldValueFromImage}. Please fill details manually.`);
            } else {
                setDocValidationStatus(prev => ({ ...prev, [docDisplayName]: { status: 'error', message: errorMsg } }));
                setApiError(`Error fetching data for ${docDisplayName}: ${errorMsg}`);
            }
        }
    }, [loanSchemaData, mainFormData]); 


    // Handles file changes for KYC documents (Aadhaar/PAN)
    const handleKycFileChange = useCallback((sectionName, fieldId, file) => { 
        const setSectionFiles = sectionName === 'aadhaar' ? setAadhaarFieldFiles : setPanFieldFiles;
        setSectionFiles(prev => file ? { ...prev, [fieldId]: file } : (({ [fieldId]: _, ...rest }) => rest)(prev));
        setExistingFileRefs(prev => (({ [`${sectionName}_${fieldId}`]: _, ...rest }) => rest)(prev));
        setDraftSaveStatus(prev => ({ ...prev, saved: false, message: '' }));

        const docDef = sectionName === 'aadhaar' ? aadhaarSchemaDef : panSchemaDef;
        if (docDef && file) {
            const primaryImageField = docDef.fields.find(f => f.type === 'image' || f.type === 'document'); 
            if (primaryImageField && fieldId === primaryImageField.key) {
                triggerEntityExtraction(docDef.name, file, docDef);
            }
        }
    }, [aadhaarSchemaDef, panSchemaDef, triggerEntityExtraction]); 


    // Validates a single section of the form
    const validateSection = useCallback((sectionName, schemaDef, sectionData, sectionFilesState) => {
        const errors = {};
        if (!schemaDef || !schemaDef.fields) return errors;
    
        schemaDef.fields.forEach(field => {
            const fieldKey = field.key || field.field_id;
            const value = sectionData[fieldKey];
            const isFileField = field.type === 'image' || field.type === 'document';
    
            if (field.required) {
                if (isFileField) {
                    const hasNewFile = sectionFilesState[fieldKey];
                    const hasExistingFile = existingFileRefs[`${sectionName}_${fieldKey}`];
                    if (!hasNewFile && !hasExistingFile) {
                        errors[fieldKey] = `${field.label || field.field_label} is required.`;
                    }
                } else if (value === null || value === undefined || String(value).trim() === '') {
                    errors[fieldKey] = `${field.label || field.field_label} is required.`;
                } else if (field.type === 'checkbox' && !value) {
                    errors[fieldKey] = `${field.label || field.field_label} must be checked.`;
                }
            }
    
            if (field.type === 'number' && value !== null && value !== undefined && String(value).trim() !== '') {
                const numValue = Number(value);
                if (isNaN(numValue)) {
                    errors[fieldKey] = `${field.label || field.field_label} must be a valid number.`;
                } else {
                    if (field.min_value !== null && field.min_value !== undefined && numValue < field.min_value) {
                        errors[fieldKey] = `${field.label || field.field_label} must be at least ${field.min_value}.`;
                    }
                    if (field.max_value !== null && field.max_value !== undefined && numValue > field.max_value) {
                        errors[fieldKey] = `${field.label || field.field_label} cannot exceed ${field.max_value}.`;
                    }
                }
            }
        });
        return errors;
    }, [existingFileRefs]); 
    

    // Runs validation for the entire form
    const runFullValidation = useCallback((showErrors = false) => {
        if (!loanSchemaData || !aadhaarSchemaDef || !panSchemaDef) {
            console.warn("Schemas not loaded, validation skipped.");
            return false;
        }
        const allErrors = {};
        let overallIsValid = true;

        const mainLoanCombinedSchema = { fields: [
            { field_id: 'amount', field_label: 'Loan Amount', type: 'number', required: true, min_value: loanSchemaData.min_amount, max_value: loanSchemaData.max_amount },
            ...(loanSchemaData.fields || [])
        ]};
        const mainLoanErrors = validateSection('mainLoan', mainLoanCombinedSchema, mainFormData, customFieldFiles);
        if (Object.keys(mainLoanErrors).length > 0) { allErrors.mainLoan = mainLoanErrors; overallIsValid = false; }

        const aadhaarErrors = validateSection('aadhaar', aadhaarSchemaDef, aadhaarFormData, aadhaarFieldFiles);
        if (Object.keys(aadhaarErrors).length > 0) { allErrors.aadhaar = aadhaarErrors; overallIsValid = false; }
        
        const aadhaarPrimaryDocField = aadhaarSchemaDef.fields.find(f => f.type === 'image' || f.type === 'document');
        const aadhaarFileKey = aadhaarPrimaryDocField?.key || 'card_image'; 
        const hasAadhaarFileForValidation = aadhaarFieldFiles[aadhaarFileKey] || existingFileRefs[`aadhaar_${aadhaarFileKey}`];
        const aadhaarStatus = docValidationStatus[aadhaarSchemaDef.name]?.status;

        if (hasAadhaarFileForValidation && aadhaarStatus !== 'verified_db_match' && aadhaarStatus !== 'submitted') {
            if (aadhaarStatus === 'db_data_mismatch' || aadhaarStatus === 'db_match_not_found' || aadhaarStatus === 'error' || aadhaarStatus === 'unique_id_missing_from_image') { 
                 allErrors.aadhaar = { ...allErrors.aadhaar, _general: docValidationStatus[aadhaarSchemaDef.name]?.message || `${aadhaarSchemaDef.name} requires attention. Please review or fill manually.` };
                 overallIsValid = false; 
            } else if (aadhaarStatus) { 
                 allErrors.aadhaar = { ...allErrors.aadhaar, _general: `${aadhaarSchemaDef.name} document is still processing.` };
                 overallIsValid = false; 
            }
        } else if (!hasAadhaarFileForValidation && aadhaarPrimaryDocField?.required && !allErrors.aadhaar?.[aadhaarFileKey]) {
            allErrors.aadhaar = { ...allErrors.aadhaar, [aadhaarFileKey]: `${aadhaarPrimaryDocField.label || aadhaarSchemaDef.name} document image is required.` };
            overallIsValid = false;
        }
        
        const panErrors = validateSection('pan', panSchemaDef, panFormData, panFieldFiles);
        if (Object.keys(panErrors).length > 0) { allErrors.pan = panErrors; overallIsValid = false; }

        const panPrimaryDocField = panSchemaDef.fields.find(f => f.type === 'image' || f.type === 'document');
        const panFileKey = panPrimaryDocField?.key || 'card_image';
        const hasPanFileForValidation = panFieldFiles[panFileKey] || existingFileRefs[`pan_${panFileKey}`];
        const panStatus = docValidationStatus[panSchemaDef.name]?.status;

        if (hasPanFileForValidation && panStatus !== 'verified_db_match' && panStatus !== 'submitted') {
             if (panStatus === 'db_data_mismatch' || panStatus === 'db_match_not_found' || panStatus === 'error' || panStatus === 'unique_id_missing_from_image') {
                 allErrors.pan = { ...allErrors.pan, _general: docValidationStatus[panSchemaDef.name]?.message || `${panSchemaDef.name} requires attention. Please review or fill manually.` };
                 overallIsValid = false; 
             } else if (panStatus) {
                 allErrors.pan = { ...allErrors.pan, _general: `${panSchemaDef.name} document is still processing.` };
                 overallIsValid = false;
             }
        } else if (!hasPanFileForValidation && panPrimaryDocField?.required && !allErrors.pan?.[panFileKey]) {
            allErrors.pan = { ...allErrors.pan, [panFileKey]: `${panPrimaryDocField.label || panSchemaDef.name} document image is required.` };
            overallIsValid = false;
        }

        const otherDocsErrors = {};
        (loanSchemaData.required_documents || []).forEach(doc => {
            if (doc.name.toLowerCase() === aadhaarSchemaDef.name.toLowerCase() || doc.name.toLowerCase() === panSchemaDef.name.toLowerCase()) return;
            const docNameKey = doc.name.replace(/\s+/g, '_');
            if (!otherRequiredDocFiles[docNameKey] && !existingFileRefs[`otherDoc_${docNameKey}`]) {
                otherDocsErrors[docNameKey] = `${doc.name} is required.`;
                overallIsValid = false;
            }
        });
        if (Object.keys(otherDocsErrors).length > 0) allErrors.otherRequiredDocs = otherDocsErrors;

        if (showErrors) setFormErrors(allErrors);
        setIsFormValidForSubmit(overallIsValid);
        return overallIsValid;
    }, [loanSchemaData, aadhaarSchemaDef, panSchemaDef, mainFormData, aadhaarFormData, panFormData, customFieldFiles, aadhaarFieldFiles, panFieldFiles, otherRequiredDocFiles, existingFileRefs, docValidationStatus, validateSection]);


    // Effect to re-run validation when relevant data changes
    useEffect(() => {
        if (loanSchemaData && aadhaarSchemaDef && panSchemaDef) { 
            runFullValidation(showValidationErrors); 
        }
    }, [loanSchemaData, aadhaarSchemaDef, panSchemaDef, mainFormData, aadhaarFormData, panFormData, customFieldFiles, aadhaarFieldFiles, panFieldFiles, otherRequiredDocFiles, existingFileRefs, docValidationStatus, showValidationErrors, runFullValidation]);


    // Handles the final form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setApiError(''); setAutoFillError('');
        setDraftSaveStatus(prev => ({ ...prev, saved: false, message: '' }));
        setShowValidationErrors(true); 

        if (!runFullValidation(true)) {
            const firstErrorElement = formRef.current?.querySelector('.is-invalid, .is-invalid-doc, .alert-danger[role="alert"]');
            if (firstErrorElement) {
                firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            setApiError("Please correct the errors highlighted in the form before submitting.");
            return;
        }
        
        setIsSubmitting(true);
        setSubmissionStatus('submitting_kyc');

        let currentAadhaarSubmissionId = docValidationStatus[aadhaarSchemaDef.name]?.submissionId || null;
        let currentPanSubmissionId = docValidationStatus[panSchemaDef.name]?.submissionId || null;

        try {
            // Step 1: Submit Aadhaar GovDocument Data (if not already submitted or if files changed)
            if (!currentAadhaarSubmissionId || Object.keys(aadhaarFieldFiles).length > 0) {
                const aadhaarApiFormData = new FormData();
                aadhaarApiFormData.append('schema_definition_id', aadhaarSchemaDef._id);
                aadhaarApiFormData.append('fieldsData', JSON.stringify(
                    aadhaarSchemaDef.fields.map(f => ({ field_id: f.key, field_label: f.label, type: f.type, value: aadhaarFormData[f.key] }))
                ));
                for (const fieldKey in aadhaarFieldFiles) {
                    if (aadhaarFieldFiles[fieldKey]) aadhaarApiFormData.append(fieldKey, aadhaarFieldFiles[fieldKey]);
                }
                const aadhaarRes = await axiosInstance.post('/api/document/submission', aadhaarApiFormData, { headers: { 'Content-Type': 'multipart/form-data' } });
                currentAadhaarSubmissionId = aadhaarRes.data.submissionId;
                setDocValidationStatus(prev => ({ ...prev, [aadhaarSchemaDef.name]: { ...prev[aadhaarSchemaDef.name], status: 'submitted', submissionId: currentAadhaarSubmissionId } }));
                setAadhaarFieldFiles({}); 
            }

            // Step 2: Submit PAN GovDocument Data (if not already submitted or if files changed)
            if (!currentPanSubmissionId || Object.keys(panFieldFiles).length > 0) {
                const panApiFormData = new FormData();
                panApiFormData.append('schema_definition_id', panSchemaDef._id);
                panApiFormData.append('fieldsData', JSON.stringify(
                    panSchemaDef.fields.map(f => ({ field_id: f.key, field_label: f.label, type: f.type, value: panFormData[f.key] }))
                ));
                for (const fieldKey in panFieldFiles) {
                    if (panFieldFiles[fieldKey]) panApiFormData.append(fieldKey, panFieldFiles[fieldKey]);
                }
                const panRes = await axiosInstance.post('/api/document/submission', panApiFormData, { headers: { 'Content-Type': 'multipart/form-data' } });
                currentPanSubmissionId = panRes.data.submissionId;
                setDocValidationStatus(prev => ({ ...prev, [panSchemaDef.name]: { ...prev[panSchemaDef.name], status: 'submitted', submissionId: currentPanSubmissionId } }));
                setPanFieldFiles({}); 
            }

            setSubmissionStatus('submitting_loan');

            // Step 3: Upload other files (custom fields, other required docs)
            const uploadedFileRefsForLoan = { ...existingFileRefs };
            const filesToUploadForLoan = [];
            Object.entries(customFieldFiles).forEach(([fieldId, file]) => {
                if (!existingFileRefs[`mainLoan_${fieldId}`]) filesToUploadForLoan.push({ key: `mainLoan_${fieldId}`, file, type: 'custom', field_id: fieldId });
            });
            Object.entries(otherRequiredDocFiles).forEach(([docNameKey, file]) => {
                if (!existingFileRefs[`otherDoc_${docNameKey}`]) filesToUploadForLoan.push({ key: `otherDoc_${docNameKey}`, file, type: 'required', docName: docNameKey.replace(/_/g, ' ') });
            });

            await Promise.all(filesToUploadForLoan.map(async ({ key, file, type, field_id, docName }) => {
                const fileUploadFormData = new FormData();
                fileUploadFormData.append("file", file);
                try {
                    const { data: uploadResult } = await axiosInstance.post("/api/file", fileUploadFormData, { headers: { "Content-Type": "multipart/form-data" } });
                    uploadedFileRefsForLoan[key] = uploadResult.id; 
                } catch (uploadError) {
                    console.error(`Failed to upload file for ${key}:`, uploadError);
                    throw new Error(`Failed to upload ${type === 'custom' && loanSchemaData?.fields ? loanSchemaData.fields.find(f => f.field_id === field_id)?.field_label : docName}. ${uploadError.response?.data?.error || ''}`);
                }
            }));
            
            // Step 4: Construct and Submit Final Loan Application
            const finalLoanFields = loanSchemaData.fields.map(f => ({
                field_id: f.field_id, field_label: f.label, type: f.type,
                value: (f.type !== 'image' && f.type !== 'document') ? (mainFormData[f.field_id] || '') : null,
                fileRef: (f.type === 'image' || f.type === 'document') ? (uploadedFileRefsForLoan[`mainLoan_${f.field_id}`] || null) : undefined
            }));
            const finalOtherRequiredDocs = (loanSchemaData.required_documents || [])
                .filter(doc => aadhaarSchemaDef && panSchemaDef && doc.name.toLowerCase() !== aadhaarSchemaDef.name.toLowerCase() && doc.name.toLowerCase() !== panSchemaDef.name.toLowerCase())
                .map(doc => ({ documentName: doc.name, fileRef: uploadedFileRefsForLoan[`otherDoc_${doc.name.replace(/\s+/g, '_')}`] || null }))
                .filter(ref => ref.fileRef);

            const loanSubmissionPayload = {
                amount: Number(mainFormData.amount),
                aadhaar_document_submission_id: currentAadhaarSubmissionId,
                pan_document_submission_id: currentPanSubmissionId,
                fields: finalLoanFields,
                requiredDocumentRefs: finalOtherRequiredDocs
            };
            
            const { data: submissionResult } = await axiosInstance.post(`/api/application/${loanId}/submissions`, loanSubmissionPayload);
            setFinalLoanSubmissionId(submissionResult._id || submissionResult.id);
            setSubmissionStatus('submitted');
            setCustomFieldFiles({}); 
            setOtherRequiredDocFiles({}); 

        } catch (err) {
            console.error("Submission process failed:", err);
            setApiError(err.message || err.response?.data?.error || "Submission failed. Please try again.");
            setSubmissionStatus('filling'); 
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Handles saving the form as a draft
    const handleSaveDraft = async () => {
        setIsSavingDraft(true);
        setDraftSaveStatus({ saved: false, error: null, message: 'Saving draft...' });
        setApiError('');
            
        const draftPayload = {
            loan_id: loanId,
            amount: mainFormData.amount,
            fields: loanSchemaData?.fields?.map(f => ({ 
                field_id: f.field_id,
                value: mainFormData[f.field_id],
                fileRef: (f.type === 'image' || f.type === 'document') ? existingFileRefs[`mainLoan_${f.field_id}`] : undefined
            })) || [],
            aadhaarFormData: aadhaarFormData, 
            panFormData: panFormData,       
            fileReferences: { ...existingFileRefs }, 
            docValidationStatus: docValidationStatus, 
            autoFilledFields: autoFilledFields,
            kycAutoFilledFields: kycAutoFilledFields, 
        };
    
        try {
            console.log("Saving draft with payload:", draftPayload);
            await axiosInstance.post(`/api/application/${loanId}/submissions/draft`, draftPayload);
            setDraftSaveStatus({ saved: true, error: null, message: 'Draft saved successfully!' });
        } catch (err) {
            console.error("Error saving draft:", err);
            const errMsg = err.response?.data?.error || err.message || 'Failed to save draft.';
            setDraftSaveStatus({ saved: false, error: true, message: `Failed to save draft: ${errMsg}` });
        } finally {
            setIsSavingDraft(false);
        }
    };
    
    // --- Render Logic ---
    if (loading) {
        return <Container fluid className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}><Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} /><p className="ms-3 fs-5 text-muted">Loading Application Setup...</p></Container>;
    }
    if (apiError && !loanSchemaData && !isSubmitting && submissionStatus !== 'submitted') {
        return <Container className="mt-5"><Alert variant="danger">Critical Error: {apiError.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}</Alert></Container>;
    }
    if (!loanSchemaData || !aadhaarSchemaDef || !panSchemaDef) {
        return (
            <Container className="mt-5">
                <Alert variant="warning">
                    <Alert.Heading><FaExclamationTriangle className="me-2" />Application Setup Incomplete</Alert.Heading>
                    <p>Required document definitions (Aadhaar/PAN) could not be loaded. Please ensure schemas with IDs '<code>{AADHAAR_SCHEMA_ID_CONST}</code>' and '<code>{PAN_SCHEMA_ID_CONST}</code>' are defined by the admin.</p>
                    {apiError && !loading && <><hr /><p className="mb-0 small">{apiError.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}</p></>}
                </Alert>
            </Container>
        );
    }

    if (submissionStatus === 'submitted') {
        return (
            <Container className="mt-5 text-center">
                <Alert variant="success" className="shadow-sm p-4">
                    <h3><FaCheckCircle className="me-2 text-success" />Application Submitted!</h3>
                    <p>Your application for "{loanSchemaData?.title}" has been received.</p>
                    <p>Submission ID: <strong>{finalLoanSubmissionId}</strong></p>
                    <hr />
                    <Button variant="primary" size="sm" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
                </Alert>
            </Container>
        );
    }

    // Helper functions to get errors for display
    const getFieldError = (sectionName, fieldKey) => formErrors[sectionName]?.[fieldKey];
    const getSectionGeneralError = (sectionName) => formErrors[sectionName]?._general;

    return (
        <Container fluid className="my-4 application-form-container p-md-4">
            <LoanInfoHeader loanSchemaData={loanSchemaData} />

            {/* Global Alerts */}
            {apiError && !isSubmitting && submissionStatus !== 'submitted' && <Alert variant="danger" onClose={() => setApiError("")} dismissible>{apiError.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}</Alert>}
            {autoFillError && <Alert variant="warning" onClose={() => setAutoFillError("")} dismissible><strong>Auto-fill Notice:</strong> {autoFillError.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}</Alert>}
            {draftSaveStatus.message && !isSavingDraft && <Alert variant={draftSaveStatus.error ? "danger" : (draftSaveStatus.saved ? "success" : "info")} onClose={() => setDraftSaveStatus(prev => ({ ...prev, message: '' }))} dismissible>{draftSaveStatus.message}</Alert>}

            <Form ref={formRef} onSubmit={handleSubmit} noValidate className={showValidationErrors ? 'was-validated' : ''}>
                {/* Aadhaar Section */}
                {aadhaarSchemaDef && 
                    <KycDocumentSection
                        docSchemaDef={aadhaarSchemaDef}
                        docFormData={aadhaarFormData}
                        sectionName="aadhaar"
                        docValidationState={docValidationStatus[aadhaarSchemaDef.name]}
                        existingFileRefs={existingFileRefs}
                        onFieldChange={handleSectionFieldChange}
                        onFileChange={handleKycFileChange} 
                        getFieldError={getFieldError}
                        getSectionGeneralError={getSectionGeneralError}
                        isSubmitting={isSubmitting}
                        isSavingDraft={isSavingDraft}
                        showValidationErrors={showValidationErrors}
                        autoFilledKycFields={kycAutoFilledFields.aadhaar || {}} 
                    />
                }

                {/* PAN Section */}
                {panSchemaDef &&
                    <KycDocumentSection
                        docSchemaDef={panSchemaDef}
                        docFormData={panFormData}
                        sectionName="pan"
                        docValidationState={docValidationStatus[panSchemaDef.name]}
                        existingFileRefs={existingFileRefs}
                        onFieldChange={handleSectionFieldChange}
                        onFileChange={handleKycFileChange} 
                        getFieldError={getFieldError}
                        getSectionGeneralError={getSectionGeneralError}
                        isSubmitting={isSubmitting}
                        isSavingDraft={isSavingDraft}
                        showValidationErrors={showValidationErrors}
                        autoFilledKycFields={kycAutoFilledFields.pan || {}} 
                    />
                }

                {/* Loan Details Section */}
                {loanSchemaData &&
                    <LoanDetailsSection
                        loanSchemaData={loanSchemaData}
                        mainFormData={mainFormData}
                        handleSectionFieldChange={handleSectionFieldChange}
                        handleMainLoanCustomFileChange={handleMainLoanCustomFileChange}
                        getFieldError={getFieldError}
                        isSubmitting={isSubmitting}
                        isSavingDraft={isSavingDraft}
                        existingFileRefs={existingFileRefs}
                        autoFilledFields={autoFilledFields}
                        docValidationStatus={docValidationStatus}
                        aadhaarSchemaDef={aadhaarSchemaDef}
                        panSchemaDef={panSchemaDef}
                        showValidationErrors={showValidationErrors}
                    />
                }
                
                {/* Other Required Documents Section */}
                {loanSchemaData && aadhaarSchemaDef && panSchemaDef &&
                    <OtherDocumentsSection
                        loanSchemaData={loanSchemaData}
                        otherRequiredDocFiles={otherRequiredDocFiles}
                        handleOtherRequiredDocFileChange={handleOtherRequiredDocFileChange}
                        getFieldError={getFieldError}
                        isSubmitting={isSubmitting}
                        isSavingDraft={isSavingDraft}
                        existingFileRefs={existingFileRefs}
                        showValidationErrors={showValidationErrors}
                        aadhaarSchemaDef={aadhaarSchemaDef}
                        panSchemaDef={panSchemaDef}
                    />
                }

                {/* Action Buttons */}
                <ActionButtons
                    isSubmitting={isSubmitting}
                    isSavingDraft={isSavingDraft}
                    isFormValidForSubmit={isFormValidForSubmit}
                    submissionStatus={submissionStatus}
                    draftSaveStatus={draftSaveStatus}
                    handleSaveDraft={handleSaveDraft}
                />
            </Form>
        </Container>
    );
}
