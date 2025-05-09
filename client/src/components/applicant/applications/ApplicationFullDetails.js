// src/pages/ApplicationFullDetails.jsx (or components/application/ApplicationFullDetails.jsx)

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { axiosInstance } from '../../../config'; // Adjust path
import {
  Container,
  Card,
  Row,
  Col,
  Table,
  Image,
  Button,
  Spinner,
  Alert,
  Badge,
  ListGroup,
  ButtonGroup // Keep ButtonGroup if actions are added back
} from 'react-bootstrap';
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Hash,
  DollarSign,
  Calendar,
  Info,
  ListChecks,
  FileBadge,
  History,
  AlertTriangle, // Icon for image error
  Image as ImageIcon // Icon for image placeholder
} from 'lucide-react'; // Using Lucide icons
import { motion } from 'framer-motion';
import { format, parseISO, isValid } from 'date-fns';
import moment from 'moment'; // Keep moment for history 'fromNow'
import './ApplicationFullDetails.css'; // Import custom styles

// Stage definitions (consistent)
const STAGE_LABELS = {
  draft: 'Draft',
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected'
};
const stageVariants = {
    draft: 'secondary-subtle',
    pending: 'warning-subtle',
    approved: 'success-subtle',
    rejected: 'danger-subtle'
};
const stageTextEmphasis = {
    draft: 'secondary-emphasis',
    pending: 'warning-emphasis',
    approved: 'success-emphasis',
    rejected: 'danger-emphasis'
};
const getStatusIcon = (stage) => {
    switch (stage) {
        case 'approved': return <CheckCircle size={16} className="me-1 text-success" />;
        case 'rejected': return <XCircle size={16} className="me-1 text-danger" />;
        case 'pending': return <Clock size={16} className="me-1 text-warning" />;
        case 'draft': return <FileText size={16} className="me-1 text-secondary"/>;
        default: return null;
    }
};

// --- Image Loader Component ---
function ImageLoader({ imageId, alt }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const objectURLRef = useRef(null);

  useEffect(() => {
    let isMounted = true; setLoading(true); setError(false); setSrc(null);
    if (objectURLRef.current) { URL.revokeObjectURL(objectURLRef.current); objectURLRef.current = null; }
    if (!imageId || typeof imageId !== 'string' || imageId.length < 10) { setError(true); setLoading(false); return; }
    let requestTimeout = setTimeout(() => { if (isMounted && loading) { setError(true); setLoading(false); } }, 15000);
    (async () => {
      try {
        // Fetch image blob from the dedicated endpoint
        const res = await axiosInstance.get(`/api/image/${imageId}`, { responseType: 'blob' });
        clearTimeout(requestTimeout);
        if (!isMounted) return;
        const newObjectURL = URL.createObjectURL(res.data);
        objectURLRef.current = newObjectURL;
        setSrc(newObjectURL);
      } catch (err) { clearTimeout(requestTimeout); console.error('Failed to load image', imageId, err); if (isMounted) setError(true); }
      finally { if (isMounted) setLoading(false); }
    })();
    return () => { isMounted = false; clearTimeout(requestTimeout); if (objectURLRef.current) { URL.revokeObjectURL(objectURLRef.current); objectURLRef.current = null; } };
  }, [imageId]);

  if (loading) return <div className="image-loader text-center p-3"><Spinner animation="border" size="sm" variant="secondary"/></div>;
  if (error || !src) return <div className="image-error text-muted small text-center p-2"><AlertTriangle size={18} className="text-danger me-1"/>(Image unavailable)</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="image-wrapper">
      <a href={src} target="_blank" rel="noopener noreferrer" title={`View full image: ${alt || 'Submission Image'}`}>
        <Image src={src} alt={alt || 'Submission Image'} rounded fluid className="submission-image" />
      </a>
    </motion.div>
  );
}
ImageLoader.propTypes = { imageId: PropTypes.string, alt: PropTypes.string };

// --- Main Component ---
export default function ApplicationFullDetails() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Removed actionInProgress state as actions are not performed on this page anymore

  // Fetch the specific submission on mount
  useEffect(() => {
    let isMounted = true;
    if (!submissionId) { setError("Submission ID is missing from URL."); setLoading(false); return; }
    (async () => {
      setLoading(true); setError(null);
      try {
        // Fetch submission, ensure fileRefs are included (they are by default unless excluded)
        const { data } = await axiosInstance.get(`/api/application/submissions/${submissionId}`);
        if (isMounted) setSubmission(data);
      } catch (err) { console.error("Error fetching submission:", err); if (isMounted) setError(err.response?.data?.error || 'Failed to load submission details.'); }
      finally { if (isMounted) setLoading(false); }
    })();
    return () => { isMounted = false; };
  }, [submissionId]);

  // Helper for date formatting
  const formatDate = (dateString) => {
      const date = dateString ? parseISO(dateString) : null;
      return date && isValid(date) ? format(date, 'MMM d, yyyy, h:mm a') : 'N/A';
  }

  // --- Render Logic ---
  if (loading) { /* ... loading state ... */
    return ( <Container fluid className="d-flex flex-column justify-content-center align-items-center page-loading-container"> <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} /> <p className="mt-3 text-muted fs-5">Loading Application Details...</p> </Container> );
  }
  if (error) { /* ... error state ... */
    return ( <Container fluid className="p-4 page-error-container"> <Alert variant="danger" className="text-center shadow-sm"> <Alert.Heading><XCircle size={24} className="me-2"/> Error Loading Application</Alert.Heading> <p>{error}</p> <hr /> <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)}> <ArrowLeft size={16} className="me-1" /> Go Back </Button> </Alert> </Container> );
  }
  if (!submission) { /* ... no data state ... */
      return ( <Container fluid className="p-4 page-error-container"> <Alert variant="warning" className="text-center shadow-sm">Application data not found.</Alert> </Container> );
  }

  // Destructure after checks
  const { user, amount, fields, created_at, updated_at, stage, loan, requiredDocumentRefs, history } = submission;

  // Combine fields for display
   const allFieldsToDisplay = [
      { field_id: '_applicant', field_label: 'Applicant Name', value: submission.user_id?.name || 'N/A', type: 'text', icon: User },
      { field_id: '_account', field_label: 'Account #', value: submission.user_id?.account_number || 'N/A', type: 'text', icon: Hash },
      { field_id: '_amount', field_label: 'Amount Requested', value: `₹${amount?.toLocaleString('en-IN') || 'N/A'}`, type: 'currency', icon: DollarSign },
      { field_id: '_stage', field_label: 'Current Stage', value: STAGE_LABELS[stage] || stage, type: 'stage', stage: stage, icon: FileText },
      { field_id: '_submitted', field_label: 'Submitted On', value: formatDate(created_at), type: 'datetime', icon: Calendar },
      { field_id: '_updated', field_label: 'Last Updated', value: formatDate(updated_at), type: 'datetime', icon: Clock },
      ...(fields || []),
      ...(requiredDocumentRefs || []).map(docRef => ({
          field_id: `reqDoc_${docRef.documentName}`, field_label: docRef.documentName,
          value: null, // Value is not relevant here, only fileRef
          type: 'image', // Mark as document type
          fileRef: docRef.fileRef // Pass the fileRef
      }))
  ];

  return (
    <Container fluid className="p-3 p-md-4 application-full-details-page-v2"> {/* Use versioned class */}
        {/* Header Row */}
        <Row className="mb-4 align-items-center page-header">
            <Col xs="auto"> <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)} className="back-button d-inline-flex align-items-center"> <ArrowLeft size={16} className="me-1" /> Back </Button> </Col>
            <Col>
                <h1 className="h4 mb-0 text-dark fw-bold"> Application Details </h1>
                {loan?.title && <span className="text-muted d-block small">For Loan: {loan.title} (ID: {submission._id})</span>}
            </Col>
             {/* Display API errors if any occurred during load */}
             {error && submission && ( <Col xs={12} className="mt-2"> <Alert variant="danger" size="sm" onClose={() => setError(null)} dismissible className="action-error-alert"> {error} </Alert> </Col> )}
        </Row>

        <Row className="g-4">
            {/* Left Column: Overview & History */}
            <Col lg={5} xl={4}>
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
                    <Card className="shadow-sm mb-4 overview-details-card">
                        <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                            <span className="fw-medium">Overview</span>
                            <Badge pill bg={stageVariants[stage] || 'light'} text={stageTextEmphasis[stage] || 'dark'} className="stage-badge-header">
                                {getStatusIcon(stage)} {STAGE_LABELS[stage] || stage}
                            </Badge>
                        </Card.Header>
                        {/* Use simpler ListGroup for overview */}
                        <ListGroup variant="flush">
                            <ListGroup.Item className="py-2 px-3"><User size={14} className="me-2 text-secondary"/><strong>Applicant:</strong> {submission.user_id?.name || 'N/A'}</ListGroup.Item>
                            <ListGroup.Item className="py-2 px-3"><Hash size={14} className="me-2 text-secondary"/><strong>Account #:</strong> {submission.user_id?.account_number || 'N/A'}</ListGroup.Item>
                            <ListGroup.Item className="py-2 px-3"><DollarSign size={14} className="me-2 text-secondary"/><strong>Amount:</strong> ₹{amount?.toLocaleString('en-IN') || 'N/A'}</ListGroup.Item>
                            <ListGroup.Item className="py-2 px-3"><Calendar size={14} className="me-2 text-secondary"/><strong>Submitted:</strong> {formatDate(created_at)}</ListGroup.Item>
                            <ListGroup.Item className="py-2 px-3"><Clock size={14} className="me-2 text-secondary"/><strong>Updated:</strong> {formatDate(updated_at)}</ListGroup.Item>
                        </ListGroup>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                     <Card className="shadow-sm mb-4 history-card">
                        <Card.Header className="bg-light"><History size={16} className="me-2 text-secondary"/>Status History</Card.Header>
                        <Card.Body className="p-3">
                             {(!history || history.length <= 1) && <p className="text-muted small mb-0 text-center">No status changes yet.</p>}
                             {history && history.length > 1 && (
                                <ListGroup variant="flush" className="history-list small">
                                    {[...history].sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at))
                                        .map((entry, index) => (
                                        <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center px-0 py-1 history-item">
                                            <span>
                                                {getStatusIcon(entry.stage)}
                                                <Badge bg={stageVariants[entry.stage] || 'light'} text={stageTextEmphasis[entry.stage] || 'dark'} className="me-2 history-badge">
                                                    {STAGE_LABELS[entry.stage] || entry.stage}
                                                </Badge>
                                            </span>
                                            <span className="text-muted">{moment(entry.changed_at).fromNow()}</span>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                             )}
                        </Card.Body>
                    </Card>
                </motion.div>
            </Col>

            {/* Right Column: Fields & Documents Table */}
            <Col lg={7} xl={8}>
                 <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
                    <Card className="mb-4 shadow-sm fields-card">
                        <Card.Header className="bg-light"><ListChecks size={16} className="me-2 text-secondary"/>Submitted Information & Documents</Card.Header>
                        <Card.Body className="p-0">
                            <div className="table-responsive">
                                <Table hover className="response-table align-middle mb-0">
                                    <thead className="table-light visually-hidden">
                                        <tr><th>Field / Document</th><th>Value / Action</th></tr>
                                    </thead>
                                    <tbody>
                                        {allFieldsToDisplay.length > 0 ? allFieldsToDisplay.map((f) => (
                                            <tr key={f.field_id}>
                                                {/* Label Column */}
                                                <td className="fw-medium response-label" style={{ width: '40%' }}>
                                                    {/* Add icon if defined in the merged array */}
                                                    {f.icon && React.createElement(f.icon, { size: 14, className: "me-2 text-secondary" })}
                                                    {f.field_label || <span className="text-muted fst-italic">N/A</span>}
                                                </td>
                                                {/* Value/Action Column */}
                                                <td>
                                                    {f.type === 'image' ? ( <ImageLoader imageId={f.fileRef} alt={f.field_label} /> ) // Use fileRef directly
                                                    : f.type === 'document' ? ( f.fileRef ? <a href={`/api/image/${f.fileRef}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center">View Document <FileText size={14} className="ms-1"/></a> : <span className="text-muted fst-italic">No document</span> )
                                                    : f.type === 'checkbox' ? ( f.value ? <Badge bg="success-subtle" text="success-emphasis">Yes</Badge> : <Badge bg="secondary-subtle" text="secondary-emphasis">No</Badge> )
                                                    : f.type === 'stage' ? ( <Badge pill bg={stageVariants[f.stage] || 'light'} text={stageTextEmphasis[f.stage] || 'dark'} className="stage-badge-table"> {getStatusIcon(f.stage)} {f.value} </Badge> )
                                                    : ( <span className="field-value">{f.value ?? <span className="text-muted fst-italic">N/A</span>}</span> )}
                                                </td>
                                            </tr>
                                        )) : ( <tr><td colSpan={2} className="text-center text-muted p-4">No information submitted.</td></tr> )}
                                    </tbody>
                                </Table>
                            </div>
                        </Card.Body>
                         {/* Action Buttons Footer (Removed as per previous step - only view) */}
                         {/* Add back if needed */}
                    </Card>
                </motion.div>
            </Col>
        </Row>
    </Container>
  );
}