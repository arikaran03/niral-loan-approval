// src/components/admin/LoanFormBuilder.js
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Form,
  Button,
  Card,
  Row,
  Col,
  Spinner,
  ListGroup,
  Alert,
  Accordion,
  Modal,
  Badge,
  Toast,
  ToastContainer,
  InputGroup,
} from "react-bootstrap";
import {
  FaInfoCircle,
  FaCalendarAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCloudUploadAlt,
  FaTrash,
  FaPlus,
  FaEdit,
  FaFileMedicalAlt,
  FaRegSave,
  FaUserLock,
  FaIdCard,
  FaDollarSign,
  FaSearch,
  FaTimesCircle,
  FaBell,
} from "react-icons/fa";
import { axiosInstance } from "../../../config";
import "./LoanFormBuilder.css";

// --- Configs & Helpers ---
const AUTOSAVE_INTERVAL = 10000;
const AADHAAR_SCHEMA_ID = "aadhaar_card";
const PAN_SCHEMA_ID = "pan_card";
const MESSAGE_LOG_CAPACITY = 5;

const getFieldKeyFromSource = (sourceString) => {
  if (!sourceString) return null;
  const p = sourceString.split(".");
  return p.length > 1 ? p[p.length - 1] : null;
};

const formatTimeAgo = (date) => {
    if (!date) return "";
    const now = new Date();
    const seconds = Math.round((now.getTime() - new Date(date).getTime()) / 1000);
    const intervals = [ { label: 'year', seconds: 31536000 }, { label: 'month', seconds: 2592000 }, { label: 'week', seconds: 604800 }, { label: 'day', seconds: 86400 }, { label: 'hour', seconds: 3600 }, { label: 'minute', seconds: 60 } ];
    if (seconds < 10) return "just now";
    if (seconds < 60) return `${seconds} seconds ago`;
    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
    }
    return "just now";
};

// --- Advanced Auto-Fill Component ---
const AutoFillSourceSelector = ({ allOptions, selectedOptions, onChange, isInvalid }) => {
    const [searchTerm, setSearchTerm] = useState("");
  
    const handleSelectionChange = (event) => {
        const newSelectedValues = Array.from(event.target.selectedOptions, (option) => option.value);
        onChange(newSelectedValues);
    };

    const filteredOptions = allOptions.filter(opt => {
        const term = searchTerm.toLowerCase();
        return opt.label.toLowerCase().includes(term);
    });

    return (
        <div>
            <Form.Label className="fw-bold">Available Auto-Fill Sources</Form.Label>
            <InputGroup className="mb-2">
                <InputGroup.Text><FaSearch /></InputGroup.Text>
                <Form.Control 
                    type="text"
                    placeholder="Search sources (e.g., 'Aadhaar Name', 'PAN')"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </InputGroup>
            <Form.Select 
                multiple
                value={selectedOptions}
                onChange={handleSelectionChange}
                className={`multi-select ${isInvalid ? 'is-invalid' : ''}`}
                style={{ height: '200px' }}
            >
                {filteredOptions.length === 0 && <option disabled>No sources match your search.</option>}
                {filteredOptions.map(opt => (
                    <option key={`all-${opt.value}`} value={opt.value}>{opt.label}</option>
                ))}
            </Form.Select>
             <Form.Text muted>Select one or more sources. The system will use the first available source from the list. Hold Ctrl/Cmd to select multiple.</Form.Text>
        </div>
    );
};


const LoanFormBuilder = ({
  initialData = null,
  onPublish: onPublishProp,
  onSaveDraft: onSaveDraftProp,
  isSaving: parentIsSaving,
}) => {
  const navigate = useNavigate();

  const getInitialLoanDataState = useCallback(
    () => ({
      title: initialData?.title || "",
      description: initialData?.description || "",
      min_amount: initialData?.min_amount ?? "",
      max_amount: initialData?.max_amount ?? "",
      interest_rate: initialData?.interest_rate ?? "",
      tenure_months: initialData?.tenure_months ?? "",
      processing_fee: initialData?.processing_fee ?? 0,
      collateral_required: initialData?.collateral_required || false,
      fields: Array.isArray(initialData?.fields)
        ? initialData.fields.map((f) => ({
            ...f,
            options: typeof f.options === "string" ? f.options.split(",").map((opt) => opt.trim()).filter(Boolean) : f.options || [],
            auto_fill_sources: Array.isArray(f.auto_fill_sources) ? f.auto_fill_sources : [],
          }))
        : [],
      eligibility: {
        min_age: initialData?.eligibility?.min_age ?? 18,
        max_age: initialData?.eligibility?.max_age ?? "",
        min_income: initialData?.eligibility?.min_income ?? "",
        min_credit_score: initialData?.eligibility?.min_credit_score ?? "",
      },
      required_documents: Array.isArray(initialData?.required_documents)
        ? initialData.required_documents.filter(doc => doc.name?.toLowerCase() !== "aadhaar card" && doc.name?.toLowerCase() !== "pan card").map((d) => ({ ...d }))
        : [],
      application_start: initialData?.application_start ? new Date(initialData.application_start).toISOString().split("T")[0] : "",
      application_end: initialData?.application_end ? new Date(initialData.application_end).toISOString().split("T")[0] : "",
      disbursement_date: initialData?.disbursement_date ? new Date(initialData.disbursement_date).toISOString().split("T")[0] : "",
    }),
    [initialData]
  );

  const [loanData, setLoanData] = useState(getInitialLoanDataState());
  const [errors, setErrors] = useState({});
  const [internalIsSaving, setInternalIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(initialData?.updated_at ? new Date(initialData.updated_at) : null);
  const [timeSinceLastSave, setTimeSinceLastSave] = useState("");
  const autoSaveTimerRef = useRef(null);
  const initialDataRef = useRef(JSON.stringify(getInitialLoanDataState()));
  const formRef = useRef(null);

  const [aadhaarSchemaDef, setAadhaarSchemaDef] = useState(null);
  const [panSchemaDef, setPanSchemaDef] = useState(null);
  const [otherDocTypesForSelection, setOtherDocTypesForSelection] = useState([]);
  const [allAutoFillSourceOptions, setAllAutoFillSourceOptions] = useState([]);
  const [docDefLoading, setDocDefLoading] = useState(true);
  const [docDefError, setDocDefError] = useState("");
  const [selectedOtherDocumentType, setSelectedOtherDocumentType] = useState("");

  const [messageLog, setMessageLog] = useState([]);
  const [autoSaveFailed, setAutoSaveFailed] = useState(false);
  
  const addMessage = (text, type = 'info') => {
    const newMessage = {
        id: Date.now(),
        text,
        type,
        time: new Date()
    };
    setMessageLog(prevLog => [newMessage, ...prevLog.slice(0, MESSAGE_LOG_CAPACITY - 1)]);
  };

  useEffect(() => { setInternalIsSaving(parentIsSaving || false); }, [parentIsSaving]);

  useEffect(() => {
    const fetchGovDocDefinitions = async () => {
      setDocDefLoading(true);
      setDocDefError("");
      try {
        const response = await axiosInstance.get("/api/document/schema-definitions");
        const definitions = response.data || [];
        const aadhaarDef = definitions.find(def => def.schema_id === AADHAAR_SCHEMA_ID);
        const panDef = definitions.find(def => def.schema_id === PAN_SCHEMA_ID);
        setAadhaarSchemaDef(aadhaarDef); setPanSchemaDef(panDef);
        if (!aadhaarDef) console.warn(`Aadhaar schema (ID: ${AADHAAR_SCHEMA_ID}) not found.`);
        if (!panDef) console.warn(`PAN schema (ID: ${PAN_SCHEMA_ID}) not found.`);
        const otherDocs = definitions.filter(def => def.schema_id !== AADHAAR_SCHEMA_ID && def.schema_id !== PAN_SCHEMA_ID);
        setOtherDocTypesForSelection(otherDocs);
        if (otherDocs.length > 0 && !selectedOtherDocumentType) setSelectedOtherDocumentType(otherDocs[0].schema_id);
        
        const autoFillOpts = [];
        await Promise.all(definitions.map(async (def) => {
          try {
            const fieldsOfEachDoc = await axiosInstance.get(`/api/document/schema-definition/by-schema-id/${def.schema_id}`);
            (fieldsOfEachDoc.data.fields || []).forEach((field) => {
              autoFillOpts.push({ value: `${def.schema_id}.${field.key}`, label: `${def.name} - ${field.label}`, key: field.key });
            });
          } catch (docFieldsError) { console.warn(`Could not fetch fields for doc schema ${def.schema_id}:`, docFieldsError); }
        }));
        setAllAutoFillSourceOptions(autoFillOpts);
      } catch (err) {
        console.error("Failed to fetch gov doc definitions:", err);
        const errorMsg = "Could not load required document definitions from the server.";
        addMessage(errorMsg, "error");
        setDocDefError(errorMsg);
      } finally { setDocDefLoading(false); }
    };
    fetchGovDocDefinitions();
  }, []);

  useEffect(() => {
    const newState = getInitialLoanDataState();
    setLoanData(newState);
    const newStateString = JSON.stringify(newState);
    if (newStateString !== initialDataRef.current) {
      initialDataRef.current = newStateString;
      setIsDirty(false);
      setLastSaveTime(initialData?.updated_at ? new Date(initialData.updated_at) : null);
    }
    setErrors({});
  }, [initialData, getInitialLoanDataState]);

  useEffect(() => {
    let intervalId = null;
    const updateRelativeTime = () => {
      if (lastSaveTime) {
        setTimeSinceLastSave(formatTimeAgo(lastSaveTime));
      } else {
        setTimeSinceLastSave("");
      }
    };

    updateRelativeTime();
    const secondsAgo = lastSaveTime ? (Date.now() - lastSaveTime.getTime()) / 1000 : 0;
    let updateFrequency = 1000 * 60;
    if (secondsAgo < 60) {
      updateFrequency = 1000;
    } else if (secondsAgo < 3600) {
      updateFrequency = 1000 * 30;
    }
    
    intervalId = setInterval(updateRelativeTime, updateFrequency);
    
    return () => clearInterval(intervalId);
  }, [lastSaveTime]);

  const handleAutoSave = useCallback(async () => {
    const currentStateString = JSON.stringify(loanData);
    if (currentStateString === initialDataRef.current || internalIsSaving || !loanData.title?.trim()) return;

    setInternalIsSaving(true);
    try {
      await onSaveDraftProp({ ...loanData }, initialData?._id);
      setLastSaveTime(new Date()); setIsDirty(false);
      initialDataRef.current = JSON.stringify(loanData);
      addMessage('Draft auto-saved.', 'info');
      setAutoSaveFailed(false);
    } catch (error) { 
        console.error("Auto-save failed for loan:", error); 
        addMessage('Auto-save failed. Pausing until next change.', 'error');
        setAutoSaveFailed(true);
    }
    finally { setInternalIsSaving(false); }
  }, [loanData, internalIsSaving, onSaveDraftProp, initialData?._id]);

  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const isActuallyDirty = JSON.stringify(loanData) !== initialDataRef.current;
    setIsDirty(isActuallyDirty);
    if (isActuallyDirty && !internalIsSaving && !autoSaveFailed) {
      autoSaveTimerRef.current = setTimeout(handleAutoSave, AUTOSAVE_INTERVAL);
    }
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [loanData, internalIsSaving, handleAutoSave, autoSaveFailed]);

  const updateLoanDataState = (updater) => { setLoanData(updater); };

  const validate = (isPublishingValidation = false) => {
    const newErrors = {}; const data = loanData;
    if (!data.title?.trim()) newErrors.title = "Title is required.";
    if (isPublishingValidation && !data.description?.trim()) newErrors.description = "Description is required for publishing.";

    if ((isPublishingValidation || data.min_amount !== "") && (isNaN(data.min_amount) || parseFloat(data.min_amount) < 0)) newErrors.min_amount = "Minimum amount must be a non-negative number.";
    if ((isPublishingValidation || data.max_amount !== "") && (isNaN(data.max_amount) || parseFloat(data.max_amount) < 0)) newErrors.max_amount = "Maximum amount must be a non-negative number.";
    if (data.min_amount !== "" && data.max_amount !== "" && !isNaN(data.min_amount) && !isNaN(data.max_amount) && parseFloat(data.min_amount) > parseFloat(data.max_amount)) newErrors.max_amount = "Maximum amount cannot be less than minimum amount.";
    if ((isPublishingValidation || data.interest_rate !== "") && (isNaN(data.interest_rate) || parseFloat(data.interest_rate) < 0)) newErrors.interest_rate = "Interest rate must be a non-negative number.";
    if ((isPublishingValidation || data.tenure_months !== "") && (isNaN(data.tenure_months) || parseInt(data.tenure_months, 10) < 1)) newErrors.tenure_months = "Tenure must be at least 1 month.";
    if (data.processing_fee !== "" && data.processing_fee !== null && (isNaN(data.processing_fee) || parseFloat(data.processing_fee) < 0)) newErrors.processing_fee = "Processing fee must be a non-negative number.";
    
    const el = data.eligibility;
    if ((isPublishingValidation || el.min_age !== "") && (isNaN(el.min_age) || parseInt(el.min_age, 10) < 18)) newErrors["eligibility.min_age"] = "Minimum age must be at least 18.";
    if (el.max_age !== "" && el.max_age !== null && (isNaN(el.max_age) || parseInt(el.max_age, 10) <= parseInt(el.min_age || 18, 10))) newErrors["eligibility.max_age"] = "Maximum age must be greater than minimum age.";
    if ((isPublishingValidation || el.min_income !== "") && (isNaN(el.min_income) || parseFloat(el.min_income) < 0)) newErrors["eligibility.min_income"] = "Minimum income must be a non-negative number.";
    if (isPublishingValidation && (el.min_credit_score === "" || el.min_credit_score === null)) {
      newErrors["eligibility.min_credit_score"] = "Minimum credit score is required for publishing.";
    } else if (el.min_credit_score !== "" && el.min_credit_score !== null && (isNaN(el.min_credit_score) || parseInt(el.min_credit_score, 10) < 300 || parseInt(el.min_credit_score, 10) > 900)) {
      newErrors["eligibility.min_credit_score"] = "Credit score must be between 300 and 900.";
    }
    
    if (isPublishingValidation && !data.application_start) newErrors.application_start = "Application start date is required.";
    if (isPublishingValidation && !data.application_end) newErrors.application_end = "Application end date is required.";
    if (data.application_start && data.application_end && new Date(data.application_start) >= new Date(data.application_end)) newErrors.application_end = "End date must be after the start date.";
    if (data.disbursement_date && data.application_end && new Date(data.disbursement_date) < new Date(data.application_end)) newErrors.disbursement_date = "Disbursement date cannot be before the application end date.";
    
    const fieldIds = new Set();
    data.fields.forEach((field, index) => {
      const prefix = `fields[${index}]`; let currentFieldId = field.field_id;
      if (!currentFieldId?.trim()) newErrors[`${prefix}.field_id`] = "Field ID is required.";
      if (currentFieldId && /[^a-z0-9_]/.test(currentFieldId)) newErrors[`${prefix}.field_id`] = "ID must be lowercase letters, numbers, or underscores only.";
      if (currentFieldId && fieldIds.has(currentFieldId.trim())) newErrors[`${prefix}.field_id`] = `ID "${currentFieldId}" is already used. IDs must be unique.`; else if (currentFieldId) fieldIds.add(currentFieldId.trim());
      if (!field.field_label?.trim()) newErrors[`${prefix}.field_label`] = "Field Label is required."; if (!field.type) newErrors[`${prefix}.type`] = "Field Type is required.";
      if ((field.type === 'select' || field.type === 'multiselect') && (!field.options || field.options.length === 0)) newErrors[`${prefix}.options`] = "At least one option is required for select/multiselect types.";
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (event) => {
    if (autoSaveFailed) { setAutoSaveFailed(false); }
    const { name, value, type, checked } = event.target;
    const val = type === "checkbox" ? checked : value;
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    
    updateLoanDataState((prev) => {
      if (name.startsWith("eligibility.")) {
        const field = name.split(".")[1];
        if (errors[`eligibility.${field}`]) setErrors(e => ({...e, [`eligibility.${field}`]: null}));
        return { ...prev, eligibility: { ...prev.eligibility, [field]: val } };
      } else {
        return { ...prev, [name]: val };
      }
    });
  };

  const handleCustomFieldChange = (index, fieldName, fieldValue) => {
    if (autoSaveFailed) { setAutoSaveFailed(false); }
    
    const errorKey = `fields[${index}].${fieldName}`;
    if (errors[errorKey]) setErrors(prev => ({ ...prev, [errorKey]: null }));
    
    updateLoanDataState(prev => {
        const updatedFields = [...prev.fields];
        const fieldToUpdate = { ...updatedFields[index] };
        fieldToUpdate[fieldName] = fieldValue;
        updatedFields[index] = fieldToUpdate;
        return { ...prev, fields: updatedFields };
    });
  };

  const handleAddOtherDocumentRequirement = () => {
    if (!selectedOtherDocumentType) return; const selectedDocDef = otherDocTypesForSelection.find(def => def.schema_id === selectedOtherDocumentType);
    if (!selectedDocDef || loanData.required_documents.some(doc => doc.schema_id === selectedDocDef.schema_id)) {
        addMessage(`Document "${selectedDocDef?.name || selectedOtherDocumentType}" is already in the list.`, 'warning');
        return;
    };
    const fieldsDescription = (selectedDocDef.fields || []).map(f => f.label).join(', '); const description = fieldsDescription ? `Contains fields: ${fieldsDescription}` : (selectedDocDef.description || "Standard document requirement.");
    const newRequirement = { name: selectedDocDef.name, description: description, schema_id: selectedDocDef.schema_id };
    updateLoanDataState(prev => ({ ...prev, required_documents: [...prev.required_documents, newRequirement] }));
    if (errors.required_documents) setErrors(prev => ({ ...prev, required_documents: null }));
  };

  const handleRemoveDocumentRequirement = (indexToRemove) => {
    updateLoanDataState(prev => ({ ...prev, required_documents: prev.required_documents.filter((_, index) => index !== indexToRemove) }));
  };

  const handleAddCustomField = () => {
    updateLoanDataState(prev => ({ ...prev, fields: [...prev.fields, { field_id: '', field_label: '', field_prompt: '', type: 'text', required: false, min_value: '', max_value: '', options: [], auto_fill_sources: [] }] }));
  };

  const handleRemoveCustomField = (indexToRemove) => {
    updateLoanDataState(prev => ({ ...prev, fields: prev.fields.filter((_, index) => index !== indexToRemove) }));
    setErrors(prevErrors => { const newErrors = {...prevErrors}; Object.keys(newErrors).filter(k=>k.startsWith(`fields[${indexToRemove}]`)).forEach(k=>delete newErrors[k]); return newErrors; });
  };

  const handlePublish = async (event) => {
    event.preventDefault(); if (internalIsSaving) return;
    if (validate(true)) {
      setInternalIsSaving(true); if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      try {
        const dataToSubmit = {
          ...loanData,
          min_amount: loanData.min_amount !== "" ? parseFloat(loanData.min_amount) : null,
          max_amount: loanData.max_amount !== "" ? parseFloat(loanData.max_amount) : null,
          interest_rate: loanData.interest_rate !== "" ? parseFloat(loanData.interest_rate) : null,
          tenure_months: loanData.tenure_months !== "" ? parseInt(loanData.tenure_months, 10) : null,
          processing_fee: loanData.processing_fee !== "" && loanData.processing_fee !== null ? parseFloat(loanData.processing_fee) : 0,
          eligibility: { min_age: loanData.eligibility.min_age !== "" ? parseInt(loanData.eligibility.min_age, 10) : null, max_age: loanData.eligibility.max_age !== "" && loanData.eligibility.max_age !== null ? parseInt(loanData.eligibility.max_age, 10) : null, min_income: loanData.eligibility.min_income !== "" ? parseFloat(loanData.eligibility.min_income) : null, min_credit_score: loanData.eligibility.min_credit_score !== "" && loanData.eligibility.min_credit_score !== null ? parseInt(loanData.eligibility.min_credit_score, 10) : null, },
          application_start: loanData.application_start ? new Date(loanData.application_start) : null,
          application_end: loanData.application_end ? new Date(loanData.application_end) : null,
          disbursement_date: loanData.disbursement_date ? new Date(loanData.disbursement_date) : null,
          fields: loanData.fields.map(field => ({ ...field, min_value: field.type === 'number' && field.min_value !== "" ? parseFloat(field.min_value) : field.min_value, max_value: field.type === 'number' && field.max_value !== "" ? parseFloat(field.max_value) : field.max_value })),
        };
        await onPublishProp(dataToSubmit, initialData?._id);
        addMessage("Loan Scheme published successfully! Redirecting...", "success");
        setTimeout(() => navigate('/console/loans'), 3000);
        setLastSaveTime(new Date()); setIsDirty(false); initialDataRef.current = JSON.stringify(loanData);
      } catch (error) { 
        console.error("Failed to publish loan:", error);
        const serverErrors = error.response?.data?.errors;
        if(serverErrors && typeof serverErrors === 'object'){
            setErrors(prev => ({ ...prev, ...serverErrors}));
            addMessage("Publication failed. Please review the errors highlighted below.", "warning");
        } else {
            addMessage(error.message || "An unexpected error occurred during publish.", "error");
        }
      }
      finally { setInternalIsSaving(false); }
    } else {
      addMessage("Please fix the errors marked in red before publishing.", "warning");
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey && formRef.current) {
         const errorNode = formRef.current.querySelector(`[name="${firstErrorKey}"], [id^="field_${firstErrorKey.replace(/[\[\].]/g, '_')}"]`);
         if (errorNode) {
            errorNode.focus({ preventScroll: true });
            errorNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
         }
      }
    }
  };

  const handleManualSaveDraft = async () => {
    if (internalIsSaving) return;
    if (validate(false)) {
      if(errors.title) setErrors(prev => ({ ...prev, title: null }));
      setInternalIsSaving(true); if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      try { 
          await onSaveDraftProp({ ...loanData }, initialData?._id); 
          setLastSaveTime(new Date()); 
          setIsDirty(false); 
          initialDataRef.current = JSON.stringify(loanData);
          addMessage("Draft saved successfully.", "success");
          setAutoSaveFailed(false);
      } catch (error) { 
          console.error("Manual save draft failed:", error); 
          addMessage(error.response?.data?.error || "Failed to save draft.", "error");
      }
      finally { setInternalIsSaving(false); }
    } else {
        addMessage("Please fill all the mandatory fields to save a draft.", "warning");
        if (errors.title) formRef.current?.querySelector('[name="title"]')?.focus();
    }
  };

  const renderInput = (name, label, type = "text", options = {}) => {
    const isEligibility = name.startsWith('eligibility.');
    const fieldName = isEligibility ? name.split('.')[1] : name;
    const value = isEligibility ? loanData.eligibility[fieldName] : loanData[name];
    const fieldId = name.replace(/\./g, "_");
    const isInvalid = !!errors[name];
    return (<Form.Group as={Col} md={options.md || 6} className="mb-3" key={fieldId} controlId={fieldId}> <Form.Label>{label}{options.required ? " *" : ""}</Form.Label> <Form.Control type={type} name={name} value={value ?? ''} onWheel={(e) => e.target.blur()} onChange={handleInputChange} checked={type === "checkbox" ? !!value : undefined} required={options.required} min={options.min} max={options.max} step={options.step} placeholder={options.placeholder} isInvalid={isInvalid} disabled={internalIsSaving}/> <Form.Control.Feedback type="invalid">{errors[name]}</Form.Control.Feedback> </Form.Group>);
  };
  const renderTextArea = (name, label, options = {}) => {
    const value = loanData[name] ?? ""; const fieldId = name.includes(".") ? name.replace(/\./g, "_") : `field_${name}`; const isInvalid = !!errors[name];
    return (<Form.Group as={Col} md={options.md || 12} className="mb-3" key={fieldId} controlId={fieldId}> <Form.Label>{label}{options.required ? " *" : ""}</Form.Label> <Form.Control as="textarea" name={name} value={value} onChange={handleInputChange} rows={options.rows} placeholder={options.placeholder} required={options.required} isInvalid={isInvalid} disabled={internalIsSaving}/> <Form.Control.Feedback type="invalid">{errors[name]}</Form.Control.Feedback> </Form.Group>);
  };
  const renderEligibilityInput = (name, label, type = "number", options = {}) => {
    const fieldName = `eligibility.${name}`; return renderInput(fieldName, label, type, { ...options, md: options.md || 6 });
  };
  const renderCustomFieldInput = (index, fieldName, label, type = "text", options = {}) => {
    const fullFieldName = `fields[${index}].${fieldName}`; const controlId = `fields_${index}_${fieldName}`; const fieldData = loanData.fields[index]; const value = fieldData?.[fieldName] ?? ""; const isInvalid = !!errors[fullFieldName];
    if (type === "checkbox") { return (<Col md={options.md || 6} className="mb-3"><Form.Group className="h-100 d-flex align-items-end" key={controlId} controlId={controlId}><div> <Form.Check type="switch" name={fieldName} label={label} checked={!!value} onChange={(e) => handleCustomFieldChange(index, 'required', e.target.checked)} isInvalid={isInvalid} disabled={internalIsSaving}/> {isInvalid && <div className="invalid-feedback d-block" style={{ marginTop: '-0.25rem' }}>{errors[fullFieldName]}</div>} </div></Form.Group></Col>); }
    return (<Form.Group as={Col} md={options.md || 6} className="mb-3" key={controlId} controlId={controlId}> <Form.Label>{label}{options.required ? " *" : ""}</Form.Label> <Form.Control type={type} name={fieldName} value={value} onWheel={(e) => e.target.blur()} onChange={(e) => handleCustomFieldChange(index, fieldName, e.target.value)} required={options.required} min={options.min} max={options.max} step={options.step} placeholder={options.placeholder} isInvalid={isInvalid} disabled={internalIsSaving} /> <Form.Control.Feedback type="invalid">{errors[fullFieldName]}</Form.Control.Feedback> </Form.Group>);
  };
  const renderCustomFieldTextarea = (index, fieldName, label, options = {}) => {
    const fullFieldName = `fields[${index}].${fieldName}`; const controlId = `fields_${index}_${fieldName}`; let value = loanData.fields[index]?.[fieldName]; if (fieldName === 'options' && Array.isArray(value)) value = value.join(', '); value = value ?? ""; const isInvalid = !!errors[fullFieldName];
    return (<Form.Group as={Col} md={options.md || 12} className="mb-3" key={controlId} controlId={controlId}> <Form.Label>{label}{options.required ? " *" : ""}</Form.Label> <Form.Control as="textarea" name={fieldName} value={value} onChange={(e) => handleCustomFieldChange(index, fieldName, e.target.value)} rows={options.rows} placeholder={options.placeholder} required={options.required} isInvalid={isInvalid} disabled={internalIsSaving} /> <Form.Control.Feedback type="invalid">{errors[fullFieldName]}</Form.Control.Feedback> </Form.Group>);
  };
  const renderCustomFieldSelect = (index, fieldName, label, optionsArray = [], fieldOptions = {}) => {
    const fullFieldName = `fields[${index}].${fieldName}`; const controlId = `fields_${index}_${fieldName}`; const value = loanData.fields[index]?.[fieldName] ?? ""; const isInvalid = !!errors[fullFieldName];
    return (<Form.Group as={Col} md={fieldOptions.md || 6} className="mb-3" key={controlId} controlId={controlId}> <Form.Label>{label}{fieldOptions.required ? " *" : ""}</Form.Label> <Form.Select name={fieldName} value={value} onChange={(e) => handleCustomFieldChange(index, fieldName, e.target.value)} required={fieldOptions.required} isInvalid={isInvalid} disabled={internalIsSaving}> <option value="">-- Select --</option> {optionsArray.map(opt => (<option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>))} </Form.Select> <Form.Control.Feedback type="invalid">{errors[fullFieldName]}</Form.Control.Feedback> </Form.Group>);
  };

  const getToastInfo = (type) => {
    switch(type) {
      case 'success': return { bg: 'success', icon: <FaCheckCircle className="me-2"/> };
      case 'error': return { bg: 'danger', icon: <FaTimesCircle className="me-2"/> };
      case 'warning': return { bg: 'warning', icon: <FaExclamationTriangle className="me-2"/> };
      default: return { bg: 'info', icon: <FaBell className="me-2"/> };
    }
  }


  return (
    <div className="loan-form-builder-component">
      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999, position: 'fixed' }}>
        {messageLog.map((msg) => {
          const { bg, icon } = getToastInfo(msg.type);
          return (
            <Toast key={msg.id} bg={bg} autohide delay={6000} onClose={() => setMessageLog(prev => prev.filter(m => m.id !== msg.id))}>
              <Toast.Header closeButton closeVariant={bg === 'warning' || bg === 'info' ? 'dark' : 'white'}>
                  {icon}
                <strong className="me-auto text-capitalize">{msg.type}</strong>
                <small>{new Date(msg.time).toLocaleTimeString()}</small>
              </Toast.Header>
              <Toast.Body className={bg === 'warning' || bg === 'info' ? 'text-dark' : 'text-white'}>
                {msg.text}
              </Toast.Body>
            </Toast>
          );
        })}
      </ToastContainer>

      <Form ref={formRef} onSubmit={handlePublish} className="loan-form-builder-content" noValidate>
        <Card className="mb-4 shadow-sm">
          <Card.Header><FaInfoCircle className="me-2 text-primary" /> Basic Information</Card.Header>
          <Card.Body>
            <Row>
              {renderInput("title", "Loan Title", "text", { required: true, md: 12, placeholder: "e.g., Personal Loan for Salaried Employees" })}
              {renderTextArea("description", "Description (Required for Publishing)", { rows: 5, md: 12, required: true, placeholder: "Describe the loan, its benefits, and target audience..." })}
            </Row>
          </Card.Body>
        </Card>

        <Card className="mb-4 shadow-sm">
          <Card.Header><FaDollarSign className="me-2 text-success" /> Financial Details</Card.Header>
          <Card.Body className="bg-light-subtle">
            <Row>
              {renderInput("min_amount", "Minimum Amount (₹)", "number", { required: true, min: 0, step: 1000 })}
              {renderInput("max_amount", "Maximum Amount (₹)", "number", { required: true, min: 0, step: 1000 })}
              {renderInput("interest_rate", "Interest Rate (%)", "number", { required: true, min: 0, step: 0.01 })}
              {renderInput("tenure_months", "Tenure (Months)", "number", { required: true, min: 1, step: 1 })}
              {renderInput("processing_fee", "Processing Fee (%)", "number", { min: 0, max: 100, step: 0.01, placeholder:"e.g., 1.5 for 1.5%"})}
              <Col md={12} className="mb-3 mt-2">
                <Form.Check type="switch" id="field_collateral_required" name="collateral_required" label="Collateral Required?" checked={!!loanData.collateral_required} onChange={handleInputChange} disabled={internalIsSaving} />
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Card className="mb-4 shadow-sm">
          <Card.Header><FaCheckCircle className="me-2 text-info" /> Eligibility Criteria</Card.Header>
          <Card.Body> <Row> {renderEligibilityInput("min_age", "Minimum Age", "number", { required: true, min: 18 })} {renderEligibilityInput("max_age", "Maximum Age", "number", { min: 19 })} {renderEligibilityInput("min_income", "Minimum Income (₹)", "number", { required: true, min: 0, step: 100 })} {renderEligibilityInput("min_credit_score", "Min Credit Score", "number", { required: true, min: 300, max: 900 })} </Row> </Card.Body>
        </Card>

        <Card className="mb-4 shadow-sm">
          <Card.Header className="bg-warning-subtle"><FaUserLock className="me-2 text-warning" /> Mandatory KYC Documents</Card.Header>
          <Card.Body>
            {docDefLoading && <div className="text-center"><Spinner animation="border" size="sm" /> Loading KYC definitions...</div>}
            {!docDefLoading && docDefError && <Alert variant="danger" size="sm">{docDefError}</Alert>}
            {!docDefLoading && !docDefError && (!aadhaarSchemaDef || !panSchemaDef) && (<Alert variant="warning" size="sm">Aadhaar or PAN card schema definitions are fundamental for applicant KYC and could not be loaded.</Alert>)}
            <Accordion defaultActiveKey={['0','1']} alwaysOpen>
              {aadhaarSchemaDef && (<Accordion.Item eventKey="0"><Accordion.Header><FaIdCard className="me-2" />Aadhaar Card (Mandatory)</Accordion.Header><Accordion.Body><p className="text-muted small">{aadhaarSchemaDef.description}</p><ListGroup variant="flush">{(aadhaarSchemaDef.fields || []).map(field => (<ListGroup.Item key={field.key} className="py-1 px-0 border-0"><strong>{field.label}:</strong> <span className="text-muted fst-italic">({field.prompt})</span></ListGroup.Item>))}</ListGroup></Accordion.Body></Accordion.Item>)}
              {panSchemaDef && (<Accordion.Item eventKey="1"><Accordion.Header><FaIdCard className="me-2" />PAN Card (Mandatory)</Accordion.Header><Accordion.Body><p className="text-muted small">{panSchemaDef.description}</p><ListGroup variant="flush">{(panSchemaDef.fields || []).map(field => (<ListGroup.Item key={field.key} className="py-1 px-0 border-0"><strong>{field.label}:</strong> <span className="text-muted fst-italic">({field.prompt})</span></ListGroup.Item>))}</ListGroup></Accordion.Body></Accordion.Item>)}
            </Accordion>
          </Card.Body>
        </Card>

        <Card className="mb-4 shadow-sm">
          <Card.Header><FaFileMedicalAlt className="me-2 text-danger" /> Other Standard Document Requirements</Card.Header>
          <Card.Body>
            {docDefLoading && <div className="text-center"><Spinner animation="border" size="sm" /> Loading document types...</div>}
            {!docDefLoading && otherDocTypesForSelection.length > 0 && ( <Row className="g-3 align-items-center mb-3 pb-3 border-bottom"> <Col xs={12} sm> <Form.Select size="sm" value={selectedOtherDocumentType} onChange={(e) => setSelectedOtherDocumentType(e.target.value)} disabled={internalIsSaving || docDefLoading} aria-label="Select other document type to add"> <option value="">-- Select Other Document Type --</option> {otherDocTypesForSelection.map(docDef => (<option key={docDef.schema_id} value={docDef.schema_id}>{docDef.name} ({docDef.schema_id})</option>))} </Form.Select> </Col> <Col xs={12} sm="auto"> <Button type="button" variant="secondary" size="sm" onClick={handleAddOtherDocumentRequirement} disabled={internalIsSaving || !selectedOtherDocumentType || docDefLoading} className="w-100">Add Document</Button> </Col> </Row> )}
            {errors.required_documents && <Alert variant="danger" size="sm" className="mt-2">{errors.required_documents}</Alert>}
            <ListGroup variant="flush"> {loanData.required_documents.length === 0 && <ListGroup.Item className="text-muted text-center py-3">No additional standard documents added yet.</ListGroup.Item>} {loanData.required_documents.map((doc, index) => ( <ListGroup.Item key={`req-doc-${index}`} className="d-flex justify-content-between align-items-center ps-1 pe-1"> <div className="flex-grow-1 me-2"> <strong className="d-block">{doc.name}</strong> <small className="text-muted fst-italic">{doc.description || "No description"}</small> </div> <Button variant="outline-danger" size="sm" className="p-1 remove-button-inline flex-shrink-0" onClick={() => handleRemoveDocumentRequirement(index)} aria-label={`Remove ${doc.name}`} disabled={internalIsSaving}> <FaTrash /> </Button> </ListGroup.Item> ))} </ListGroup>
          </Card.Body>
        </Card>

        <Card className="mb-4 shadow-sm">
            <Card.Header><FaEdit className="me-2 text-secondary" /> Custom Application Fields</Card.Header>
            <Card.Body className="bg-light-subtle">
                {docDefLoading && <div className="text-center"><Spinner animation="border" size="sm" /> Loading auto-fill options...</div>}
                {!docDefLoading && loanData.fields.length === 0 && <p className="text-muted text-center py-3 mb-0">No custom fields added yet.</p>}
                {loanData.fields.map((field, index) => ( 
                    <div className="custom-field-item p-3 mb-3 border rounded bg-white position-relative" key={`custom-field-${index}`}> 
                        <div className="custom-field-header d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom"> 
                            <h6 className="text-primary mb-0 fw-bold">Custom Field #{index + 1}</h6> 
                            <Button variant="link" size="sm" className="p-0 text-danger remove-button-inline" onClick={() => handleRemoveCustomField(index)} aria-label={`Remove Custom Field ${index + 1}`} disabled={internalIsSaving} title="Remove Field"> <FaTrash /> </Button> 
                        </div> 
                        <Row> {renderCustomFieldInput(index, "field_id", "Field ID", "text", { required: true, md: 6 })} {renderCustomFieldInput(index, "field_label", "Field Label", "text", { required: true, md: 6 })} </Row> 
                        <Row className="align-items-end"> {renderCustomFieldSelect(index, "type", "Field Type", [ { value: "text", label: "Text" }, { value: "textarea", label: "Text Area" }, { value: "number", label: "Number" }, { value: "date", label: "Date" }, { value: "datetime", label: "Date & Time" }, { value: "time", label: "Time" }, { value: "select", label: "Dropdown (Single)" }, { value: "multiselect", label: "Dropdown (Multi)" }, { value: "checkbox", label: "Checkbox" }, { value: "image", label: "Image Upload" }, { value: "document", label: "Document Upload" } ], { required: true, md: 6 })} {renderCustomFieldInput(index, "required", "Required Field?", "checkbox", { md: 6 })} </Row> 
                        <Row>{renderCustomFieldTextarea(index, "field_prompt", "Field Prompt/Hint", { rows: 2, md: 12 })}</Row> 
                        {(field.type === 'number' || field.type === 'text' || field.type === 'textarea') && ( <Row> {renderCustomFieldInput(index, "min_value", "Min Value / Length", field.type === 'number' ? 'number' : 'text', { md: 6 })} {renderCustomFieldInput(index, "max_value", "Max Value / Length", field.type === 'number' ? 'number' : 'text', { md: 6 })} </Row> )} 
                        {(field.type === 'select' || field.type === 'multiselect') && ( <Row>{renderCustomFieldTextarea(index, "options", "Options (Comma-separated)", { required: true, placeholder: "e.g., Option 1, Option 2", md: 12 })}</Row> )} 
                        {field.type !== 'image' && field.type !== 'document' && !docDefLoading && ( 
                            <Row className="mt-3">
                                <Col>
                                    <AutoFillSourceSelector 
                                        allOptions={allAutoFillSourceOptions}
                                        selectedOptions={field.auto_fill_sources}
                                        isInvalid={!!errors[`fields[${index}].auto_fill_sources`]}
                                        onChange={(newSelection) => handleCustomFieldChange(index, 'auto_fill_sources', newSelection)}
                                    />
                                    {errors[`fields[${index}].auto_fill_sources`] && <div className="invalid-feedback d-block">{errors[`fields[${index}].auto_fill_sources`]}</div>}
                                </Col>
                            </Row>
                        )} 
                    </div> 
                ))}
                <div className="mt-2 text-end"> <Button type="button" variant="outline-primary" size="sm" onClick={handleAddCustomField} disabled={internalIsSaving}><FaPlus className="me-1" /> Add Custom Field </Button> </div>
            </Card.Body>
        </Card>

        <Card className="mb-4 shadow-sm">
          <Card.Header><FaCalendarAlt className="me-2 text-warning" /> Application Window & Dates</Card.Header>
          <Card.Body className="bg-light-subtle">
            <Row>
              {renderInput("application_start", "Application Start Date", "date", { required: true, max: loanData.application_end || null })}
              {renderInput("application_end", "Application End Date", "date", { required: true, min: loanData.application_start || null })}
              {renderInput("disbursement_date", "Disbursement Date (Optional)", "date", { min: loanData.application_end || null })}
            </Row>
          </Card.Body>
        </Card>

        <div className="form-status-bar sticky-bottom bg-dark text-light p-2 shadow-lg">
          <Row className="align-items-center"> <Col md={6} className="text-center text-md-start mb-2 mb-md-0"> <div className={`status-indicator status-${internalIsSaving ? "saving" : isDirty ? "unsaved" : lastSaveTime ? "saved" : "neutral"}`}> {internalIsSaving ? (<><Spinner animation="border" size="sm" className="me-2" />Saving...</>) : isDirty ? (<><FaExclamationTriangle className="me-1" /> Unsaved changes</>) : lastSaveTime ? (<><FaCheckCircle className="me-1" /> Last saved: {timeSinceLastSave}</>) : ("No changes yet.")} </div> </Col> <Col md={6} className="text-center text-md-end"> <div className="action-buttons d-inline-flex gap-2"> <Button type="button" variant="outline-light" size="sm" onClick={handleManualSaveDraft} disabled={!isDirty || internalIsSaving}> {internalIsSaving && !isDirty ? <Spinner as="span" size="sm" animation="border" className="me-1" /> : <FaRegSave className="me-1" />} Save Draft </Button> <Button type="submit" variant="success" size="sm" disabled={internalIsSaving || initialData?.status === 'published'}> {internalIsSaving && isDirty ? <Spinner as="span" size="sm" animation="border" className="me-1" /> : <FaCloudUploadAlt className="me-1" />} {initialData?.status === 'published' ? "Published" : "Publish Loan"} </Button> </div> </Col> </Row>
        </div>
      </Form>
    </div>
  );
};

export default LoanFormBuilder;
