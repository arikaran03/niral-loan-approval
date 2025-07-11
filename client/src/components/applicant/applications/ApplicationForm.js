// src/components/application/ApplicationForm.js

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
  InputGroup,
} from "react-bootstrap";
import { axiosInstance } from "../../../config";
import {
  FaInfoCircle,
  FaDollarSign,
  FaPercentage,
  FaCalendarAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCloudUploadAlt,
  FaTrash,
  FaListOl,
  FaFileMedicalAlt,
  FaRegSave,
  FaFileUpload,
  FaShieldAlt,
  FaDownload,
  FaPaperclip,
} from "react-icons/fa";
import {
  Check,
  AlertCircle,
  FileWarning,
  UserCheck,
  BarChart3,
  Landmark,
  MessageSquareText,
} from "lucide-react";
import "./ApplicationForm.css";
import FaceVerificationApp from "../verification/FaceVerificationApp";
import FieldRenderer from "./FieldRenderer";
import OtpVerificationModal from "./OtpVerificationModal";
import LiquidLoader from "../../super/LiquidLoader";
import annexurePdf from "./annexure.pdf";

// Define field labels eligible for annexure if mismatched
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
  const [submissionStatus, setSubmissionStatus] = useState("filling");
  const [apiError, setApiError] = useState("");
  const [autoFillError, setAutoFillError] = useState("");
  const [submissionId, setSubmissionId] = useState(null);
  const [docValidationStatus, setDocValidationStatus] = useState({});
  const [isFormValidForSubmit, setIsFormValidForSubmit] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState({});
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Face Verification State
  const [aadhaarPhotoIdForVerification, setAadhaarPhotoIdForVerification] = useState(null);
  const [isFaceVerificationComplete, setIsFaceVerificationComplete] = useState(false);
  const [showFaceVerificationModule, setShowFaceVerificationModule] = useState(false);
  const [faceVerificationError, setFaceVerificationError] = useState("");

  // Annexure State
  const [annexureEligibleMismatches, setAnnexureEligibleMismatches] = useState([]);
  const [showAnnexureUpload, setShowAnnexureUpload] = useState(false);
  const [annexureFile, setAnnexureFile] = useState(null);
  const [existingAnnexureFileRef, setExistingAnnexureFileRef] = useState(null);
  const [annexureFileError, setAnnexureFileError] = useState("");

  // OTP Verification State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpVerificationMobileNumber, setOtpVerificationMobileNumber] = useState(null);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [otpVerificationError, setOtpVerificationError] = useState("");
  const [isAadhaarFromGovDB, setIsAadhaarFromGovDB] = useState(false);

  const formRef = useRef(null);

  const isExtracting = Object.values(docValidationStatus).some(
    (status) => status.status === "validating"
  );

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

  const initializeForm = useCallback((loanDef, draftData = null) => {
    const initialFd = {};
    const initialExistingRefs = {};
    const customFields = loanDef?.fields || [];
    const reqDocs = loanDef?.required_documents || [];

    initialFd.amount = draftData?.amount ?? (loanDef?.min_amount || "");
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
    if (!reqDocs.find((d) => d.schema_id === "aadhaar_card")) allDocsForDraft.push({ name: "Aadhaar Card", schema_id: "aadhaar_card" });
    if (!reqDocs.find((d) => d.schema_id === "pan_card")) allDocsForDraft.push({ name: "PAN Card", schema_id: "pan_card" });

    allDocsForDraft.forEach((doc) => {
      const draftRefKey = `reqDoc_${doc.schema_id}`;
      if (draftData?.fileReferences?.[draftRefKey]) {
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
    setIsOtpVerified(false);
    setOtpVerificationError("");
    setIsAadhaarFromGovDB(false);
    setAnnexureEligibleMismatches([]);
    setShowAnnexureUpload(false);
    setAnnexureFile(null);
    setAnnexureFileError("");
  }, []);

  useEffect(() => {
    if (!loanId) {
      setApiError("Loan ID is missing.");
      setLoading(false);
      return;
    }
    let isMounted = true;
    setLoading(true);
    const loadData = async () => {
      try {
        const loanRes = await axiosInstance.get(`/api/loans/${loanId}`);
        if (!isMounted) return;
        const loanDef = loanRes.data;
        if (!loanDef.document_definitions) loanDef.document_definitions = {};
        if (!loanDef.aadhaar_card_definition && loanDef.document_definitions.aadhaar_card) {
          loanDef.aadhaar_card_definition = loanDef.document_definitions.aadhaar_card;
        } else if (!loanDef.aadhaar_card_definition) {
          console.warn("Aadhaar card definition missing from loan schema response.");
        }
        if (!loanDef.pan_card_definition && loanDef.document_definitions.pan_card) {
          loanDef.pan_card_definition = loanDef.document_definitions.pan_card;
        } else if (!loanDef.pan_card_definition) {
          console.warn("PAN card definition missing from loan schema response.");
        }

        setLoanSchemaData(loanDef);
        let draftData = null;
        try {
          const draftRes = await axiosInstance.get(`/api/application/${loanId}/submissions/draft`);
          if (!isMounted) return;
          draftData = draftRes.data;
          console.log("Draft loaded:", draftData);
        } catch (draftErr) {
          if (draftErr.response?.status !== 404)
            console.error("Error loading draft:", draftErr);
        }
        initializeForm(loanDef, draftData);
      } catch (err) {
        console.error("Error loading loan definition:", err);
        if (isMounted) {
          setApiError(err.response?.data?.error || `Failed to load loan details (ID: ${loanId}).`);
          setLoanSchemaData(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [loanId, initializeForm]);

  const handleInputChange = useCallback(
    (fieldId, value) => {
      setFormData((prev) => ({ ...prev, [fieldId]: value }));
      setAutoFilledFields((prev) => {
        if (!prev[fieldId]) return prev;
        if (String(prev[fieldId].value).toLowerCase() !== String(value).toLowerCase()) {
          const newState = { ...prev };
          delete newState[fieldId];
          return newState;
        }
        return prev;
      });
      if (showValidationErrors) {
        setFormErrors((prev) => {
          if (!prev[fieldId]) return prev;
          const n = { ...prev };
          delete n[fieldId];
          return n;
        });
      }
      if (apiError) setApiError("");
      if (autoFillError) setAutoFillError("");
    },
    [apiError, autoFillError, showValidationErrors]
  );

  const handleCustomFieldFileChange = useCallback(
    (fieldId, file) => {
      setCustomFieldFiles((prev) => {
        const n = { ...prev };
        if (file) n[fieldId] = file;
        else delete n[fieldId];
        return n;
      });
      setExistingFileRefs((prev) => {
        const n = { ...prev };
        delete n[fieldId];
        return n;
      });
      handleInputChange(fieldId, file ? file.name : "");
    },
    [handleInputChange]
  );

  const validateField = useCallback((fieldSchema, value) => {
    const { required, type, min_value, max_value, field_label } = fieldSchema;
    const label = field_label || "Field";
    if (required && type !== "image" && type !== "document") {
      if (value === null || value === undefined || String(value).trim() === "") return `${label} is required.`;
      if (type === "checkbox" && !value) return `${label} must be checked.`;
    }
    if (!required && (value === null || value === undefined || String(value).trim() === "")) return null;
    switch (type) {
      case "number":
        const n = parseFloat(value);
        if (isNaN(n)) return `${label} must be a valid number.`;
        if (min_value !== null && min_value !== undefined && String(min_value).trim() !== "" && n < parseFloat(min_value))
          return `${label} must be at least ${min_value}.`;
        if (max_value !== null && max_value !== undefined && String(max_value).trim() !== "" && n > parseFloat(max_value))
          return `${label} cannot exceed ${max_value}.`;
        break;
      case "text":
      case "textarea":
        const s = String(value || "");
        if (min_value !== null && min_value !== undefined && String(min_value).trim() !== "" && s.length < parseInt(min_value, 10))
          return `${label} must be at least ${min_value} characters long.`;
        if (max_value !== null && max_value !== undefined && String(max_value).trim() !== "" && s.length > parseInt(max_value, 10))
          return `${label} cannot exceed ${max_value} characters.`;
        break;
      case "date":
      case "datetime-local":
        if (value && isNaN(Date.parse(value))) return `${label} must be a valid date.`;
        if (min_value && value && new Date(value) < new Date(formatDateToYYYYMMDD(min_value)))
          return `${label} cannot be earlier than ${min_value}.`;
        if (max_value && value && new Date(value) > new Date(formatDateToYYYYMMDD(max_value)))
          return `${label} cannot be later than ${max_value}.`;
        break;
      default:
        break;
    }
    return null;
  }, []);

  const runFullValidation = useCallback(
    (showErrors = false) => {
      const currentErrors = {};
      let hasHardErrors = false;
      let tempAnnexureEligibleMismatchesLocal = [];
      
      if (!loanSchemaData) {
        setIsFormValidForSubmit(false);
        return false;
      }

      if (!formData.amount || isNaN(formData.amount) || Number(formData.amount) <= 0) {
        currentErrors["amount"] = "A valid positive amount is required.";
        hasHardErrors = true;
      } else if (loanSchemaData.min_amount !== null && Number(formData.amount) < loanSchemaData.min_amount) {
        currentErrors["amount"] = `Amount must be at least ₹${loanSchemaData.min_amount?.toLocaleString("en-IN")}.`;
        hasHardErrors = true;
      } else if (loanSchemaData.max_amount !== null && Number(formData.amount) > loanSchemaData.max_amount) {
        currentErrors["amount"] = `Amount cannot exceed ₹${loanSchemaData.max_amount?.toLocaleString("en-IN")}.`;
        hasHardErrors = true;
      }
      
      loanSchemaData.fields.forEach((f) => {
        const value = formData[f.field_id];
        const error = validateField(f, value);
        if (error) {
          currentErrors[f.field_id] = error;
          hasHardErrors = true;
        }

        if ((f.type === 'image' || f.type === 'document') && f.required) {
          const hasUploadedFile = !!customFieldFiles[f.field_id];
          const hasExistingFile = !!existingFileRefs[f.field_id];
          if (!hasUploadedFile && !hasExistingFile) {
              currentErrors[f.field_id] = `${f.field_label} is required.`;
              hasHardErrors = true;
          }
        }
      });

      const allRequiredDocs = new Set(['aadhaar_card', 'pan_card', ...(loanSchemaData.required_documents || []).map(d => d.schema_id)]);
      
      allRequiredDocs.forEach(docKey => {
          const docDef = docKey === 'aadhaar_card' ? loanSchemaData.aadhaar_card_definition : docKey === 'pan_card' ? loanSchemaData.pan_card_definition : loanSchemaData.document_definitions?.[docKey];
          const docLabel = docDef?.label || docKey.replace(/_/g, ' ');
          const docRefKey = `reqDoc_${docKey}`;
          const hasUploadedFile = !!requiredDocFiles[docKey];
          const hasExistingFile = !!existingFileRefs[docRefKey];

          if (!hasUploadedFile && !hasExistingFile) {
              currentErrors[docRefKey] = `${docLabel} is required.`;
              hasHardErrors = true;
          }
      });

      Object.keys(docValidationStatus).forEach(docKey => {
          const statusInfo = docValidationStatus[docKey];
          const docDef = docKey === 'aadhaar_card' ? loanSchemaData.aadhaar_card_definition : docKey === 'pan_card' ? loanSchemaData.pan_card_definition : loanSchemaData.document_definitions?.[docKey];
          const docLabel = docDef?.label || docKey.replace(/_/g, ' ');
          const docRefKey = `reqDoc_${docKey}`;

          if (statusInfo?.status === 'extraction_incomplete') {
              currentErrors[docRefKey] = `Essential information could not be read from ${docLabel}. Please upload a clearer image.`;
              hasHardErrors = true;
          } else if (statusInfo?.status === "error") {
              const allMismatchesAnnexureEligible = statusInfo.mismatches?.every(mm => ANNEXURE_ELIGIBLE_FIELD_LABELS.includes(mm.fieldLabel));
              if (allMismatchesAnnexureEligible) {
                  statusInfo.mismatches.forEach(mm => {
                      tempAnnexureEligibleMismatchesLocal.push({ docTypeKey: docKey, fieldLabel: mm.fieldLabel, extractedValue: mm.actual, formValue: mm.expected });
                  });
                  currentErrors[docRefKey] = `${docLabel} has Name/Address discrepancies. Annexure may be required.`;
              } else {
                  currentErrors[docRefKey] = `${docLabel} has critical data mismatches or other issues. Please re-upload or check the document.`;
                  hasHardErrors = true;
              }
          } else if (statusInfo?.status !== 'verified') {
              currentErrors[docRefKey] = `${docLabel} requires successful verification. Status: ${statusInfo?.status || "Pending"}.`;
              hasHardErrors = true;
          }
      });

      setAnnexureEligibleMismatches(tempAnnexureEligibleMismatchesLocal);
      let finalFormValidity = !hasHardErrors;

      if (tempAnnexureEligibleMismatchesLocal.length > 0) {
        setShowAnnexureUpload(true);
        if (!(annexureFile || existingAnnexureFileRef)) {
          currentErrors["annexure"] = "An annexure document is required to resolve the noted name/address discrepancies.";
          finalFormValidity = false;
        } else if (finalFormValidity) {
          tempAnnexureEligibleMismatchesLocal.forEach((aem) => {
            if (currentErrors[`reqDoc_${aem.docTypeKey}`]?.includes("Annexure may be required")) {
              delete currentErrors[`reqDoc_${aem.docTypeKey}`];
            }
          });
        }
      } else {
        setShowAnnexureUpload(false);
      }
      
      if (isAadhaarFromGovDB && otpVerificationMobileNumber && !isOtpVerified) {
        currentErrors["otp_verification"] = "Mobile OTP verification for Aadhaar is pending. Please complete it to proceed.";
        finalFormValidity = false;
      }
      
      if (showFaceVerificationModule && aadhaarPhotoIdForVerification && !isFaceVerificationComplete) {
        let otpPrerequisiteMet = true;
        if (isAadhaarFromGovDB && otpVerificationMobileNumber) {
          otpPrerequisiteMet = isOtpVerified;
        }
        if (otpPrerequisiteMet) {
          currentErrors["face_verification"] = "Face verification is required to submit the application.";
          finalFormValidity = false;
        }
      }
      
      if (showErrors) {
        setFormErrors(currentErrors);
      }
      setIsFormValidForSubmit(finalFormValidity);
      return finalFormValidity;
    },
    [
      formData,
      loanSchemaData,
      requiredDocFiles,
      customFieldFiles,
      existingFileRefs,
      docValidationStatus,
      validateField,
      isFaceVerificationComplete,
      showFaceVerificationModule,
      annexureFile,
      existingAnnexureFileRef,
      isAadhaarFromGovDB,
      otpVerificationMobileNumber,
      isOtpVerified,
      aadhaarPhotoIdForVerification,
    ]
  );

  useEffect(() => {
    runFullValidation(false);
  }, [runFullValidation]);

  const triggerEntityExtraction = useCallback(async (docTypeKey, file) => {
    console.log(`Triggering entity extraction for ${docTypeKey}...`);
    let docDefinition;
    if (docTypeKey === "aadhaar_card")
      docDefinition = loanSchemaData?.aadhaar_card_definition;
    else if (docTypeKey === "pan_card")
      docDefinition = loanSchemaData?.pan_card_definition;
    else docDefinition = loanSchemaData?.document_definitions?.[docTypeKey];

    if (!docDefinition) {
      console.warn(`No document definition found for type ${docTypeKey}. Auto-fill skipped.`);
      setDocValidationStatus((prev) => ({ ...prev, [docTypeKey]: { status: "error", mismatches: [{ fieldLabel: "Configuration Error", expected: "", actual: "Document type not configured for auto-fill details." }] } }));
      return;
    }

    console.log(`Triggering entity extraction for ${docDefinition.label || docTypeKey} (type: ${docTypeKey})`);
    setDocValidationStatus((prev) => ({ ...prev, [docTypeKey]: { status: "validating", mismatches: null } }));
    setAutoFillError("");
    setApiError("");
    setAnnexureEligibleMismatches((prev) => prev.filter((m) => m.docTypeKey !== docTypeKey));

    if (docTypeKey === "aadhaar_card") {
      setIsAadhaarFromGovDB(false);
      setOtpVerificationMobileNumber(null);
      setShowOtpModal(false);
      setIsOtpVerified(false);
      setOtpVerificationError("");
      setShowFaceVerificationModule(false);
      setIsFaceVerificationComplete(false);
      setFaceVerificationError("");
    }

    const docFieldsSchema = docDefinition.fields || [];
    if (docFieldsSchema.length === 0) {
      console.warn(`No field schema defined for document type ${docTypeKey} (for ${docDefinition.label}). Auto-fill skipped.`);
      setDocValidationStatus((prev) => ({ ...prev, [docTypeKey]: { status: "error", mismatches: [{ fieldLabel: "Configuration Error", expected: "", actual: "Fields for this document type not configured." }] } }));
      return;
    }
    const fieldsPayload = JSON.stringify({
      label: docDefinition.label || docTypeKey,
      fields: docFieldsSchema.map((f) => ({ key: f.key, label: f.label, prompt: f.prompt || "" })),
    });

    try {
      const ocrApiFormData = new FormData();
      ocrApiFormData.append("file", file);
      ocrApiFormData.append("docType", docTypeKey);
      ocrApiFormData.append("fields", fieldsPayload);
      const ocrResponse = await axiosInstance.post("/api/application/extract-entity", ocrApiFormData, { headers: { "Content-Type": "multipart/form-data" } });
      const { extracted_data: extractedDataFromOCR, doc_name: detectedDocTypeFromApi } = ocrResponse.data;

      if (detectedDocTypeFromApi !== docTypeKey) {
        const expectedLabel = docDefinition.label || docTypeKey;
        const actualDef = detectedDocTypeFromApi === "aadhaar_card"
            ? loanSchemaData?.aadhaar_card_definition
            : detectedDocTypeFromApi === "pan_card"
            ? loanSchemaData?.pan_card_definition
            : loanSchemaData?.document_definitions?.[detectedDocTypeFromApi];
        const actualLabel = actualDef?.label || detectedDocTypeFromApi || "Unknown";
        const mismatchError = [{ fieldLabel: "Document Type Mismatch", expected: docTypeKey, actual: detectedDocTypeFromApi || "Unknown" }];
        setDocValidationStatus((prev) => ({ ...prev, [docTypeKey]: { status: "error", mismatches: mismatchError } }));
        setAutoFillError(`Incorrect document type uploaded for ${expectedLabel}. Expected ${expectedLabel}, but received a document identified as ${actualLabel}.`);
        return;
      }
      
      const ocrDataMap = typeof extractedDataFromOCR === "object" && !Array.isArray(extractedDataFromOCR)
          ? { ...extractedDataFromOCR } : Array.isArray(extractedDataFromOCR)
          ? extractedDataFromOCR.reduce((acc, pair) => { if (pair && pair.key) acc[pair.key] = pair.value; return acc; }, {}) : {};
      
      let dataToUseForAutofill = ocrDataMap;
      let isDataFromDB = false;
      let localPhotoIdForFaceVerification = null;
      let govDbSourceNote = "Data extracted via OCR.";
      
      const uniqueIdentifiersToCheck = Object.entries(ocrDataMap).map(([key, value]) => ({ key, value })).filter((pair) => docDefinition.fields.some((f) => f.is_unique_identifier && f.key === pair.key && pair.value && String(pair.value).trim() !== ""));

      if (uniqueIdentifiersToCheck.length > 0) {
        try {
          const govDbApiResponse = await axiosInstance.post("/api/document/check-unique", {
            schema_definition_id: docDefinition._id,
            identifiers_to_check: uniqueIdentifiersToCheck,
          });
          const govDbResponseData = govDbApiResponse.data;
          console.log(`GovDB response for ${docTypeKey}:`, govDbResponseData);

          if (govDbResponseData.exists === true && govDbResponseData.matched_keys && govDbResponseData.matched_keys.length > 0) {
            const matchedSubmission = govDbResponseData.matched_keys[0];
            console.log(`Existing submission found in GovDB for ${docTypeKey}. Prioritizing this data.`);

            isDataFromDB = true;
            dataToUseForAutofill = (matchedSubmission.fields || []).reduce((acc, field) => {
                acc[field.field_id] = field.value;
                if (docTypeKey === "aadhaar_card" && (field.field_id === "photo" || field.key === "photo") && field.fileRef) {
                  localPhotoIdForFaceVerification = field.fileRef;
                  console.log(`Photo ID for face verification from GovDB Aadhaar: ${localPhotoIdForFaceVerification}`);
                }
                return acc;
              }, {});
            govDbSourceNote = "Data matched with existing verified record.";
          } else if (govDbResponseData.exists === false && govDbResponseData.totalCount > 0) {
            console.warn(`No exact match in GovDB for ${docTypeKey}, but other records exist.`);
            const mismatchErrorMsg = `The uploaded ${docDefinition.label || docTypeKey} does not match our existing records. Please upload a valid document or ensure the details are correct.`;
            setDocValidationStatus((prev) => ({ ...prev, [docTypeKey]: { status: "error", mismatches: [{ fieldLabel: "Document Verification", expected: "Match in existing records", actual: "No exact match found." }] } }));
            setAutoFillError(mismatchErrorMsg);
            return;
          }
        } catch (govDbError) {
          console.warn(`Could not verify unique identifiers against GovDB for ${docTypeKey}:`, govDbError);
          setAutoFillError(`Could not verify document against central records. Auto-fill will use extracted data. ${govDbError.response?.data?.message || ""}`);
        }
      }

      if (!isDataFromDB) {
        const allAutoFillFieldsForThisDoc = loanSchemaData.fields.filter(f => f.auto_fill_sources?.some(s => s.startsWith(`${docTypeKey}.`)));
        const missingAutoFillFields = [];

        allAutoFillFieldsForThisDoc.forEach(appField => {
            const sourceKey = getFieldKeyFromSource(appField.auto_fill_sources.find(s => s.startsWith(`${docTypeKey}.`)));
            if (!dataToUseForAutofill[sourceKey] || String(dataToUseForAutofill[sourceKey]).trim() === "") {
                missingAutoFillFields.push(appField.field_label);
            }
        });

        if (missingAutoFillFields.length > 0) {
            console.error(`Required auto-fill fields missing from ${docTypeKey} extraction:`, missingAutoFillFields);
            setDocValidationStatus(prev => ({
                ...prev,
                [docTypeKey]: {
                    status: 'extraction_incomplete',
                    missingFields: missingAutoFillFields,
                }
            }));
            return; 
        }
      }

      if (docTypeKey === "aadhaar_card") {
        if (!localPhotoIdForFaceVerification) {
            const photoFieldKeyFromSchema = docDefinition.fields.find(f => f.key === "photo" || f.label.toLowerCase().includes("photo"))?.key;
            if (photoFieldKeyFromSchema && dataToUseForAutofill[photoFieldKeyFromSchema]) {
                localPhotoIdForFaceVerification = dataToUseForAutofill[photoFieldKeyFromSchema];
            }
        }
        setAadhaarPhotoIdForVerification(localPhotoIdForFaceVerification);
        setIsAadhaarFromGovDB(isDataFromDB);

        if (isDataFromDB) {
            const mobileKeyInAadhaarSchema = docDefinition.fields.find(f => f.key === "mobile_number" || f.key === "phone_number" || f.type === "phone")?.key;
            const mobileNumberFromDB = mobileKeyInAadhaarSchema ? dataToUseForAutofill[mobileKeyInAadhaarSchema] : null;

            if (mobileNumberFromDB && localPhotoIdForFaceVerification) {
                setOtpVerificationMobileNumber(mobileNumberFromDB);
                setShowOtpModal(true);
            } else {
                 if (!mobileNumberFromDB) console.warn("Mobile number missing from GovDB Aadhaar data. OTP cannot be sent.");
                 if (!localPhotoIdForFaceVerification) console.warn("Photo ID missing from GovDB Aadhaar data. Face verification cannot proceed.");
            }
        } else {
            if (localPhotoIdForFaceVerification) {
                setShowFaceVerificationModule(true);
            } else {
                console.warn("New Aadhaar (OCR), but no photo_id obtained for face verification.");
            }
        }
      }
      
      const currentMismatches = [];
      let canProceedWithOverallFill = true;

      // Check for mismatches against other verified documents first.
      loanSchemaData?.fields.forEach((targetField) => {
        const relevantSource = targetField.auto_fill_sources?.find((source) => source.startsWith(`${docTypeKey}.`));
        if (relevantSource) {
          const sourceKey = getFieldKeyFromSource(relevantSource);
          if (dataToUseForAutofill.hasOwnProperty(sourceKey)) {
            const autoFillValueStr = String(dataToUseForAutofill[sourceKey] ?? "");
            const targetFieldId = targetField.field_id;
            if (autoFilledFields[targetFieldId] && autoFilledFields[targetFieldId].verifiedByDocType !== docTypeKey) {
              const existingVerifiedValueStr = String(autoFilledFields[targetFieldId].value ?? "");
              if (existingVerifiedValueStr.toLowerCase() !== autoFillValueStr.toLowerCase()) {
                const conflictingDocDef =
                  autoFilledFields[targetFieldId].verifiedByDocType === "aadhaar_card"
                    ? loanSchemaData?.aadhaar_card_definition
                    : autoFilledFields[targetFieldId].verifiedByDocType === "pan_card"
                    ? loanSchemaData?.pan_card_definition
                    : loanSchemaData?.document_definitions?.[autoFilledFields[targetFieldId].verifiedByDocType];
                const conflictingDocLabel = conflictingDocDef?.label || autoFilledFields[targetFieldId].verifiedByDocType;
                currentMismatches.push({
                  fieldLabel: targetField.field_label,
                  expected: existingVerifiedValueStr,
                  actual: autoFillValueStr,
                  conflictingDoc: conflictingDocLabel,
                });
              }
            }
          }
        }
      });

      // Determine if there are critical mismatches (not eligible for annexure)
      if (currentMismatches.some((mm) => !ANNEXURE_ELIGIBLE_FIELD_LABELS.includes(mm.fieldLabel))) {
        canProceedWithOverallFill = false;
      }

      if (canProceedWithOverallFill) {
        let updatedFormDataFlag = false;
        const newAutoFilledForThisDoc = {};
        const currentFormDataSnapshot = { ...formData };
        
        loanSchemaData?.fields.forEach((targetField) => {
          const relevantSource = targetField.auto_fill_sources?.find((source) => source.startsWith(`${docTypeKey}.`));
          if (relevantSource) {
            const sourceKey = getFieldKeyFromSource(relevantSource);
            if (dataToUseForAutofill.hasOwnProperty(sourceKey)) {
              let autoFillValue = String(dataToUseForAutofill[sourceKey] ?? "");
              if (targetField.type === "date" && autoFillValue.match(/^\d{2}-\d{2}-\d{4}$/)) {
                autoFillValue = formatDateToYYYYMMDD(autoFillValue);
              } else if (targetField.type === "date" && autoFillValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
                autoFillValue = autoFillValue.split("T")[0];
              }

              const targetFieldId = targetField.field_id;
              const existingManualValue = String(currentFormDataSnapshot[targetFieldId] ?? "");
              
              const isManuallyFilled = existingManualValue && !autoFilledFields[targetFieldId];

              // Check if this field is already part of an inter-document mismatch
              const isInterDocMismatched = currentMismatches.some((mm) => mm.fieldLabel === targetField.field_label);

              if (isManuallyFilled && existingManualValue.toLowerCase() !== autoFillValue.toLowerCase()) {
                  // This is a manual mismatch. Add it to the list (if not already there) and skip filling.
                  if (!isInterDocMismatched) {
                    currentMismatches.push({
                      fieldLabel: targetField.field_label,
                      expected: existingManualValue,
                      actual: autoFillValue,
                      note: "manual value conflict",
                    });
                  }
              } else if (isInterDocMismatched) {
                  // This field had an annexure-eligible inter-document mismatch.
                  // The mismatch is already in the list. Do not auto-fill this specific field.
                  // By doing nothing here, we allow the loop to continue to the next field.
              } else {
                  // This field is clear of all conflicts. Proceed with auto-fill.
                  if (currentFormDataSnapshot[targetFieldId] !== autoFillValue) {
                    currentFormDataSnapshot[targetFieldId] = autoFillValue;
                    updatedFormDataFlag = true;
                  }
                  newAutoFilledForThisDoc[targetFieldId] = {
                    value: autoFillValue,
                    verifiedByDocType: docTypeKey,
                    originalSourceKey: sourceKey,
                  };
              }
            }
          }
        });

        if (updatedFormDataFlag) {
          setFormData(currentFormDataSnapshot);
        }
        if (Object.keys(newAutoFilledForThisDoc).length > 0) {
          setAutoFilledFields((prevAutoFilled) => ({ ...prevAutoFilled, ...newAutoFilledForThisDoc }));
        }

        const currentDocStatus = docValidationStatus[docTypeKey];
        if (!currentDocStatus || currentDocStatus.status !== "error" || (currentDocStatus.mismatches && currentDocStatus.mismatches[0]?.expected !== "Match in existing records")) {
          if (currentMismatches.length > 0) {
            setDocValidationStatus((prev) => ({ ...prev, [docTypeKey]: { status: "error", mismatches: currentMismatches } }));
            setAutoFillError(`Data conflicts found for ${docDefinition.label || docTypeKey}. Please review manual entries.`);
            const allMismatchesAnnexureEligible = currentMismatches.every((mm) => ANNEXURE_ELIGIBLE_FIELD_LABELS.includes(mm.fieldLabel));
            if (allMismatchesAnnexureEligible) {
              setAnnexureEligibleMismatches((prev) => [...prev.filter((m) => m.docTypeKey !== docTypeKey), ...currentMismatches.map((mm) => ({ ...mm, docTypeKey }))]);
            }
          } else if (currentDocStatus?.status !== "verified") {
            setDocValidationStatus((prev) => ({ ...prev, [docTypeKey]: { status: "verified", mismatches: null, note: govDbSourceNote } }));
            console.log(`${docDefinition.label || docTypeKey} processed for auto-fill. Source: ${govDbSourceNote.includes("existing record") ? "GovDB" : "OCR"}`);
          }
        }
      } else {
        setDocValidationStatus((prev) => ({ ...prev, [docTypeKey]: { status: "error", mismatches: currentMismatches } }));
        setAutoFillError(`Critical data mismatches found for ${docDefinition.label || docTypeKey} against previously verified documents. Values not auto-filled.`);
        console.error(`${docDefinition.label || docTypeKey} verification failed due to critical mismatches with other documents.`);
      }
    } catch (error) {
      console.error(`Entity extraction or GovDB check failed for ${docDefinition?.label || docTypeKey}:`, error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || "Failed to process document.";
      setDocValidationStatus((prev) => ({
        ...prev,
        [docTypeKey]: { status: "error", mismatches: [{ fieldLabel: "Processing Error", expected: "", actual: errorMsg }] },
      }));
      setApiError(`Error processing ${docDefinition?.label || docTypeKey}: ${errorMsg}`);
    }
  }, [loanSchemaData, formData, autoFilledFields, getFieldKeyFromSource, docValidationStatus, validateField]);

  const handleRequiredDocFileChangeCallback = useCallback(
    (docTypeKey, file) => {
      setRequiredDocFiles((prev) => {
        const n = { ...prev };
        if (file) n[docTypeKey] = file;
        else delete n[docTypeKey];
        return n;
      });
      const refKey = `reqDoc_${docTypeKey}`;
      setExistingFileRefs((prev) => {
        const n = { ...prev };
        delete n[refKey];
        return n;
      });
      setAnnexureEligibleMismatches((prev) => prev.filter((m) => m.docTypeKey !== docTypeKey));
      
      if (file) {
        triggerEntityExtraction(docTypeKey, file);
      } else {
        setDocValidationStatus((prev) => {
          const n = { ...prev };
          delete n[docTypeKey];
          return n;
        });
        const clearedDocTypeKey = docTypeKey;
        if (clearedDocTypeKey) {
          const newFormData = { ...formData };
          const newAutoFilled = { ...autoFilledFields };
          let changedInFormData = false;
          let changedInAutoFilled = false;
          Object.keys(autoFilledFields).forEach((fieldId) => {
            if (autoFilledFields[fieldId]?.verifiedByDocType === clearedDocTypeKey) {
              if (String(newFormData[fieldId]).toLowerCase() === String(autoFilledFields[fieldId].value).toLowerCase()) {
                newFormData[fieldId] = "";
                changedInFormData = true;
              }
              delete newAutoFilled[fieldId];
              changedInAutoFilled = true;
            }
          });
          if (changedInFormData) setFormData(newFormData);
          if (changedInAutoFilled) setAutoFilledFields(newAutoFilled);
          
          let docDef;
          if (clearedDocTypeKey === "aadhaar_card") docDef = loanSchemaData?.aadhaar_card_definition;
          else if (clearedDocTypeKey === "pan_card") docDef = loanSchemaData?.pan_card_definition;
          else docDef = loanSchemaData?.document_definitions?.[clearedDocTypeKey];
          const docLabel = docDef?.label || clearedDocTypeKey;
          if (autoFillError.includes(docLabel)) setAutoFillError("");
          if (clearedDocTypeKey === "aadhaar_card") {
            setAadhaarPhotoIdForVerification(null);
            setIsFaceVerificationComplete(false);
            setShowFaceVerificationModule(false);
            setFaceVerificationError("");
            setShowOtpModal(false);
            setOtpVerificationMobileNumber(null);
            setIsOtpVerified(false);
            setOtpVerificationError("");
            setIsAadhaarFromGovDB(false);
          }
          const remainingMismatches = annexureEligibleMismatches.filter((m) => m.docTypeKey !== clearedDocTypeKey);
          setAnnexureEligibleMismatches(remainingMismatches);
          if (remainingMismatches.length === 0) {
            setShowAnnexureUpload(false);
          }
        }
      }
    },
    [triggerEntityExtraction, formData, autoFilledFields, autoFillError, loanSchemaData, annexureEligibleMismatches]
  );
  
  const handleFaceVerificationResult = useCallback((success, errorMsg = "") => {
    setIsFaceVerificationComplete(success);
    if (success) {
      setFaceVerificationError("");
    } else {
      setFaceVerificationError(errorMsg || "Face verification failed or was cancelled by user. Please try again.");
    }
    runFullValidation(showValidationErrors);
  }, [showValidationErrors, runFullValidation]);

  const handleAnnexureFileChange = (event) => {
    const file = event.target.files ? event.target.files[0] : null;
    if (file) {
      if (file.type === "application/pdf") {
        setAnnexureFile(file);
        setAnnexureFileError("");
        setExistingAnnexureFileRef(null);
      } else {
        setAnnexureFile(null);
        setAnnexureFileError("Invalid file type. Please upload a PDF annexure.");
      }
    } else {
      setAnnexureFile(null);
    }
    runFullValidation(showValidationErrors);
  };

  const handleOtpVerificationSubmit = async (requestId, otpValue) => {
    if (!otpVerificationMobileNumber) {
      setOtpVerificationError("Mobile number not available for OTP verification.");
      return;
    }
    setOtpVerificationError("");

    try {
      const response = await axiosInstance.post("/api/otp/verify", {
        mobileNumber: otpVerificationMobileNumber,
        otp: otpValue,
        loanId: loanId,
        requestId: requestId,
      });

      if (response.data.verified) {
        setIsOtpVerified(true);
        setShowOtpModal(false);
        setOtpVerificationError("");

        if (aadhaarPhotoIdForVerification) {
          setShowFaceVerificationModule(true);
        } else {
          console.warn("OTP verified, but Aadhaar photo ID is missing. Cannot proceed to face verification.");
          setFaceVerificationError("Aadhaar photo data is missing, cannot start face verification even after OTP success.");
        }
      } else {
        console.error("OTP Verification Failed by API:", response.data.message || "Incorrect OTP.");
        setOtpVerificationError(response.data.message || "The entered OTP is incorrect. Please try again.");
        setIsOtpVerified(false);
      }
    } catch (error) {
      console.error("Error during OTP verification API call:", error);
      const errMsg = error.response?.data?.error || error.response?.data?.message || "OTP verification service failed. Please try again later.";
      setOtpVerificationError(errMsg);
      setIsOtpVerified(false);
    } finally {
      runFullValidation(showValidationErrors);
    }
  };

  const handleOtpModalClose = () => {
    setShowOtpModal(false);
    runFullValidation(showValidationErrors);
  };

  const handleSaveDraft = async () => {
    if (isSavingDraft || isSubmitting) return;
    const draftErrors = {};
    let isDraftValid = true;
    if (!formData.amount || isNaN(formData.amount) || Number(formData.amount) <= 0) {
      draftErrors["amount"] = "A valid amount is needed to save draft.";
      isDraftValid = false;
    }
    setFormErrors((prev) => ({ ...prev, ...draftErrors }));
    if (!isDraftValid) {
      window.alert("Please enter at least the Loan Amount to save a draft.");
      return;
    }
    setFormErrors((prev) => {
      const n = { ...prev };
      if (Object.keys(draftErrors).includes("amount")) delete n["amount"];
      return n;
    });

    setIsSavingDraft(true);
    setApiError("");
    try {
      const payloadFields = loanSchemaData.fields.map((f) => ({
        field_id: f.field_id,
        field_label: f.field_label,
        type: f.type,
        value: f.type === "image" || f.type === "document"
            ? existingFileRefs[f.field_id] || (customFieldFiles[f.field_id] ? `local:${customFieldFiles[f.field_id].name}` : "")
            : formData[f.field_id] || "",
      }));

      const requiredDocRefsPayload = [];
      const aadhaarRefKey = "reqDoc_aadhaar_card";
      if (existingFileRefs[aadhaarRefKey] || requiredDocFiles["aadhaar_card"]) {
        requiredDocRefsPayload.push({ documentTypeKey: "aadhaar_card", fileRef: existingFileRefs[aadhaarRefKey] || `local:${requiredDocFiles["aadhaar_card"]?.name}` });
      }
      const panRefKey = "reqDoc_pan_card";
      if (existingFileRefs[panRefKey] || requiredDocFiles["pan_card"]) {
        requiredDocRefsPayload.push({ documentTypeKey: "pan_card", fileRef: existingFileRefs[panRefKey] || `local:${requiredDocFiles["pan_card"]?.name}` });
      }
      loanSchemaData.required_documents
        .filter((doc) => doc.schema_id !== "aadhaar_card" && doc.schema_id !== "pan_card")
        .forEach((doc) => {
          const refKey = `reqDoc_${doc.schema_id}`;
          if (existingFileRefs[refKey] || requiredDocFiles[doc.schema_id]) {
            requiredDocRefsPayload.push({ documentTypeKey: doc.schema_id, fileRef: existingFileRefs[refKey] || `local:${requiredDocFiles[doc.schema_id]?.name}` });
          }
        });

      const payload = {
        amount: Number(formData.amount) || 0,
        fields: payloadFields,
        requiredDocumentRefs: requiredDocRefsPayload.filter((ref) => ref.fileRef),
        autoFilledFields: autoFilledFields,
        annexureDocumentRef: existingAnnexureFileRef || (annexureFile ? `local:${annexureFile.name}` : null),
      };
      await axiosInstance.post(`/api/application/${loanId}/submissions/draft`, payload);
      setDraftSaveStatus({ saved: true, time: new Date() });
      setTimeout(() => setDraftSaveStatus({ saved: false, time: null }), 3000);
    } catch (err) {
      console.error("Error saving draft:", err);
      setApiError(err.response?.data?.error || "Draft save failed.");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setApiError("");
    setAutoFillError("");
    setShowValidationErrors(true);
    setOtpVerificationError("");

    if (!runFullValidation(true)) {
       const errorKeys = Object.keys(formErrors);
       if (errorKeys.length > 0) {
        const firstErrorKey = errorKeys[0];
        let selector = `[id="${firstErrorKey}"], [id="custom_${firstErrorKey}"]`;
        if (firstErrorKey.startsWith("reqDoc_") || firstErrorKey === "face_verification" || firstErrorKey === "annexure" || firstErrorKey === "otp_verification") {
          selector = `[id="${firstErrorKey}"]`;
        }
        const element = formRef.current?.querySelector(selector);
        if (element) {
          element.focus({ preventScroll: true });
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          const otpErrorElement = document.getElementById("otp-error-anchor");
          const faceErrorElement = document.getElementById("face-verification-section-anchor");

          if (formErrors.otp_verification && otpErrorElement)
            otpErrorElement.scrollIntoView({ behavior: "smooth", block: "center" });
          else if (formErrors.face_verification && faceErrorElement)
            faceErrorElement.scrollIntoView({ behavior: "smooth", block: "center" });
          else window.scrollTo(0, 0);
        }
      } else {
        window.scrollTo(0, 0);
      }
    } else {
       submitApplication();
    }
  };

  const submitApplication = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setApiError("");
    try {
      const filesToUpload = [];
      Object.keys(requiredDocFiles).forEach(docTypeKey => {
        const refKey = `reqDoc_${docTypeKey}`;
        if (requiredDocFiles[docTypeKey] && !existingFileRefs[refKey]) {
          filesToUpload.push({
            key: refKey,
            file: requiredDocFiles[docTypeKey],
            type: "required",
            docTypeKey: docTypeKey,
          });
        }
      });

      Object.entries(customFieldFiles).forEach(([fieldId, file]) => {
        if (!existingFileRefs[fieldId]) {
          filesToUpload.push({ key: fieldId, file: file, type: "custom" });
        }
      });
      
      if (annexureFile && !existingAnnexureFileRef) {
        filesToUpload.push({ key: "annexure_document", file: annexureFile, type: "annexure" });
      }

      const uploadedFileRefs = { ...existingFileRefs };
      if (existingAnnexureFileRef) {
        uploadedFileRefs["annexure_document"] = existingAnnexureFileRef;
      }

      const uploadPromises = filesToUpload.map(async ({ key, file, type, docTypeKey }) => {
        const fieldSchema = type === "custom" ? loanSchemaData?.fields.find((f) => f.field_id === key) : null;
        let docDefForLabel;
        if (type === "required") {
          if (docTypeKey === "aadhaar_card") docDefForLabel = loanSchemaData?.aadhaar_card_definition;
          else if (docTypeKey === "pan_card") docDefForLabel = loanSchemaData?.pan_card_definition;
          else docDefForLabel = loanSchemaData?.document_definitions?.[docTypeKey];
        }
        const docLabel = type === "annexure" ? "Annexure Document" : type === "required" ? docDefForLabel?.label || docTypeKey : fieldSchema?.field_label || key.replace("reqDoc_", "");

        const uploadUrl = "/api/image";
        const fileFormData = new FormData();
        fileFormData.append("file", file);
        try {
          const { data: uploadResult } = await axiosInstance.post(uploadUrl, fileFormData, { headers: { "Content-Type": "multipart/form-data" } });
          if (!uploadResult || !uploadResult.id) {
            console.error(`Upload for ${key} did not return a valid ID. Response:`, uploadResult);
            throw new Error(`File ID missing after uploading ${docLabel}.`);
          }
          uploadedFileRefs[key] = uploadResult.id;
        } catch (uploadError) {
          console.error(`Failed to upload file for ${key}:`, uploadError);
          throw new Error(`Failed to upload ${docLabel}. ${uploadError.response?.data?.error || uploadError.response?.data?.message || uploadError.message}`);
        }
      });
      await Promise.all(uploadPromises);

      const finalSubmissionFields = loanSchemaData.fields.map((f) => {
        let value = formData[f.field_id] || "";
        if (f.type === "date" && value) {
          value = formatDateToDDMMYYYY(value);
        }
        return {
          field_id: f.field_id,
          field_label: f.field_label,
          type: f.type,
          value: f.type !== "image" && f.type !== "document" ? value : null,
          fileRef: f.type === "image" || f.type === "document" ? uploadedFileRefs[f.field_id] || null : undefined,
        };
      });

      const finalRequiredDocsRefs = [];
      Object.keys(uploadedFileRefs).forEach(key => {
        if (key.startsWith('reqDoc_')) {
            const docTypeKey = key.substring(7);
            finalRequiredDocsRefs.push({
                documentTypeKey: docTypeKey,
                fileRef: uploadedFileRefs[key],
            });
        }
      });

      const aadhaarDataForPayload = {};
      const panDataForPayload = {};

      loanSchemaData.fields.forEach((field) => {
        if (field.auto_fill_sources && field.auto_fill_sources.length > 0) {
          field.auto_fill_sources.forEach((sourceString) => {
            const docTypeKey = sourceString.split(".")[0];
            const sourceFieldKey = getFieldKeyFromSource(sourceString);
            let currentFormFieldValue = formData[field.field_id];

            if (field.type === "date" && currentFormFieldValue) {
              currentFormFieldValue = formatDateToDDMMYYYY(currentFormFieldValue);
            }

            if (docTypeKey === "aadhaar_card" && sourceFieldKey) {
              aadhaarDataForPayload[sourceFieldKey] = currentFormFieldValue;
            } else if (docTypeKey === "pan_card" && sourceFieldKey) {
              panDataForPayload[sourceFieldKey] = currentFormFieldValue;
            }
          });
        }
      });

      const submissionPayload = {
        amount: Number(formData.amount),
        fields: finalSubmissionFields,
        requiredDocumentRefs: finalRequiredDocsRefs,
        isFaceVerified: isFaceVerificationComplete,
        isOtpVerified: isOtpVerified,
        annexureDocumentRef: uploadedFileRefs["annexure_document"] || null,
      };
      if (Object.keys(aadhaarDataForPayload).length > 0) {
        submissionPayload.aadhaar_data = aadhaarDataForPayload;
      }
      if (Object.keys(panDataForPayload).length > 0) {
        submissionPayload.pan_data = panDataForPayload;
      }

      const { data: submissionResult } = await axiosInstance.post(`/api/application/${loanId}/submissions`, submissionPayload);
      const newId = submissionResult._id || submissionResult.id;
      setSubmissionId(newId);
      setSubmissionStatus("submitted");
    } catch (err) {
      console.error("Submission failed:", err.response.data);
      setApiError(err.response?.data?.message || "Submission failed. Please try again.");
      setSubmissionStatus("filling");
      window.scrollTo(0, 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRequiredDocumentItem = (docTypeKey, isRequired) => {
    let docDefinition;
    let docDisplayLabel;
    let docDescription;

    if (docTypeKey === "aadhaar_card") {
      docDefinition = loanSchemaData?.aadhaar_card_definition;
      docDisplayLabel = docDefinition?.label || "Aadhaar Card";
      docDescription = docDefinition?.description || "Upload your Aadhaar Card (front and back if applicable, as a single file or ensure all details are clear).";
    } else if (docTypeKey === "pan_card") {
      docDefinition = loanSchemaData?.pan_card_definition;
      docDisplayLabel = docDefinition?.label || "PAN Card";
      docDescription = docDefinition?.description || "Upload your PAN Card.";
    } else {
      const reqDocEntry = loanSchemaData.required_documents.find((d) => d.schema_id === docTypeKey);
      docDefinition = loanSchemaData.document_definitions?.[docTypeKey];
      docDisplayLabel = docDefinition?.label || reqDocEntry?.name || docTypeKey;
      docDescription = reqDocEntry?.description || docDefinition?.description;
    }

    if (!docDefinition) {
        return null; 
    }

    const inputIdAndRefKeyPart = `reqDoc_${docTypeKey}`;
    const docStatusInfo = docValidationStatus[docTypeKey];
    const hasExisting = !!existingFileRefs[inputIdAndRefKeyPart];
    const hasNew = !!requiredDocFiles[docTypeKey];
    const fileInputError = formErrors[inputIdAndRefKeyPart];

    let showItemError = false;
    if (showValidationErrors) {
      if (fileInputError) {
        showItemError = true;
      } else if (docStatusInfo?.status === "error" || docStatusInfo?.status === 'extraction_incomplete') {
        const allMismatchesAnnexureEligible = docStatusInfo.mismatches?.every((mm) => ANNEXURE_ELIGIBLE_FIELD_LABELS.includes(mm.fieldLabel));
        if (!allMismatchesAnnexureEligible) {
          showItemError = true;
        } else if (allMismatchesAnnexureEligible && !(annexureFile || existingAnnexureFileRef)) {
          showItemError = true;
        }
      } else if (docStatusInfo?.status && docStatusInfo.status !== "verified" && (hasExisting || hasNew)) {
        showItemError = true;
      }
    }

    const isTypeMismatch = docStatusInfo?.status === "error" && docStatusInfo.mismatches?.[0]?.fieldLabel === "Document Type Mismatch";

    return (
      <ListGroup.Item
        key={docTypeKey}
        className={`required-doc-item p-3 border rounded mb-3 ${showItemError ? "doc-item-invalid" : ""} ${isTypeMismatch ? "doc-item-typemismatch" : ""}`}
      >
        <Row className="align-items-center g-2">
          <Col md={4} className="doc-info">
            <strong className="d-block">{docDisplayLabel} {isRequired && '*'}</strong>
            {docDescription && (<small className="text-muted d-block">{docDescription}</small>)}
          </Col>
          <Col md={hasNew || hasExisting ? 4 : 5} className="doc-input">
            <Form.Control
              type="file"
              id={inputIdAndRefKeyPart}
              onChange={(e) => handleRequiredDocFileChangeCallback(docTypeKey, e.target.files ? e.target.files[0] : null)}
              disabled={isSubmitting || isSavingDraft || isExtracting}
              isInvalid={showValidationErrors && !!fileInputError && !hasNew && !hasExisting && !docStatusInfo}
              size="sm"
              className="document-file-input"
            />
            {hasExisting && !hasNew && (
              <small className="text-success d-block mt-1">
                <FaCheckCircle size={12} className="me-1" />
                Current file:{" "}
                {decodeURIComponent(new URL(existingFileRefs[inputIdAndRefKeyPart]).pathname.split("/").pop() || existingFileRefs[inputIdAndRefKeyPart]).substring(0, 20)}
                ...
              </small>
            )}
            {hasNew && (
              <small className="text-info d-block mt-1">
                <FaFileUpload size={12} className="me-1" />
                New: {requiredDocFiles[docTypeKey]?.name}
              </small>
            )}
            {showValidationErrors && fileInputError && !hasNew && !hasExisting && !docStatusInfo && (
              <Form.Text className="text-danger d-block mt-1">{fileInputError}</Form.Text>
            )}
          </Col>
          <Col md={3} className="doc-status text-md-end">
            {" "}
            {getDocStatusBadge(docTypeKey)}{" "}
          </Col>
          <Col md={hasNew || hasExisting ? 1 : "auto"} className="doc-actions text-end">
            {(hasNew || hasExisting) && !(docStatusInfo?.status === "validating") && (
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => {
                  const inputElement = document.getElementById(inputIdAndRefKeyPart);
                  if (inputElement) inputElement.value = "";
                  handleRequiredDocFileChangeCallback(docTypeKey, null);
                }}
                title={`Remove ${docDisplayLabel}`}
                className="p-1"
                disabled={isExtracting}
              >
                <FaTrash size={12} />
              </Button>
            )}
          </Col>
        </Row>
        
        {docStatusInfo?.status === 'extraction_incomplete' && (
            <Alert variant="danger" className="mismatches mt-2 p-2 small">
                <strong className="d-block mb-1">
                    <FaExclamationTriangle size={14} className="me-1" /> Could Not Read Document
                </strong>
                We could not read the following essential information from your uploaded {docDisplayLabel}. 
                This is likely due to poor image quality or an incorrect document.
                <strong className="d-block mt-2">Please upload a clearer, higher-quality picture.</strong>
                <hr className="my-1"/>
                Missing essential fields:
                <ul className="mb-0 mt-1">
                    {docStatusInfo.missingFields.map((fieldLabel, idx) => (
                        <li key={idx}><strong>{fieldLabel}</strong></li>
                    ))}
                </ul>
            </Alert>
        )}

        {(docStatusInfo?.status === "error" || isTypeMismatch) && docStatusInfo.mismatches && (
            <Alert
              variant={isTypeMismatch ? "danger" : "warning"}
              className="mismatches mt-2 p-2 small"
            >
              {isTypeMismatch ? (
                <>
                  {" "}
                  <strong className="d-block mb-1">
                    <FileWarning size={14} className="me-1" /> Incorrect Document Type:
                  </strong>
                  Expected{" "}
                  <strong>
                    {(docTypeKey === "aadhaar_card"
                      ? loanSchemaData?.aadhaar_card_definition?.label
                      : docTypeKey === "pan_card"
                      ? loanSchemaData?.pan_card_definition?.label
                      : loanSchemaData.document_definitions?.[docStatusInfo.mismatches[0]?.expected]?.label) || docStatusInfo.mismatches[0]?.expected}
                  </strong>
                  , but uploaded document appears to be{" "}
                  <strong>
                    {(docStatusInfo.mismatches[0]?.actual === "aadhaar_card"
                      ? loanSchemaData?.aadhaar_card_definition?.label
                      : docStatusInfo.mismatches[0]?.actual === "pan_card"
                      ? loanSchemaData?.pan_card_definition?.label
                      : loanSchemaData.document_definitions?.[docStatusInfo.mismatches[0]?.actual]?.label) || docStatusInfo.mismatches[0]?.actual || "Unknown"}
                  </strong>
                  . Please upload the correct document.{" "}
                </>
              ) : (
                <>
                  {" "}
                  <strong className="d-block mb-1">
                    <FaExclamationTriangle size={14} className="me-1" /> Data Discrepancy:
                  </strong>
                  {docStatusInfo.mismatches.map((mm, idx) => (
                    <div key={idx} className="mismatch-item">
                      - <strong>{mm.fieldLabel}:</strong>{" "}
                      {mm.note === "manual value conflict" ? "Your entered value" : "Expected"}{" "}
                      "<code>{mm.expected || "(empty)"}</code>", found "
                      <code>{mm.actual}</code>" in document.
                      {mm.note === "manual value conflict"
                        ? " Please ensure consistency or clear your entry to auto-fill."
                        : mm.conflictingDoc
                        ? ` Conflicts with data from ${mm.conflictingDoc}.`
                        : ""}
                    </div>
                  ))}{" "}
                </>
              )}
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

    if (statusInfo?.status === 'extraction_incomplete') {
      return (
          <Badge bg="danger-subtle" text="danger-emphasis" className="status-badge error">
              <AlertCircle size={14} className="me-1" /> Incomplete Data
          </Badge>
      );
    }
    
    if (statusInfo?.status === "validating")
      return (
        <Badge bg="light" text="dark" className="status-badge validating">
          <Spinner animation="border" size="sm" className="me-1" /> Validating...
        </Badge>
      );
    if (statusInfo?.status === "verified")
      return (
        <Badge bg="success-subtle" text="success-emphasis" className="status-badge verified">
          <Check size={14} className="me-1" /> Verified
        </Badge>
      );
    if (statusInfo?.status === "error" && statusInfo.mismatches?.[0]?.fieldLabel === "Document Type Mismatch")
      return (
        <Badge bg="danger-subtle" text="danger-emphasis" className="status-badge error">
          <FileWarning size={14} className="me-1" /> Wrong Doc Type
        </Badge>
      );
    if (statusInfo?.status === "error") {
      const allMismatchesAnnexureEligible = statusInfo.mismatches?.every((mm) => ANNEXURE_ELIGIBLE_FIELD_LABELS.includes(mm.fieldLabel));
      if (allMismatchesAnnexureEligible) {
        return (
          <Badge bg="warning-subtle" text="warning-emphasis" className="status-badge error">
            <AlertCircle size={14} className="me-1" /> Name/Address Mismatch
          </Badge>
        );
      }
      return (
        <Badge bg="danger-subtle" text="danger-emphasis" className="status-badge error">
          <AlertCircle size={14} className="me-1" /> Data Error
        </Badge>
      );
    }
    if (hasNew)
      return (
        <Badge bg="info-subtle" text="info-emphasis" className="status-badge">
          New File
        </Badge>
      );
    if (hasExisting)
      return (
        <Badge bg="secondary-subtle" text="secondary-emphasis" className="status-badge">
          Uploaded
        </Badge>
      );
    if (docError)
      return (
        <Badge bg="danger-subtle" text="danger-emphasis" className="status-badge error">
          Missing
        </Badge>
      );
    return (
      <Badge bg="light" text="dark" className="status-badge">
        Pending Upload
      </Badge>
    );
  };

  if (loading) {
    return <LiquidLoader/>
  }
  if (!loanSchemaData && !loading) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          {apiError || "Could not load loan details."}
        </Alert>
      </Container>
    );
  }
  if (submissionStatus === "submitted") {
    return (
      <Container className="mt-5 text-center">
        <Alert variant="success" className="shadow-sm">
          <h3>
            <FaCheckCircle className="me-2" />
            Application Submitted!
          </h3>
          <p>
            Your application for "{loanSchemaData?.title}" has been received.
          </p>
          <p>
            Submission ID: <strong>{submissionId}</strong>
          </p>
          <hr />
          <Button variant="primary" size="sm" onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
        </Alert>
      </Container>
    );
  }

  const allDocumentKeys = new Set([
      'aadhaar_card',
      'pan_card',
      ...(loanSchemaData.required_documents || []).map(d => d.schema_id)
  ]);
  
  (loanSchemaData.fields || []).forEach(field => {
      (field.auto_fill_sources || []).forEach(source => {
          const docKey = source.split('.')[0];
          if(docKey) allDocumentKeys.add(docKey);
      });
  });
  
  const allDocsToRender = Array.from(allDocumentKeys);
  const requiredDocKeys = new Set(['aadhaar_card', 'pan_card', ...(loanSchemaData.required_documents || []).map(d => d.schema_id)]);


  return (
    <Container fluid className="my-4 application-form-container p-md-4">
      {showOtpModal && otpVerificationMobileNumber && (
        <OtpVerificationModal
          show={showOtpModal}
          handleClose={handleOtpModalClose}
          mobileNumber={otpVerificationMobileNumber}
          loanTitle={loanSchemaData?.title}
          onSubmitOtp={handleOtpVerificationSubmit}
          loanId={loanId}
        />
      )}

      <Card className="shadow-sm mb-4 loan-info-card">
        <Card.Header as="h5" className="bg-primary text-white loan-info-header d-flex align-items-center">
          <FaInfoCircle className="me-2" /> Loan Overview
        </Card.Header>
        <Card.Body className="p-4">
          <Card.Title as="h2" className="mb-2 loan-title">
            {loanSchemaData.title}
          </Card.Title>
          {loanSchemaData.description && (
            <Card.Subtitle
              className="mb-3 text-muted loan-description"
              dangerouslySetInnerHTML={{ __html: loanSchemaData.description }}
            />
          )}
          <hr />
          <Row className="mb-3 text-center loan-key-metrics">
            <Col md={3} xs={6} className="metric-item mb-3 mb-md-0">
              <FaPercentage className="metric-icon text-success mb-1" size="1.8em" />
              <div className="metric-label">Interest Rate</div>
              <strong className="metric-value fs-5">{loanSchemaData.interest_rate}%</strong>
            </Col>
            <Col md={3} xs={6} className="metric-item mb-3 mb-md-0">
              <FaCalendarAlt className="metric-icon text-info mb-1" size="1.8em" />
              <div className="metric-label">Max Tenure</div>
              <strong className="metric-value fs-5">{loanSchemaData.tenure_months} months</strong>
            </Col>
            <Col md={3} xs={6} className="metric-item">
              <FaDollarSign className="metric-icon text-warning mb-1" size="1.8em" />
              <div className="metric-label">Processing Fee</div>
              <strong className="metric-value fs-5">₹{loanSchemaData.processing_fee?.toLocaleString("en-IN")}</strong>
            </Col>
            <Col md={3} xs={6} className="metric-item">
              <Landmark className="metric-icon text-primary mb-1" size="1.8em" />
              <div className="metric-label">Collateral</div>
              <strong className="metric-value fs-5">{loanSchemaData.collateral_required ? "Required" : "Not Required"}</strong>
            </Col>
          </Row>

          {loanSchemaData.eligibility && (
            <>
              <hr />
              <h5 className="mt-3 mb-3 eligibility-main-title">Who Can Apply? (Eligibility)</h5>
              <Row className="eligibility-details">
                <Col md={6} lg={4} className="mb-2 eligibility-criterion">
                  <UserCheck size={18} className="me-2 text-muted" />{" "}
                  <strong>Age:</strong> {loanSchemaData.eligibility.min_age}
                  {loanSchemaData.eligibility.max_age ? ` - ${loanSchemaData.eligibility.max_age}` : "+"} years
                </Col>
                {loanSchemaData.eligibility.min_income != null && (
                  <Col md={6} lg={4} className="mb-2 eligibility-criterion">
                    <FaDollarSign className="me-2 text-muted" />{" "}
                    <strong>Min. Income:</strong> ₹{loanSchemaData.eligibility.min_income?.toLocaleString("en-IN")}
                  </Col>
                )}
                {loanSchemaData.eligibility.min_credit_score && (
                  <Col md={6} lg={4} className="mb-2 eligibility-criterion">
                    <BarChart3 size={18} className="me-2 text-muted" />{" "}
                    <strong>Min. Credit Score:</strong> {loanSchemaData.eligibility.min_credit_score}
                  </Col>
                )}
              </Row>
            </>
          )}
        </Card.Body>
      </Card>

      <Card className="shadow-sm application-details-card">
        <Card.Header className="bg-light">
          {" "}
          <h4 className="mb-0 card-form-title">Your Application Details</h4>{" "}
        </Card.Header>
        <Card.Body className="p-4">
          {apiError && (
            <Alert variant="danger" className="api-error-alert" onClose={() => setApiError("")} dismissible>
              {apiError}
            </Alert>
          )}
          {autoFillError && (
            <Alert variant="warning" className="autofill-error-alert" onClose={() => setAutoFillError("")} dismissible>
              <strong>Data Notice:</strong> {autoFillError}
            </Alert>
          )}

          {showOtpModal && otpVerificationError && (
            <Alert variant="danger" className="mt-0 mb-3 p-2 text-center small" id="otp-error-anchor">
              <MessageSquareText size={16} className="me-1 align-middle" />
              <strong>OTP Error:</strong> {otpVerificationError}
            </Alert>
          )}
          {showValidationErrors && formErrors.otp_verification && !showOtpModal && (
            <Alert variant="danger" className="mt-0 mb-3 p-2 text-center small" id="otp-error-anchor">
              <MessageSquareText size={16} className="me-1 align-middle" />
              {formErrors.otp_verification}
            </Alert>
          )}

          <Form ref={formRef} onSubmit={handleSubmit} noValidate className={showValidationErrors ? "was-validated" : ""}>
            <Form.Group as={Row} className="mb-4 align-items-center" controlId="amount">
              <Form.Label column sm={3} className="fw-bold form-section-label">Loan Amount Requested*</Form.Label>
              <Col sm={9}>
                <InputGroup>
                  <InputGroup.Text>₹</InputGroup.Text>
                  <Form.Control
                    type="number"
                    onWheel={(e) => e.target.blur()}
                    value={formData.amount || ""}
                    onChange={(e) => handleInputChange("amount", e.target.value)}
                    required
                    min={loanSchemaData.min_amount}
                    max={loanSchemaData.max_amount}
                    step="any"
                    disabled={isSubmitting || isSavingDraft || showOtpModal}
                    isInvalid={showValidationErrors && !!formErrors.amount}
                  />
                  <Form.Control.Feedback type="invalid">{formErrors.amount}</Form.Control.Feedback>
                </InputGroup>
                <Form.Text className="text-muted d-block mt-1">
                  {" "}
                  Min: ₹{loanSchemaData.min_amount?.toLocaleString("en-IN")}, Max: ₹{loanSchemaData.max_amount?.toLocaleString("en-IN")}{" "}
                </Form.Text>
              </Col>
            </Form.Group>

            {loanSchemaData.fields?.length > 0 && (
              <>
                <hr className="my-4" />
                <h5 className="mb-3 section-title">Additional Information</h5>
              </>
            )}
            {loanSchemaData.fields?.map((field) => {
              const isPotentiallyAutoFill = field.auto_fill_sources && field.auto_fill_sources.length > 0;
              const isDisabled = 
                  isPotentiallyAutoFill || 
                  isSubmitting || 
                  isSavingDraft || 
                  showOtpModal || 
                  (isExtracting && (field.type === "image" || field.type === "document"));
              
              return (
                  <FieldRenderer
                      key={field.field_id}
                      field={field}
                      value={formData[field.field_id]}
                      onChange={handleInputChange}
                      onFileChange={handleCustomFieldFileChange}
                      error={formErrors[field.field_id]}
                      disabled={isDisabled}
                      existingFileUrl={existingFileRefs[field.field_id]}
                      isAutoFilled={!!autoFilledFields[field.field_id]}
                      autoFilledDetail={autoFilledFields[field.field_id]}
                      isPotentiallyAutoFill={isPotentiallyAutoFill}
                      autoFillSources={field.auto_fill_sources || []}
                      docValidationStatus={docValidationStatus}
                      allDocSchemasForSourceLookup={{
                          documentDefinitions: loanSchemaData.document_definitions || {},
                          aadhaar_card_definition: loanSchemaData.aadhaar_card_definition,
                          pan_card_definition: loanSchemaData.pan_card_definition,
                          required: loanSchemaData.required_documents || [],
                          existingGlobalFileRefs: existingFileRefs,
                      }}
                      requiredDocFiles={requiredDocFiles}
                      showValidationErrors={showValidationErrors}
                  />
              );
            })}

            <hr className="my-4" />
            <h5 className="mb-3 section-title">
              <FaFileMedicalAlt className="me-2 text-danger" /> Documents
            </h5>
            <ListGroup variant="flush" className="mb-4 mandatory-docs-listgroup">
              {allDocsToRender.map(docKey => renderRequiredDocumentItem(docKey, requiredDocKeys.has(docKey)))}
            </ListGroup>

            {showAnnexureUpload && (
              <>
                <hr className="my-4" />
                <h5 className="mb-3 section-title">
                  <FaPaperclip className="me-2 text-warning" /> Annexure for Discrepancies
                </h5>
                <Card className="mb-4 border-warning" id="annexure">
                  <Card.Body>
                    <Alert variant="warning">
                      <FaExclamationTriangle className="me-2" />
                      There are discrepancies in Name and/or Address fields based on the documents provided. Please download the annexure form, fill it correctly, and upload it to proceed.
                      <ul>
                        {annexureEligibleMismatches.map((mismatch, idx) => (
                          <li key={idx}>
                            Discrepancy in <strong>{mismatch.fieldLabel}</strong> from{" "}
                            {mismatch.docTypeKey === "aadhaar_card"
                              ? loanSchemaData?.aadhaar_card_definition?.label || "Aadhaar Card"
                              : mismatch.docTypeKey === "pan_card"
                              ? loanSchemaData?.pan_card_definition?.label || "PAN Card"
                              : loanSchemaData?.document_definitions?.[mismatch.docTypeKey]?.label || mismatch.docTypeKey}.
                          </li>
                        ))}
                      </ul>
                    </Alert>
                    <div className="mb-3">
                      <Button variant="info" size="sm" href={annexurePdf} target="_blank" download={`Annexure_${loanSchemaData.title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`} >
                        <FaDownload className="me-2" /> Download Annexure Form
                      </Button>
                    </div>
                    <Form.Group controlId="annexureFile" className="mb-2">
                      <Form.Label>Upload Signed Annexure (PDF only)*</Form.Label>
                      <Form.Control
                        type="file"
                        accept="application/pdf"
                        onChange={handleAnnexureFileChange}
                        isInvalid={showValidationErrors && !!formErrors.annexure}
                        disabled={showOtpModal || isExtracting}
                        size="sm"
                      />
                      {annexureFile && (
                        <div className="mt-1 text-muted small">Selected: {annexureFile.name}</div>
                      )}
                      {existingAnnexureFileRef && !annexureFile && (
                        <div className="mt-1 text-success small">
                          <FaCheckCircle className="me-1" /> Current Annexure:{" "}
                          {decodeURIComponent(new URL(existingAnnexureFileRef).pathname.split("/").pop() || existingAnnexureFileRef).substring(0, 30)}...
                        </div>
                      )}
                      <Form.Control.Feedback type="invalid">{formErrors.annexure}</Form.Control.Feedback>
                      {annexureFileError && (
                        <div className="text-danger small mt-1">{annexureFileError}</div>
                      )}
                    </Form.Group>
                  </Card.Body>
                </Card>
              </>
            )}
            <div id="face-verification-section-anchor"></div>
            {showFaceVerificationModule && aadhaarPhotoIdForVerification && (
              <>
                <hr className="my-4" />
                <h5 className="mb-3 section-title">
                  <FaShieldAlt className="me-2 text-primary" /> Face Verification
                </h5>
                <Card className="mb-4 face-verification-card shadow-sm" id="face_verification">
                  <Card.Body className="p-3">
                    {isFaceVerificationComplete ? (
                      <Alert variant="success" className="text-center">
                        <FaCheckCircle className="me-2" /> Face Verification Successful.
                      </Alert>
                    ) : (
                      <>
                        <p className="text-muted small mb-2">
                          Please complete live face verification. This step uses the photo from your Aadhaar data as a reference.
                        </p>
                        <FaceVerificationApp
                          referenceImageId={aadhaarPhotoIdForVerification}
                          onVerificationComplete={handleFaceVerificationResult}
                        />
                      </>
                    )}
                  </Card.Body>
                </Card>
              </>
            )}

            <Row>
              <Col className="d-flex justify-content-end pt-3 mt-3 border-top">
                <Button
                  type="button"
                  variant={draftSaveStatus.saved ? "outline-success" : "outline-secondary"}
                  className="me-2 save-draft-button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || isSubmitting || showOtpModal}
                >
                  {isSavingDraft ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" /> Saving...
                    </>
                  ) : draftSaveStatus.saved ? (
                    <>
                      <FaCheckCircle className="me-1" /> Draft Saved
                    </>
                  ) : (
                    <>
                      <FaRegSave className="me-1" /> Save Draft
                    </>
                  )}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="submit-button"
                  disabled={isSubmitting || isSavingDraft || showOtpModal}
                >
                  {isSubmitting ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" className="me-1" /> Submitting...
                    </>
                  ) : (
                    <>
                      <FaCloudUploadAlt className="me-1" /> Submit Application
                    </>
                  )}
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}

// PropTypes for ApplicationForm (optional but good practice)
ApplicationForm.propTypes = {
  // No props are directly passed to ApplicationForm as it uses useParams
};
