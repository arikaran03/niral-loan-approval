// src/pages/SubmissionDetails.jsx (or appropriate path)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { axiosInstance } from '../../config';
import {
  Container, Card, Row, Col, Table, Image, Button, Spinner, Alert, Badge, ListGroup, ButtonGroup, Modal, Form
} from 'react-bootstrap';
import {
  FaInfoCircle, FaAddressCard, FaIdBadge, FaPaperclip, FaPercentage, FaCalendarAlt,
  FaDollarSign, FaCheckCircle, FaHistory
} from 'react-icons/fa';
import {
  ArrowLeft, FileText, XCircle, AlertTriangle as LucideAlertTriangle,
  Clock, User as UserIcon, Hash as HashIcon, DollarSign as DollarSignIcon, CalendarDays,
  RotateCcw, Image as ImageIcon, Send, Mail, UserCheck, BarChart3, Landmark,
  Download as DownloadIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, parseISO, isValid as isValidDate } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './SubmissionDetails.css';
import LiquidLoader from '../super/LiquidLoader';

// Stage definitions
const STAGE_LABELS = {
  draft: 'Draft',
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  paid_to_applicant: 'Paid to Applicant',
  closed: 'Closed'
};
const stageVariants = {
    draft: 'secondary-subtle',
    pending: 'warning-subtle',
    approved: 'success-subtle',
    rejected: 'danger-subtle',
    paid_to_applicant: 'primary-subtle',
    closed: 'dark-subtle'
};
const stageTextEmphasis = {
    draft: 'secondary-emphasis',
    pending: 'warning-emphasis',
    approved: 'success-emphasis',
    rejected: 'danger-emphasis',
    paid_to_applicant: 'primary-emphasis',
    closed: 'dark-emphasis'
};

// Icon mapping for stages
const getStatusIcon = (stage) => {
    switch (stage) {
        case 'approved': return <FaCheckCircle size={16} className="me-1 text-success" />;
        case 'rejected': return <XCircle size={16} className="me-1 text-danger" />;
        case 'pending': return <Clock size={16} className="me-1 text-warning" />;
        case 'draft': return <FileText size={16} className="me-1 text-secondary"/>;
        case 'paid_to_applicant': return <Send size={16} className="me-1 text-primary"/>;
        case 'closed': return <FaCheckCircle size={16} className="me-1 text-dark"/>;
        default: return <FileText size={16} className="me-1 text-muted"/>;
    }
};

// --- Helper to extract file ID ---
const getFileIdFromStringOrObject = (fileRefValue) => {
  if (typeof fileRefValue === 'string') {
    return fileRefValue;
  }
  if (fileRefValue && typeof fileRefValue === 'object' && fileRefValue.$oid) {
    return fileRefValue.$oid;
  }
  return null;
};

// --- Image Loader Component ---
function ImageLoader({ imageId: imageIdProp, alt, onImageLoad }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);
    setSrc(null);

    const actualImageId = getFileIdFromStringOrObject(imageIdProp);

    if (!actualImageId || typeof actualImageId !== 'string' || actualImageId.length < 10) {
      if (isMounted) {
        setError(true);
        setLoading(false);
      }
      if (onImageLoad) onImageLoad(actualImageId, null, true);
      return;
    }

    const requestTimeout = setTimeout(() => {
      if (isMounted && loading) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
        if (onImageLoad) onImageLoad(actualImageId, null, true);
      }
    }, 15000);

    axiosInstance.get(`/api/image/${actualImageId}`, { responseType: 'blob' })
      .then(res => {
        clearTimeout(requestTimeout);
        if (!isMounted) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (isMounted) {
            const base64data = reader.result;
            setSrc(base64data);
            setLoading(false);
            setError(false);
            if (onImageLoad) onImageLoad(actualImageId, base64data, false);
          }
        };
        reader.onerror = () => {
          clearTimeout(requestTimeout);
          if (isMounted) {
            setError(true);
            setLoading(false);
            if (onImageLoad) onImageLoad(actualImageId, null, true);
          }
        };
        reader.readAsDataURL(res.data);
      })
      .catch(err => {
        clearTimeout(requestTimeout);
        if (isMounted) {
          setError(true);
          setLoading(false);
          if (onImageLoad) onImageLoad(actualImageId, null, true);
        }
      });
    return () => {
      isMounted = false;
      clearTimeout(requestTimeout);
    };
  }, [imageIdProp, onImageLoad]);

  if (loading) return <LiquidLoader/>;
  if (error || !src) return (
      <div className="image-placeholder image-error text-center p-2">
          <LucideAlertTriangle size={24} className="text-danger mb-1"/>
          <span className="d-block small text-danger">Load Failed</span>
      </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="image-wrapper"
    >
      <a href={src} target="_blank" rel="noopener noreferrer" title={`View full image: ${alt || 'Submission Image'}`}>
        <Image src={src} alt={alt || 'Submission Image'} rounded fluid className="submission-image" />
      </a>
    </motion.div>
  );
}
ImageLoader.propTypes = {
    imageId: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    alt: PropTypes.string,
    onImageLoad: PropTypes.func
};

// --- Main Component ---
export default function SubmissionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [error, setError] = useState(null);
  const [apiActionError, setApiActionError] = useState(null);
  const targetStageRef = useRef(null);

  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loadedImagesForPdf, setLoadedImagesForPdf] = useState({});


  useEffect(() => {
    let isMounted = true;
    const fetchSubmission = async () => {
      setLoading(true); setError(null); setApiActionError(null);
      try {
        const { data } = await axiosInstance.get(`/api/application/submissions/${id}?populateLoanDetails=true`);
        if (isMounted) {
          if (data.loan?.document_definitions?.aadhaar_card && !data.loan?.aadhaar_card_definition) {
              data.loan.aadhaar_card_definition = data.loan.document_definitions.aadhaar_card;
          }
          if (data.loan?.document_definitions?.pan_card && !data.loan?.pan_card_definition) {
              data.loan.pan_card_definition = data.loan.document_definitions.pan_card;
          }
          setSubmission(data);
        }
      } catch (err) {
          console.error("Error fetching submission:", err);
          if (isMounted) setError(err.response?.data?.error || 'Failed to load submission details.');
      }
      finally { if (isMounted) setLoading(false); }
    };
    if (id) {
        fetchSubmission();
    } else {
        setError("Submission ID is missing.");
        setLoading(false);
    }
    return () => { isMounted = false; };
  }, [id]);

  const handleShowRejectionModal = () => {
    setRejectionReason('');
    setApiActionError(null);
    setShowRejectionModal(true);
  };
  const handleCloseRejectionModal = () => setShowRejectionModal(false);

  const handleChangeStage = async (targetStage, reason = null) => {
    if (!targetStage || actionInProgress || submission?.stage === 'paid_to_applicant' || submission?.stage === 'closed') {
        if (submission?.stage === 'paid_to_applicant' || submission?.stage === 'closed') {
            setApiActionError("Action not allowed: Loan has already been processed or closed.");
        }
        return;
    }
    targetStageRef.current = targetStage;
    setActionInProgress(true);
    setApiActionError(null);
    try {
      const payload = { stage: targetStage };
      if (targetStage === 'rejected' && reason) {
        payload.rejection_reason = reason;
      }
      const { data } = await axiosInstance.patch(`/api/application/submissions/${id}/change-stage`, payload);
      setSubmission(data);
      if (targetStage === 'rejected') handleCloseRejectionModal();
    } catch (err) {
        console.error(`Error changing stage to ${targetStage}:`, err);
        setApiActionError(err.response?.data?.error || `Failed to change stage.`);
    }
    finally {
        setActionInProgress(false);
        targetStageRef.current = null;
    }
  };

  const handleRejectSubmit = () => {
    handleChangeStage('rejected', rejectionReason.trim() || null);
  };

  const currentStage = submission?.stage;
  const canApprove = currentStage === 'pending';
  const canReject = currentStage === 'pending';
  const canMarkAsPaid = currentStage === 'approved';
  const canRevert = (currentStage === 'approved' || currentStage === 'rejected') && currentStage !== 'paid_to_applicant' && currentStage !== 'closed';

  const formatDateDisplay = (dateString, includeTime = true) => {
      const date = dateString ? parseISO(dateString) : null;
      if (date && isValidDate(date)) {
        return format(date, includeTime ? 'dd-MM-yyyy HH:mm:ss' : 'dd-MM-yyyy');
      }
      return 'N/A';
  }

  const getFieldDisplayValue = (field, value) => {
    if (value === null || value === undefined || String(value).trim() === '') {
        return <span className="text-muted fst-italic">N/A</span>;
    }
    if (field.type === 'date') {
        let dateToFormat = value;
        if (typeof value === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(value)) {
            const parts = value.split('-');
            dateToFormat = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return formatDateDisplay(dateToFormat, false);
    }
    if (field.type === 'datetime' || field.type === 'datetime-local') {
        return formatDateDisplay(value, true);
    }
    if (field.type === 'checkbox') {
        return value ? <Badge bg="success-subtle" text="success-emphasis">Yes</Badge> : <Badge bg="secondary-subtle" text="secondary-emphasis">No</Badge>;
    }
     if (field.type === 'currency') {
        return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    return String(value);
  };

  const handleImageLoadedForPdf = useCallback((loadedImageId, base64Data, hasError) => {
    if (!hasError && base64Data && loadedImageId) {
        setLoadedImagesForPdf(prev => ({...prev, [loadedImageId]: base64Data}));
    } else if (loadedImageId) {
        setLoadedImagesForPdf(prev => ({...prev, [loadedImageId]: null}));
    }
  }, []);


  const handleDirectDownload = async (fileRefValue, filenamePrefix = 'document') => {
    const actualFileId = getFileIdFromStringOrObject(fileRefValue);
    if (!actualFileId) {
        alert("Failed to download: Invalid file reference.");
        return;
    }
    try {
        const response = await axiosInstance.get(`/api/image/${actualFileId}`, { responseType: 'blob' });
        const blob = new Blob([response.data], { type: response.headers['content-type'] });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const contentDisposition = response.headers['content-disposition'];
        const fileExtension = response.data.type.split('/')[1] || 'bin';
        let filename = `${filenamePrefix.replace(/[^a-z0-9_.-]/gi, '_')}-${actualFileId}.${fileExtension}`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
            if (filenameMatch && filenameMatch.length === 2) filename = filenameMatch[1];
        }
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error downloading file:", actualFileId, error);
        alert("Failed to download file. Please try again.");
    }
  };

  const constructDisplayData = useCallback(() => {
    if (!submission) return { generalInfo: [], textualData: [], documentFiles: [] };
    const generalInfo = [];
    const textualDataEntries = new Map();
    const documentFiles = [];
    const loanProductDefinition = submission.loan;

    generalInfo.push({ field_id: '_submission_id', field_label: 'Submission ID', value: submission._id, type: 'text', icon: HashIcon });
    generalInfo.push({ field_id: '_applicant_name', field_label: 'Applicant Name', value: submission.user_id?.name || 'N/A', type: 'text', icon: UserIcon });
    generalInfo.push({ field_id: '_applicant_email', field_label: 'Applicant Email', value: submission.user_id?.email || 'N/A', type: 'text', icon: Mail });
    generalInfo.push({ field_id: '_applicant_account', field_label: 'Account #', value: submission.user_id?.account_number || 'N/A', type: 'text', icon: HashIcon });
    generalInfo.push({ field_id: '_amount_requested', field_label: 'Amount Requested', value: submission.amount, type: 'currency', icon: DollarSignIcon });
    generalInfo.push({ field_id: '_current_stage', field_label: 'Current Stage', value: STAGE_LABELS[submission.stage] || submission.stage, type: 'stage_display', stage: submission.stage, icon: FileText });
    if (submission.stage === 'rejected' && submission.rejection_reason) {
        generalInfo.push({ field_id: '_rejection_reason', field_label: 'Rejection Reason', value: submission.rejection_reason, type: 'text', icon: LucideAlertTriangle });
    }
    generalInfo.push({ field_id: '_submitted_on', field_label: 'Submitted On', value: submission.created_at, type: 'datetime', icon: CalendarDays });
    generalInfo.push({ field_id: '_last_updated', field_label: 'Last Updated', value: submission.updated_at, type: 'datetime', icon: Clock });
    if (submission.isFaceVerified) {
        generalInfo.push({ field_id: '_face_verified', field_label: 'Face Verification', value: 'Completed', type: 'text', icon: FaCheckCircle });
    }

    const addTextualData = (canonicalKey, value, displayLabel, type, source) => {
        const logicalKey = canonicalKey.toLowerCase().replace(/[\s_]/g, '');
        if (value === null || value === undefined || String(value).trim() === '') return;
        const currentEntry = textualDataEntries.get(logicalKey);
        const sourcePriority = { "Aadhaar": 3, "PAN": 2, "Custom": 1 };
        let icon;
        switch(source) {
            case "Aadhaar": icon = FaAddressCard; break;
            case "PAN": icon = FaIdBadge; break;
            default: icon = FaInfoCircle;
        }
        const finalLabel = (source === "Aadhaar" || source === "PAN") ? `${source}: ${displayLabel}` : displayLabel;
        if (!currentEntry ||
            (sourcePriority[source] && currentEntry.source && sourcePriority[source] >= sourcePriority[currentEntry.source]) ||
            (sourcePriority[source] && !currentEntry.source)
           ) {
            textualDataEntries.set(logicalKey, {
                field_id: `${source.toLowerCase()}_${logicalKey}_${Math.random().toString(36).substring(2, 7)}`,
                field_label: finalLabel,
                value: value,
                type: type || 'text',
                icon: icon,
                source: source
            });
        }
    };

    if (submission.aadhaar_data && loanProductDefinition?.aadhaar_card_definition?.fields) {
        loanProductDefinition.aadhaar_card_definition.fields.forEach(defField => {
            if (submission.aadhaar_data.hasOwnProperty(defField.key) && defField.type !== 'image' && defField.type !== 'document') {
                addTextualData(defField.key, submission.aadhaar_data[defField.key], defField.label, defField.type, "Aadhaar");
            }
        });
    }
    if (submission.pan_data && loanProductDefinition?.pan_card_definition?.fields) {
        loanProductDefinition.pan_card_definition.fields.forEach(defField => {
            if (submission.pan_data.hasOwnProperty(defField.key) && defField.type !== 'image' && defField.type !== 'document') {
                addTextualData(defField.key, submission.pan_data[defField.key], defField.label, defField.type, "PAN");
            }
        });
    }
    if (submission.fields) {
        submission.fields.forEach(customField => {
            if (customField.type !== 'image' && customField.type !== 'document') {
                let canonicalKey = customField.field_label;
                if (loanProductDefinition?.fields) {
                    const mainFieldDef = loanProductDefinition.fields.find(f => f.field_id === customField.field_id);
                    if (mainFieldDef?.auto_fill_sources?.length > 0) {
                        for (const sourceStr of mainFieldDef.auto_fill_sources) {
                            const [docType, srcKey] = sourceStr.split('.');
                            if (srcKey && (docType.toLowerCase() === 'aadhaar' || docType.toLowerCase() === 'pan')) {
                                canonicalKey = srcKey;
                                break;
                            }
                        }
                    }
                }
                addTextualData(canonicalKey, customField.value, customField.field_label, customField.type, "Custom");
            } else if (customField.fileRef) {
                const fileId = getFileIdFromStringOrObject(customField.fileRef);
                if (fileId) {
                    documentFiles.push({
                        field_id: `customFile_${customField.field_id}_${fileId}`,
                        field_label: customField.field_label,
                        fileRef: fileId,
                        originalFilename: customField.value,
                        originalType: customField.type,
                        icon: customField.type === 'image' ? ImageIcon : FileText
                    });
                }
            }
        });
    }
    const textualData = Array.from(textualDataEntries.values());

    if (submission.requiredDocumentRefs) {
        submission.requiredDocumentRefs.forEach(docRef => {
            const fileId = getFileIdFromStringOrObject(docRef.fileRef);
            if (fileId) {
                let docLabel = docRef.documentTypeKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                let originalType = 'document';
                let definition = null;
                if (docRef.documentTypeKey === 'aadhaar_card') {
                    definition = loanProductDefinition?.aadhaar_card_definition;
                    docLabel = definition?.label || "Aadhaar Card File";
                    originalType = 'image';
                } else if (docRef.documentTypeKey === 'pan_card') {
                    definition = loanProductDefinition?.pan_card_definition;
                    docLabel = definition?.label || "PAN Card File";
                    originalType = 'image';
                } else if (loanProductDefinition?.document_definitions?.[docRef.documentTypeKey]) {
                    definition = loanProductDefinition.document_definitions[docRef.documentTypeKey];
                    docLabel = definition?.label || docLabel;
                    originalType = definition?.type === 'image' ? 'image' : (definition?.type || 'document');
                }
                documentFiles.push({
                    field_id: `reqDocFile_${docRef.documentTypeKey}_${fileId}`,
                    field_label: docLabel,
                    fileRef: fileId,
                    originalType: originalType,
                    icon: originalType === 'image' ? ImageIcon : FileText,
                });
            }
        });
    }
    if (submission.annexureDocumentRef) {
        const fileId = getFileIdFromStringOrObject(submission.annexureDocumentRef);
        if (fileId) {
            documentFiles.push({
                field_id: `annexure_doc_file_${fileId}`,
                field_label: 'Uploaded Annexure',
                fileRef: fileId,
                originalType: 'document',
                icon: FaPaperclip,
            });
        }
    }
    return { generalInfo, textualData, documentFiles };
  }, [submission]);

  const { generalInfo, textualData, documentFiles } = constructDisplayData();

  const handleDownloadAsPDF = async () => {
    if (!submission) return;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    let yPos = 15; // Initial Y position
    const lineSpacing = 6;
    const sectionGap = 8; // Reduced gap between sections
    const leftMargin = 15;
    const rightMargin = 15;
    const contentWidth = doc.internal.pageSize.width - leftMargin - rightMargin;
    const fieldLabelWidth = contentWidth * 0.4; // Adjusted label width
    const fieldValueX = leftMargin + fieldLabelWidth + 3; // Start X for value
    const fieldValueMaxWidth = contentWidth - fieldLabelWidth - 3;

    // Refined Color Palette
    const headerBarColor = [70, 70, 70]; // Medium-Dark Gray for section header background
    const headerTextColor = [255, 255, 255]; // White for text on headerBarColor
    const mainTitleColor = [30, 30, 30];     // Very Dark Gray for main document title
    const subTitleColor = [90, 90, 90];      // Medium Gray for subtitles (like Submission ID under main title)
    const labelColor = [60, 60, 60];        // Dark Gray for key-value labels
    const valueColor = [80, 80, 80];        // Standard text gray for values
    const mutedTextColor = [150, 150, 150];   // Light Gray for N/A or less important text
    const accentLineColor = [47, 79, 79];   // Dark Slate Gray for the main header underline
    const lightLineColor = [220, 220, 220];  // Very light gray for subtle separators

    const addPageIfNeeded = (neededHeight = lineSpacing) => {
        if (yPos + neededHeight > doc.internal.pageSize.height - 20) { // 20mm bottom margin
            doc.addPage();
            yPos = 15; // Reset Y for new page
        }
    };

    // Section Header with solid background bar
    const addSectionHeader = (title) => {
        addPageIfNeeded(15); // Space for header bar
        doc.setFillColor(headerBarColor[0], headerBarColor[1], headerBarColor[2]);
        doc.rect(leftMargin, yPos, contentWidth, 9, 'F'); // Draw background bar for header

        doc.setFontSize(12); // Slightly smaller section title for better fit
        doc.setFont(undefined, 'bold');
        doc.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
        // Center text vertically in the bar
        const textProps = doc.getTextDimensions(title);
        const textYInBar = yPos + (9 / 2) + (textProps.h / 2) - 1.5; // Adjust for vertical centering
        doc.text(title, leftMargin + 3, textYInBar);

        yPos += 9; // Height of the header bar
        yPos += lineSpacing * 0.8; // Small gap after header bar
        doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]); // Reset text color for content
    };


    const addKeyValueLine = (label, value, valueType = 'text') => {
        addPageIfNeeded(lineSpacing * 1.2); // Adjusted needed height
        doc.setFontSize(9.5); // Slightly smaller for key-value
        doc.setFont(undefined, 'bold');
        doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
        doc.text(label + ":", leftMargin, yPos, { maxWidth: fieldLabelWidth });

        doc.setFont(undefined, 'normal');
        doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
        let displayValue = value;
        let dateStrToFormat = String(value);

        if (value === null || value === undefined || String(value).trim() === '') {
            displayValue = 'N/A';
            doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
        } else if (valueType === 'datetime') {
            displayValue = formatDateDisplay(dateStrToFormat, true);
        } else if (valueType === 'date') {
            if (typeof dateStrToFormat === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(dateStrToFormat)) {
                const parts = dateStrToFormat.split('-');
                dateStrToFormat = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            displayValue = formatDateDisplay(dateStrToFormat, false);
        } else if (valueType === 'currency') {
            displayValue = `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        } else if (valueType === 'checkbox') {
            displayValue = value ? 'Yes' : 'No';
        } else if (typeof value === 'object' && value.props) {
            if (value.props.children && Array.isArray(value.props.children)) {
                 displayValue = value.props.children.filter(c => typeof c === 'string').join(' ').trim() || 'See Original';
            } else if (value.props.children && typeof value.props.children === 'string') {
                displayValue = value.props.children;
            } else {
                displayValue = 'See Original Document';
            }
        } else {
            displayValue = String(value);
        }

        const splitValue = doc.splitTextToSize(displayValue, fieldValueMaxWidth);
        const valueTextHeight = splitValue.length * (lineSpacing * 0.7); // Approximate height of value text block
        addPageIfNeeded(valueTextHeight); // Check if value itself needs a new page

        doc.text(splitValue, fieldValueX, yPos);
        yPos += valueTextHeight + (lineSpacing * 0.4); // Adjust spacing based on lines
        doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
    };

    // --- PDF Main Document Header ---
    doc.setFontSize(20); // Larger main title
    doc.setFont(undefined, 'bold');
    doc.setTextColor(mainTitleColor[0], mainTitleColor[1], mainTitleColor[2]);
    doc.text("Loan Application Summary", doc.internal.pageSize.width / 2, yPos, { align: 'center' });
    yPos += lineSpacing * 1.5;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(subTitleColor[0], subTitleColor[1], subTitleColor[2]);
    doc.text(`Submission ID: ${submission._id}`, doc.internal.pageSize.width / 2, yPos, { align: 'center' });
    yPos += lineSpacing * 0.8;

    doc.setDrawColor(accentLineColor[0], accentLineColor[1], accentLineColor[2]); // Use accent for this line
    doc.setLineWidth(0.5); // Make it a bit prominent
    doc.line(leftMargin, yPos, doc.internal.pageSize.width - rightMargin, yPos);
    yPos += sectionGap * 1.2; // More space after main header


    // --- Submission Overview Section ---
    addSectionHeader("Submission Overview");
    generalInfo.forEach(field => {
        if (field.field_id === '_submission_id') return;
        let val = field.value;
        if(field.type === 'stage_display') {
            val = STAGE_LABELS[field.stage] || field.stage;
        }
        addKeyValueLine(field.field_label, val, field.type);
    });
    yPos += sectionGap / 2;

    // --- Loan Product Details Section ---
    const effectiveLoanTitle = submission.loanDetails?.title || submission.loan?.title;
    const interestRate = submission.loanDetails?.interest_rate ?? submission.loan?.interest_rate;
    const tenureMonths = submission.loanDetails?.tenure_months ?? submission.loan?.tenure_months;
    const processingFee = submission.loanDetails?.processing_fee ?? submission.loan?.processing_fee;

    if (submission.loan || submission.loanDetails) {
        addSectionHeader("Loan Product Details");
        if(effectiveLoanTitle) addKeyValueLine("Loan Product", effectiveLoanTitle);
        addKeyValueLine("Interest Rate", interestRate != null ? `${interestRate}%` : 'N/A');
        addKeyValueLine("Maximum Tenure", tenureMonths != null ? `${tenureMonths} months` : 'N/A');
        addKeyValueLine("Processing Fee", processingFee != null ? processingFee : 'N/A', 'currency');
        if(submission.loan?.collateral_required !== undefined) {
          addKeyValueLine("Collateral", submission.loan.collateral_required ? "Required" : "Not Required");
        }

        if (submission.loan?.eligibility) {
            yPos += lineSpacing * 0.5;
            doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
            doc.text("Eligibility Criteria:", leftMargin, yPos);
            yPos += lineSpacing * 0.8;
            doc.setFontSize(9.5); doc.setFont(undefined, 'normal'); doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
            let eligibilityText = `Age: ${submission.loan.eligibility.min_age}${submission.loan.eligibility.max_age ? ` - ${submission.loan.eligibility.max_age}` : '+'} years. `;
            if (submission.loan.eligibility.min_income != null) {
                eligibilityText += `Min. Income: ₹${submission.loan.eligibility.min_income.toLocaleString('en-IN')}. `;
            }
            if (submission.loan.eligibility.min_credit_score) {
                eligibilityText += `Min. Credit Score: ${submission.loan.eligibility.min_credit_score}.`;
            }
            const splitEligibility = doc.splitTextToSize(eligibilityText, contentWidth);
            doc.text(splitEligibility, leftMargin, yPos);
            yPos += (splitEligibility.length * lineSpacing * 0.7) + (lineSpacing * 0.5);
        }
        yPos += sectionGap / 2;
    }

    // --- Applicant Provided Information Section ---
    if (textualData.length > 0) {
        addSectionHeader("Applicant Provided Information");
        textualData.forEach(field => {
            addKeyValueLine(field.field_label, field.value, field.type);
        });
        yPos += sectionGap / 2;
    }

    // --- Submission History Section ---
    if (submission.history && submission.history.length > 0) {
        addSectionHeader("Submission History");
        submission.history.forEach(item => {
            addPageIfNeeded(lineSpacing * 3); // Adjusted space
            doc.setFontSize(9.5);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
            doc.text(`Status:`, leftMargin, yPos);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
            doc.text(`${STAGE_LABELS[item.stage] || item.stage}`, leftMargin + 20, yPos);
            yPos += lineSpacing * 0.9;

            doc.setFont(undefined, 'bold');
            doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
            doc.text(`Changed At:`, leftMargin, yPos);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
            doc.text(`${formatDateDisplay(item.changed_at, true)}`, leftMargin + 25, yPos);
            yPos += lineSpacing * 0.9;

            let changedByText = 'System';
            if (item.changed_by) {
                changedByText = item.changed_by.$oid ? `User ID: ${item.changed_by.$oid}` : `ID: ${item.changed_by}`;
            }
            doc.setFont(undefined, 'bold');
            doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
            doc.text(`Changed By:`, leftMargin, yPos);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
            doc.text(`${changedByText}`, leftMargin + 25, yPos);
            yPos += lineSpacing * 1.2; // Extra space after each history item
        });
        yPos += sectionGap / 2;
    }

    // --- Uploaded Documents Section ---
    if (documentFiles.length > 0) {
        addSectionHeader("Uploaded Documents");
        for (const docFile of documentFiles) {
            addPageIfNeeded(docFile.originalType === 'image' && loadedImagesForPdf[docFile.fileRef] ? 50 : lineSpacing * 2); // Adjusted needed height
            doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
            doc.text(`${docFile.field_label}:`, leftMargin, yPos);
            yPos += lineSpacing * 0.8;
            doc.setFont(undefined, 'normal'); doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);

            if (docFile.originalType === 'image' && loadedImagesForPdf[docFile.fileRef]) {
                try {
                    const imgData = loadedImagesForPdf[docFile.fileRef];
                    const imgProps = doc.getImageProperties(imgData);
                    const aspectRatio = imgProps.width / imgProps.height;
                    let imgWidth = contentWidth * 0.4; // Max 40% of content width for image
                    let imgHeight = imgWidth / aspectRatio;
                    const maxImgHeight = 30; // Max height for image preview
                    if (imgHeight > maxImgHeight) {
                        imgHeight = maxImgHeight;
                        imgWidth = imgHeight * aspectRatio;
                    }
                     if (imgWidth > contentWidth * 0.6) { // Cap width
                        imgWidth = contentWidth * 0.6;
                        imgHeight = imgWidth / aspectRatio;
                    }

                    if (yPos + imgHeight > doc.internal.pageSize.height - 25) { // Check page break for image
                        doc.addPage(); yPos = 15;
                        // Re-add label if new page
                        doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
                        doc.text(`${docFile.field_label}:`, leftMargin, yPos); yPos += lineSpacing*0.8;
                        doc.setFont(undefined, 'normal'); doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
                    }
                    doc.setDrawColor(lightLineColor[0], lightLineColor[1], lightLineColor[2]); // Lighter border for image
                    doc.setLineWidth(0.2);
                    doc.rect(leftMargin, yPos, imgWidth + 2, imgHeight + 2, 'S'); // Border
                    doc.addImage(imgData, imgProps.fileType, leftMargin + 1, yPos + 1, imgWidth, imgHeight);
                    yPos += imgHeight + 2 + lineSpacing * 0.8; // Space after image
                } catch (e) {
                    doc.text(`(Image preview unavailable - ID: ${docFile.fileRef})`, leftMargin, yPos);
                    yPos += lineSpacing * 1.2;
                }
            } else if (docFile.originalType === 'image') {
                doc.text(`(Image not loaded for PDF - ID: ${docFile.fileRef})`, leftMargin, yPos);
                yPos += lineSpacing * 1.2;
            } else {
                doc.text(`(Document File - ID: ${docFile.fileRef})`, leftMargin, yPos);
                if(docFile.originalFilename) {
                     doc.setFontSize(8.5);
                     doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
                     doc.text(`Filename: ${docFile.originalFilename}`, leftMargin + 5, yPos + lineSpacing * 0.7);
                     doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
                     yPos += lineSpacing * 0.7;
                }
                yPos += lineSpacing * 1.2;
            }
        }
    }

    // --- PDF Footer ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setFont(undefined, 'normal'); doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
        doc.setDrawColor(lightLineColor[0], lightLineColor[1], lightLineColor[2]);
        doc.setLineWidth(0.2);
        doc.line(leftMargin, doc.internal.pageSize.height - 12, doc.internal.pageSize.width - rightMargin, doc.internal.pageSize.height - 12); // Footer line
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - rightMargin, doc.internal.pageSize.height - 8, { align: 'right' });
        doc.text(`Generated: ${format(new Date(), 'dd-MM-yyyy HH:mm')}`, leftMargin, doc.internal.pageSize.height - 8);
        const footerLoanTitle = submission.loanDetails?.title || submission.loan?.title;
        if(footerLoanTitle) {
             doc.text(`Loan Product: ${footerLoanTitle}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 8, {maxWidth: contentWidth - 100, align: 'center'});
        }
    }

    doc.save(`Loan_Submission_${submission._id}.pdf`);
  };


  if (loading) {
    return <LiquidLoader />;
  }
  if (error && !submission) {
    return ( <Container fluid className="p-4 page-error-container"> <Alert variant="danger" className="text-center shadow-sm"> <Alert.Heading><XCircle size={24} className="me-2"/> Error Loading Submission</Alert.Heading> <p>{error}</p> <hr /> <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)}> <ArrowLeft size={16} className="me-1" /> Go Back </Button> </Alert> </Container> );
  }
  if (!submission) {
      return ( <Container fluid className="p-4 page-error-container"> <Alert variant="warning" className="text-center shadow-sm">No submission data found or ID is invalid.</Alert> </Container> );
  }

  const { stage } = submission;
  const displayLoanDetails = {
      title: submission.loanDetails?.title || submission.loan?.title || 'N/A',
      interest_rate: submission.loanDetails?.interest_rate ?? submission.loan?.interest_rate,
      tenure_months: submission.loanDetails?.tenure_months ?? submission.loan?.tenure_months,
      processing_fee: submission.loanDetails?.processing_fee ?? submission.loan?.processing_fee,
      description: submission.loan?.description,
      collateral_required: submission.loan?.collateral_required,
      eligibility: submission.loan?.eligibility,
      _id: submission.loan?._id
  };


  return (
    <Container fluid className="p-3 p-md-4 submission-details-page-v2">
        <Row className="mb-4 align-items-center page-header">
            <Col xs="auto"> <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)} className="back-button d-inline-flex align-items-center"> <ArrowLeft size={16} className="me-1" /> Back </Button> </Col>
            <Col>
                <h1 className="h4 mb-0 text-dark fw-bold"> Submission Details </h1>
                {displayLoanDetails.title !== 'N/A' && <span className="text-muted d-block small">For Loan: {displayLoanDetails.title} (ID: {displayLoanDetails._id})</span>}
            </Col>
            <Col xs="auto">
                <Button variant="outline-primary" size="sm" onClick={handleDownloadAsPDF} className="d-inline-flex align-items-center">
                    <DownloadIcon size={16} className="me-1"/> Download as PDF
                </Button>
            </Col>
             {apiActionError && submission && ( <Col xs={12} className="mt-2"> <Alert variant="danger" size="sm" onClose={() => setApiActionError(null)} dismissible className="action-error-alert"> {apiActionError} </Alert> </Col> )}
        </Row>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="mb-4 shadow-sm loan-info-card-details-page">
                <Card.Header as="h5" className="bg-primary text-white loan-info-header d-flex align-items-center">
                    <FaInfoCircle className="me-2"/> Loan Overview
                </Card.Header>
                <Card.Body className="p-4">
                    <Card.Title as="h2" className="mb-2 loan-title">{displayLoanDetails.title}</Card.Title>
                    {displayLoanDetails.description && (
                        <Card.Subtitle className="mb-3 text-muted loan-description" dangerouslySetInnerHTML={{ __html: displayLoanDetails.description }} />
                    )}
                    <hr />
                    <Row className="mb-3 text-center loan-key-metrics">
                        <Col md={3} xs={6} className="metric-item mb-3 mb-md-0">
                            <FaPercentage className="metric-icon text-success mb-1" size="1.8em"/>
                            <div className="metric-label">Interest Rate</div>
                            <strong className="metric-value fs-5">{displayLoanDetails.interest_rate != null ? `${displayLoanDetails.interest_rate}%` : 'N/A'}</strong>
                        </Col>
                        <Col md={3} xs={6} className="metric-item mb-3 mb-md-0">
                            <FaCalendarAlt className="metric-icon text-info mb-1" size="1.8em"/>
                            <div className="metric-label">Max Tenure</div>
                            <strong className="metric-value fs-5">{displayLoanDetails.tenure_months != null ? `${displayLoanDetails.tenure_months} months` : 'N/A'}</strong>
                        </Col>
                        <Col md={3} xs={6} className="metric-item">
                            <FaDollarSign className="metric-icon text-warning mb-1" size="1.8em"/>
                            <div className="metric-label">Processing Fee</div>
                            <strong className="metric-value fs-5">{displayLoanDetails.processing_fee != null ? `₹${Number(displayLoanDetails.processing_fee).toLocaleString('en-IN')}` : 'N/A'}</strong>
                        </Col>
                         <Col md={3} xs={6} className="metric-item">
                            <Landmark className="metric-icon text-primary mb-1" size="1.8em"/>
                            <div className="metric-label">Collateral</div>
                            <strong className="metric-value fs-5">{displayLoanDetails.collateral_required ? "Required" : "Not Required"}</strong>
                        </Col>
                    </Row>

                    {displayLoanDetails.eligibility && (
                        <>
                            <hr />
                            <h5 className="mt-3 mb-3 eligibility-main-title">Who Can Apply? (Eligibility)</h5>
                            <Row className="eligibility-details">
                                <Col md={6} lg={4} className="mb-2 eligibility-criterion">
                                    <UserCheck size={18} className="me-2 text-muted"/> <strong>Age:</strong> {displayLoanDetails.eligibility.min_age}
                                    {displayLoanDetails.eligibility.max_age ? ` - ${displayLoanDetails.eligibility.max_age}` : '+'} years
                                </Col>
                                {displayLoanDetails.eligibility.min_income != null && (
                                    <Col md={6} lg={4} className="mb-2 eligibility-criterion">
                                        <FaDollarSign className="me-2 text-muted"/> <strong>Min. Income:</strong> ₹{displayLoanDetails.eligibility.min_income?.toLocaleString('en-IN')}
                                    </Col>
                                )}
                                {displayLoanDetails.eligibility.min_credit_score && (
                                    <Col md={6} lg={4} className="mb-2 eligibility-criterion">
                                        <BarChart3 size={18} className="me-2 text-muted"/> <strong>Min. Credit Score:</strong> {displayLoanDetails.eligibility.min_credit_score}
                                    </Col>
                                )}
                            </Row>
                        </>
                    )}
                </Card.Body>
            </Card>

            <Card className="mb-4 shadow-sm details-card">
                <Card.Header as="h5" className="card-header-title d-flex justify-content-between align-items-center">
                    <span>Applicant Submission Data</span>
                        <Badge pill bg={stageVariants[stage] || 'light'} text={stageTextEmphasis[stage] || 'dark'} className="stage-badge-header fs-6 px-3 py-2">
                            {getStatusIcon(stage)} {STAGE_LABELS[stage] || stage}
                        </Badge>
                </Card.Header>
                <Card.Body>
                    <h6 className="text-primary mt-1 mb-2 fw-bold">General Information</h6>
                    <hr className="my-1"/>
                    <div className="table-responsive mb-3">
                        <Table borderless hover className="details-table mb-0">
                            <tbody>
                                {generalInfo.map((f) => (
                                    <tr key={f.field_id}>
                                        <th style={{ width: '35%' }}>
                                            {f.icon && React.createElement(f.icon, { size: 14, className: "me-2 text-secondary" })}
                                            {f.field_label}
                                        </th>
                                        <td>
                                            {f.type === 'stage_display' ? (
                                                <Badge pill bg={stageVariants[f.stage] || 'light'} text={stageTextEmphasis[f.stage] || 'dark'} className="stage-badge-table"> {getStatusIcon(f.stage)} {f.value} </Badge>
                                            ) : ( <span className="field-value">{getFieldDisplayValue(f, f.value)}</span> )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>

                    {textualData.length > 0 && (
                        <>
                            <h6 className="text-primary mt-3 mb-2 fw-bold">Detailed Form Data</h6>
                            <hr className="my-1"/>
                            <div className="table-responsive mb-3">
                                <Table borderless hover className="details-table mb-0">
                                    <tbody>
                                        {textualData.map((f) => (
                                            <tr key={f.field_id}>
                                                <th style={{ width: '35%' }}>
                                                    {f.icon && React.createElement(f.icon, { size: 14, className: "me-2 text-secondary" })}
                                                    {f.field_label}
                                                </th>
                                                <td>
                                                    <span className="field-value">{getFieldDisplayValue(f, f.value)}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        </>
                    )}
                    {submission?.history && submission.history.length > 0 && (
                        <>
                            <h6 className="text-primary mt-4 mb-2 fw-bold"><FaHistory className="me-2"/>Submission History</h6>
                            <hr className="my-1"/>
                            <ListGroup variant="flush" className="submission-history-list">
                                {submission.history.map((item, index) => (
                                    <ListGroup.Item key={index} className="px-0 py-2 history-item">
                                        <Row>
                                            <Col md={4}>
                                                <strong>Stage:</strong> <Badge bg={stageVariants[item.stage] || 'light'} text={stageTextEmphasis[item.stage] || 'dark'}>{STAGE_LABELS[item.stage] || item.stage}</Badge>
                                            </Col>
                                            <Col md={5}>
                                                <strong>Changed At:</strong> {formatDateDisplay(item.changed_at, true)}
                                            </Col>
                                            <Col md={3}>
                                                <strong>By:</strong> {item.changed_by?.$oid || item.changed_by || 'System'}
                                            </Col>
                                        </Row>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        </>
                    )}


                    {documentFiles.length > 0 && (
                        <>
                            <h6 className="text-primary mt-4 mb-2 fw-bold">Uploaded Documents</h6>
                            <hr className="my-1"/>
                            <ListGroup variant="flush">
                                {documentFiles.map((docFile) => (
                                    <ListGroup.Item key={docFile.field_id} className="px-0 py-3 border-bottom document-item-display">
                                        <Row className="align-items-center">
                                            <Col xs={12} md={5} className="mb-2 mb-md-0 document-label-column">
                                                {docFile.icon && React.createElement(docFile.icon, { size: 16, className: "me-2 text-primary" })}
                                                <strong>{docFile.field_label}:</strong>
                                            </Col>
                                            <Col xs={12} md={7} className="document-action-column">
                                                {docFile.originalType === 'image' ? (
                                                    <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center">
                                                        <div className="mb-2 mb-sm-0 me-sm-2" style={{width: '120px', height: 'auto', overflow: 'hidden'}}>
                                                            <ImageLoader
                                                                imageId={docFile.fileRef}
                                                                alt={docFile.field_label}
                                                                onImageLoad={handleImageLoadedForPdf}
                                                            />
                                                        </div>
                                                        <Button
                                                            onClick={() => handleDirectDownload(docFile.fileRef, docFile.originalFilename || docFile.field_label)}
                                                            variant="outline-info"
                                                            size="sm"
                                                            className="d-inline-flex align-items-center mt-2 mt-sm-0">
                                                            <DownloadIcon size={14} className="me-1"/> Download Image
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    docFile.fileRef ?
                                                    <Button
                                                        onClick={() => handleDirectDownload(docFile.fileRef, docFile.originalFilename || docFile.field_label)}
                                                        variant="outline-secondary"
                                                        size="sm"
                                                        className="d-inline-flex align-items-center">
                                                        <DownloadIcon size={14} className="me-1"/> Download Document
                                                    </Button>
                                                    : <span className="text-muted fst-italic">No document</span>
                                                )}
                                            </Col>
                                        </Row>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        </>
                    )}
                </Card.Body>
                 {(canApprove || canReject || canRevert || canMarkAsPaid) && submission?.stage !== 'paid_to_applicant' && submission?.stage !== 'closed' && (
                    <Card.Footer className="text-end bg-light action-footer">
                        <ButtonGroup size="sm">
                            {canRevert && ( <Button onClick={() => handleChangeStage('pending')} disabled={actionInProgress} variant="outline-secondary" className="action-button d-inline-flex align-items-center"> {actionInProgress && targetStageRef.current === 'pending' ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <RotateCcw size={16} className="me-1"/>} Revert to Pending </Button> )}
                            {canReject && ( <Button onClick={handleShowRejectionModal} disabled={actionInProgress} variant="outline-danger" className="action-button d-inline-flex align-items-center"> {actionInProgress && targetStageRef.current === 'rejected' ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <XCircle size={16} className="me-1"/>} Reject </Button> )}
                            {canApprove && ( <Button onClick={() => handleChangeStage('approved')} disabled={actionInProgress} variant="success" className="action-button d-inline-flex align-items-center"> {actionInProgress && targetStageRef.current === 'approved' ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <FaCheckCircle size={16} className="me-1"/>} Approve </Button> )}
                            {canMarkAsPaid && ( <Button onClick={() => handleChangeStage('paid_to_applicant')} disabled={actionInProgress} variant="primary" className="action-button d-inline-flex align-items-center"> {actionInProgress && targetStageRef.current === 'paid_to_applicant' ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <Send size={16} className="me-1"/>} Mark as Paid </Button> )}
                        </ButtonGroup>
                    </Card.Footer>
                 )}
                 {(submission?.stage === 'paid_to_applicant' || submission?.stage === 'closed') && (
                    <Card.Footer className="text-center bg-light-subtle">
                        <Alert variant={submission?.stage === 'paid_to_applicant' ? "info" : "secondary"} className="mb-0 small">
                            {submission?.stage === 'paid_to_applicant' ? <Send size={16} className="me-1"/> : <FaCheckCircle size={16} className="me-1"/> }
                             This loan application is marked as <strong className="text-capitalize">{STAGE_LABELS[submission?.stage] || submission?.stage}</strong>. No further stage changes are permitted.
                        </Alert>
                    </Card.Footer>
                 )}
            </Card>
        </motion.div>

        <Modal show={showRejectionModal} onHide={handleCloseRejectionModal} centered>
            <Modal.Header closeButton>
                <Modal.Title>Rejection Reason</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form.Group controlId="rejectionReasonInput">
                    <Form.Label>Please provide a reason for rejection (optional but recommended):</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={3}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        disabled={actionInProgress}
                    />
                </Form.Group>
                {apiActionError && <Alert variant="danger" className="mt-3">{apiActionError}</Alert>}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleCloseRejectionModal} disabled={actionInProgress}>
                    Cancel
                </Button>
                <Button variant="danger" onClick={handleRejectSubmit} disabled={actionInProgress}>
                    {actionInProgress && targetStageRef.current === 'rejected' ? <Spinner as="span" animation="border" size="sm" /> : 'Confirm Rejection'}
                </Button>
            </Modal.Footer>
        </Modal>
    </Container>
  );
}
