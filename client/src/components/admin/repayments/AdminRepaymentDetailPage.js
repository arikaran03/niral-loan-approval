import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Row,
  Col,
  Table,
  Button,
  Spinner,
  Alert,
  Badge,
  ListGroup,
  ProgressBar,
  Tab,
  Nav,
  Form,
} from "react-bootstrap";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Info,
  FileText,
  MessageSquare,
  Hourglass,
  AlertTriangle,
  Send,
  History,
  Mail,
  User as UserIcon,
  TrendingDown
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  getStatusBadgeVariant,
} from "../../../utils/formatters"; // Adjust path
import { axiosInstance } from "../../../config"; // Adjust path
import LiquidLoader from "../../../components/super/LiquidLoader"; // Adjust path

// Helper for installment status icon
const getInstallmentStatusIconElement = (status) => {
    switch (status) {
        case "Paid": return <CheckCircle size={16} className="text-success" />;
        case "Pending": return <Hourglass size={16} className="text-warning" />;
        case "Overdue": return <AlertTriangle size={16} className="text-danger" />;
        case "Partially Paid": return <TrendingDown size={16} className="text-info" />;
        default: return <Info size={16} className="text-secondary" />;
    }
};

const getBadgeVariant = (status) => {
    const variants = {
        Paid: "success", "Paid Late": "success", Overdue: "danger", Pending: "warning",
        "Partially Paid": "info", Waived: "secondary", Skipped: "secondary", Cancelled: "dark"
    };
    return variants[status] || 'light';
};


export default function AdminRepaymentDetailPage() {
  const { repaymentId } = useParams();
  const navigate = useNavigate();
  const [repaymentDetails, setRepaymentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // State for new communication log
  const [newLog, setNewLog] = useState({ subject: '', summary: '', sendEmail: true });
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logError, setLogError] = useState("");
  const [logSuccess, setLogSuccess] = useState("");

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      //================================================================
      // FIX 1: Using the correct admin-specific API endpoint
      // This endpoint populates user_id and loan_id as needed for the admin view.
      //================================================================
      const response = await axiosInstance.get(`/api/repayments/admin/${repaymentId}`);
      setRepaymentDetails(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch repayment details.");
    } finally {
      setLoading(false);
    }
  }, [repaymentId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleLogSubmit = async (e) => {
      e.preventDefault();
      if (!newLog.summary.trim()) {
          setLogError("Message summary cannot be empty.");
          return;
      }
      setLogSubmitting(true);
      setLogError("");
      setLogSuccess("");
      try {
          const logData = {
              type: 'Email',
              subject: newLog.subject || `A Message Regarding Your Loan`,
              summary: newLog.summary,
              sendEmail: newLog.sendEmail,
              recipient: repaymentDetails?.user_id?.email,
          };
          const response = await axiosInstance.post(`/api/repayments/${repaymentId}/communication`, logData);
          setRepaymentDetails(prev => ({ ...prev, communication_log: response.data.data }));
          setLogSuccess("Message sent and logged successfully!");
          setNewLog({ subject: '', summary: '', sendEmail: true });
          setTimeout(() => setLogSuccess(""), 4000);
      } catch (err) {
          setLogError(err.response?.data?.message || "Failed to send message.");
      } finally {
          setLogSubmitting(false);
      }
  };


  if (loading) return <LiquidLoader />;

  if (error) {
    return (
      <Container className="my-4">
        <Alert variant="danger" className="text-center">
          <AlertTriangle size={48} className="mb-3" />
          <h4>Error Loading Details</h4><p>{error}</p>
          <Button variant="outline-primary" onClick={() => navigate(-1)}><ArrowLeft size={16} className="me-1" /> Go Back</Button>
        </Alert>
      </Container>
    );
  }

  if (!repaymentDetails) return null;

  const {
    loan_id, user_id, disbursed_amount,
    current_outstanding_principal, next_due_date, next_emi_amount, loan_repayment_status,
    scheduled_installments = [], payment_transactions = [], communication_log = [],
    total_principal_repaid = 0,
  } = repaymentDetails;

  const progressPercent = disbursed_amount > 0 ? (total_principal_repaid / disbursed_amount) * 100 : 0;

  return (
    <Container fluid="lg" className="my-4">
      <Button variant="link" onClick={() => navigate('/console/repayments')} className="mb-3 text-decoration-none ps-0 d-inline-flex align-items-center">
        <ArrowLeft size={18} className="me-1" /> Back to Dashboard
      </Button>

      <Row className="g-4">
          <Col xl={4}>
            <Card className="shadow-sm mb-4">
                <Card.Header className="bg-light fw-bold"><UserIcon size={16} className="me-2"/>Applicant Information</Card.Header>
                <ListGroup variant="flush">
                    {/* These fields will now populate correctly after fixing the API call */}
                    <ListGroup.Item><strong>Name:</strong> {user_id?.name}</ListGroup.Item>
                    <ListGroup.Item><strong>Email:</strong> {user_id?.email}</ListGroup.Item>
                    <ListGroup.Item><strong>Phone:</strong> {user_id?.phone || 'N/A'}</ListGroup.Item>
                    <ListGroup.Item><strong>User ID:</strong> <small className="text-muted">{user_id?._id}</small></ListGroup.Item>
                </ListGroup>
            </Card>

            <Card className="shadow-sm">
                <Card.Header className="bg-light fw-bold"><FileText size={16} className="me-2"/>Loan Overview</Card.Header>
                 <ListGroup variant="flush">
                    <ListGroup.Item><strong>Loan Product:</strong> {loan_id?.title}</ListGroup.Item>
                    <ListGroup.Item><strong>Status:</strong> <Badge pill bg={getStatusBadgeVariant(loan_repayment_status)}>{loan_repayment_status}</Badge></ListGroup.Item>
                    <ListGroup.Item><strong>Disbursed:</strong> {formatCurrency(disbursed_amount)}</ListGroup.Item>
                    <ListGroup.Item><strong>Outstanding:</strong> {formatCurrency(current_outstanding_principal)}</ListGroup.Item>
                    <ListGroup.Item><strong>Next Due:</strong> {formatDate(next_due_date)}</ListGroup.Item>
                    <ListGroup.Item><strong>Next EMI:</strong> {formatCurrency(next_emi_amount)}</ListGroup.Item>
                 </ListGroup>
                 <Card.Body>
                    <ProgressBar now={progressPercent} label={`${Math.round(progressPercent)}% Repaid`} variant="success" striped />
                 </Card.Body>
            </Card>
          </Col>

          <Col xl={8}>
            <Tab.Container defaultActiveKey="communication">
                <Card className="shadow-sm">
                    <Card.Header>
                        <Nav variant="tabs">
                            <Nav.Item><Nav.Link eventKey="communication"><MessageSquare size={16} className="me-2"/>Communication</Nav.Link></Nav.Item>
                            <Nav.Item><Nav.Link eventKey="schedule"><Calendar size={16} className="me-2"/>Schedule</Nav.Link></Nav.Item>
                            <Nav.Item><Nav.Link eventKey="history"><History size={16} className="me-2"/>Payments</Nav.Link></Nav.Item>
                        </Nav>
                    </Card.Header>
                    <Tab.Content>
                        <Tab.Pane eventKey="schedule">
                            <Card.Body><Table responsive hover striped size="sm"><thead className="table-light"><tr><th>#</th><th>Due Date</th><th className="text-end">Principal</th><th className="text-end">Interest</th><th className="text-end">Total EMI</th><th className="text-end">Paid</th><th>Status</th></tr></thead><tbody>
                            {scheduled_installments.map((inst) => (<tr key={inst.installment_number} className={inst.status === "Overdue" ? "table-danger" : ""}><td>{inst.installment_number}</td><td>{formatDate(inst.due_date)}</td><td className="text-end">{formatCurrency(inst.principal_due)}</td><td className="text-end">{formatCurrency(inst.interest_due)}</td><td className="text-end fw-bold">{formatCurrency(inst.total_emi_due)}</td><td className="text-end text-success">{formatCurrency(inst.principal_paid + inst.interest_paid)}</td><td><span className="me-1">{getInstallmentStatusIconElement(inst.status)}</span><Badge pill bg={getBadgeVariant(inst.status)}>{inst.status}</Badge></td></tr>))}
                            </tbody></Table></Card.Body>
                        </Tab.Pane>
                        <Tab.Pane eventKey="history">
                            <Card.Body><Table responsive hover striped size="sm"><thead className="table-light"><tr><th>Date</th><th className="text-end">Amount</th><th>Method</th><th>Reference</th><th>Status</th><th>Processed By</th></tr></thead><tbody>
                            {payment_transactions.map((txn) => (<tr key={txn._id}><td>{formatDate(txn.transaction_date)}</td><td className="text-end">{formatCurrency(txn.amount_received)}</td><td>{txn.payment_method}</td><td>{txn.reference_id || 'N/A'}</td><td><Badge bg={txn.status === "Cleared" ? "success" : "secondary"}>{txn.status}</Badge></td><td>{txn.processed_by?.name || "User"}</td></tr>))}
                            </tbody></Table></Card.Body>
                        </Tab.Pane>
                        <Tab.Pane eventKey="communication">
                            <Card.Body>
                                <Card className="mb-4 bg-light border"><Card.Header as="h6">Send a Message</Card.Header><Card.Body><Form onSubmit={handleLogSubmit}>{logSuccess && <Alert variant="success">{logSuccess}</Alert>}{logError && <Alert variant="danger">{logError}</Alert>}<Form.Group className="mb-3"><Form.Label>Subject</Form.Label><Form.Control type="text" placeholder="e.g., Regarding your upcoming payment" value={newLog.subject} onChange={(e) => setNewLog({...newLog, subject: e.target.value})} disabled={logSubmitting}/></Form.Group><Form.Group className="mb-3"><Form.Label>Message</Form.Label><Form.Control as="textarea" rows={4} placeholder="Enter message for the applicant..." value={newLog.summary} onChange={(e) => setNewLog({...newLog, summary: e.target.value})} required disabled={logSubmitting}/></Form.Group><Form.Check type="checkbox" id="sendEmailCheckbox" label={<><Mail size={14} className="me-1"/>Send as email notification</>} checked={newLog.sendEmail} onChange={(e) => setNewLog({...newLog, sendEmail: e.target.checked})} disabled={logSubmitting}/><div className="text-end mt-3"><Button variant="primary" type="submit" disabled={logSubmitting}>{logSubmitting ? <><Spinner size="sm"/> Sending...</> : <><Send size={16} className="me-1" /> Log & Send</>}</Button></div></Form></Card.Body></Card>
                                <h6 className="mt-4">Communication History</h6>
                                <ListGroup variant="flush" className="p-0">
                                {communication_log.length > 0 ? [...communication_log].reverse().map((log, index) => (
                                    //================================================================
                                    // FIX 2: Using a modern chat-bubble UI for the log
                                    //================================================================
                                    <ListGroup.Item key={index} className={`px-0 d-flex flex-column border-0 ${log.sender_context === 'You' ? 'align-items-end' : 'align-items-start'}`}>
                                        <div className={`p-2 px-3 rounded mb-1 ${log.sender_context === 'You' ? 'bg-primary-subtle' : 'bg-body-secondary'}`} style={{ maxWidth: '80%' }}>
                                            {log.subject && <p className="mb-1 fw-bold">{log.subject}</p>}
                                            <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{log.summary}</p>
                                        </div>
                                        <small className="text-muted" style={{ padding: '0 0.75rem' }}>
                                            <strong>{log.sender_context === 'You' ? 'You' : log.sent_by?.name || log.sender_context}</strong>
                                            {' · '}{formatDate(log.log_date, { hour: 'numeric', minute: 'numeric' })}
                                        </small>
                                    </ListGroup.Item>
                                )) : <Alert variant="secondary" className="text-center mt-2 small">No communication history.</Alert>}
                                </ListGroup>
                            </Card.Body>
                        </Tab.Pane>
                    </Tab.Content>
                </Card>
            </Tab.Container>
          </Col>
      </Row>
    </Container>
  );
}