// src/components/admin/LoanFormBuilder.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Form,
  Button,
  Card,
  Row,
  Col,
  Spinner,
  InputGroup,
  ListGroup,
  Badge,
  Alert,
  Accordion, // Added for better layout of KYC
} from "react-bootstrap";
import {
  FaInfoCircle,
  FaDollarSign,
  FaPercentage,
  FaCalendarAlt,
  FaClock,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSave,
  FaCloudUploadAlt,
  FaTrash,
  FaPlus,
  FaEdit,
  FaListOl,
  FaFileMedicalAlt,
  FaRegSave,
  FaRedo,
  FaUserLock, // Icon for KYC
  FaIdCard, // Icon for Aadhaar/PAN
} from "react-icons/fa";
import { axiosInstance } from "../../config"; // Assuming axiosInstance is correctly configured
import "./LoanFormBuilder.css";

// --- Configs & Helpers ---
const AUTOSAVE_INTERVAL = 10000; // 10 seconds

// Schema IDs for Aadhaar and PAN (these must match the schema_id in your GovDocumentDefinitionModel)
const AADHAAR_SCHEMA_ID = "aadhaar_card"; // Example, adjust to your actual schema_id
const PAN_SCHEMA_ID = "pan_card"; // Example, adjust to your actual schema_id

const getFieldKeyFromSource = (sourceString) => {
  if (!sourceString) return null;
  const p = sourceString.split(".");
  return p.length > 1 ? p[p.length - 1] : null;
};
// ---

const LoanFormBuilder = ({
  initialData = null,
  onPublish,
  onSaveDraft,
  isSaving: parentIsSaving,
}) => {
  // --- State Definitions ---
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
            options:
              typeof f.options === "string"
                ? f.options
                    .split(",")
                    .map((opt) => opt.trim())
                    .filter(Boolean)
                : f.options || [],
            auto_fill_sources: Array.isArray(f.auto_fill_sources)
              ? f.auto_fill_sources
              : [],
          }))
        : [],
      eligibility: {
        min_age: initialData?.eligibility?.min_age ?? 18,
        max_age: initialData?.eligibility?.max_age ?? "",
        min_income: initialData?.eligibility?.min_income ?? "",
        min_credit_score: initialData?.eligibility?.min_credit_score ?? "",
      },
      // required_documents will now store OTHER standard documents, not Aadhaar/PAN
      required_documents: Array.isArray(initialData?.required_documents)
        ? initialData.required_documents
            .filter(
              (doc) =>
                doc.name?.toLowerCase() !== "aadhaar card" &&
                doc.name?.toLowerCase() !== "pan card"
            )
            .map((d) => ({ ...d }))
        : [],
      application_start: initialData?.application_start
        ? new Date(initialData.application_start).toISOString().split("T")[0]
        : "",
      application_end: initialData?.application_end
        ? new Date(initialData.application_end).toISOString().split("T")[0]
        : "",
      disbursement_date: initialData?.disbursement_date
        ? new Date(initialData.disbursement_date).toISOString().split("T")[0]
        : "",
    }),
    [initialData]
  );

  const [loanData, setLoanData] = useState(getInitialLoanDataState());
  const [errors, setErrors] = useState({});
  const [internalIsSaving, setInternalIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(
    initialData?.updated_at ? new Date(initialData.updated_at) : null
  );
  const [timeSinceLastSave, setTimeSinceLastSave] = useState("");
  const autoSaveTimerRef = useRef(null);
  const initialDataRef = useRef(JSON.stringify(getInitialLoanDataState()));
  const formRef = useRef(null);

  // State for fetched document definitions
  const [govDocDefinitions, setGovDocDefinitions] = useState([]);
  const [aadhaarSchemaDef, setAadhaarSchemaDef] = useState(null);
  const [panSchemaDef, setPanSchemaDef] = useState(null);
  const [otherDocTypesForSelection, setOtherDocTypesForSelection] = useState(
    []
  );
  const [allAutoFillSourceOptions, setAllAutoFillSourceOptions] = useState([]);
  const [docDefLoading, setDocDefLoading] = useState(true);
  const [docDefError, setDocDefError] = useState("");
  const [selectedOtherDocumentType, setSelectedOtherDocumentType] =
    useState("");

  // --- Effects ---
  useEffect(() => {
    setInternalIsSaving(parentIsSaving || false);
  }, [parentIsSaving]);

  // Fetch Government Document Definitions on mount
  useEffect(() => {
    const fetchGovDocDefinitions = async () => {
      setDocDefLoading(true);
      setDocDefError("");
      try {
        const response = await axiosInstance.get(
          "/api/document/schema-definitions"
        );
        const definitions = response.data || [];
        setGovDocDefinitions(definitions);

        const aadhaarDef = definitions.find(
          (def) => def.schema_id === AADHAAR_SCHEMA_ID
        );
        const panDef = definitions.find(
          (def) => def.schema_id === PAN_SCHEMA_ID
        );
        setAadhaarSchemaDef(aadhaarDef);
        setPanSchemaDef(panDef);

        if (!aadhaarDef)
          console.warn(
            `Aadhaar schema definition (schema_id: ${AADHAAR_SCHEMA_ID}) not found.`
          );
        if (!panDef)
          console.warn(
            `PAN schema definition (schema_id: ${PAN_SCHEMA_ID}) not found.`
          );

        const otherDocs = definitions.filter(
          (def) =>
            def.schema_id !== AADHAAR_SCHEMA_ID &&
            def.schema_id !== PAN_SCHEMA_ID
        );
        setOtherDocTypesForSelection(otherDocs);
        if (otherDocs.length > 0) {
          setSelectedOtherDocumentType(otherDocs[0]._id); // Use _id (Mongoose ID) or schema_id
        }

        // Generate auto-fill options from ALL fetched definitions
        const autoFillOpts = [];
        definitions.forEach(async (def) => {
          const fieldsOfEachDocs = await axiosInstance.get(
            `/api/document/schema-definition/by-schema-id/${def.schema_id}`
          );

          (fieldsOfEachDocs.data.fields || []).forEach((field) => {
            autoFillOpts.push({
              value: `${def.schema_id}.${field.key}`, // Use schema_id.key for uniqueness
              label: `${def.name} - ${field.label}`,
              key: field.key, // Store original key for potential derivation logic
            });
          });
        });

        setAllAutoFillSourceOptions(autoFillOpts);
      } catch (err) {
        console.error("Failed to fetch government document definitions:", err);
        setDocDefError(
          "Could not load document types. Auto-fill sources and standard document selection might be affected."
        );
      } finally {
        setDocDefLoading(false);
      }
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
      setLastSaveTime(
        initialData?.updated_at ? new Date(initialData.updated_at) : null
      );
    }
    setErrors({});
  }, [initialData, getInitialLoanDataState]);

  useEffect(() => {
    let intervalId = null;
    const updateRelativeTime = () => {
      if (lastSaveTime) {
        const now = Date.now();
        const secondsAgo = Math.round((now - lastSaveTime.getTime()) / 1000);
        setTimeSinceLastSave(
          `${Math.max(0, secondsAgo)} second${secondsAgo !== 1 ? "s" : ""} ago`
        );
      } else {
        setTimeSinceLastSave("");
      }
    };
    updateRelativeTime();
    intervalId = setInterval(updateRelativeTime, 1000);
    return () => clearInterval(intervalId);
  }, [lastSaveTime]);

  const handleAutoSave = useCallback(async () => {
    const currentStateString = JSON.stringify(loanData);
    const isStillDirty = currentStateString !== initialDataRef.current;

    if (!isStillDirty || internalIsSaving || !loanData.title?.trim()) return;

    console.log("Auto-saving draft...");
    setInternalIsSaving(true);
    try {
      const dataToSave = { ...loanData };
      const idToSave = initialData?._id;
      await onSaveDraft(dataToSave, idToSave);
      const now = new Date();
      setLastSaveTime(now);
      setIsDirty(false);
      initialDataRef.current = JSON.stringify(loanData);
    } catch (error) {
      console.error("Auto-save failed:", error);
    } finally {
      setInternalIsSaving(false);
    }
  }, [loanData, internalIsSaving, onSaveDraft, initialData?._id]);

  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const currentStateString = JSON.stringify(loanData);
    const isActuallyDirty = currentStateString !== initialDataRef.current;
    setIsDirty(isActuallyDirty);

    if (isActuallyDirty && !internalIsSaving) {
      autoSaveTimerRef.current = setTimeout(handleAutoSave, AUTOSAVE_INTERVAL);
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [loanData, internalIsSaving, handleAutoSave]);

  const updateLoanDataState = (updater) => {
    setLoanData(updater);
  };

  const validate = (isPublishingValidation = false) => {
    const newErrors = {};
    // ... (Keep existing validation logic for title, financial, eligibility, dates)
    // Title
    if (!loanData.title?.trim()) newErrors.title = "Title is required.";
    if (isPublishingValidation && !loanData.description?.trim())
      newErrors.description = "Description is required for publishing.";

    // Financial Details
    if (
      (isPublishingValidation || loanData.min_amount !== "") &&
      (isNaN(loanData.min_amount) || parseFloat(loanData.min_amount) < 0)
    )
      newErrors.min_amount = "Minimum amount must be a non-negative number.";
    if (
      (isPublishingValidation || loanData.max_amount !== "") &&
      (isNaN(loanData.max_amount) || parseFloat(loanData.max_amount) < 0)
    )
      newErrors.max_amount = "Maximum amount must be a non-negative number.";
    if (
      loanData.min_amount !== "" &&
      loanData.max_amount !== "" &&
      !isNaN(loanData.min_amount) &&
      !isNaN(loanData.max_amount) &&
      parseFloat(loanData.min_amount) > parseFloat(loanData.max_amount)
    )
      newErrors.max_amount =
        "Maximum amount cannot be less than minimum amount.";
    if (
      (isPublishingValidation || loanData.interest_rate !== "") &&
      (isNaN(loanData.interest_rate) || parseFloat(loanData.interest_rate) < 0)
    )
      newErrors.interest_rate = "Interest rate must be a non-negative number.";
    if (
      (isPublishingValidation || loanData.tenure_months !== "") &&
      (isNaN(loanData.tenure_months) ||
        parseInt(loanData.tenure_months, 10) < 1)
    )
      newErrors.tenure_months = "Tenure must be at least 1 month.";
    if (
      loanData.processing_fee !== "" &&
      loanData.processing_fee !== null &&
      (isNaN(loanData.processing_fee) ||
        parseFloat(loanData.processing_fee) < 0)
    )
      newErrors.processing_fee =
        "Processing fee must be a non-negative number.";

    // Eligibility
    const el = loanData.eligibility;
    if (
      (isPublishingValidation || el.min_age !== "") &&
      (isNaN(el.min_age) || parseInt(el.min_age, 10) < 18)
    )
      newErrors["eligibility.min_age"] = "Minimum age must be at least 18.";
    if (
      el.max_age !== "" &&
      el.max_age !== null &&
      (isNaN(el.max_age) ||
        parseInt(el.max_age, 10) <= parseInt(el.min_age || 0, 10))
    )
      newErrors["eligibility.max_age"] =
        "Maximum age must be greater than minimum age.";
    if (
      (isPublishingValidation || el.min_income !== "") &&
      (isNaN(el.min_income) || parseFloat(el.min_income) < 0)
    )
      newErrors["eligibility.min_income"] =
        "Minimum income must be a non-negative number.";
    if (
      el.min_credit_score !== "" &&
      el.min_credit_score !== null &&
      (isNaN(el.min_credit_score) ||
        parseInt(el.min_credit_score, 10) < 300 ||
        parseInt(el.min_credit_score, 10) > 900)
    )
      newErrors["eligibility.min_credit_score"] =
        "Credit score must be between 300 and 900.";

    // Dates
    if (isPublishingValidation && !loanData.application_start)
      newErrors.application_start =
        "Application start date is required for publishing.";
    if (isPublishingValidation && !loanData.application_end)
      newErrors.application_end =
        "Application end date is required for publishing.";
    if (
      loanData.application_start &&
      loanData.application_end &&
      new Date(loanData.application_start) > new Date(loanData.application_end)
    )
      newErrors.application_end =
        "Application end date must be after start date.";
    if (
      loanData.disbursement_date &&
      loanData.application_end &&
      new Date(loanData.disbursement_date) < new Date(loanData.application_end)
    )
      newErrors.disbursement_date =
        "Disbursement date cannot be before the application end date.";

    // Custom Fields (same validation logic as before)
    const fieldIds = new Set();
    loanData.fields.forEach((field, index) => {
      const prefix = `fields[${index}]`;
      let currentFieldId = field.field_id;
      let isDerived = false;
      if (field.auto_fill_sources?.length > 0) {
        const derivedKey = getFieldKeyFromSource(field.auto_fill_sources[0]);
        if (!currentFieldId?.trim() && derivedKey) {
          currentFieldId = derivedKey;
          isDerived = true;
        } else if (
          currentFieldId?.trim() &&
          derivedKey &&
          currentFieldId.trim() === derivedKey
        ) {
          isDerived = true;
        }
      }
      if (!isDerived && !currentFieldId?.trim())
        newErrors[`${prefix}.field_id`] =
          "Field ID is required (or select an auto-fill source).";
      if (currentFieldId && fieldIds.has(currentFieldId.trim()))
        newErrors[
          `${prefix}.field_id`
        ] = `Field ID "${currentFieldId}" is already used or derived. IDs must be unique.`;
      else if (currentFieldId) fieldIds.add(currentFieldId.trim());
      if (!field.field_label?.trim())
        newErrors[`${prefix}.field_label`] = "Field Label is required.";
      if (!field.type) newErrors[`${prefix}.type`] = "Field Type is required.";
      if (
        (field.type === "select" || field.type === "multiselect") &&
        (!field.options || field.options.length === 0)
      )
        newErrors[`${prefix}.options`] =
          "Options are required for select/multiselect types (comma-separated).";
    });

    // Required Docs (Aadhaar & PAN are implicitly required, this checks for *additional* docs)
    // If your business rule is that NO other documents are needed if Aadhaar/PAN are there, remove this.
    // Or, if you always want admins to explicitly add at least one "other" document:
    // if (isPublishingValidation && loanData.required_documents.length === 0) {
    //   newErrors["required_documents"] = "At least one additional standard document must be specified for publishing (besides mandatory Aadhaar/PAN).";
    // }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Input Handlers (handleInputChange, handleCustomFieldChange remain largely the same) ---
  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    const val = type === "checkbox" ? checked : value;
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    if (name.startsWith("eligibility.") && errors[name])
      setErrors((prev) => ({ ...prev, [name]: null }));
    updateLoanDataState((prev) => {
      if (name.startsWith("eligibility.")) {
        const field = name.split(".")[1];
        return { ...prev, eligibility: { ...prev.eligibility, [field]: val } };
      } else {
        return { ...prev, [name]: val };
      }
    });
  };

  const handleCustomFieldChange = (index, event) => {
    const {
      name,
      value,
      type,
      checked,
      multiple: isMultiSelectTarget,
    } = event.target;
    const fieldName = name;
    const isCheckbox = type === "checkbox";
    const isMultiSelect =
      isMultiSelectTarget && fieldName === "auto_fill_sources";

    const errorKey = `fields[${index}].${fieldName}`;
    if (errors[errorKey]) setErrors((prev) => ({ ...prev, [errorKey]: null }));
    if (
      fieldName === "auto_fill_sources" &&
      errors[`fields[${index}].field_id`]
    ) {
      setErrors((prev) => ({ ...prev, [`fields[${index}].field_id`]: null }));
    }

    updateLoanDataState((prev) => {
      const updatedFields = [...prev.fields];
      const fieldToUpdate = { ...updatedFields[index] };
      const oldAutoFillSources = fieldToUpdate.auto_fill_sources || [];
      let newFieldValue;

      if (isMultiSelect) {
        const selectedValues = Array.from(
          event.target.selectedOptions,
          (option) => option.value
        );
        newFieldValue = selectedValues;
        const currentManualId = fieldToUpdate.field_id?.trim();
        const wasDerived =
          oldAutoFillSources.length > 0 &&
          currentManualId === getFieldKeyFromSource(oldAutoFillSources[0]);
        if (selectedValues.length > 0) {
          const firstSource = selectedValues[0];
          const derivedKey = getFieldKeyFromSource(firstSource);
          if (derivedKey && (!currentManualId || wasDerived))
            fieldToUpdate["field_id"] = derivedKey;
        } else if (
          oldAutoFillSources.length > 0 &&
          selectedValues.length === 0 &&
          wasDerived
        ) {
          fieldToUpdate["field_id"] = "";
        }
      } else if (fieldName === "options") {
        newFieldValue = value
          .split(",")
          .map((opt) => opt.trim())
          .filter(Boolean);
      } else {
        newFieldValue = isCheckbox ? checked : value;
      }
      fieldToUpdate[fieldName] = newFieldValue;
      updatedFields[index] = fieldToUpdate;
      return { ...prev, fields: updatedFields };
    });
  };

  // --- Add/Remove Handlers for OTHER Standard Documents ---
  const handleAddOtherDocumentRequirement = () => {
    if (!selectedOtherDocumentType) return; // This is now the _id of the GovDocumentDefinition

    const selectedDocDef = otherDocTypesForSelection.find(
      (def) => def.schema_id === selectedOtherDocumentType
    );
    if (
      !selectedDocDef ||
      loanData.required_documents.some(
        (doc) => doc.name === selectedDocDef.schema_id
      )
    ) {
      // Prevent adding if not found or already added by name
      console.warn(
        "Document not found or already added:",
        selectedOtherDocumentType
      );
      return;
    }

    // Generate description from the definition's fields
    const fieldsDescription = (selectedDocDef.fields || [])
      .map((f) => f.label)
      .join(", ");
    const description = fieldsDescription
      ? `Expected Fields: ${fieldsDescription}`
      : "General document requirement.";

    const newRequirement = {
      name: selectedDocDef.name, // Use name from definition
      description: description,
      schema_id: selectedDocDef.schema_id, // Use schema_id for backend reference
    };
    updateLoanDataState((prev) => ({
      ...prev,
      required_documents: [...prev.required_documents, newRequirement],
    }));
    if (errors.required_documents)
      setErrors((prev) => ({ ...prev, required_documents: null }));
  };

  const handleRemoveDocumentRequirement = (indexToRemove) => {
    updateLoanDataState((prev) => ({
      ...prev,
      required_documents: prev.required_documents.filter(
        (_, index) => index !== indexToRemove
      ),
    }));
  };

  // Add/Remove Custom Fields (same as before)
  const handleAddCustomField = () => {
    updateLoanDataState((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          field_id: "",
          field_label: "",
          field_prompt: "",
          type: "text",
          required: false,
          min_value: "",
          max_value: "",
          options: [],
          auto_fill_sources: [],
        },
      ],
    }));
  };
  const handleRemoveCustomField = (indexToRemove) => {
    updateLoanDataState((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, index) => index !== indexToRemove),
    }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      Object.keys(newErrors).forEach((key) => {
        if (key.startsWith("fields[")) {
          const match = key.match(/fields\[(\d+)\]/);
          if (match) {
            const errorIndex = parseInt(match[1], 10);
            if (errorIndex === indexToRemove) delete newErrors[key];
            else if (errorIndex > indexToRemove) delete newErrors[key];
          }
        }
      });
      return newErrors;
    });
  };

  // --- Form Submission/Action Handlers (handlePublish, handleManualSaveDraft remain largely the same) ---
  const handlePublish = async (event) => {
    event.preventDefault();
    if (internalIsSaving) return;
    if (validate(true)) {
      console.log("Form Validated for Publishing. Submitting:", loanData);
      setInternalIsSaving(true);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      try {
        // Prepare data (ensure types are correct for API)
        const dataToSubmit = {
          ...loanData,
          min_amount:
            loanData.min_amount !== "" ? parseFloat(loanData.min_amount) : null,
          max_amount:
            loanData.max_amount !== "" ? parseFloat(loanData.max_amount) : null,
          interest_rate:
            loanData.interest_rate !== ""
              ? parseFloat(loanData.interest_rate)
              : null,
          tenure_months:
            loanData.tenure_months !== ""
              ? parseInt(loanData.tenure_months, 10)
              : null,
          processing_fee:
            loanData.processing_fee !== "" && loanData.processing_fee !== null
              ? parseFloat(loanData.processing_fee)
              : 0,
          eligibility: {
            min_age:
              loanData.eligibility.min_age !== ""
                ? parseInt(loanData.eligibility.min_age, 10)
                : null,
            max_age:
              loanData.eligibility.max_age !== "" &&
              loanData.eligibility.max_age !== null
                ? parseInt(loanData.eligibility.max_age, 10)
                : null,
            min_income:
              loanData.eligibility.min_income !== ""
                ? parseFloat(loanData.eligibility.min_income)
                : null,
            min_credit_score:
              loanData.eligibility.min_credit_score !== "" &&
              loanData.eligibility.min_credit_score !== null
                ? parseInt(loanData.eligibility.min_credit_score, 10)
                : null,
          },
          application_start: loanData.application_start
            ? new Date(loanData.application_start)
            : null,
          application_end: loanData.application_end
            ? new Date(loanData.application_end)
            : null,
          disbursement_date: loanData.disbursement_date
            ? new Date(loanData.disbursement_date)
            : null,
          fields: loanData.fields.map((field) => ({
            ...field,
            // options: Array.isArray(field.options) ? field.options.join(',') : field.options, // If backend expects string
            min_value:
              field.type === "number" && field.min_value !== ""
                ? parseFloat(field.min_value)
                : field.min_value,
            max_value:
              field.type === "number" && field.max_value !== ""
                ? parseFloat(field.max_value)
                : field.max_value,
          })),
          // required_documents now only contains "other" documents. Aadhaar/PAN are implicit.
        };
        const idToSave = initialData?._id;
        await onPublish(dataToSubmit, idToSave);
        const now = new Date();
        setLastSaveTime(now);
        setIsDirty(false);
        initialDataRef.current = JSON.stringify(loanData);
      } catch (error) {
        console.error("Failed to publish loan:", error);
      } finally {
        setInternalIsSaving(false);
      }
    } else {
      console.log("Publish Validation Failed:", errors);
      alert("Please fix the errors marked in red before publishing.");
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey && formRef.current) {
        const selector = `[name="${firstErrorKey}"], [id^="field_${firstErrorKey.replace(
          ".",
          "_"
        )}"]`;
        const element = formRef.current.querySelector(selector);
        if (element) {
          element.focus({ preventScroll: true });
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  };

  const handleManualSaveDraft = async () => {
    if (internalIsSaving) return;
    if (!loanData.title?.trim()) {
      setErrors((prev) => ({
        ...prev,
        title: "Title is required to save a draft.",
      }));
      alert("Please enter a Title before saving the draft.");
      formRef.current?.querySelector('[name="title"]')?.focus();
      return;
    }
    if (errors.title) setErrors((prev) => ({ ...prev, title: null }));

    setInternalIsSaving(true);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    try {
      const dataToSave = { ...loanData };
      const idToSave = initialData?._id;
      await onSaveDraft(dataToSave, idToSave);
      const now = new Date();
      setLastSaveTime(now);
      setIsDirty(false);
      initialDataRef.current = JSON.stringify(loanData);
    } catch (error) {
      console.error("Manual save draft failed:", error);
    } finally {
      setInternalIsSaving(false);
    }
  };

  // --- Rendering Helpers (renderInput, renderTextArea, renderEligibilityInput, renderCustomField... remain the same) ---
  // ... (Keep your existing render helper functions here, they are mostly fine) ...
  // For brevity, I'll skip re-pasting all render helpers if they don't need direct changes
  // related to the new KYC logic, but ensure they correctly use `loanData` and `errors`.
  // Key change will be in how `renderCustomFieldMultiSelect` gets its options.

  const renderInput = (
    name,
    label,
    type = "text",
    options = {},
    valueOverride = undefined
  ) => {
    const actualValue =
      valueOverride !== undefined ? valueOverride : loanData[name];
    const value = actualValue ?? "";
    const fieldId = name.includes(".")
      ? name.replace(/\./g, "_")
      : `field_${name}`;
    const isInvalid = !!errors[name];
    return (
      <Form.Group
        as={Col}
        md={options.md || 6}
        className="mb-3"
        key={fieldId}
        controlId={fieldId}
      >
        <Form.Label>
          {label}
          {options.required ? " *" : ""}
        </Form.Label>
        <Form.Control
          type={type}
          name={name}
          value={value}
          onChange={handleInputChange}
          checked={type === "checkbox" ? !!value : undefined}
          required={options.required}
          min={options.min}
          max={options.max}
          step={options.step}
          placeholder={options.placeholder}
          isInvalid={isInvalid}
          disabled={internalIsSaving}
        />
        <Form.Control.Feedback type="invalid">
          {errors[name]}
        </Form.Control.Feedback>
      </Form.Group>
    );
  };
  const renderTextArea = (
    name,
    label,
    options = {},
    valueOverride = undefined
  ) => {
    const actualValue =
      valueOverride !== undefined ? valueOverride : loanData[name];
    const value = actualValue ?? "";
    const fieldId = name.includes(".")
      ? name.replace(/\./g, "_")
      : `field_${name}`;
    const isInvalid = !!errors[name];
    return (
      <Form.Group
        as={Col}
        md={options.md || 12}
        className="mb-3"
        key={fieldId}
        controlId={fieldId}
      >
        <Form.Label>
          {label}
          {options.required ? " *" : ""}
        </Form.Label>
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
        <Form.Control.Feedback type="invalid">
          {errors[name]}
        </Form.Control.Feedback>
      </Form.Group>
    );
  };
  const renderEligibilityInput = (
    name,
    label,
    type = "number",
    options = {}
  ) => {
    const fieldName = `eligibility.${name}`;
    return renderInput(
      fieldName,
      label,
      type,
      { ...options, md: options.md || 6 },
      loanData.eligibility[name]
    );
  };
  const renderCustomFieldInput = (
    index,
    fieldName,
    label,
    type = "text",
    options = {}
  ) => {
    const fullFieldName = `fields[${index}].${fieldName}`;
    const controlId = `field_${index}_${fieldName}`;
    const fieldData = loanData.fields[index];
    const value = fieldData?.[fieldName] ?? "";
    const isInvalid = !!errors[fullFieldName];
    const isIdField = fieldName === "field_id";
    const isDerived =
      isIdField &&
      fieldData?.auto_fill_sources?.length > 0 &&
      value === getFieldKeyFromSource(fieldData.auto_fill_sources[0]);

    if (type === "checkbox") {
      return (
        <Col md={options.md || 6} className="mb-3">
          <Form.Group
            className="h-100 d-flex align-items-end"
            key={controlId}
            controlId={controlId}
          >
            <div>
              <Form.Check
                type="switch"
                name={fieldName}
                label={label}
                checked={!!value}
                onChange={(e) => handleCustomFieldChange(index, e)}
                isInvalid={isInvalid}
                disabled={internalIsSaving}
              />
              {isInvalid && (
                <div
                  className="invalid-feedback d-block"
                  style={{ marginTop: "-0.25rem" }}
                >
                  {errors[fullFieldName]}
                </div>
              )}
            </div>
          </Form.Group>
        </Col>
      );
    }
    return (
      <Form.Group
        as={Col}
        md={options.md || 6}
        className="mb-3"
        key={controlId}
        controlId={controlId}
      >
        <Form.Label>
          {label}
          {options.required && !isDerived ? " *" : ""}
        </Form.Label>
        <Form.Control
          type={type}
          name={fieldName}
          value={value}
          onChange={(e) => handleCustomFieldChange(index, e)}
          readOnly={isDerived}
          className={isDerived ? "read-only-input" : ""}
          required={options.required && !isDerived}
          min={options.min}
          max={options.max}
          step={options.step}
          placeholder={options.placeholder}
          isInvalid={isInvalid}
          disabled={internalIsSaving}
        />
        {isIdField && isDerived && (
          <Form.Text className="derived-text">
            Derived from Auto-Fill Source.
          </Form.Text>
        )}
        <Form.Control.Feedback type="invalid">
          {errors[fullFieldName]}
        </Form.Control.Feedback>
      </Form.Group>
    );
  };
  const renderCustomFieldTextarea = (index, fieldName, label, options = {}) => {
    const fullFieldName = `fields[${index}].${fieldName}`;
    const controlId = `field_${index}_${fieldName}`;
    let value = loanData.fields[index]?.[fieldName];
    if (fieldName === "options" && Array.isArray(value))
      value = value.join(", ");
    value = value ?? "";
    const isInvalid = !!errors[fullFieldName];
    return (
      <Form.Group
        as={Col}
        md={options.md || 12}
        className="mb-3"
        key={controlId}
        controlId={controlId}
      >
        <Form.Label>
          {label}
          {options.required ? " *" : ""}
        </Form.Label>
        <Form.Control
          as="textarea"
          name={fieldName}
          value={value}
          onChange={(e) => handleCustomFieldChange(index, e)}
          rows={options.rows}
          placeholder={options.placeholder}
          required={options.required}
          isInvalid={isInvalid}
          disabled={internalIsSaving}
        />
        <Form.Control.Feedback type="invalid">
          {errors[fullFieldName]}
        </Form.Control.Feedback>
      </Form.Group>
    );
  };
  const renderCustomFieldSelect = (
    index,
    fieldName,
    label,
    optionsArray = [],
    fieldOptions = {}
  ) => {
    const fullFieldName = `fields[${index}].${fieldName}`;
    const controlId = `field_${index}_${fieldName}`;
    const value = loanData.fields[index]?.[fieldName] ?? "";
    const isInvalid = !!errors[fullFieldName];
    return (
      <Form.Group
        as={Col}
        md={fieldOptions.md || 6}
        className="mb-3"
        key={controlId}
        controlId={controlId}
      >
        <Form.Label>
          {label}
          {fieldOptions.required ? " *" : ""}
        </Form.Label>
        <Form.Select
          name={fieldName}
          value={value}
          onChange={(e) => handleCustomFieldChange(index, e)}
          required={fieldOptions.required}
          isInvalid={isInvalid}
          disabled={internalIsSaving}
        >
          <option value="">-- Select --</option>
          {optionsArray.map((opt) => (
            <option key={opt.value || opt} value={opt.value || opt}>
              {opt.label || opt}
            </option>
          ))}
        </Form.Select>
        <Form.Control.Feedback type="invalid">
          {errors[fullFieldName]}
        </Form.Control.Feedback>
      </Form.Group>
    );
  };
  const renderCustomFieldMultiSelect = (
    index,
    fieldName,
    label,
    baseOptionsArray = [],
    fieldOptions = {}
  ) => {
    const fullFieldName = `fields[${index}].${fieldName}`;
    const controlId = `field_${index}_${fieldName}`;
    const currentField = loanData.fields[index];
    const selectedSources = Array.isArray(currentField?.[fieldName])
      ? currentField[fieldName]
      : [];
    const isInvalid = !!errors[fullFieldName];
    const baseKey =
      selectedSources.length > 0
        ? getFieldKeyFromSource(selectedSources[0])
        : null;
    let filteredOptions = baseKey
      ? baseOptionsArray.filter(
          (opt) => opt.key === baseKey || selectedSources.includes(opt.value)
        )
      : baseOptionsArray;

    return (
      <Form.Group
        as={Col}
        md={fieldOptions.md || 12}
        className="mb-3"
        key={controlId}
        controlId={controlId}
      >
        <Form.Label>
          {label}
          {fieldOptions.required ? " *" : ""}
        </Form.Label>
        <Form.Select
          multiple
          name={fieldName}
          value={selectedSources}
          onChange={(e) => handleCustomFieldChange(index, e)}
          required={fieldOptions.required}
          className={`multi-select ${isInvalid ? "is-invalid" : ""}`}
          style={{ minHeight: "120px" }}
          disabled={internalIsSaving}
        >
          {filteredOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Form.Select>
        <Form.Control.Feedback
          type="invalid"
          className={isInvalid ? "d-block" : ""}
        >
          {errors[fullFieldName]}
        </Form.Control.Feedback>
        <Form.Text muted>Hold Ctrl/Cmd to select multiple.</Form.Text>
      </Form.Group>
    );
  };

  // --- Component Render ---
  return (
    <div className="loan-form-builder-component">
      {internalIsSaving && !isDirty && (
        <div className="saving-indicator saving-success">
          {" "}
          <FaCheckCircle /> Saved
        </div>
      )}
      {internalIsSaving && isDirty && (
        <div className="saving-indicator saving-progress">
          {" "}
          <Spinner animation="grow" size="sm" /> Saving...
        </div>
      )}

      <Form
        ref={formRef}
        onSubmit={handlePublish}
        className="loan-form-builder-content needs-validation"
        noValidate
      >
        <Card className="mb-4 shadow-sm">
          <Card.Header>
            <FaInfoCircle className="me-2 text-primary" /> Basic Information
          </Card.Header>
          <Card.Body>
            <Row>
              {renderInput("title", "Loan Title", "text", {
                required: true,
                md: 12,
                placeholder: "Enter a clear title",
              })}
              {renderTextArea("description", "Description (HTML supported)", {
                rows: 5,
                md: 12,
                required: false,
                placeholder: "Describe the loan...",
              })}
            </Row>
          </Card.Body>
        </Card>

        <Card className="mb-4 shadow-sm">
          <Card.Header>
            <FaDollarSign className="me-2 text-success" /> Financial Details
          </Card.Header>
          <Card.Body className="bg-light-subtle">
            <Row>
              {renderInput("min_amount", "Minimum Amount", "number", {
                required: true,
                min: 0,
                step: 0.01,
              })}
              {renderInput("max_amount", "Maximum Amount", "number", {
                required: true,
                min: 0,
                step: 0.01,
              })}
              {renderInput("interest_rate", "Interest Rate (%)", "number", {
                required: true,
                min: 0,
                step: 0.01,
              })}
              {renderInput("tenure_months", "Tenure (Months)", "number", {
                required: true,
                min: 1,
                step: 1,
              })}
              {renderInput("processing_fee", "Processing Fee", "number", {
                min: 0,
                step: 0.01,
              })}
              <Col md={12} className="mb-3 mt-2">
                <Form.Check
                  type="switch"
                  id="field_collateral_required"
                  name="collateral_required"
                  label="Collateral Required?"
                  checked={!!loanData.collateral_required}
                  onChange={handleInputChange}
                  disabled={internalIsSaving}
                />
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Card className="mb-4 shadow-sm">
          <Card.Header>
            <FaCheckCircle className="me-2 text-info" /> Eligibility Criteria
          </Card.Header>
          <Card.Body>
            <Row>
              {renderEligibilityInput("min_age", "Minimum Age", "number", {
                required: true,
                min: 18,
              })}
              {renderEligibilityInput("max_age", "Maximum Age", "number", {
                min: 18,
              })}
              {renderEligibilityInput(
                "min_income",
                "Minimum Income",
                "number",
                { required: true, min: 0, step: 0.01 }
              )}
              {renderEligibilityInput(
                "min_credit_score",
                "Min Credit Score",
                "number",
                { min: 300, max: 900 }
              )}
            </Row>
          </Card.Body>
        </Card>

        {/* --- MANDATORY KYC DOCUMENTS --- */}
        <Card className="mb-4 shadow-sm">
          <Card.Header className="bg-warning-subtle">
            <FaUserLock className="me-2 text-warning" /> Mandatory KYC Documents
          </Card.Header>
          <Card.Body>
            {docDefLoading && (
              <div className="text-center">
                <Spinner animation="border" size="sm" /> Loading KYC
                definitions...
              </div>
            )}
            {docDefError && !docDefLoading && (
              <Alert variant="danger" size="sm">
                {docDefError}
              </Alert>
            )}

            {!docDefLoading && (!aadhaarSchemaDef || !panSchemaDef) && (
              <Alert variant="warning" size="sm">
                Aadhaar or PAN card schema definitions could not be loaded.
                These are mandatory for loan products. Please ensure schemas
                with ID '<code>{AADHAAR_SCHEMA_ID}</code>' and '
                <code>{PAN_SCHEMA_ID}</code>' exist.
              </Alert>
            )}

            <Accordion defaultActiveKey={["0", "1"]} alwaysOpen>
              {aadhaarSchemaDef && (
                <Accordion.Item eventKey="0">
                  <Accordion.Header>
                    <FaIdCard className="me-2" />
                    Aadhaar Card (Mandatory)
                  </Accordion.Header>
                  <Accordion.Body>
                    <p className="text-muted small">
                      {aadhaarSchemaDef.description}
                    </p>
                    <ListGroup variant="flush">
                      {(aadhaarSchemaDef.fields || []).map((field) => (
                        <ListGroup.Item
                          key={field.key}
                          className="py-1 px-0 border-0"
                        >
                          <strong>{field.label}:</strong>{" "}
                          <span className="text-muted fst-italic">
                            ({field.prompt})
                          </span>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  </Accordion.Body>
                </Accordion.Item>
              )}
              {panSchemaDef && (
                <Accordion.Item eventKey="1">
                  <Accordion.Header>
                    <FaIdCard className="me-2" />
                    PAN Card (Mandatory)
                  </Accordion.Header>
                  <Accordion.Body>
                    <p className="text-muted small">
                      {panSchemaDef.description}
                    </p>
                    <ListGroup variant="flush">
                      {(panSchemaDef.fields || []).map((field) => (
                        <ListGroup.Item
                          key={field.key}
                          className="py-1 px-0 border-0"
                        >
                          <strong>{field.label}:</strong>{" "}
                          <span className="text-muted fst-italic">
                            ({field.prompt})
                          </span>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  </Accordion.Body>
                </Accordion.Item>
              )}
            </Accordion>
          </Card.Body>
        </Card>

        {/* --- OTHER Standard Document Requirements --- */}
        <Card className="mb-4 shadow-sm">
          <Card.Header>
            <FaFileMedicalAlt className="me-2 text-danger" />
            Other Standard Document Requirements
          </Card.Header>
          <Card.Body>
            {docDefLoading && (
              <div className="text-center">
                <Spinner animation="border" size="sm" /> Loading document
                types...
              </div>
            )}
            {!docDefLoading && otherDocTypesForSelection.length > 0 && (
              <Row className="g-3 align-items-center mb-3 pb-3 border-bottom">
                <Col xs={12} sm>
                  <Form.Select
                    size="sm"
                    value={selectedOtherDocumentType}
                    onChange={(e) =>
                      setSelectedOtherDocumentType(e.target.value)
                    }
                    disabled={internalIsSaving || docDefLoading}
                    aria-label="Select other document type to add"
                  >
                    <option value="">-- Select Other Document Type --</option>
                    {otherDocTypesForSelection.map((docDef) => (
                      <option key={docDef.schema_id} value={docDef.schema_id}>
                        {docDef.name} ({docDef.schema_id})
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col xs={12} sm="auto">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddOtherDocumentRequirement}
                    disabled={
                      internalIsSaving ||
                      !selectedOtherDocumentType ||
                      docDefLoading
                    }
                    className="w-100"
                  >
                    Add Document
                  </Button>
                </Col>
              </Row>
            )}
            {errors.required_documents && (
              <Alert variant="danger" size="sm" className="mt-2">
                {errors.required_documents}
              </Alert>
            )}
            <ListGroup variant="flush">
              {loanData.required_documents.length === 0 && (
                <ListGroup.Item className="text-muted text-center py-3">
                  No additional standard documents added yet.
                </ListGroup.Item>
              )}
              {loanData.required_documents.map((doc, index) => (
                <ListGroup.Item
                  key={`req-doc-${index}`}
                  className="d-flex justify-content-between align-items-center ps-1 pe-1"
                >
                  <div className="flex-grow-1 me-2">
                    <strong className="d-block">{doc.name}</strong>
                    <small className="text-muted fst-italic">
                      {doc.description || "No description"}
                    </small>
                  </div>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    className="p-1 remove-button-inline flex-shrink-0"
                    onClick={() => handleRemoveDocumentRequirement(index)}
                    aria-label={`Remove ${doc.name}`}
                    disabled={internalIsSaving}
                  >
                    {" "}
                    <FaTrash />{" "}
                  </Button>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card.Body>
        </Card>

        {/* Custom Fields Card (uses allAutoFillSourceOptions which is now dynamic) */}
        <Card className="mb-4 shadow-sm">
          <Card.Header>
            <FaEdit className="me-2 text-secondary" /> Custom Application Fields
          </Card.Header>
          <Card.Body className="bg-light-subtle">
            {docDefLoading && (
              <div className="text-center">
                <Spinner animation="border" size="sm" /> Loading auto-fill
                options...
              </div>
            )}
            {!docDefLoading && loanData.fields.length === 0 && (
              <p className="text-muted text-center py-3 mb-0">
                No custom fields added yet.
              </p>
            )}
            {loanData.fields.map((field, index) => (
              <div
                className="custom-field-item p-3 mb-3 border rounded bg-white position-relative"
                key={`custom-field-${index}`}
              >
                <div className="custom-field-header d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                  <h6 className="text-primary mb-0 fw-bold">
                    Custom Field #{index + 1}
                  </h6>
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 text-danger remove-button-inline"
                    onClick={() => handleRemoveCustomField(index)}
                    aria-label={`Remove Custom Field ${index + 1}`}
                    disabled={internalIsSaving}
                    title="Remove Field"
                  >
                    {" "}
                    <FaTrash />{" "}
                  </Button>
                </div>
                <Row>
                  {renderCustomFieldInput(
                    index,
                    "field_id",
                    "Field ID",
                    "text",
                    { required: !field.auto_fill_sources?.length > 0, md: 6 }
                  )}
                  {renderCustomFieldInput(
                    index,
                    "field_label",
                    "Field Label",
                    "text",
                    { required: true, md: 6 }
                  )}
                </Row>
                <Row className="align-items-end">
                  {renderCustomFieldSelect(
                    index,
                    "type",
                    "Field Type",
                    [
                      { value: "text", label: "Text" },
                      { value: "textarea", label: "Text Area" },
                      { value: "number", label: "Number" },
                      { value: "date", label: "Date" },
                      { value: "datetime", label: "Date & Time" },
                      { value: "time", label: "Time" },
                      { value: "select", label: "Dropdown (Single)" },
                      { value: "multiselect", label: "Dropdown (Multi)" },
                      { value: "checkbox", label: "Checkbox" },
                      { value: "image", label: "Image Upload" },
                      { value: "document", label: "Document Upload" },
                    ],
                    { required: true, md: 6 }
                  )}
                  {renderCustomFieldInput(
                    index,
                    "required",
                    "Required Field?",
                    "checkbox",
                    { md: 6 }
                  )}
                </Row>
                <Row>
                  {renderCustomFieldTextarea(
                    index,
                    "field_prompt",
                    "Field Prompt/Hint",
                    { rows: 2, md: 12 }
                  )}
                </Row>
                {(field.type === "number" ||
                  field.type === "text" ||
                  field.type === "textarea") && (
                  <Row>
                    {renderCustomFieldInput(
                      index,
                      "min_value",
                      "Min Value / Length",
                      field.type === "number" ? "number" : "text",
                      { md: 6 }
                    )}
                    {renderCustomFieldInput(
                      index,
                      "max_value",
                      "Max Value / Length",
                      field.type === "number" ? "number" : "text",
                      { md: 6 }
                    )}
                  </Row>
                )}
                {(field.type === "select" || field.type === "multiselect") && (
                  <Row>
                    {renderCustomFieldTextarea(
                      index,
                      "options",
                      "Options (Comma-separated)",
                      {
                        required: true,
                        placeholder: "e.g., Option 1, Option 2",
                        md: 12,
                      }
                    )}
                  </Row>
                )}
                {field.type !== "image" &&
                  field.type !== "document" &&
                  !docDefLoading && ( // Ensure options are loaded
                    <Row>
                      {renderCustomFieldMultiSelect(
                        index,
                        "auto_fill_sources",
                        "Potential Auto-Fill Sources",
                        allAutoFillSourceOptions,
                        { md: 12 }
                      )}
                    </Row>
                  )}
              </div>
            ))}
            <div className="mt-2 text-end">
              <Button
                type="button"
                variant="outline-primary"
                size="sm"
                onClick={handleAddCustomField}
                disabled={internalIsSaving}
              >
                <FaPlus className="me-1" /> Add Custom Field{" "}
              </Button>
            </div>
          </Card.Body>
        </Card>

        <Card className="mb-4 shadow-sm">
          <Card.Header>
            <FaCalendarAlt className="me-2 text-warning" /> Application Window &
            Dates
          </Card.Header>
          <Card.Body className="bg-light-subtle">
            <Row>
              {renderInput(
                "application_start",
                "Application Start Date",
                "date",
                { required: true }
              )}
              {renderInput("application_end", "Application End Date", "date", {
                required: true,
              })}
              {renderInput(
                "disbursement_date",
                "Disbursement Date (Optional)",
                "date"
              )}
            </Row>
          </Card.Body>
        </Card>

        <div className="form-status-bar sticky-bottom bg-dark text-light p-2 shadow-lg">
          <Row className="align-items-center">
            <Col md={6} className="text-center text-md-start mb-2 mb-md-0">
              <div
                className={`status-indicator status-${
                  internalIsSaving
                    ? "saving"
                    : isDirty
                    ? "unsaved"
                    : lastSaveTime
                    ? "saved"
                    : "neutral"
                }`}
              >
                {internalIsSaving ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Saving...
                  </>
                ) : isDirty ? (
                  <>
                    <FaExclamationTriangle className="me-1" /> Unsaved changes
                  </>
                ) : lastSaveTime ? (
                  <>
                    <FaCheckCircle className="me-1" /> Last saved:{" "}
                    {timeSinceLastSave}
                  </>
                ) : (
                  "No changes yet."
                )}
              </div>
            </Col>
            <Col md={6} className="text-center text-md-end">
              <div className="action-buttons d-inline-flex gap-2">
                <Button
                  type="button"
                  variant="outline-light"
                  size="sm"
                  onClick={handleManualSaveDraft}
                  disabled={!isDirty || internalIsSaving}
                >
                  {internalIsSaving && !isDirty ? (
                    <Spinner
                      as="span"
                      size="sm"
                      animation="border"
                      className="me-1"
                    />
                  ) : (
                    <FaRegSave className="me-1" />
                  )}{" "}
                  Save Draft
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  size="sm"
                  disabled={
                    internalIsSaving || initialData?.status === "published"
                  }
                >
                  {internalIsSaving && isDirty ? (
                    <Spinner
                      as="span"
                      size="sm"
                      animation="border"
                      className="me-1"
                    />
                  ) : (
                    <FaCloudUploadAlt className="me-1" />
                  )}
                  {initialData?.status === "published"
                    ? "Published"
                    : "Publish Loan"}
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
