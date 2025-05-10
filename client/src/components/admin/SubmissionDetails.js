// src/pages/SubmissionDetails.jsx (or appropriate path)

import React, { useState, useEffect, useRef } from 'react'; 
import { useParams, useNavigate, Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { axiosInstance } from '../../config'; // Assuming this is your client/src/config
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
  ButtonGroup,
  Modal, 
  Form 
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
  RotateCcw,
  AlertTriangle, 
  Image as ImageIcon,
  Send // Icon for "Paid to Applicant"
} from 'lucide-react'; 
import { motion } from 'framer-motion';
import { format, parseISO, isValid } from 'date-fns';
import './SubmissionDetails.css'; // Import custom styles

// Stage definitions - ADDED 'paid_to_applicant'
const STAGE_LABELS = {
  draft: 'Draft',
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  paid_to_applicant: 'Paid to Applicant' 
};
const stageVariants = {
    draft: 'secondary-subtle',
    pending: 'warning-subtle',
    approved: 'success-subtle',
    rejected: 'danger-subtle',
    paid_to_applicant: 'primary-subtle' 
};
const stageTextEmphasis = {
    draft: 'secondary-emphasis',
    pending: 'warning-emphasis',
    approved: 'success-emphasis',
    rejected: 'danger-emphasis',
    paid_to_applicant: 'primary-emphasis' 
};

// Icon mapping for stages - ADDED 'paid_to_applicant'
const getStatusIcon = (stage) => {
    switch (stage) {
        case 'approved': return <CheckCircle size={16} className="me-1 text-success" />;
        case 'rejected': return <XCircle size={16} className="me-1 text-danger" />;
        case 'pending': return <Clock size={16} className="me-1 text-warning" />;
        case 'draft': return <FileText size={16} className="me-1 text-secondary"/>;
        case 'paid_to_applicant': return <Send size={16} className="me-1 text-primary"/>; 
        default: return <FileText size={16} className="me-1 text-muted"/>; // Default icon
    }
};

// --- Image Loader Component (remains the same) ---
function ImageLoader({ imageId, alt }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const objectURLRef = useRef(null); 

  useEffect(() => {
    let isMounted = true;
    setLoading(true); setError(false); setSrc(null);

    if (objectURLRef.current) {
        URL.revokeObjectURL(objectURLRef.current);
        objectURLRef.current = null;
    }

    if (!imageId || typeof imageId !== 'string' || imageId.length < 10) {
        console.warn("Invalid imageId provided to ImageLoader:", imageId);
        setError(true); setLoading(false); return;
    }

    let requestTimeout = setTimeout(() => { 
        if (isMounted && loading) {
            console.warn(`Image load timeout for ${imageId}`);
            setError(true); 
            setLoading(false);
        }
    }, 15000); 

    (async () => {
      try {
        const res = await axiosInstance.get(`/api/image/${imageId}`, { responseType: 'blob' });
        clearTimeout(requestTimeout); 
        if (!isMounted) return;
        const newObjectURL = URL.createObjectURL(res.data);
        objectURLRef.current = newObjectURL;
        setSrc(newObjectURL);
      } catch (err) {
        clearTimeout(requestTimeout); 
        console.error('Failed to load image', imageId, err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      clearTimeout(requestTimeout); 
      if (objectURLRef.current) {
          URL.revokeObjectURL(objectURLRef.current);
          objectURLRef.current = null;
      }
    };
  }, [imageId]); 

  if (loading) return (
      <div className="image-placeholder image-loading text-center p-3">
          <Spinner animation="border" size="sm" variant="secondary"/>
          <span className="d-block small text-muted mt-1">Loading...</span>
      </div>
  );
  if (error || !src) return (
      <div className="image-placeholder image-error text-center p-2">
          <AlertTriangle size={24} className="text-danger mb-1"/>
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
ImageLoader.propTypes = { imageId: PropTypes.string, alt: PropTypes.string };

// --- Main Component ---
export default function SubmissionDetails() {
  const { id } = useParams(); // This is submissionId
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [error, setError] = useState(null);
  const [apiActionError, setApiActionError] = useState(null); 
  const targetStageRef = useRef(null); // Initialize targetStageRef

  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');


  useEffect(() => {
    let isMounted = true;
    const fetchSubmission = async () => { 
      setLoading(true); setError(null); setApiActionError(null);
      try {
        const { data } = await axiosInstance.get(`/api/application/submissions/${id}`); 
        if (isMounted) setSubmission(data);
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
    if (!targetStage || actionInProgress || submission?.stage === 'paid_to_applicant') { 
        if (submission?.stage === 'paid_to_applicant') {
            setApiActionError("Action not allowed: Loan has already been paid to applicant.");
        }
        return;
    }
    targetStageRef.current = targetStage; // Set the target stage for spinner logic
    setActionInProgress(true); 
    setApiActionError(null);
    console.log(`Attempting to change stage to: ${targetStage} ${reason ? `with reason: ${reason}` : ''}`);
    try {
      const payload = { stage: targetStage };
      if (targetStage === 'rejected' && reason) { 
        payload.rejection_reason = reason; 
      }
      
      const { data } = await axiosInstance.patch(`/api/application/submissions/${id}/change-stage`, payload); 
      setSubmission(data); 
      console.log(`Stage changed successfully to: ${targetStage}`);
      if (targetStage === 'rejected') handleCloseRejectionModal(); 
    } catch (err) { 
        console.error(`Error changing stage to ${targetStage}:`, err); 
        setApiActionError(err.response?.data?.error || `Failed to change stage.`); 
    }
    finally { 
        setActionInProgress(false); 
        targetStageRef.current = null; // Reset after action
    }
  };

  const handleRejectSubmit = () => {
    handleChangeStage('rejected', rejectionReason.trim() || null); 
  };


  const currentStage = submission?.stage;
  const canApprove = currentStage === 'pending';
  const canReject = currentStage === 'pending';
  const canMarkAsPaid = currentStage === 'approved'; 
  const canRevert = (currentStage === 'approved' || currentStage === 'rejected'); 


  const formatDateDisplay = (dateString) => { 
      const date = dateString ? parseISO(dateString) : null;
      return date && isValid(date) ? format(date, 'MMM d, yyyy, h:mm a') : 'N/A'; 
  }

  if (loading) { 
    return ( <Container fluid className="d-flex flex-column justify-content-center align-items-center page-loading-container"> <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} /> <p className="mt-3 text-muted fs-5">Loading Submission Details...</p> </Container> );
  }
  if (error && !submission) { 
    return ( <Container fluid className="p-4 page-error-container"> <Alert variant="danger" className="text-center shadow-sm"> <Alert.Heading><XCircle size={24} className="me-2"/> Error Loading Submission</Alert.Heading> <p>{error}</p> <hr /> <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)}> <ArrowLeft size={16} className="me-1" /> Go Back </Button> </Alert> </Container> );
  }
  if (!submission) { 
      return ( <Container fluid className="p-4 page-error-container"> <Alert variant="warning" className="text-center shadow-sm">No submission data found or ID is invalid.</Alert> </Container> );
  }

  const { user_id, amount, fields, created_at, updated_at, stage, loan, requiredDocumentRefs, rejection_reason: currentRejectionReasonFromDB } = submission;


   const allFieldsToDisplay = [
      { field_id: '_applicant', field_label: 'Applicant Name', value: user_id?.name || 'N/A', type: 'text', icon: User },
      { field_id: '_applicant_email', field_label: 'Applicant Email', value: user_id?.email || 'N/A', type: 'text', icon: User },
      { field_id: '_account', field_label: 'Account #', value: user_id?.account_number || 'N/A', type: 'text', icon: Hash },
      { field_id: '_amount', field_label: 'Amount Requested', value: `₹${amount?.toLocaleString('en-IN') || 'N/A'}`, type: 'currency', icon: DollarSign },
      { field_id: '_stage_info', field_label: 'Current Stage', value: STAGE_LABELS[stage] || stage, type: 'stage', stage: stage, icon: FileText }, 
      { field_id: '_submitted', field_label: 'Submitted On', value: formatDateDisplay(created_at), type: 'datetime', icon: Calendar },
      { field_id: '_updated', field_label: 'Last Updated', value: formatDateDisplay(updated_at), type: 'datetime', icon: Clock },
      ...(fields || []),
      ...(requiredDocumentRefs || []).map(docRef => ({
          field_id: `reqDoc_${docRef.documentName.replace(/\s+/g, '_')}`, 
          field_label: docRef.documentName,
          value: docRef.fileRef, type: 'image', fileRef: docRef.fileRef 
      }))
  ];
  if (stage === 'rejected' && currentRejectionReasonFromDB) {
    allFieldsToDisplay.splice(5, 0, { 
        field_id: '_rejection_reason',
        field_label: 'Rejection Reason',
        value: currentRejectionReasonFromDB,
        type: 'text',
        icon: AlertTriangle
    });
  }


  return (
    <Container fluid className="p-3 p-md-4 submission-details-page-v2">
        <Row className="mb-4 align-items-center page-header">
            <Col xs="auto"> <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)} className="back-button d-inline-flex align-items-center"> <ArrowLeft size={16} className="me-1" /> Back </Button> </Col>
            <Col>
                <h1 className="h4 mb-0 text-dark fw-bold"> Submission Details </h1>
                {loan?.title && <span className="text-muted d-block small">For Loan: {loan.title} (ID: {loan._id})</span>}
            </Col>
             {apiActionError && submission && ( <Col xs={12} className="mt-2"> <Alert variant="danger" size="sm" onClose={() => setApiActionError(null)} dismissible className="action-error-alert"> {apiActionError} </Alert> </Col> )}
        </Row>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="mb-4 shadow-sm details-card">
                <Card.Header as="h5" className="card-header-title d-flex justify-content-between align-items-center">
                    <span>Applicant Information & Status</span>
                     <Badge pill bg={stageVariants[stage] || 'light'} text={stageTextEmphasis[stage] || 'dark'} className="stage-badge-header fs-6 px-3 py-2">
                        {getStatusIcon(stage)} {STAGE_LABELS[stage] || stage}
                    </Badge>
                </Card.Header>
                <Card.Body>
                    <div className="table-responsive">
                        <Table borderless hover className="details-table mb-0">
                            <tbody>
                                {allFieldsToDisplay.map((f) => (
                                    <tr key={f.field_id}>
                                        <th style={{ width: '30%' }}>
                                            {f.icon && React.createElement(f.icon, { size: 14, className: "me-2 text-secondary" })}
                                            {f.field_label}
                                        </th>
                                        <td>
                                            {f.type === 'image' ? ( <ImageLoader imageId={f.fileRef || f.value} alt={f.field_label} /> )
                                            : f.type === 'document' ? ( (f.fileRef || f.value) ? <a href={`/api/image/${f.fileRef || f.value}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center">View Document <FileText size={14} className="ms-1"/></a> : <span className="text-muted fst-italic">No document</span> )
                                            : f.type === 'checkbox' ? ( f.value ? <Badge bg="success-subtle" text="success-emphasis">Yes</Badge> : <Badge bg="secondary-subtle" text="secondary-emphasis">No</Badge> )
                                            : f.type === 'stage' ? ( 
                                                 <Badge pill bg={stageVariants[f.stage] || 'light'} text={stageTextEmphasis[f.stage] || 'dark'} className="stage-badge-table"> {getStatusIcon(f.stage)} {f.value} </Badge>
                                            ) : ( <span className="field-value">{f.value ?? <span className="text-muted fst-italic">N/A</span>}</span> )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                </Card.Body>
                 {(canApprove || canReject || canRevert || canMarkAsPaid) && submission?.stage !== 'paid_to_applicant' && (
                    <Card.Footer className="text-end bg-light action-footer">
                         <ButtonGroup size="sm">
                            {canRevert && ( <Button onClick={() => handleChangeStage('pending')} disabled={actionInProgress} variant="outline-secondary" className="action-button d-inline-flex align-items-center"> {actionInProgress && targetStageRef.current === 'pending' ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <RotateCcw size={16} className="me-1"/>} Revert to Pending </Button> )}
                            {canReject && ( <Button onClick={handleShowRejectionModal} disabled={actionInProgress} variant="outline-danger" className="action-button d-inline-flex align-items-center"> {actionInProgress && targetStageRef.current === 'rejected' ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <XCircle size={16} className="me-1"/>} Reject </Button> )}
                            {canApprove && ( <Button onClick={() => handleChangeStage('approved')} disabled={actionInProgress} variant="success" className="action-button d-inline-flex align-items-center"> {actionInProgress && targetStageRef.current === 'approved' ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <CheckCircle size={16} className="me-1"/>} Approve </Button> )}
                            {canMarkAsPaid && ( <Button onClick={() => handleChangeStage('paid_to_applicant')} disabled={actionInProgress} variant="primary" className="action-button d-inline-flex align-items-center"> {actionInProgress && targetStageRef.current === 'paid_to_applicant' ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <Send size={16} className="me-1"/>} Mark as Paid </Button> )}
                         </ButtonGroup>
                    </Card.Footer>
                 )}
                 {submission?.stage === 'paid_to_applicant' && (
                    <Card.Footer className="text-center bg-light-subtle">
                        <Alert variant="info" className="mb-0 small">
                            <Send size={16} className="me-1"/> This loan has been marked as paid to the applicant. No further stage changes are permitted for this submission.
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
