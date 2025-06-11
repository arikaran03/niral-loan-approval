// src/components/application/WaiverApplicationForm.js

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Form,
  Button,
  Spinner,
  Row,
  Col,
  Alert,
  ListGroup,
  Badge,
} from "react-bootstrap";
import { axiosInstance } from "../../../config"; // Adjust path as per your project structure
import {
  FaInfoCircle,
  FaPercentage,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCloudUploadAlt,
  FaTrash,
  FaListOl,
  FaFileMedicalAlt,
  FaRegSave,
  FaShieldAlt,
  FaDownload,
  FaPaperclip,
  FaHandHoldingUsd, // Icon for waiver
  FaFileUpload
} from "react-icons/fa";
import {
  Check,
  AlertCircle,
  FileWarning,
  UserCheck,
  BarChart3,
  MessageSquareText,
} from "lucide-react";
import annexurePdf from "../applications/annexure.pdf"; // Adjust path as per your project structure
import "../applications/ApplicationForm.css"; // You can reuse or create a new CSS file
import FaceVerificationApp from "../verification/FaceVerificationApp"; // Adjust path
import FieldRenderer from "../applications/FieldRenderer"; // Adjust path
import OtpVerificationModal from "../applications/OtpVerificationModal"; // Adjust path

// Define field labels eligible for annexure if mismatched (likely still relevant for applicant details)
const ANNEXURE_ELIGIBLE_FIELD_LABELS = [
  "Full Name",
  "Applicant Name",
  "Name",
  "Address",
  "Permanent Address",
  "Current Address",
  "Street Address",
  "Father Name",
  "Spouses Name",
];

export default function WaiverApplicationForm() {
  const { waiverSchemeId } = useParams(); // Changed from loanId
  const navigate = useNavigate();

  // State
  const [waiverSchemeData, setWaiverSchemeData] = useState(null); // Renamed
  const [formData, setFormData] = useState({}); // For custom fields
  const [requiredDocFiles, setRequiredDocFiles] = useState({});
  const [customFieldFiles, setCustomFieldFiles] = useState({});
  const [existingFileRefs, setExistingFileRefs] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftSaveStatus, setDraftSaveStatus] = useState({ saved: false, time: null });
  const [submissionStatus, setSubmissionStatus] = useState("filling");
  const [apiError, setApiError] = useState("");
  const [autoFillError, setAutoFillError] = useState("");
  const [submissionId, setSubmissionId] = useState(null);
  const [docValidationStatus, setDocValidationStatus] = useState({});
  const [isFormValidForSubmit, setIsFormValidForSubmit] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState({});
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // KYC States (Face Verification, OTP, Annexure) - largely reusable
  const [aadhaarPhotoIdForVerification, setAadhaarPhotoIdForVerification] = useState(null);
  const [isFaceVerificationComplete, setIsFaceVerificationComplete] = useState(false);
  const [showFaceVerificationModule, setShowFaceVerificationModule] = useState(false);
  const [faceVerificationError, setFaceVerificationError] = useState("");
  const [annexureEligibleMismatches, setAnnexureEligibleMismatches] = useState([]);
  const [showAnnexureUpload, setShowAnnexureUpload] = useState(false);
  const [annexureFile, setAnnexureFile] = useState(null);
  const [existingAnnexureFileRef, setExistingAnnexureFileRef] = useState(null);
  const [annexureFileError, setAnnexureFileError] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpVerificationMobileNumber, setOtpVerificationMobileNumber] = useState(null);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [otpVerificationError, setOtpVerificationError] = useState("");
  const [isAadhaarFromGovDB, setIsAadhaarFromGovDB] = useState(false);
  const [currentOtpRequestId, setCurrentOtpRequestId] = useState(null);


  const formRef = useRef(null);

  const getFieldKeyFromSource = (sourceString) => {
    if (!sourceString) return null;
    const p = sourceString.split(".");
    return p.length > 1 ? p[p.length - 1] : null;
  };

  const formatDateToYYYYMMDD = (dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return dateStr;
    const isoMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];
    const ddmmMatch = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!ddmmMatch) return dateStr;
    const day = ddmmMatch[1];
    const month = ddmmMatch[2];
    const year = ddmmMatch[3];
    return `${year}-${month}-${day}`;
  };
  const formatDateToDDMMYYYY = (isoDateString) => {
    if (!isoDateString || !/^\d{4}-\d{2}-\d{2}$/.test(isoDateString)) return isoDateString;
    const parts = isoDateString.split("-");
    if (parts.length !== 3) return isoDateString;
    const [year, month, day] = parts;
    return `${day}-${month}-${year}`;
  };

  const initializeForm = useCallback((schemeDef, draftData = null) => {
    const initialFd = {}; // For custom fields
    const initialExistingRefs = {};
    const customFields = schemeDef?.fields || [];
    const reqDocs = schemeDef?.required_documents || []; // Documents required by the scheme

    customFields.forEach((f) => {
      const draftField = draftData?.fields?.find((df) => df.field_id === f.field_id);
      const isPotentiallyAutoFill = f.auto_fill_sources && f.auto_fill_sources.length > 0;
      let initialValue = "";
      if (draftData && !isPotentiallyAutoFill && draftField?.value !== undefined) {
        initialValue = draftField.value;
      } else if (isPotentiallyAutoFill) {
        initialValue = "";
      } else if (draftData && draftField?.value !== undefined) {
        initialValue = draftField.value;
      } else if (f.default_value !== undefined) {
        initialValue = f.default_value;
      }
      if (f.type === "date" && initialValue) {
        initialValue = formatDateToYYYYMMDD(initialValue);
      }
      initialFd[f.field_id] = initialValue;

      if ((f.type === "image" || f.type === "document") && draftField?.value) {
        initialExistingRefs[f.field_id] = draftField.value;
      }
    });

    const allDocsForDraft = [...reqDocs];
    if (!reqDocs.find((d) => d.name === "aadhaar_card" || d.schema_id === "aadhaar_card")) {
        allDocsForDraft.push({ name: "Aadhaar Card", schema_id: "aadhaar_card" });
    }
    if (!reqDocs.find((d) => d.name === "pan_card" || d.schema_id === "pan_card")) {
        allDocsForDraft.push({ name: "PAN Card", schema_id: "pan_card" });
    }

    allDocsForDraft.forEach((doc) => {
      const docKey = doc.schema_id || doc.name;
      const draftRefKey = `reqDoc_${docKey}`;
      if (draftData?.requiredDocumentRefs?.find(ref => ref.documentTypeKey === docKey)?.fileRef) {
        initialExistingRefs[draftRefKey] = draftData.requiredDocumentRefs.find(ref => ref.documentTypeKey === docKey).fileRef;
      } else if (draftData?.fileReferences?.[draftRefKey]) {
        initialExistingRefs[draftRefKey] = draftData.fileReferences[draftRefKey];
      }
    });

    if (draftData?.annexureDocumentRef) {
      setExistingAnnexureFileRef(draftData.annexureDocumentRef);
    }

    const draftAutoFilled = draftData?.autoFilledFields || {};
    setFormData(initialFd);
    setRequiredDocFiles({});
    setCustomFieldFiles({});
    setExistingFileRefs(initialExistingRefs);
    setFormErrors({});
    setApiError("");
    setAutoFillError("");
    setSubmissionStatus("filling");
    setSubmissionId(null);
    setDocValidationStatus({});
    setAutoFilledFields(draftAutoFilled);
    setShowValidationErrors(false);
    setAadhaarPhotoIdForVerification(null);
    setIsFaceVerificationComplete(false);
    setShowFaceVerificationModule(false);
    setFaceVerificationError("");
    setShowOtpModal(false);
    setOtpVerificationMobileNumber(null);
    setCurrentOtpRequestId(null);
    setIsOtpVerified(false);
    setOtpVerificationError("");
    setIsAadhaarFromGovDB(false);
    setAnnexureEligibleMismatches([]);
    setShowAnnexureUpload(false);
    setAnnexureFile(null);
    setAnnexureFileError("");
  }, []);

  useEffect(() => {
    if (!waiverSchemeId) {
      setApiError("Waiver Scheme ID is missing.");
      setLoading(false);
      return;
    }
    let isMounted = true;
    setLoading(true);
    const loadData = async () => {
      try {
        const schemeRes = await axiosInstance.get(`/api/waiver-schemes/${waiverSchemeId}`);
        if (!isMounted) return;
        const schemeDef = schemeRes.data;
        if (!schemeDef.document_definitions) schemeDef.document_definitions = {};
        if (!schemeDef.aadhaar_card_definition && schemeDef.document_definitions.aadhaar_card) {
            schemeDef.aadhaar_card_definition = schemeDef.document_definitions.aadhaar_card;
        }
        if (!schemeDef.pan_card_definition && schemeDef.document_definitions.pan_card) {
            schemeDef.pan_card_definition = schemeDef.document_definitions.pan_card;
        }
        setWaiverSchemeData(schemeDef);
        let draftData = null;
        try {
          const draftRes = await axiosInstance.get(`/api/waiver-submissions/draft/${waiverSchemeId}`);
          if (!isMounted) return;
          draftData = draftRes.data;
          console.log("Waiver application draft loaded:", draftData);
        } catch (draftErr) {
          if (draftErr.response?.status !== 404) console.error("Error loading waiver application draft:", draftErr);
        }
        initializeForm(schemeDef, draftData);
      } catch (err) {
        console.error("Error loading waiver scheme definition:", err);
        if (isMounted) {
          setApiError(err.response?.data?.error || `Failed to load waiver scheme details (ID: ${waiverSchemeId}).`);
          setWaiverSchemeData(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [waiverSchemeId, initializeForm]);


  const handleInputChange = useCallback((fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    setAutoFilledFields(prev => {
        if (!prev[fieldId]) return prev;
        if (String(prev[fieldId].value).toLowerCase() !== String(value).toLowerCase()) {
            const newState = {...prev}; delete newState[fieldId]; return newState;
        }
        return prev;
    });
    if (showValidationErrors) {
        setFormErrors(prev => { if (!prev[fieldId]) return prev; const n = {...prev}; delete n[fieldId]; return n; });
    }
    if(apiError) setApiError(""); if(autoFillError) setAutoFillError("");
  }, [apiError, autoFillError, showValidationErrors]);

  const handleCustomFieldFileChange = useCallback((fieldId, file) => {
      setCustomFieldFiles(prev => { const n = {...prev}; if (file) n[fieldId] = file; else delete n[fieldId]; return n; });
      setExistingFileRefs(prev => { const n = {...prev}; delete n[fieldId]; return n; });
      handleInputChange(fieldId, file ? file.name : '');
  }, [handleInputChange]);

  const validateField = useCallback((fieldSchema, value) => {
    const { required, type, min_value, max_value, field_label } = fieldSchema;
    const label = field_label || 'Field';
    if (required && type !== 'image' && type !== 'document') {
        if (value === null || value === undefined || String(value).trim() === '') return `${label} is required.`;
        if (type === 'checkbox' && !value) return `${label} must be checked.`;
    }
    if (!required && (value === null || value === undefined || String(value).trim() === '')) return null;
    switch (type) {
        case 'number':
            const n = parseFloat(value);
            if (isNaN(n)) return `${label} must be a valid number.`;
            if (min_value !== null && min_value !== undefined && String(min_value).trim() !== '' && n < parseFloat(min_value)) return `${label} must be at least ${min_value}.`;
            if (max_value !== null && max_value !== undefined && String(max_value).trim() !== '' && n > parseFloat(max_value)) return `${label} cannot exceed ${max_value}.`;
            break;
        case 'text': case 'textarea':
            const s = String(value || '');
            if (min_value !== null && min_value !== undefined && String(min_value).trim() !== '' && s.length < parseInt(min_value, 10)) return `${label} must be at least ${min_value} characters long.`;
            if (max_value !== null && max_value !== undefined && String(max_value).trim() !== '' && s.length > parseInt(max_value, 10)) return `${label} cannot exceed ${max_value} characters.`;
            break;
        case 'date': case 'datetime-local':
            if (value && isNaN(Date.parse(value))) return `${label} must be a valid date.`;
            if (min_value && value && new Date(value) < new Date(formatDateToYYYYMMDD(min_value))) return `${label} cannot be earlier than ${min_value}.`;
            if (max_value && value && new Date(value) > new Date(formatDateToYYYYMMDD(max_value))) return `${label} cannot be later than ${max_value}.`;
            break;
        default: break;
    }
    return null;
  }, []);


  const runFullValidation = useCallback((showErrors = false) => {
    const currentErrors = {};
    let hasHardErrors = false; // Tracks errors that cannot be resolved by an annexure
    let hasNonAnnexureEligibleDiscrepancies = false; // Tracks if any doc has errors not fixable by annexure
    let tempAnnexureEligibleMismatchesLocal = [];

    if (!waiverSchemeData) {
      setIsFormValidForSubmit(false);
      return false;
    }

    // Validate custom fields from the waiver scheme
    (waiverSchemeData.fields || []).forEach(f => {
      const error = validateField(f, formData[f.field_id]);
      if (error) {
        currentErrors[f.field_id] = error;
        hasHardErrors = true; // Custom field errors are hard errors
      }
    });

    // Document validation (Aadhaar, PAN, and other scheme-specific required docs)
    const schemeReqDocs = waiverSchemeData.required_documents || [];
    const allDocsForValidation = [
        { key: 'aadhaar_card', def: waiverSchemeData.aadhaar_card_definition, isMandatorySystemLevel: true, schema_id: 'aadhaar_card' },
        { key: 'pan_card', def: waiverSchemeData.pan_card_definition, isMandatorySystemLevel: true, schema_id: 'pan_card' },
        ...schemeReqDocs.map(doc => ({
            key: doc.schema_id || doc.name,
            def: waiverSchemeData.document_definitions?.[doc.schema_id || doc.name],
            isMandatorySystemLevel: false,
            schemeReqDocEntry: doc,
            schema_id: doc.schema_id || doc.name
        }))
    ];

    allDocsForValidation.forEach(docInfo => {
      const docKeyForStatusAndFiles = docInfo.schema_id;
      if (!docInfo.def && (docInfo.isMandatorySystemLevel || schemeReqDocs.find(rd => (rd.schema_id || rd.name) === docKeyForStatusAndFiles)) ) {
          currentErrors[`reqDoc_${docKeyForStatusAndFiles}`] = `${docInfo.schemeReqDocEntry?.name || docKeyForStatusAndFiles.replace('_', ' ')} definition is missing.`;
          hasHardErrors = true;
          hasNonAnnexureEligibleDiscrepancies = true; // Definition missing is a hard, non-annexure error
          return;
      }
      const docLabel = docInfo.def?.label || docInfo.schemeReqDocEntry?.name || docKeyForStatusAndFiles;
      const docRefKey = `reqDoc_${docKeyForStatusAndFiles}`;
      const hasUploadedFile = !!requiredDocFiles[docKeyForStatusAndFiles];
      const hasExistingFile = !!existingFileRefs[docRefKey];
      const statusInfo = docValidationStatus[docKeyForStatusAndFiles];

      if (!hasUploadedFile && !hasExistingFile) {
          currentErrors[docRefKey] = `${docLabel} is required.`;
          hasHardErrors = true;
          // Missing document is a hard error, but could be non-annexure related if it's not about name/address.
          // However, the primary issue is missing doc, not mismatch.
          // For simplicity, let's assume missing doc itself is a hard error not fixed by annexure.
          hasNonAnnexureEligibleDiscrepancies = true;
      } else if (!statusInfo || statusInfo.status !== 'verified') {
          if (statusInfo?.status === 'error' && statusInfo.mismatches && statusInfo.mismatches.length > 0) {
              const annexureEligibleForThisDoc = statusInfo.mismatches.filter(mm => ANNEXURE_ELIGIBLE_FIELD_LABELS.includes(mm.fieldLabel));
              const nonAnnexureEligibleForThisDoc = statusInfo.mismatches.filter(mm => !ANNEXURE_ELIGIBLE_FIELD_LABELS.includes(mm.fieldLabel));

              if (nonAnnexureEligibleForThisDoc.length > 0) {
                  currentErrors[docRefKey] = `${docLabel} has critical data mismatches or other verification issues: ${nonAnnexureEligibleForThisDoc.map(m=>m.fieldLabel).join(', ')}. Please re-upload or check the document.`;
                  hasHardErrors = true;
                  hasNonAnnexureEligibleDiscrepancies = true;
              } else if (annexureEligibleForThisDoc.length > 0) {
                  // ALL mismatches for THIS document are annexure-eligible
                  annexureEligibleForThisDoc.forEach(mm => {
                      tempAnnexureEligibleMismatchesLocal.push({
                          docTypeKey: docInfo.schema_id,
                          fieldLabel: mm.fieldLabel,
                          extractedValue: mm.actual,
                          formValue: mm.expected
                      });
                  });
                  currentErrors[docRefKey] = `${docLabel} has Name/Address discrepancies. An annexure document may be required if these cannot be resolved by re-uploading.`;
                  // Not setting hasHardErrors = true here yet for this specific doc's issue.
              } else { // Error status, but no mismatches, or mismatches array is empty.
                  currentErrors[docRefKey] = `${docLabel} requires successful verification. Status: ${statusInfo?.status || 'Pending'}.`;
                  hasHardErrors = true;
                  hasNonAnnexureEligibleDiscrepancies = true;
              }
          } else if (statusInfo?.status !== 'verified') { // e.g., 'validating', 'pending_verification', or other non-mismatch error
              currentErrors[docRefKey] = `${docLabel} requires successful verification. Status: ${statusInfo?.status || 'Pending'}.`;
              hasHardErrors = true;
              hasNonAnnexureEligibleDiscrepancies = true;
          }
      }
    });

    setAnnexureEligibleMismatches(tempAnnexureEligibleMismatchesLocal);

    // Determine if annexure upload should be shown
    const shouldShowAnnexure = tempAnnexureEligibleMismatchesLocal.length > 0 && !hasNonAnnexureEligibleDiscrepancies;
    setShowAnnexureUpload(shouldShowAnnexure);

    // Initial finalFormValidity based on hard errors found so far
    let finalFormValidity = !hasHardErrors;

    if (shouldShowAnnexure) {
        if (!(annexureFile || existingAnnexureFileRef)) {
            currentErrors['annexure'] = "An annexure document is required to resolve the noted name/address discrepancies.";
            finalFormValidity = false; // If annexure is needed but not provided, form is invalid.
        } else {
            // Annexure is provided, and it was the only type of issue.
            // Clear the specific "Annexure may be required" messages for documents whose errors are covered by the annexure.
            tempAnnexureEligibleMismatchesLocal.forEach(aem => {
                const docErrorKey = `reqDoc_${aem.docTypeKey}`;
                if (currentErrors[docErrorKey]?.includes("An annexure document may be required")) {
                    delete currentErrors[docErrorKey];
                }
            });
            // If `hasHardErrors` was false (meaning no non-annexure discrepancies),
            // and annexure is provided, `finalFormValidity` remains true.
        }
    } else if (tempAnnexureEligibleMismatchesLocal.length > 0 && hasNonAnnexureEligibleDiscrepancies) {
        // There are annexure-eligible mismatches, but also other critical errors.
        // Annexure upload is hidden. The form is already invalid due to `hasHardErrors` being true.
    }


    // OTP & Face Verification checks (reusable logic)
    if (isAadhaarFromGovDB && otpVerificationMobileNumber && !isOtpVerified) {
      currentErrors['otp_verification'] = 'Mobile OTP verification for Aadhaar is pending.';
      finalFormValidity = false;
    }
    if (showFaceVerificationModule && aadhaarPhotoIdForVerification && !isFaceVerificationComplete) {
      let otpPrerequisiteMet = !isAadhaarFromGovDB || !otpVerificationMobileNumber || isOtpVerified;
      if (otpPrerequisiteMet) {
        currentErrors['face_verification'] = 'Face verification is required.';
        finalFormValidity = false;
      }
    }

    if (showErrors) setFormErrors(currentErrors);
    setIsFormValidForSubmit(finalFormValidity);
    return finalFormValidity;
  }, [
    formData, waiverSchemeData, requiredDocFiles, existingFileRefs, docValidationStatus, validateField,
    isFaceVerificationComplete, showFaceVerificationModule, annexureFile, existingAnnexureFileRef,
    isAadhaarFromGovDB, otpVerificationMobileNumber, isOtpVerified, aadhaarPhotoIdForVerification
  ]);

  useEffect(() => { runFullValidation(false); }, [runFullValidation]);


  const triggerEntityExtraction = useCallback(async (docTypeKey, file) => {
    console.log(`Triggering entity extraction for document schema: ${docTypeKey}...`);
    let docDefinition;
    if (docTypeKey === 'aadhaar_card') docDefinition = waiverSchemeData?.aadhaar_card_definition;
    else if (docTypeKey === 'pan_card') docDefinition = waiverSchemeData?.pan_card_definition;
    else docDefinition = waiverSchemeData?.document_definitions?.[docTypeKey];

    if (!docDefinition) {
        console.warn(`No document definition found for schema ${docTypeKey}. Auto-fill skipped.`);
        setDocValidationStatus(prev => ({ ...prev, [docTypeKey]: { status: 'error', mismatches: [{ fieldLabel: 'Configuration Error', expected: '', actual: 'Document type not configured for auto-fill details.' }] } }));
        return;
    }
        console.log(`Triggering entity extraction for ${docDefinition.label || docTypeKey} (type: ${docTypeKey})`);
        setDocValidationStatus(prev => ({ ...prev, [docTypeKey]: { status: 'validating', mismatches: null } }));
        setAutoFillError(''); setApiError('');
        setAnnexureEligibleMismatches(prev => prev.filter(m => m.docTypeKey !== docTypeKey));

        if (docTypeKey === 'aadhaar_card') {
            setIsAadhaarFromGovDB(false);
            setOtpVerificationMobileNumber(null);
            setShowOtpModal(false);
            setIsOtpVerified(false);
            setOtpVerificationError("");
            setCurrentOtpRequestId(null);
            setShowFaceVerificationModule(false);
            setIsFaceVerificationComplete(false);
            setFaceVerificationError("");
        }

        const docFieldsSchema = docDefinition.fields || [];
        if (docFieldsSchema.length === 0) {
            console.warn(`No field schema defined for document type ${docTypeKey} (for ${docDefinition.label}). Auto-fill skipped.`);
            setDocValidationStatus(prev => ({ ...prev, [docTypeKey]: { status: 'error', mismatches: [{ fieldLabel: 'Configuration Error', expected: '', actual: 'Fields for this document type not configured.' }] } }));
            return;
        }
        const fieldsPayload = JSON.stringify({ label: docDefinition.label || docTypeKey, fields: docFieldsSchema.map(f => ({ key: f.key, label: f.label, prompt: f.prompt || '' })) });

        try {
            const ocrApiFormData = new FormData();
            ocrApiFormData.append('file', file);
            ocrApiFormData.append('docType', docTypeKey);
            ocrApiFormData.append('fields', fieldsPayload);
            const ocrResponse = await axiosInstance.post('/api/application/extract-entity', ocrApiFormData, { headers: { 'Content-Type': 'multipart/form-data' } });
            const { extracted_data: extractedDataFromOCR, doc_name: detectedDocTypeFromApi } = ocrResponse.data;

            if (detectedDocTypeFromApi !== docTypeKey) {
                const expectedLabel = docDefinition.label || docTypeKey;
                const actualDef = detectedDocTypeFromApi === 'aadhaar_card' ? waiverSchemeData?.aadhaar_card_definition : (detectedDocTypeFromApi === 'pan_card' ? waiverSchemeData?.pan_card_definition : waiverSchemeData?.document_definitions?.[detectedDocTypeFromApi]);
                const actualLabel = actualDef?.label || detectedDocTypeFromApi || 'Unknown';
                const mismatchError = [{ fieldLabel: 'Document Type Mismatch', expected: docTypeKey, actual: detectedDocTypeFromApi || 'Unknown' }];
                setDocValidationStatus(prev => ({ ...prev, [docTypeKey]: { status: 'error', mismatches: mismatchError } }));
                setAutoFillError(`Incorrect document type uploaded for ${expectedLabel}. Expected ${expectedLabel}, but received a document identified as ${actualLabel}.`);
                return;
            }

            const ocrDataMap = typeof extractedDataFromOCR === 'object' && !Array.isArray(extractedDataFromOCR) ? { ...extractedDataFromOCR } : (Array.isArray(extractedDataFromOCR) ? extractedDataFromOCR.reduce((acc, pair) => { if (pair && pair.key) acc[pair.key] = pair.value; return acc; }, {}) : {});
            let uniqueIdentifiersToCheck = Object.entries(ocrDataMap).map(([key, value]) => ({ key, value })).filter(pair => docDefinition.fields.some(f => f.is_unique_identifier && f.key === pair.key && pair.value && String(pair.value).trim() !== ''));
            let dataToUseForAutofill = ocrDataMap;
            let localPhotoIdForFaceVerification = null;
            let govDbCheckPerformed = false;
            let govDbSourceNote = 'Data extracted via OCR.';
            let govDbResponseData = null;

            if (uniqueIdentifiersToCheck.length > 0) {
                govDbCheckPerformed = true;
                try {
                    const govDbApiResponse = await axiosInstance.post('/api/document/check-unique', { schema_definition_id: docDefinition._id, identifiers_to_check: uniqueIdentifiersToCheck });
                    govDbResponseData = govDbApiResponse.data;
                    if (govDbResponseData.exists === true && govDbResponseData.matched_keys?.length > 0) {
                        const matchedSubmission = govDbResponseData.matched_keys[0];
                        dataToUseForAutofill = (matchedSubmission.fields || []).reduce((acc, field) => {
                            acc[field.field_id] = field.value;
                            if (docTypeKey === 'aadhaar_card' && (field.field_id === 'photo' || field.key === 'photo') && field.fileRef) {
                                localPhotoIdForFaceVerification = field.fileRef;
                            }
                            return acc;
                        }, {});
                        govDbSourceNote = 'Data matched with existing verified record.';
                        setDocValidationStatus(prev => ({ ...prev, [docTypeKey]: { status: 'verified', mismatches: null, note: govDbSourceNote } }));
                    } else if (govDbResponseData.exists === false && govDbResponseData.totalCount > 0) {
                        const mismatchErrorMsg = `The uploaded ${docDefinition.label || docTypeKey} does not match our existing records.`;
                        setDocValidationStatus(prev => ({ ...prev, [docTypeKey]: { status: 'error', mismatches: [{ fieldLabel: 'Document Verification', expected: 'Match in existing records', actual: 'No exact match found.' }] } }));
                        setAutoFillError(mismatchErrorMsg); return;
                    } else { 
                        if (docTypeKey === 'aadhaar_card') {
                            const photoFieldKey = docDefinition.fields.find(f => f.key === 'photo' || f.label.toLowerCase().includes('photo'))?.key;
                            if (photoFieldKey && ocrDataMap[photoFieldKey] && typeof ocrDataMap[photoFieldKey] === 'string') localPhotoIdForFaceVerification = ocrDataMap[photoFieldKey];
                        }
                    }
                } catch (govDbError) { console.warn(`GovDB check failed for ${docTypeKey}:`, govDbError); setAutoFillError(`Could not verify document. ${govDbError.response?.data?.message || ''}`); }
            } else { 
                 if (docTypeKey === 'aadhaar_card') {
                    const photoFieldKey = docDefinition.fields.find(f => f.key === 'photo' || f.label.toLowerCase().includes('photo'))?.key;
                    if (photoFieldKey && ocrDataMap[photoFieldKey] && typeof ocrDataMap[photoFieldKey] === 'string') localPhotoIdForFaceVerification = ocrDataMap[photoFieldKey];
                }
            }

            if (docTypeKey === 'aadhaar_card') {
                setAadhaarPhotoIdForVerification(localPhotoIdForFaceVerification);
                const isFromGovDB = govDbCheckPerformed && govDbResponseData?.exists === true && govDbResponseData.matched_keys?.length > 0;
                setIsAadhaarFromGovDB(isFromGovDB);
                if (isFromGovDB) {
                    const mobileKey = docDefinition.fields.find(f => f.key === 'mobile_number' || f.key === 'phone_number' || f.type === 'phone')?.key;
                    const mobileNumberFromDB = mobileKey ? dataToUseForAutofill[mobileKey] : null;
                    if (mobileNumberFromDB && localPhotoIdForFaceVerification) {
                        setOtpVerificationMobileNumber(mobileNumberFromDB); setShowOtpModal(true);
                    } else { setShowFaceVerificationModule(false); if (!mobileNumberFromDB) console.warn("Mobile missing from GovDB Aadhaar."); if (!localPhotoIdForFaceVerification) console.warn("Photo ID missing from GovDB Aadhaar.");}
                } else { if (localPhotoIdForFaceVerification) setShowFaceVerificationModule(true); else setShowFaceVerificationModule(false); }
                if (!govDbCheckPerformed || (govDbResponseData?.exists === false && (govDbResponseData.totalCount === 0 || govDbResponseData.totalCount === undefined))) {
                    if (docValidationStatus[docTypeKey]?.status !== 'error') setDocValidationStatus(prev => ({ ...prev, [docTypeKey]: { status: 'verified', mismatches: null, note: 'New document processed via OCR.' } }));
                }
            }

            const currentMismatches = []; let canProceedWithOverallFill = true;
            (waiverSchemeData?.fields || []).forEach(targetField => {
                const relevantSource = targetField.auto_fill_sources?.find(source => source.startsWith(`${docTypeKey}.`));
                if (relevantSource) {
                    const sourceKey = getFieldKeyFromSource(relevantSource);
                    if (sourceKey && dataToUseForAutofill.hasOwnProperty(sourceKey)) {
                        const autoFillValueStr = String(dataToUseForAutofill[sourceKey] ?? '');
                        const targetFieldId = targetField.field_id;
                        if (autoFilledFields[targetFieldId] && autoFilledFields[targetFieldId].verifiedByDocType !== docTypeKey) {
                            const existingVerifiedValueStr = String(autoFilledFields[targetFieldId].value ?? '');
                            if (existingVerifiedValueStr.toLowerCase() !== autoFillValueStr.toLowerCase()) {
                                const confDocDef = autoFilledFields[targetFieldId].verifiedByDocType === 'aadhaar_card' ? waiverSchemeData?.aadhaar_card_definition : (autoFilledFields[targetFieldId].verifiedByDocType === 'pan_card' ? waiverSchemeData?.pan_card_definition : waiverSchemeData?.document_definitions?.[autoFilledFields[targetFieldId].verifiedByDocType]);
                                currentMismatches.push({ fieldLabel: targetField.field_label, expected: existingVerifiedValueStr, actual: autoFillValueStr, conflictingDoc: confDocDef?.label || autoFilledFields[targetFieldId].verifiedByDocType });
                                canProceedWithOverallFill = false;
                            }
                        }
                    }
                }
            });

            if (canProceedWithOverallFill) {
                let updatedFormDataFlag = false; const newAutoFilledForThisDoc = {}; const currentFormDataSnapshot = { ...formData };
                (waiverSchemeData?.fields || []).forEach(targetField => {
                    const relevantSource = targetField.auto_fill_sources?.find(source => source.startsWith(`${docTypeKey}.`));
                    if (relevantSource) {
                        const sourceKey = getFieldKeyFromSource(relevantSource);
                        if (sourceKey && dataToUseForAutofill.hasOwnProperty(sourceKey)) {
                            let autoFillValue = String(dataToUseForAutofill[sourceKey] ?? '');
                            if (targetField.type === 'date' && autoFillValue.match(/^\d{2}-\d{2}-\d{4}$/)) autoFillValue = formatDateToYYYYMMDD(autoFillValue);
                            else if (targetField.type === 'date' && autoFillValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) autoFillValue = autoFillValue.split('T')[0];
                            const targetFieldId = targetField.field_id; const existingManualValue = String(currentFormDataSnapshot[targetFieldId] ?? '');
                            if (existingManualValue.toLowerCase() === '' || existingManualValue.toLowerCase() === autoFillValue.toLowerCase() || (autoFilledFields[targetFieldId] && autoFilledFields[targetFieldId].verifiedByDocType === docTypeKey)) {
                                if (currentFormDataSnapshot[targetFieldId] !== autoFillValue) { currentFormDataSnapshot[targetFieldId] = autoFillValue; updatedFormDataFlag = true; }
                                newAutoFilledForThisDoc[targetFieldId] = { value: autoFillValue, verifiedByDocType: docTypeKey, originalSourceKey: sourceKey };
                            } else if (existingManualValue !== '' && existingManualValue.toLowerCase() !== autoFillValue.toLowerCase()) {
                                currentMismatches.push({ fieldLabel: targetField.field_label, expected: existingManualValue, actual: autoFillValue, note: "manual value conflict" });
                            }
                        }
                    }
                });
                if (updatedFormDataFlag) setFormData(currentFormDataSnapshot);
                if (Object.keys(newAutoFilledForThisDoc).length > 0) setAutoFilledFields(prev => ({ ...prev, ...newAutoFilledForThisDoc }));
                const currentStatus = docValidationStatus[docTypeKey];
                if (!currentStatus || (currentStatus.status !== 'error' || (currentStatus.mismatches && currentStatus.mismatches[0]?.expected !== 'Match in existing records'))) {
                    if (currentMismatches.length > 0) {
                        setDocValidationStatus(prev => ({ ...prev, [docTypeKey]: { status: 'error', mismatches: currentMismatches } }));
                        setAutoFillError(`Data conflicts for ${docDefinition.label || docTypeKey}.`);
                        if (currentMismatches.every(mm => ANNEXURE_ELIGIBLE_FIELD_LABELS.includes(mm.fieldLabel))) setAnnexureEligibleMismatches(prev => [...prev.filter(m => m.docTypeKey !== docTypeKey), ...currentMismatches.map(mm => ({...mm, docTypeKey}))]);
                    } else if (currentStatus?.status !== 'verified') {
                        setDocValidationStatus(prev => ({ ...prev, [docTypeKey]: { status: 'verified', mismatches: null, note: govDbSourceNote } }));
                    }
                }
            } else {
                setDocValidationStatus(prev => ({ ...prev, [docTypeKey]: { status: 'error', mismatches: currentMismatches } }));
                setAutoFillError(`Critical mismatches for ${docDefinition.label || docTypeKey}.`);
            }
        } catch (error) {
            console.error(`Extraction/GovDB check failed for ${docDefinition?.label || docTypeKey}:`, error);
            const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to process document.';
            setDocValidationStatus(prev => ({ ...prev, [docTypeKey]: { status: 'error', mismatches: [{ fieldLabel: 'Processing Error', actual: errorMsg }] } }));
            setApiError(`Error processing ${docDefinition?.label || docTypeKey}: ${errorMsg}`);
        }
  }, [waiverSchemeData, formData, autoFilledFields, getFieldKeyFromSource, docValidationStatus]);

  const handleRequiredDocFileChangeCallback = useCallback((docTypeKey, file) => {
    setRequiredDocFiles(prev => { const n = {...prev}; if (file) n[docTypeKey] = file; else delete n[docTypeKey]; return n; });
    const refKey = `reqDoc_${docTypeKey}`;
    setExistingFileRefs(prev => { const n = {...prev}; delete n[refKey]; return n; });
    setAnnexureEligibleMismatches(prev => prev.filter(m => m.docTypeKey !== docTypeKey));

    if (file) {
        triggerEntityExtraction(docTypeKey, file);
    } else {
        setDocValidationStatus(prev => { const n = {...prev}; delete n[docTypeKey]; return n; });
        const clearedDocTypeKey = docTypeKey;
        if (clearedDocTypeKey) {
            const newFormData = { ...formData }; const newAutoFilled = { ...autoFilledFields };
            let changedInFormData = false; let changedInAutoFilled = false;
            Object.keys(autoFilledFields).forEach(fieldId => {
                if (autoFilledFields[fieldId]?.verifiedByDocType === clearedDocTypeKey) {
                    if (String(newFormData[fieldId]).toLowerCase() === String(autoFilledFields[fieldId].value).toLowerCase()) {
                        newFormData[fieldId] = ''; changedInFormData = true;
                    }
                    delete newAutoFilled[fieldId]; changedInAutoFilled = true;
                }
            });
            if (changedInFormData) setFormData(newFormData);
            if (changedInAutoFilled) setAutoFilledFields(newAutoFilled);
            let docDef;
            if (clearedDocTypeKey === 'aadhaar_card') docDef = waiverSchemeData?.aadhaar_card_definition;
            else if (clearedDocTypeKey === 'pan_card') docDef = waiverSchemeData?.pan_card_definition;
            else docDef = waiverSchemeData?.document_definitions?.[clearedDocTypeKey];
            const docLabel = docDef?.label || clearedDocTypeKey;
            if (autoFillError.includes(docLabel)) setAutoFillError("");
            if (clearedDocTypeKey === 'aadhaar_card') {
                setAadhaarPhotoIdForVerification(null); setIsFaceVerificationComplete(false); setShowFaceVerificationModule(false); setFaceVerificationError("");
                setShowOtpModal(false); setOtpVerificationMobileNumber(null); setIsOtpVerified(false); setOtpVerificationError(""); setCurrentOtpRequestId(null); setIsAadhaarFromGovDB(false);
            }
            const remainingMismatches = annexureEligibleMismatches.filter(m => m.docTypeKey !== clearedDocTypeKey);
            setAnnexureEligibleMismatches(remainingMismatches);
            if (remainingMismatches.length === 0) setShowAnnexureUpload(false);
        }
    }
  }, [triggerEntityExtraction, formData, autoFilledFields, autoFillError, waiverSchemeData, annexureEligibleMismatches]);

  const handleFaceVerificationResult = useCallback((success, errorMsg = "") => {
      setIsFaceVerificationComplete(success);
      if (success) { setFaceVerificationError(""); }
      else { setFaceVerificationError(errorMsg || "Face verification failed or was cancelled by user."); }
      runFullValidation(showValidationErrors);
  }, [showValidationErrors, runFullValidation]);

  const handleAnnexureFileChange = (event) => {
      const file = event.target.files ? event.target.files[0] : null;
      if (file) {
          if (file.type === "application/pdf") { setAnnexureFile(file); setAnnexureFileError(""); setExistingAnnexureFileRef(null); }
          else { setAnnexureFile(null); setAnnexureFileError("Invalid file type. Please upload a PDF annexure."); }
      } else { setAnnexureFile(null); }
      runFullValidation(showValidationErrors);
  };

  const handleOtpVerificationSubmit = async (requestId, otpValue) => {
    if (!otpVerificationMobileNumber) { setOtpVerificationError("Mobile number not available."); return; }
    setOtpVerificationError("");
    try {
        // The OtpVerificationModal now passes the requestId it received from /api/otp/send
        setCurrentOtpRequestId(requestId); // Ensure currentOtpRequestId is set for this attempt

        const response = await axiosInstance.post('/api/otp/verify', {
            requestId: requestId,
            otp: otpValue,
            // waiverSchemeId: waiverSchemeId // Optional context
        });
        if (response.data.verified) {
            setIsOtpVerified(true); setShowOtpModal(false); setOtpVerificationError("");
            if (aadhaarPhotoIdForVerification) setShowFaceVerificationModule(true);
            else console.warn("OTP verified, but Aadhaar photo ID missing for face verification.");
        } else {
            setOtpVerificationError(response.data.error || "Incorrect OTP."); setIsOtpVerified(false);
        }
    } catch (error) {
        setOtpVerificationError(error.response?.data?.error || "OTP verification service failed."); setIsOtpVerified(false);
    } finally { runFullValidation(showValidationErrors); }
  };

  const handleOtpModalClose = () => {
      setShowOtpModal(false);
      // setCurrentOtpRequestId(null); // Clearing here might be too soon if user reopens to try same OTP
      runFullValidation(showValidationErrors);
  };


  const handleSaveDraft = async () => {
    if (isSavingDraft || isSubmitting) return;
    setIsSavingDraft(true); setApiError("");
    try {
      const payloadFields = (waiverSchemeData.fields || []).map(f => ({
        field_id: f.field_id,
        field_label: f.field_label,
        type: f.type,
        value: (f.type === 'image' || f.type === 'document') ? (existingFileRefs[f.field_id] || (customFieldFiles[f.field_id] ? `local:${customFieldFiles[f.field_id].name}`: '')) : (formData[f.field_id] || '')
      }));

      const requiredDocRefsPayload = [];
      const addDocToPayload = (docKey) => {
          if (existingFileRefs[`reqDoc_${docKey}`] || requiredDocFiles[docKey]) {
              requiredDocRefsPayload.push({ documentTypeKey: docKey, fileRef: existingFileRefs[`reqDoc_${docKey}`] || `local:${requiredDocFiles[docKey]?.name}`});
          }
      };
      addDocToPayload('aadhaar_card');
      addDocToPayload('pan_card');
      (waiverSchemeData.required_documents || []).forEach(doc => addDocToPayload(doc.schema_id || doc.name));

      const payload = {
        waiver_scheme_id: waiverSchemeId,
        fields: payloadFields,
        requiredDocumentRefs: requiredDocRefsPayload.filter(ref => ref.fileRef),
        autoFilledFields: autoFilledFields,
        annexureDocumentRef: existingAnnexureFileRef || (annexureFile ? `local:${annexureFile.name}` : null),
      };
      await axiosInstance.post(`/api/waiver-submissions/draft/${waiverSchemeId}`, payload); // Ensure this endpoint is correct
      setDraftSaveStatus({ saved: true, time: new Date() });
      setTimeout(() => setDraftSaveStatus({ saved: false, time: null }), 3000);
    } catch (err) {
      setApiError(err.response?.data?.error || "Waiver draft save failed.");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault(); setApiError(""); setAutoFillError(""); setShowValidationErrors(true);
    setOtpVerificationError("");

    if (runFullValidation(true)) {
      submitWaiverApplication();
    } else {
      console.log("Waiver form validation failed.", formErrors);
      let errorMessages = "Please correct the issues before submitting your waiver application:\n";
      Object.values(formErrors).forEach(value => { errorMessages += `- ${value}\n`; });
      if (isAadhaarFromGovDB && otpVerificationMobileNumber && !isOtpVerified && !formErrors.otp_verification) {
          errorMessages += "- Mobile OTP verification for Aadhaar is pending.\n";
      }
      if (showFaceVerificationModule && aadhaarPhotoIdForVerification && !isFaceVerificationComplete && !formErrors.face_verification) {
           let otpPrerequisiteMet = !isAadhaarFromGovDB || !otpVerificationMobileNumber || isOtpVerified;
           if (otpPrerequisiteMet) errorMessages += "- Face verification is required.\n";
      }
      window.alert(errorMessages);
        const errorKeys = Object.keys(formErrors);
        if (errorKeys.length > 0) {
            const firstErrorKey = errorKeys[0];
            let selector = `[id="${firstErrorKey}"], [id="custom_${firstErrorKey}"]`;
            if (firstErrorKey.startsWith('reqDoc_') || firstErrorKey === 'face_verification' || firstErrorKey === 'annexure' || firstErrorKey === 'otp_verification') {
                selector = `[id="${firstErrorKey}"]`;
            }
            const element = formRef.current?.querySelector(selector);
            if (element) {
                element.focus({ preventScroll: true });
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                const otpErrorElement = document.getElementById('otp-error-anchor');
                const faceErrorElement = document.getElementById('face-verification-section-anchor');
                if (formErrors.otp_verification && otpErrorElement) otpErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                else if (formErrors.face_verification && faceErrorElement) faceErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                else window.scrollTo(0,0);
            }
        } else { window.scrollTo(0,0); }
    }
  };

  const submitWaiverApplication = async () => {
    if (isSubmitting) return; setIsSubmitting(true); setApiError("");
    try {
      const filesToUpload = [];
      Object.entries(customFieldFiles).forEach(([fieldId, file]) => {
        if (!existingFileRefs[fieldId]) {
          filesToUpload.push({ key: fieldId, file: file, type: 'custom' });
        }
      });
      const processRequiredDoc = (docKey) => {
          if (requiredDocFiles[docKey] && !existingFileRefs[`reqDoc_${docKey}`]) {
              filesToUpload.push({ key: `reqDoc_${docKey}`, file: requiredDocFiles[docKey], type: 'required', docTypeKey: docKey });
          }
      };
      processRequiredDoc('aadhaar_card');
      processRequiredDoc('pan_card');
      (waiverSchemeData.required_documents || []).forEach(doc => processRequiredDoc(doc.schema_id || doc.name));

      if (annexureFile && !existingAnnexureFileRef) {
        filesToUpload.push({ key: 'annexure_document', file: annexureFile, type: 'annexure' });
      }

      const uploadedFileRefs = { ...existingFileRefs };
      if (existingAnnexureFileRef) uploadedFileRefs['annexure_document'] = existingAnnexureFileRef;

      const uploadPromises = filesToUpload.map(async ({ key, file, type, docTypeKey }) => {
        const fieldSchema = type === 'custom' ? waiverSchemeData?.fields.find(f => f.field_id === key) : null;
        let docDefForLabel;
        if (type === 'required') {
            if (docTypeKey === 'aadhaar_card') docDefForLabel = waiverSchemeData?.aadhaar_card_definition;
            else if (docTypeKey === 'pan_card') docDefForLabel = waiverSchemeData?.pan_card_definition;
            else docDefForLabel = waiverSchemeData?.document_definitions?.[docTypeKey];
        }
        const docLabel = type === 'annexure' ? 'Annexure Document' : (type === 'required' ? (docDefForLabel?.label || docTypeKey) : (fieldSchema?.field_label || key.replace('reqDoc_','')));
        const uploadUrl = "/api/image";
        const fileFormData = new FormData(); fileFormData.append("file", file);
        try {
            const { data: uploadResult } = await axiosInstance.post(uploadUrl, fileFormData, { headers: { "Content-Type": "multipart/form-data" } });
            if (!uploadResult || !uploadResult.id) throw new Error(`File ID missing for ${docLabel}.`);
            uploadedFileRefs[key] = uploadResult.id;
        } catch (uploadError) {
            throw new Error(`Failed to upload ${docLabel}. ${uploadError.response?.data?.error || uploadError.message}`);
        }
      });
      await Promise.all(uploadPromises);

      const finalSubmissionFields = (waiverSchemeData.fields || []).map(f => {
        let value = formData[f.field_id] || '';
        if (f.type === 'date' && value) value = formatDateToDDMMYYYY(value);
        return {
          field_id: f.field_id, field_label: f.field_label, type: f.type,
          value: (f.type !== 'image' && f.type !== 'document') ? value : null,
          fileRef: (f.type === 'image' || f.type === 'document') ? (uploadedFileRefs[f.field_id] || null) : undefined
        };
      });

      const finalRequiredDocsRefs = [];
      const addFinalReqDoc = (docKey) => {
          if (uploadedFileRefs[`reqDoc_${docKey}`]) {
              finalRequiredDocsRefs.push({ documentTypeKey: docKey, fileRef: uploadedFileRefs[`reqDoc_${docKey}`] });
          }
      };
      addFinalReqDoc('aadhaar_card');
      addFinalReqDoc('pan_card');
      (waiverSchemeData.required_documents || []).forEach(doc => addFinalReqDoc(doc.schema_id || doc.name));

      const aadhaarDataForPayload = {};
      const panDataForPayload = {};
      Object.entries(autoFilledFields).forEach(([fieldId, autoFillInfo]) => {
          const targetFieldSchema = waiverSchemeData.fields.find(f => f.field_id === fieldId);
          if (targetFieldSchema && targetFieldSchema.auto_fill_sources) {
              targetFieldSchema.auto_fill_sources.forEach(sourceString => {
                  const docType = sourceString.split('.')[0];
                  const sourceKey = getFieldKeyFromSource(sourceString);
                  let valueToUse = autoFillInfo.value;
                  if (targetFieldSchema.type === 'date') valueToUse = formatDateToDDMMYYYY(valueToUse);
                  if (docType === 'aadhaar_card' && sourceKey) aadhaarDataForPayload[sourceKey] = valueToUse;
                  else if (docType === 'pan_card' && sourceKey) panDataForPayload[sourceKey] = valueToUse;
              });
          }
      });

      const submissionPayload = {
        waiver_scheme_id: waiverSchemeId,
        fields: finalSubmissionFields,
        requiredDocumentRefs: finalRequiredDocsRefs,
        aadhaar_data: aadhaarDataForPayload,
        pan_data: panDataForPayload,
        isFaceVerified: isFaceVerificationComplete,
        isOtpVerified: isOtpVerified,
        annexureDocumentRef: uploadedFileRefs['annexure_document'] || null,
        stage: 'pending_review'
      };

      const { data: submissionResult } = await axiosInstance.post(`/api/waiver-submissions`, submissionPayload);
      setSubmissionId(submissionResult._id || submissionResult.id);
      setSubmissionStatus('submitted');
    } catch (err) {
      setApiError(err.message || err.response?.data?.error || "Waiver submission failed.");
      setSubmissionStatus('filling');
      window.scrollTo(0, 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRequiredDocumentItem = (docKey, isMandatoryFixed = false) => {
    let docDefinition;
    let docDisplayLabel;
    let docDescription;
    let schemeDocEntry = null;

    if (docKey === 'aadhaar_card') {
        docDefinition = waiverSchemeData?.aadhaar_card_definition;
        docDisplayLabel = docDefinition?.label || "Aadhaar Card";
        docDescription = docDefinition?.description || "Upload your Aadhaar Card.";
    } else if (docKey === 'pan_card') {
        docDefinition = waiverSchemeData?.pan_card_definition;
        docDisplayLabel = docDefinition?.label || "PAN Card";
        docDescription = docDefinition?.description || "Upload your PAN Card.";
    } else {
        schemeDocEntry = (waiverSchemeData?.required_documents || []).find(d => (d.schema_id || d.name) === docKey);
        docDefinition = waiverSchemeData?.document_definitions?.[docKey];
        docDisplayLabel = docDefinition?.label || schemeDocEntry?.name || docKey;
        docDescription = schemeDocEntry?.description || docDefinition?.description;
    }

    if (!docDefinition && (isMandatoryFixed || schemeDocEntry) ) {
        return (<ListGroup.Item key={docKey} className="required-doc-item p-3 border rounded mb-3">
            <Alert variant="warning">Configuration for {docDisplayLabel || docKey} is missing. Contact support.</Alert>
        </ListGroup.Item>);
    }

    const inputIdAndRefKeyPart = `reqDoc_${docKey}`;
    const docStatusInfo = docValidationStatus[docKey];
    const hasExisting = !!existingFileRefs[inputIdAndRefKeyPart];
    const hasNew = !!requiredDocFiles[docKey];
    const fileInputError = formErrors[inputIdAndRefKeyPart];
    let showItemError = false;
    if (showValidationErrors) {
        if (fileInputError) { showItemError = true; }
        else if (docStatusInfo?.status === 'error') {
            const allMismatchesAnnexureEligible = docStatusInfo.mismatches?.every(mm => ANNEXURE_ELIGIBLE_FIELD_LABELS.includes(mm.fieldLabel));
            if (!allMismatchesAnnexureEligible) { showItemError = true; }
            else if (allMismatchesAnnexureEligible && !(annexureFile || existingAnnexureFileRef)) { showItemError = true; }
        } else if (docStatusInfo?.status && docStatusInfo.status !== 'verified' && (hasExisting || hasNew)) { showItemError = true; }
    }
    const isTypeMismatch = docStatusInfo?.status === 'error' && docStatusInfo.mismatches?.[0]?.fieldLabel === 'Document Type Mismatch';

    return (
        <ListGroup.Item key={docKey} className={`required-doc-item p-3 border rounded mb-3 ${showItemError ? 'doc-item-invalid' : ''} ${isTypeMismatch ? 'doc-item-typemismatch' : ''}`}>
            <Row className="align-items-center g-2">
                <Col md={4} className="doc-info">
                    <strong className="d-block">{docDisplayLabel} *</strong>
                    {docDescription && <small className="text-muted d-block">{docDescription}</small>}
                </Col>
                <Col md={hasNew || hasExisting ? 4 : 5} className="doc-input">
                    <Form.Control type="file" id={inputIdAndRefKeyPart}
                        onChange={(e) => handleRequiredDocFileChangeCallback(docKey, e.target.files ? e.target.files[0] : null)}
                        disabled={isSubmitting || isSavingDraft || docStatusInfo?.status === 'validating'}
                        isInvalid={showValidationErrors && !!fileInputError && !hasNew && !hasExisting && !docStatusInfo }
                        size="sm" className="document-file-input" />
                    {hasExisting && !hasNew && <small className='text-success d-block mt-1'><FaCheckCircle size={12} className="me-1"/>Current: {decodeURIComponent(new URL(existingFileRefs[inputIdAndRefKeyPart]).pathname.split('/').pop() || existingFileRefs[inputIdAndRefKeyPart]).substring(0,20)}...</small>}
                    {hasNew && <small className='text-info d-block mt-1'><FaFileUpload size={12} className="me-1"/>New: {requiredDocFiles[docKey]?.name}</small>}
                    {showValidationErrors && fileInputError && !hasNew && !hasExisting && !docStatusInfo && <Form.Text className="text-danger d-block mt-1">{fileInputError}</Form.Text>}
                </Col>
                <Col md={3} className="doc-status text-md-end"> {getDocStatusBadge(docKey)} </Col>
                <Col md={hasNew || hasExisting ? 1 : "auto"} className="doc-actions text-end">
                    {(hasNew || hasExisting) && !(docStatusInfo?.status === 'validating') && (
                        <Button variant="outline-danger" size="sm" onClick={() => {
                            const el = document.getElementById(inputIdAndRefKeyPart); if (el) el.value = "";
                            handleRequiredDocFileChangeCallback(docKey, null);
                        }} title={`Remove ${docDisplayLabel}`} className="p-1"><FaTrash size={12} /></Button>
                    )}
                </Col>
            </Row>
            {(docStatusInfo?.status === 'error' || isTypeMismatch) && docStatusInfo.mismatches && (
                <Alert variant={isTypeMismatch ? "danger" : "warning"} className="mismatches mt-2 p-2 small">
                    {isTypeMismatch ? ( <> <strong className="d-block mb-1"><FileWarning size={14} className="me-1"/> Incorrect Document Type:</strong> Expected <strong>{ (docKey === 'aadhaar_card' ? waiverSchemeData?.aadhaar_card_definition?.label : (docKey === 'pan_card' ? waiverSchemeData?.pan_card_definition?.label : waiverSchemeData.document_definitions?.[docStatusInfo.mismatches[0]?.expected]?.label)) || docStatusInfo.mismatches[0]?.expected}</strong>, but uploaded document appears to be <strong>{(docStatusInfo.mismatches[0]?.actual === 'aadhaar_card' ? waiverSchemeData?.aadhaar_card_definition?.label : (docStatusInfo.mismatches[0]?.actual === 'pan_card' ? waiverSchemeData?.pan_card_definition?.label : waiverSchemeData.document_definitions?.[docStatusInfo.mismatches[0]?.actual]?.label)) || docStatusInfo.mismatches[0]?.actual || 'Unknown'}</strong>.</>
                    ) : ( <> <strong className="d-block mb-1"><FaExclamationTriangle size={14} className="me-1"/> Data Discrepancy:</strong> {docStatusInfo.mismatches.map((mm, idx) => (<div key={idx} className="mismatch-item">- <strong>{mm.fieldLabel}:</strong> {(mm.note === "manual value conflict" ? "Your entered value" : "Expected")} "<code>{mm.expected || '(empty)'}</code>", found "<code>{mm.actual}</code>". {mm.note === "manual value conflict" ? " Clear entry to auto-fill." : (mm.conflictingDoc ? ` Conflicts with ${mm.conflictingDoc}.` : "")}</div>))}</> )}
                </Alert>
            )}
        </ListGroup.Item>
    );
  };

  const getDocStatusBadge = (docTypeKey) => {
    const refKey = `reqDoc_${docTypeKey}`;
    const hasNew = !!requiredDocFiles[docTypeKey];
    const hasExisting = !!existingFileRefs[refKey];
    const statusInfo = docValidationStatus[docTypeKey];
    const docError = showValidationErrors && formErrors[refKey];

    if (statusInfo?.status === 'validating') return <Badge bg="light" text="dark" className="status-badge validating"><Spinner animation="border" size="sm" className="me-1"/> Validating...</Badge>;
    if (statusInfo?.status === 'verified') return <Badge bg="success-subtle" text="success-emphasis" className="status-badge verified"><Check size={14} className="me-1"/> Verified</Badge>;
    if (statusInfo?.status === 'error' && statusInfo.mismatches?.[0]?.fieldLabel === 'Document Type Mismatch') return <Badge bg="danger-subtle" text="danger-emphasis" className="status-badge error"><FileWarning size={14} className="me-1"/> Wrong Doc Type</Badge>;
    if (statusInfo?.status === 'error') {
        const allMismatchesAnnexureEligible = statusInfo.mismatches?.every(mm => ANNEXURE_ELIGIBLE_FIELD_LABELS.includes(mm.fieldLabel));
        if (allMismatchesAnnexureEligible) return <Badge bg="warning-subtle" text="warning-emphasis" className="status-badge error"><AlertCircle size={14} className="me-1"/> Name/Address Mismatch</Badge>;
        return <Badge bg="danger-subtle" text="danger-emphasis" className="status-badge error"><AlertCircle size={14} className="me-1"/> Data Error</Badge>;
    }
    if (hasNew) return <Badge bg="info-subtle" text="info-emphasis" className="status-badge">New File</Badge>;
    if (hasExisting) return <Badge bg="secondary-subtle" text="secondary-emphasis" className="status-badge">Uploaded</Badge>;
    if (docError) return <Badge bg="danger-subtle" text="danger-emphasis" className="status-badge error">Missing</Badge>;
    return <Badge bg="light" text="dark" className="status-badge">Pending Upload</Badge>;
  };

  if (loading) { return <Container fluid className="d-flex flex-column justify-content-center align-items-center page-loading-container"> <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} /> <p className="mt-3 text-muted fs-5">Loading Waiver Scheme Details...</p> </Container>; }
  if (!waiverSchemeData && !loading) { return <Container className="mt-5"><Alert variant="danger">{apiError || 'Could not load waiver scheme details.'}</Alert></Container>; }
  if (submissionStatus === 'submitted') { return <Container className="mt-5 text-center"><Alert variant="success" className="shadow-sm"><h3><FaCheckCircle className="me-2"/>Waiver Application Submitted!</h3><p>Your application for "{waiverSchemeData?.title}" has been received.</p><p>Submission ID: <strong>{submissionId}</strong></p><hr/><Button variant="primary" size="sm" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button></Alert></Container>; }

  const otherSchemeRequiredDocs = waiverSchemeData.required_documents?.filter(
      doc => (doc.schema_id || doc.name) !== 'aadhaar_card' && (doc.schema_id || doc.name) !== 'pan_card'
  ) || [];


  return (
    <Container fluid className="my-4 application-form-container p-md-4">
      {showOtpModal && otpVerificationMobileNumber && (
        <OtpVerificationModal
          show={showOtpModal}
          handleClose={handleOtpModalClose}
          mobileNumber={otpVerificationMobileNumber}
          loanTitle={waiverSchemeData?.title}
          onSubmitOtp={handleOtpVerificationSubmit}
          currentRequestId={currentOtpRequestId}
          setCurrentRequestId={setCurrentOtpRequestId}
        />
      )}

      <Card className="shadow-sm mb-4 scheme-info-card">
        <Card.Header as="h5" className="bg-primary text-white scheme-info-header d-flex align-items-center">
          <FaInfoCircle className="me-2" /> Waiver Scheme Overview
        </Card.Header>
        <Card.Body className="p-4">
          <Card.Title as="h2" className="mb-2 scheme-title">{waiverSchemeData.title}</Card.Title>
          {waiverSchemeData.description && (
            <Card.Subtitle className="mb-3 text-muted scheme-description" dangerouslySetInnerHTML={{ __html: waiverSchemeData.description }} />
          )}
          <hr />
          <Row className="mb-3 text-center scheme-key-metrics">
            <Col md={4} xs={6} className="metric-item mb-3 mb-md-0">
              <FaPercentage className="metric-icon text-success mb-1" size="1.8em"/>
              <div className="metric-label">Waiver Type</div>
              <strong className="metric-value fs-5 text-capitalize">{waiverSchemeData.waiver_type?.replace('_', ' ')}</strong>
            </Col>
            <Col md={4} xs={6} className="metric-item mb-3 mb-md-0">
              <FaHandHoldingUsd className="metric-icon text-info mb-1" size="1.8em"/>
              <div className="metric-label">Waiver Value</div>
              <strong className="metric-value fs-5">
                {waiverSchemeData.waiver_type === 'percentage' ? `${waiverSchemeData.waiver_value}%` : `₹${waiverSchemeData.waiver_value?.toLocaleString('en-IN')}`}
              </strong>
            </Col>
            <Col md={4} xs={12} className="metric-item">
              <FaCheckCircle className="metric-icon text-primary mb-1" size="1.8em"/>
              <div className="metric-label">Applicable On</div>
              <strong className="metric-value fs-5 text-capitalize">{waiverSchemeData.applicable_on?.replace('_', ' ')}</strong>
            </Col>
          </Row>
           {waiverSchemeData.max_waiver_cap_amount > 0 && (
             <Row className="justify-content-center mt-2">
                <Col md={4} xs={6} className="metric-item text-center">
                    <div className="metric-label text-muted">Max Waiver Cap</div>
                    <strong className="metric-value fs-5">₹{waiverSchemeData.max_waiver_cap_amount?.toLocaleString('en-IN')}</strong>
                </Col>
             </Row>
           )}

          {waiverSchemeData.eligibility && (
            <>
              <hr />
              <h5 className="mt-3 mb-3 eligibility-main-title">Who Can Apply? (Eligibility)</h5>
              <Row className="eligibility-details">
                <Col md={6} lg={4} className="mb-2 eligibility-criterion">
                  <UserCheck size={18} className="me-2 text-muted"/> <strong>Age:</strong> {waiverSchemeData.eligibility.min_age}
                  {waiverSchemeData.eligibility.max_age ? ` - ${waiverSchemeData.eligibility.max_age}` : '+'} years
                </Col>
                {waiverSchemeData.eligibility.min_income != null && (
                  <Col md={6} lg={4} className="mb-2 eligibility-criterion">
                    <FaHandHoldingUsd className="me-2 text-muted"/> <strong>Min. Income:</strong> ₹{waiverSchemeData.eligibility.min_income?.toLocaleString('en-IN')}
                  </Col>
                )}
                {waiverSchemeData.eligibility.min_credit_score && (
                  <Col md={6} lg={4} className="mb-2 eligibility-criterion">
                    <BarChart3 size={18} className="me-2 text-muted"/> <strong>Min. Credit Score:</strong> {waiverSchemeData.eligibility.min_credit_score}
                  </Col>
                )}
              </Row>
            </>
          )}
        </Card.Body>
      </Card>

      <Card className="shadow-sm application-details-card">
        <Card.Header className="bg-light">
          <h4 className="mb-0 card-form-title">Your Waiver Application Details</h4>
        </Card.Header>
        <Card.Body className="p-4">
          {apiError && <Alert variant="danger" className="api-error-alert" onClose={() => setApiError("")} dismissible>{apiError}</Alert>}
          {autoFillError && <Alert variant="warning" className="autofill-error-alert" onClose={() => setAutoFillError("")} dismissible><strong>Data Notice:</strong> {autoFillError}</Alert>}
          {showOtpModal && otpVerificationError && (
            <Alert variant="danger" className="mt-0 mb-3 p-2 text-center small" id="otp-error-anchor">
              <MessageSquareText size={16} className="me-1 align-middle" />
              <strong>OTP Error:</strong> {otpVerificationError}
            </Alert>
          )}
          {showValidationErrors && formErrors.otp_verification && !showOtpModal && (
            <Alert variant="danger" className="mt-0 mb-3 p-2 text-center small" id="otp-error-anchor">
              <MessageSquareText size={16} className="me-1 align-middle" /> {formErrors.otp_verification}
            </Alert>
          )}

          <Form ref={formRef} onSubmit={handleSubmit} noValidate className={showValidationErrors ? 'was-validated' : ''}>
            {waiverSchemeData.fields?.length > 0 && (
              <>
                <hr className="my-4"/>
                <h5 className='mb-3 section-title'>Required Information</h5>
              </>
            )}
            {waiverSchemeData.fields?.map((field) => (
              <FieldRenderer
                key={field.field_id}
                field={field}
                value={formData[field.field_id]}
                onChange={handleInputChange}
                onFileChange={handleCustomFieldFileChange}
                error={formErrors[field.field_id]}
                disabled={isSubmitting || isSavingDraft || showOtpModal}
                existingFileUrl={existingFileRefs[field.field_id]}
                isAutoFilled={!!autoFilledFields[field.field_id]}
                autoFilledDetail={autoFilledFields[field.field_id]}
                isPotentiallyAutoFill={field.auto_fill_sources && field.auto_fill_sources.length > 0}
                autoFillSources={field.auto_fill_sources || []}
                docValidationStatus={docValidationStatus}
                allDocSchemasForSourceLookup={{ 
                    documentDefinitions: waiverSchemeData.document_definitions || {},
                    aadhaar_card_definition: waiverSchemeData.aadhaar_card_definition,
                    pan_card_definition: waiverSchemeData.pan_card_definition,
                    required: waiverSchemeData.required_documents || [], 
                    existingGlobalFileRefs: existingFileRefs
                }}
                requiredDocFiles={requiredDocFiles}
                showValidationErrors={showValidationErrors}
              />
            ))}

            <hr className="my-4"/>
            <h5 className='mb-3 section-title'><FaFileMedicalAlt className="me-2 text-danger"/>Mandatory Documents (KYC)</h5>
            <ListGroup variant="flush" className='mb-4 mandatory-docs-listgroup'>
              {renderRequiredDocumentItem('aadhaar_card', true)}
              {renderRequiredDocumentItem('pan_card', true)}
            </ListGroup>

            {otherSchemeRequiredDocs.length > 0 && (
              <>
                <hr className="my-4"/>
                <h5 className='mb-3 section-title'><FaListOl className="me-2 text-info"/>Other Scheme Specific Documents</h5>
                <ListGroup variant="flush" className='mb-4 required-docs-listgroup'>
                  {otherSchemeRequiredDocs.map((doc) => renderRequiredDocumentItem(doc.schema_id || doc.name))}
                </ListGroup>
              </>
            )}

            {showAnnexureUpload && (
              <>
                <hr className="my-4"/>
                <h5 className='mb-3 section-title'><FaPaperclip className="me-2 text-warning"/>Annexure for Discrepancies</h5>
                <Card className="mb-4 border-warning" id="annexure">
                  <Card.Body>
                    <Alert variant="warning">
                      <FaExclamationTriangle className="me-2"/>
                      There are discrepancies in Name and/or Address fields. Please download, fill, and upload the annexure form.
                      <ul>
                        {annexureEligibleMismatches.map((mismatch, idx) => (
                          <li key={idx}>
                            Discrepancy in <strong>{mismatch.fieldLabel}</strong> from {
                              mismatch.docTypeKey === 'aadhaar_card' ? (waiverSchemeData?.aadhaar_card_definition?.label || 'Aadhaar') :
                              mismatch.docTypeKey === 'pan_card' ? (waiverSchemeData?.pan_card_definition?.label || 'PAN') :
                              (waiverSchemeData?.document_definitions?.[mismatch.docTypeKey]?.label || mismatch.docTypeKey)
                            }.
                          </li>
                        ))}
                      </ul>
                    </Alert>
                    <div className="mb-3">
                      <Button variant="info" size="sm" href={annexurePdf} target="_blank" download="Annexure_Form.pdf">
                        <FaDownload className="me-2"/>Download Annexure Form
                      </Button>
                    </div>
                    <Form.Group controlId="annexureFile" className="mb-2">
                      <Form.Label>Upload Signed Annexure (PDF only)*</Form.Label>
                      <Form.Control type="file" accept="application/pdf" onChange={handleAnnexureFileChange}
                        isInvalid={showValidationErrors && !!formErrors.annexure} disabled={showOtpModal} size="sm"/>
                      {annexureFile && <div className="mt-1 text-muted small">Selected: {annexureFile.name}</div>}
                      {existingAnnexureFileRef && !annexureFile && <div className="mt-1 text-success small"><FaCheckCircle className="me-1"/> Current: {decodeURIComponent(new URL(existingAnnexureFileRef).pathname.split('/').pop()||existingAnnexureFileRef).substring(0,30)}...</div>}
                      <Form.Control.Feedback type="invalid">{formErrors.annexure}</Form.Control.Feedback>
                      {annexureFileError && <div className="text-danger small mt-1">{annexureFileError}</div>}
                    </Form.Group>
                  </Card.Body>
                </Card>
              </>
            )}

            <div id="face-verification-section-anchor"></div>
            {showFaceVerificationModule && aadhaarPhotoIdForVerification && (
              <>
                <hr className="my-4"/>
                <h5 className='mb-3 section-title'><FaShieldAlt className="me-2 text-primary"/>Face Verification</h5>
                <Card className="mb-4 face-verification-card shadow-sm" id="face_verification">
                  <Card.Body className="p-3">
                    {isFaceVerificationComplete ? (
                      <Alert variant="success" className="text-center"><FaCheckCircle className="me-2"/> Face Verification Successful.</Alert>
                    ) : (
                      <>
                        <p className="text-muted small mb-2">Please complete live face verification using your Aadhaar photo as reference.</p>
                        <FaceVerificationApp referenceImageId={aadhaarPhotoIdForVerification} onVerificationComplete={handleFaceVerificationResult} />
                        {faceVerificationError && <Alert variant="danger" className="mt-3 py-2 small">{faceVerificationError}</Alert>}
                        {showValidationErrors && formErrors.face_verification && <Alert variant="danger" className="mt-3 py-2 small">{formErrors.face_verification}</Alert>}
                      </>
                    )}
                  </Card.Body>
                </Card>
              </>
            )}

            <Row>
              <Col className="d-flex justify-content-end pt-3 mt-3 border-top">
                <Button type="button" variant={draftSaveStatus.saved ? "outline-success" : "outline-secondary"} className="me-2 save-draft-button" onClick={handleSaveDraft} disabled={isSavingDraft || isSubmitting || showOtpModal}>
                  {isSavingDraft ? <><Spinner as="span" animation="border" size="sm" /> Saving...</> : (draftSaveStatus.saved ? <><FaCheckCircle className="me-1"/>Draft Saved</> : <><FaRegSave className="me-1"/>Save Draft</>)}
                </Button>
                <Button type="submit" variant="primary" className="submit-button"
                  disabled={isSubmitting || isSavingDraft || !isFormValidForSubmit || showOtpModal}
                  title={!isFormValidForSubmit ? "Please complete all required fields and verifications." : (showOtpModal ? "Please complete OTP verification." : "Submit Waiver Application")}>
                  {isSubmitting ? <><Spinner as="span" animation="border" size="sm" className="me-1"/> Submitting...</> : <><FaCloudUploadAlt className="me-1"/>Submit Waiver Application</>}
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
