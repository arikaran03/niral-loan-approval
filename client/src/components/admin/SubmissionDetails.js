// src/pages/SubmissionDetails.jsx (or appropriate path)

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PropTypes from 'prop-types'; // Import PropTypes
import { axiosInstance } from '../../config';
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
  ButtonGroup // Added for action buttons
} from 'react-bootstrap';
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  User,
  Hash,
  DollarSign,
  Calendar,
  RotateCcw // Icon for Revert
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, parseISO, isValid } from 'date-fns';
import './SubmissionDetails.css'; // Import custom styles

// Stage definitions
// Removed 'draft' from admin workflow order
const ADMIN_STAGE_WORKFLOW = ['pending', 'approved', 'rejected'];
const STAGE_LABELS = {
  draft: 'Draft', // Keep label for display
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

// Icon mapping for stages
const getStatusIcon = (stage) => {
    // Added me-1 for margin
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

  useEffect(() => {
    let isMounted = true;
    setLoading(true); setError(false); setSrc(null);
    if (!imageId) { setError(true); setLoading(false); return; }

    (async () => {
      try {
        const res = await axiosInstance.get(`/api/image/${imageId}`, { responseType: 'blob' });
        if (!isMounted) return;
        const objectURL = URL.createObjectURL(res.data);
        setSrc(objectURL);
        // Consider revoking URL on cleanup if memory becomes an issue, but be careful with state updates
        // return () => URL.revokeObjectURL(objectURL);
      } catch (err) { console.error('Failed to load image', imageId, err); if (isMounted) setError(true); }
      finally { if (isMounted) setLoading(false); }
    })();
    return () => { isMounted = false; };
  }, [imageId]);

  if (loading) return <div className="image-loader text-center p-3"><Spinner animation="border" size="sm" /></div>;
  if (error || !src) return <div className="image-error text-muted small text-center p-2">(Image not available)</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="image-wrapper">
      <Image src={src} alt={alt} rounded fluid className="submission-image" />
    </motion.div>
  );
}
// Define PropTypes for ImageLoader
ImageLoader.propTypes = {
  imageId: PropTypes.string, // Can be null or string
  alt: PropTypes.string
};

// --- Main Component ---
export default function SubmissionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false); // Combined state for actions
  const [error, setError] = useState(null);

  // Fetch the submission on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data } = await axiosInstance.get(`/api/application/submissions/${id}`);
        if (isMounted) setSubmission(data);
      } catch (err) { console.error("Error fetching submission:", err); if (isMounted) setError(err.response?.data?.error || 'Failed to load submission details.'); }
      finally { if (isMounted) setLoading(false); }
    })();
    return () => { isMounted = false; };
  }, [id]);

  // --- Stage Change Logic ---
  const handleChangeStage = async (targetStage) => {
    if (!targetStage || actionInProgress) return;
    setActionInProgress(true);
    setError(null); // Clear previous errors
    console.log(`Attempting to change stage to: ${targetStage}`);
    try {
      const { data } = await axiosInstance.patch(
        `/api/application/submissions/${id}/change-stage`,
        { stage: targetStage } // Send the target stage name
      );
      setSubmission(data); // Update local state with the response
      console.log(`Stage changed successfully to: ${targetStage}`);
    } catch (err) {
      console.error(`Error changing stage to ${targetStage}:`, err);
      setError(err.response?.data?.error || `Failed to change stage to ${STAGE_LABELS[targetStage] || targetStage}.`); // Set error state
    } finally {
      setActionInProgress(false);
    }
  };

  // Determine available actions based on current stage
  const currentStage = submission?.stage;
  const canApprove = currentStage === 'pending';
  const canReject = currentStage === 'pending';
  // Allow reverting from approved/rejected back to pending, but not from draft
  const canRevert = (currentStage === 'approved' || currentStage === 'rejected');


  // Helper for date formatting
  const formatDate = (dateString) => {
      const date = dateString ? parseISO(dateString) : null;
      return date && isValid(date) ? format(date, 'MMM d, yyyy, h:mm a') : 'N/A'; // Adjusted format slightly
  }

  // --- Render Logic ---
  if (loading) { /* ... loading state ... */
    return ( <Container fluid className="d-flex flex-column justify-content-center align-items-center page-loading-container"> <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} /> <p className="mt-3 text-muted fs-5">Loading Submission Details...</p> </Container> );
  }
  if (error && !submission) { /* ... error state ... */
    return ( <Container fluid className="p-4 page-error-container"> <Alert variant="danger" className="text-center shadow-sm"> <Alert.Heading><XCircle size={24} className="me-2"/> Error Loading Submission</Alert.Heading> <p>{error}</p> <hr /> <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)}> <ArrowLeft size={16} className="me-1" /> Go Back </Button> </Alert> </Container> );
  }
  if (!submission) { /* ... no data state ... */
      return ( <Container fluid className="p-4 page-error-container"> <Alert variant="warning" className="text-center shadow-sm">No submission data found.</Alert> </Container> );
  }

  // Destructure after checks
  const { user, amount, fields, created_at, updated_at, stage, loan } = submission;

  return (
    <Container fluid className="p-3 p-md-4 submission-details-page">
        {/* Header Row */}
        <Row className="mb-4 align-items-center page-header">
            <Col xs="auto"> <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)} className="back-button d-inline-flex align-items-center"> <ArrowLeft size={16} className="me-1" /> Back </Button> </Col>
            <Col>
                <h1 className="h4 mb-0 text-dark fw-bold"> Submission Details </h1>
                {loan?.title && <span className="text-muted d-block small">For Loan: {loan.title} (ID: {loan._id})</span>}
            </Col>
             {/* Display API errors related to actions */}
             {error && submission && ( <Col xs={12} className="mt-2"> <Alert variant="danger" size="sm" onClose={() => setError(null)} dismissible> {error} </Alert> </Col> )}
        </Row>

        {/* Overview Card */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="mb-4 shadow-sm overview-card">
                <Card.Header className="bg-light">Submission Overview</Card.Header>
                <Card.Body> <Row>
                    <Col md={6} className="mb-3 mb-md-0"> <ListGroup variant="flush">
                        {/* Added me-2 to icons */}
                        <ListGroup.Item className="d-flex justify-content-between align-items-start px-0"> <div className="ms-2 me-auto"> <div className="fw-bold"><User size={14} className="me-2 text-secondary"/>Applicant</div> {user?.name || <span className="text-muted fst-italic">N/A</span>} </div> </ListGroup.Item>
                        <ListGroup.Item className="d-flex justify-content-between align-items-start px-0"> <div className="ms-2 me-auto"> <div className="fw-bold"><Hash size={14} className="me-2 text-secondary"/>Account #</div> {user?.account_number || <span className="text-muted fst-italic">N/A</span>} </div> </ListGroup.Item>
                        <ListGroup.Item className="d-flex justify-content-between align-items-start px-0"> <div className="ms-2 me-auto"> <div className="fw-bold"><DollarSign size={14} className="me-2 text-secondary"/>Amount Requested</div> ₹{amount?.toLocaleString('en-IN') || <span className="text-muted fst-italic">N/A</span>} </div> </ListGroup.Item>
                    </ListGroup> </Col>
                    <Col md={6}> <ListGroup variant="flush">
                        {/* Added me-2 to icons */}
                        <ListGroup.Item className="d-flex justify-content-between align-items-start px-0"> <div className="ms-2 me-auto"> <div className="fw-bold"><FileText size={14} className="me-2 text-secondary"/>Current Stage</div> <Badge bg={stageVariants[stage] || 'light'} text={stageTextEmphasis[stage] || 'dark'} className="stage-badge"> {getStatusIcon(stage)} {STAGE_LABELS[stage] || stage} </Badge> </div> </ListGroup.Item>
                        <ListGroup.Item className="d-flex justify-content-between align-items-start px-0"> <div className="ms-2 me-auto"> <div className="fw-bold"><Calendar size={14} className="me-2 text-secondary"/>Submitted</div> {formatDate(created_at)} </div> </ListGroup.Item>
                        <ListGroup.Item className="d-flex justify-content-between align-items-start px-0"> <div className="ms-2 me-auto"> <div className="fw-bold"><Clock size={14} className="me-2 text-secondary"/>Last Updated</div> {formatDate(updated_at)} </div> </ListGroup.Item>
                    </ListGroup> </Col>
                </Row> </Card.Body>
            </Card>
        </motion.div>

        {/* Field Responses Card */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Card className="mb-4 shadow-sm fields-card">
                <Card.Header className="bg-light">Field Responses</Card.Header>
                <Card.Body className="p-0"> <div className="table-responsive">
                    <Table hover className="response-table align-middle mb-0">
                        <thead className="table-light"> <tr> <th style={{ width: '35%' }}>Field Label</th> <th>Submitted Value</th> </tr> </thead>
                        <tbody>
                            {fields && fields.length > 0 ? fields.map((f) => (
                                <tr key={f.field_id}>
                                    <td className="fw-medium">{f.field_label || <span className="text-muted fst-italic">No Label</span>}</td>
                                    <td>
                                        {f.type === 'image' ? ( <ImageLoader imageId={f.value} alt={f.field_label} /> )
                                        : f.type === 'document' ? ( f.value ? <a href={`/api/document/${f.value}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center">View Document <FileText size={14} className="ms-1"/></a> : <span className="text-muted fst-italic">No document</span> ) // Added d-inline-flex
                                        : f.type === 'checkbox' ? ( f.value ? <Badge bg="success-subtle" text="success-emphasis">Yes</Badge> : <Badge bg="secondary-subtle" text="secondary-emphasis">No</Badge> )
                                        : ( <span className="field-value">{f.value || <span className="text-muted fst-italic">N/A</span>}</span> )}
                                    </td>
                                </tr>
                            )) : ( <tr><td colSpan={2} className="text-center text-muted p-4">No field responses available.</td></tr> )}
                        </tbody>
                    </Table>
                </div> </Card.Body>
            </Card>
        </motion.div>

        {/* Action Buttons - Conditional Rendering */}
        {(canApprove || canReject || canRevert) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.2 }} className="text-end mt-3 action-footer">
                 <ButtonGroup size="sm">
                    {canRevert && (
                         <Button onClick={() => handleChangeStage('pending')} disabled={actionInProgress} variant="outline-secondary" className="action-button d-inline-flex align-items-center">
                            {actionInProgress ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <RotateCcw size={16} className="me-1"/>} Revert to Pending
                        </Button>
                    )}
                     {canReject && (
                         <Button onClick={() => handleChangeStage('rejected')} disabled={actionInProgress} variant="outline-danger" className="action-button d-inline-flex align-items-center mr-2">
                            {actionInProgress ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <XCircle size={16} className="me-1"/>} Reject
                        </Button>
                    )}
                    {canApprove && (
                        <Button onClick={() => handleChangeStage('approved')} disabled={actionInProgress} variant="success" className="action-button d-inline-flex align-items-center">
                             {actionInProgress ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <CheckCircle size={16} className="me-1"/>} Approve
                        </Button>
                    )}
                 </ButtonGroup>
            </motion.div>
        )}
    </Container>
  );
}

