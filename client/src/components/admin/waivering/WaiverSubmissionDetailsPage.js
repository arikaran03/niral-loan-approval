import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { axiosInstance } from '../../../config.js'
import {
  Container, Card, Row, Col, Table, Image, Button, Spinner, Alert, Badge, ListGroup, ButtonGroup, Modal, Form
} from 'react-bootstrap';
import {
  ArrowLeft, FileText, XCircle, CheckCircle as CheckCircleIcon, Clock, User as UserIcon, Hash, 
  RotateCcw, ShieldCheck, Mail, Phone, Percent, Edit, Info, AlertTriangle, LucideAlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { parseISO, formatDistanceToNow } from 'date-fns';
import LiquidLoader from '../../super/LiquidLoader';

// --- CSS for Timeline ---
const TimelineStyles = () => (
    <style type="text/css">{`
        .timeline {
            position: relative;
            padding-left: 30px;
            border-left: 2px solid #e9ecef;
        }
        .timeline-item {
            position: relative;
            margin-bottom: 25px;
        }
        .timeline-item:last-child {
            margin-bottom: 0;
        }
        .timeline-icon {
            position: absolute;
            left: -42px;
            top: 0;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .timeline-icon.bg-success { background-color: #198754 !important; }
        .timeline-icon.bg-danger { background-color: #dc3545 !important; }
        .timeline-icon.bg-warning { background-color: #ffc107 !important; }
        .timeline-icon.bg-secondary { background-color: #6c757d !important; }
    `}</style>
);


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



// Stage definitions for Waivers
const STAGE_LABELS = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected'
};
const stageVariants = {
    draft: 'secondary-subtle',
    pending_review: 'warning-subtle',
    approved: 'success-subtle',
    rejected: 'danger-subtle',
};
const getStatusIcon = (stage) => {
    switch (stage) {
        case 'approved': return <CheckCircleIcon size={16} />;
        case 'rejected': return <XCircle size={16} />;
        case 'pending_review': return <Clock size={16} />;
        case 'draft': return <Edit size={16} />;
        default: return <Info size={16}/>;
    }
};

export default function WaiverSubmissionDetailsPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [error, setError] = useState(null);
  const [apiActionError, setApiActionError] = useState(null);

  // Modal States
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fetchSubmissionDetails = useCallback(async () => {
    // This function is now the single source of truth for data
    if (!isFinite) setLoading(true); // Don't show main loader on soft refresh
    setError(null);
    try {
      const { data } = await axiosInstance.get(`/api/waiver-submissions/${submissionId}`);
      setSubmission(data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load waiver submission details.');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    fetchSubmissionDetails();
  }, [fetchSubmissionDetails]);

  const handleChangeStage = async (targetStage, notes = '') => {
    if (actionInProgress) return;
    setActionInProgress(true);
    setApiActionError(null);
    try {
      const payload = { stage: targetStage, notes };
      await axiosInstance.patch(`/api/waiver-submissions/${submissionId}/stage`, payload);
      
      // FIX: Instead of setting state from response, refetch for fully populated data
      await fetchSubmissionDetails();

      if (targetStage === 'rejected') setShowRejectionModal(false);
      if (targetStage === 'approved') setShowConfirmModal(false);
    } catch (err) {
      setApiActionError(err.response?.data?.message || `Failed to change stage to ${targetStage}.`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleShowRejectionModal = () => {
    setRejectionNotes('');
    setApiActionError(null);
    setShowRejectionModal(true);
  };
  
  const handleRejectSubmit = () => handleChangeStage('rejected', rejectionNotes);
  const handleApproveSubmit = () => handleChangeStage('approved', 'Waiver application approved.');
  
  if (loading) return <LiquidLoader />;
  if (error) return ( <Container className="my-4"><Alert variant="danger" className="text-center"><h4>Error Loading Submission</h4><p>{error}</p></Alert></Container> );
  if (!submission) return ( <Container className="my-4"><Alert variant="info">Submission not found.</Alert></Container> );

  const currentStage = submission.stage;
  const isActionable = currentStage === 'pending_review';
  // FIX: Approval is final, only rejected can be reverted
  const canRevert = currentStage === 'rejected'; 

  return (
    <>
      <TimelineStyles />
      <Container fluid className="p-3 p-md-4">
        <Row className="mb-4 align-items-center page-header">
          <Col xs="auto"><Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)}><ArrowLeft size={16} className="me-1" /> Back</Button></Col>
          <Col><h1 className="h4 mb-0 text-dark fw-bold">Waiver Submission Details</h1></Col>
        </Row>
        
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <Row className="g-4">
                {/* Left Column: Overview & Actions */}
                <Col lg={4}>
                    <Card className="shadow-sm mb-4">
                      <Card.Header className="bg-light fw-bold d-flex justify-content-between align-items-center">
                        <span>Submission Status</span>
                        <Badge pill bg={stageVariants[currentStage].replace('-subtle', '')} text="white" className="fs-6 px-3 py-2">{getStatusIcon(currentStage)} {STAGE_LABELS[currentStage]}</Badge>
                      </Card.Header>
                      <Card.Body className="text-center">
                        {isActionable && (
                            <ButtonGroup className="d-flex">
                                <Button variant="success" onClick={() => setShowConfirmModal(true)} disabled={actionInProgress}><CheckCircleIcon size={16} className="me-1"/>Approve</Button>
                                <Button variant="danger" onClick={handleShowRejectionModal} disabled={actionInProgress}><XCircle size={16} className="me-1"/>Reject</Button>
                            </ButtonGroup>
                        )}
                        {canRevert && <Button variant="outline-secondary" className="mt-2 w-100" onClick={() => handleChangeStage('pending_review')} disabled={actionInProgress}><RotateCcw size={16} className="me-1"/>Revert to Pending</Button>}
                        {(currentStage === 'approved' || currentStage === 'rejected') && !canRevert && 
                            <Alert variant={currentStage === 'approved' ? 'success' : 'danger'} className="small mt-2 mb-0">
                                This submission has been <strong>{STAGE_LABELS[currentStage]}</strong>.
                                {currentStage === 'approved' && " The action is final."}
                            </Alert>
                        }
                      </Card.Body>
                    </Card>

                    <Card className="shadow-sm mb-4">
                      <Card.Header className="bg-light fw-bold"><UserIcon size={16} className="me-2"/>Applicant</Card.Header>
                      <ListGroup variant="flush">
                        <ListGroup.Item className="d-flex align-items-center"><UserIcon size={16} className="text-muted me-2"/>{submission.user_id.name}</ListGroup.Item>
                        <ListGroup.Item className="d-flex align-items-center"><Mail size={16} className="text-muted me-2"/>{submission.user_id.email}</ListGroup.Item>
                        <ListGroup.Item className="d-flex align-items-center"><Phone size={16} className="text-muted me-2"/>{submission.user_id.phone || 'N/A'}</ListGroup.Item>
                        <ListGroup.Item className="d-flex align-items-center"><Hash size={16} className="text-muted me-2"/>{submission.user_id.account_number || 'N/A'}</ListGroup.Item>
                      </ListGroup>
                    </Card>

                    <Card className="shadow-sm mb-4">
                      <Card.Header className="bg-light fw-bold"><ShieldCheck size={16} className="me-2"/>Waiver Scheme Details</Card.Header>
                       <ListGroup variant="flush">
                        <ListGroup.Item className="d-flex align-items-center"><FileText size={16} className="text-muted me-2"/>{submission.waiver_scheme_id.title}</ListGroup.Item>
                        <ListGroup.Item className="d-flex align-items-center"><Edit size={16} className="text-muted me-2"/>{submission.waiver_scheme_id.waiver_type} on {submission.waiver_scheme_id.applicable_on.replace('_', ' ')}</ListGroup.Item>
                        <ListGroup.Item className="d-flex align-items-center"><Percent size={16} className="text-muted me-2"/>{submission.waiver_scheme_id.waiver_value}%</ListGroup.Item>
                      </ListGroup>
                    </Card>
                </Col>

                {/* Right Column: Submitted Data */}
                <Col lg={8}>
                    <Card className="shadow-sm">
                      <Card.Header><FileText size={16} className="me-2"/>Submitted Information & History</Card.Header>
                      <Card.Body>
                        {submission.fields?.length > 0 && (
                          <><h6 className="text-primary mt-1 mb-2 fw-bold">Form Data</h6><Table striped bordered size="sm"><tbody>
                            {submission.fields.map(f => <tr key={f.field_id}><th>{f.field_label}</th><td>{String(f.value)}</td></tr>)}
                          </tbody></Table></>
                        )}
                        
                        {submission.requiredDocumentRefs?.length > 0 && (
                          <><h6 className="text-primary mt-4 mb-2 fw-bold">Uploaded Documents</h6><ListGroup variant="flush">
                            {submission.requiredDocumentRefs.map(doc => (<ListGroup.Item key={doc.fileRef} className="px-0">
                                <strong>{doc.documentTypeKey.replace(/_/g, ' ')}</strong>
                                <div className="mt-2" style={{width: '200px'}}><ImageLoader imageId={doc.fileRef} alt={doc.documentTypeKey} /></div>
                            </ListGroup.Item>))}
                          </ListGroup></>
                        )}

                        <h6 className="text-primary mt-4 mb-3 fw-bold">Submission History</h6>
                        <div className="timeline">
                           {submission.history.map((item, index) => (
                               <div key={index} className="timeline-item">
                                   <div className={`timeline-icon bg-${stageVariants[item.stage].replace('-subtle', '')}`}>
                                       {getStatusIcon(item.stage)}
                                   </div>
                                   <div className="timeline-content">
                                       <strong className="d-block">{STAGE_LABELS[item.stage]}</strong>
                                       <span className="text-muted small">
                                           {formatDistanceToNow(parseISO(item.changed_at), { addSuffix: true })} by <strong>{item.changed_by.name || 'User'}</strong>
                                       </span>
                                       {item.comment && <p className="small mb-0 mt-1 fst-italic bg-light p-2 rounded">"{item.comment}"</p>}
                                   </div>
                               </div>
                           ))}
                        </div>
                      </Card.Body>
                    </Card>
                </Col>
            </Row>
        </motion.div>
        
        {/* Confirmation and Rejection Modals */}
        <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered>
            <Modal.Header closeButton><Modal.Title><AlertTriangle className="text-warning"/> Confirm Approval</Modal.Title></Modal.Header>
            <Modal.Body>
                Are you sure you want to approve this waiver request?
                <br/><br/>
                This will apply a <strong>{submission.waiver_scheme_id.waiver_value}% interest waiver</strong> to the applicant's pending loan installments.
                <br/><br/>
                <strong>This action cannot be undone.</strong>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowConfirmModal(false)} disabled={actionInProgress}>Cancel</Button>
                <Button variant="success" onClick={handleApproveSubmit} disabled={actionInProgress}>{actionInProgress ? <Spinner size="sm" /> : 'Confirm & Approve'}</Button>
            </Modal.Footer>
        </Modal>

        <Modal show={showRejectionModal} onHide={() => setShowRejectionModal(false)} centered>
            <Modal.Header closeButton><Modal.Title>Rejection Reason</Modal.Title></Modal.Header>
            <Modal.Body>
                <Form.Group><Form.Label>Please provide a reason for rejection (optional but recommended):</Form.Label><Form.Control as="textarea" rows={3} value={rejectionNotes} onChange={(e) => setRejectionNotes(e.target.value)} disabled={actionInProgress}/></Form.Group>
                {apiActionError && <Alert variant="danger" className="mt-3">{apiActionError}</Alert>}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowRejectionModal(false)} disabled={actionInProgress}>Cancel</Button>
                <Button variant="danger" onClick={handleRejectSubmit} disabled={actionInProgress}>{actionInProgress ? <Spinner size="sm" /> : 'Confirm Rejection'}</Button>
            </Modal.Footer>
        </Modal>
      </Container>
    </>
  );
}