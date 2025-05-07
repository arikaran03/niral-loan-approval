// src/pages/SubmissionDetails.jsx (or appropriate path)

import React, { useState, useEffect, useRef } from 'react'; // Removed unused useCallback
import { useParams, useNavigate, Link } from 'react-router-dom';
import PropTypes from 'prop-types';
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
  ButtonGroup
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
  AlertTriangle, // Icon for image error
  Image as ImageIcon // Icon for image placeholder
} from 'lucide-react'; // Using Lucide icons consistently
import { motion } from 'framer-motion';
import { format, parseISO, isValid } from 'date-fns';
import './SubmissionDetails.css'; // Import custom styles

// Stage definitions
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

// Icon mapping for stages
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
  const objectURLRef = useRef(null); // Ref to store the object URL for cleanup

  useEffect(() => {
    let isMounted = true;
    setLoading(true); setError(false); setSrc(null);

    // Clean up previous object URL if exists
    if (objectURLRef.current) {
        URL.revokeObjectURL(objectURLRef.current);
        objectURLRef.current = null;
    }

    if (!imageId || typeof imageId !== 'string' || imageId.length < 10) {
        console.warn("Invalid imageId provided to ImageLoader:", imageId);
        setError(true); setLoading(false); return;
    }

    let requestTimeout = setTimeout(() => { // Add a timeout for slow loads
        if (isMounted && loading) {
            console.warn(`Image load timeout for ${imageId}`);
            setError(true); // Mark as error if loading takes too long (e.g., > 15 seconds)
            setLoading(false);
        }
    }, 15000); // 15 second timeout

    (async () => {
      try {
        const res = await axiosInstance.get(`/api/image/${imageId}`, { responseType: 'blob' });
        clearTimeout(requestTimeout); // Clear timeout on successful fetch start
        if (!isMounted) return;
        const newObjectURL = URL.createObjectURL(res.data);
        objectURLRef.current = newObjectURL;
        setSrc(newObjectURL);
      } catch (err) {
        clearTimeout(requestTimeout); // Clear timeout on error
        console.error('Failed to load image', imageId, err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    // Cleanup function
    return () => {
      isMounted = false;
      clearTimeout(requestTimeout); // Clear timeout on unmount
      if (objectURLRef.current) {
          URL.revokeObjectURL(objectURLRef.current);
          objectURLRef.current = null;
      }
    };
  }, [imageId]); // Dependency array

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
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
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
    setActionInProgress(true); setError(null);
    console.log(`Attempting to change stage to: ${targetStage}`);
    try {
      const payload = { stage: targetStage };
      // if (targetStage === 'rejected') { payload.rejection_reason = prompt("Enter rejection reason (optional):"); } // Example prompt
      const { data } = await axiosInstance.patch(`/api/application/submissions/${id}/change-stage`, payload);
      setSubmission(data);
      console.log(`Stage changed successfully to: ${targetStage}`);
    } catch (err) { console.error(`Error changing stage to ${targetStage}:`, err); setError(err.response?.data?.error || `Failed to change stage.`); }
    finally { setActionInProgress(false); }
  };

  // Determine available actions based on current stage
  const currentStage = submission?.stage;
  const canApprove = currentStage === 'pending';
  const canReject = currentStage === 'pending';
  const canRevert = (currentStage === 'approved' || currentStage === 'rejected');

  // Helper for date formatting
  const formatDate = (dateString) => {
      const date = dateString ? parseISO(dateString) : null;
      return date && isValid(date) ? format(date, 'MMM d, yyyy, h:mm a') : 'N/A';
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
  const { user, amount, fields, created_at, updated_at, stage, loan, requiredDocumentRefs } = submission;


  // console.log(requiredDocumentRefs);
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
          value: docRef.fileRef, type: 'image', fileRef: docRef.fileRef
      }))
  ];

  return (
    <Container fluid className="p-3 p-md-4 submission-details-page-v2">
        {/* Header Row */}
        <Row className="mb-4 align-items-center page-header">
            <Col xs="auto"> <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)} className="back-button d-inline-flex align-items-center"> <ArrowLeft size={16} className="me-1" /> Back </Button> </Col>
            <Col>
                <h1 className="h4 mb-0 text-dark fw-bold"> Submission Details </h1>
                {loan?.title && <span className="text-muted d-block small">For Loan: {loan.title} (ID: {loan._id})</span>}
            </Col>
             {/* Display API errors related to actions */}
             {error && submission && ( <Col xs={12} className="mt-2"> <Alert variant="danger" size="sm" onClose={() => setError(null)} dismissible className="action-error-alert"> {error} </Alert> </Col> )}
        </Row>

        {/* Main Content Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="mb-4 shadow-sm details-card">
                <Card.Header as="h5" className="card-header-title d-flex justify-content-between align-items-center">
                    <span>Applicant Information & Status</span>
                     <Badge pill bg={stageVariants[stage] || 'light'} text={stageTextEmphasis[stage] || 'dark'} className="stage-badge-header">
                        {getStatusIcon(stage)} {STAGE_LABELS[stage] || stage}
                    </Badge>
                </Card.Header>
                <Card.Body>
                    {/* Using Table for Key-Value Display */}
                    <div className="table-responsive">
                        <Table borderless hover className="details-table mb-0">
                            <tbody>
                                {allFieldsToDisplay.map((f) => (
                                    <tr key={f.field_id}>
                                        {/* Label Column */}
                                        <th style={{ width: '30%' }}>
                                            {/* Optionally add icon from field definition */}
                                            {f.icon && React.createElement(f.icon, { size: 14, className: "me-2 text-secondary" })}
                                            {f.field_label}
                                        </th>
                                        {/* Value Column */}
                                        <td>
                                            {f.type === 'image' ? ( <ImageLoader imageId={f.fileRef || f.value} alt={f.field_label} /> )
                                            : f.type === 'document' ? ( (f.fileRef || f.value) ? <a href={`/api/image/${f.fileRef || f.value}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center">View Document <FileText size={14} className="ms-1"/></a> : <span className="text-muted fst-italic">No document</span> )
                                            : f.type === 'checkbox' ? ( f.value ? <Badge bg="success-subtle" text="success-emphasis">Yes</Badge> : <Badge bg="secondary-subtle" text="secondary-emphasis">No</Badge> )
                                            : f.type === 'stage' ? ( // Special handling for stage row (already shown in header/footer) - could be omitted or styled differently
                                                 <Badge pill bg={stageVariants[f.stage] || 'light'} text={stageTextEmphasis[f.stage] || 'dark'} className="stage-badge-table"> {getStatusIcon(f.stage)} {f.value} </Badge>
                                            ) : ( <span className="field-value">{f.value ?? <span className="text-muted fst-italic">N/A</span>}</span> )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                </Card.Body>
                 {/* Action Buttons Footer */}
                 {(canApprove || canReject || canRevert) && (
                    <Card.Footer className="text-end bg-light action-footer">
                         <ButtonGroup size="sm">
                            {canRevert && ( <Button onClick={() => handleChangeStage('pending')} disabled={actionInProgress} variant="outline-secondary" className="action-button d-inline-flex align-items-center"> {actionInProgress ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <RotateCcw size={16} className="me-1"/>} Revert to Pending </Button> )}
                            {canReject && ( <Button onClick={() => handleChangeStage('rejected')} disabled={actionInProgress} variant="outline-danger" className="action-button d-inline-flex align-items-center"> {actionInProgress ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <XCircle size={16} className="me-1"/>} Reject </Button> )}
                            {canApprove && ( <Button onClick={() => handleChangeStage('approved')} disabled={actionInProgress} variant="success" className="action-button d-inline-flex align-items-center"> {actionInProgress ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <CheckCircle size={16} className="me-1"/>} Approve </Button> )}
                         </ButtonGroup>
                    </Card.Footer>
                 )}
            </Card>
        </motion.div>
    </Container>
  );
}