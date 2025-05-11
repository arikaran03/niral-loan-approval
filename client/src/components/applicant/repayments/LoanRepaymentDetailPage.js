// src/components/applicant/repayments/LoanRepaymentDetailPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Row, Col, Table, Button, Spinner, Alert, Badge, Modal, Form, InputGroup, ListGroup, ProgressBar, Tab, Nav } from 'react-bootstrap';
import { 
    ArrowLeft, Calendar, CheckCircle, XCircle, Info, FileText, 
    DollarSign as DollarSignIcon, CreditCard, Landmark, MessageSquare, 
    Quote, ShieldCheck, ShieldX, Hourglass, AlertTriangle, Send, 
    TrendingUp, TrendingDown, Percent, HelpCircle, SlidersHorizontal, History // Changed ClockHistory to History
} from 'lucide-react';
import { formatCurrency, formatDate, getStatusBadgeVariant, getInstallmentStatusBadgeVariant } from '../../../utils/formatters'; 
import { axiosInstance } from '../../../config'; 

// API call functions (assuming these are correctly implemented to hit your backend)
const fetchLoanRepaymentDetailsAPI = async (repaymentId) => {
    const response = await axiosInstance.get(`/api/repayments/${repaymentId}`);
    return response.data.data; 
};

const makePaymentAPI = async (repaymentId, paymentData) => {
    const response = await axiosInstance.post(`/api/repayments/${repaymentId}/make-payment`, paymentData);
    return response.data; 
};

const fetchForeclosureQuoteAPI = async (repaymentId) => {
    const response = await axiosInstance.get(`/api/repayments/${repaymentId}/foreclosure-quote`);
    return response.data.data; 
};

const confirmForeclosureAPI = async (repaymentId, confirmationData) => {
    const response = await axiosInstance.post(`/api/repayments/${repaymentId}/confirm-foreclosure`, confirmationData);
    return response.data;
};

// Helper for installment status icon
const getInstallmentStatusIconElement = (status) => {
    switch (status) {
        case 'Paid': return <CheckCircle size={16} className="text-success" />;
        case 'Pending': return <Hourglass size={16} className="text-warning" />;
        case 'Overdue': return <AlertTriangle size={16} className="text-danger" />;
        case 'Paid Late': return <CheckCircle size={16} className="text-info" />;
        case 'Waived': return <ShieldCheck size={16} className="text-secondary" />;
        case 'Skipped': return <Info size={16} className="text-muted" />;
        case 'Cancelled': return <XCircle size={16} className="text-dark" />;
        default: return <Info size={16} className="text-secondary" />;
    }
};


export default function LoanRepaymentDetailPage() {
    const { repaymentId } = useParams();
    const navigate = useNavigate();
    const [repaymentDetails, setRepaymentDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('schedule');


    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('UPI');
    const [paymentSubmitting, setPaymentSubmitting] = useState(false);
    const [paymentError, setPaymentError] = useState('');
    const [paymentSuccess, setPaymentSuccess] = useState('');

    // Foreclosure Quote Modal State
    const [showForeclosureQuoteModal, setShowForeclosureQuoteModal] = useState(false);
    const [foreclosureQuote, setForeclosureQuote] = useState(null);
    const [foreclosureLoading, setForeclosureLoading] = useState(false);
    const [foreclosureError, setForeclosureError] = useState('');

    // Confirm Foreclosure Modal State
    const [showConfirmForeclosureModal, setShowConfirmForeclosureModal] = useState(false);
    const [foreclosurePaymentRef, setForeclosurePaymentRef] = useState('');
    const [confirmForeclosureSubmitting, setConfirmForeclosureSubmitting] = useState(false);
    const [confirmForeclosureError, setConfirmForeclosureError] = useState('');
    const [confirmForeclosureSuccess, setConfirmForeclosureSuccess] = useState('');
    
    const loadDetails = useCallback(async (isRefresh = false) => { 
        if (!repaymentId) {
            setError("Repayment ID is missing.");
            setLoading(false);
            return;
        }
        if (!isRefresh) setLoading(true); 
        setError('');
        try {
            const data = await fetchLoanRepaymentDetailsAPI(repaymentId);
            setRepaymentDetails(data);
            if (!showPaymentModal || (isRefresh && paymentAmount === (repaymentDetails?.next_emi_amount?.toString() || ''))) {
                 setPaymentAmount(data?.next_emi_amount?.toString() || '');
            }
        } catch (err) {
            console.error("Fetch detail error:", err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch repayment details.');
        } finally {
            if (!isRefresh) setLoading(false);
        }
    }, [repaymentId]); 

    useEffect(() => {
        loadDetails();
    }, [loadDetails]); 

    const handleShowPaymentModal = (amountToPay = null, isForeclosurePayment = false) => {
        setPaymentError('');
        setPaymentSuccess('');
        const nextEmi = repaymentDetails?.next_emi_amount;
        setPaymentAmount(amountToPay ? String(amountToPay) : (nextEmi && nextEmi > 0 ? String(nextEmi) : ''));
        setPaymentMethod('UPI'); 
        setShowPaymentModal(true);
    };
    const handleClosePaymentModal = () => setShowPaymentModal(false);

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        const numericPaymentAmount = parseFloat(paymentAmount);

        if (!paymentAmount || isNaN(numericPaymentAmount) || numericPaymentAmount <= 0) {
            setPaymentError("Please enter a valid positive payment amount.");
            return;
        }

        if (repaymentDetails && numericPaymentAmount > repaymentDetails.current_outstanding_principal + 0.01) { 
            setPaymentError(`Payment amount cannot exceed the total outstanding principal of ${formatCurrency(repaymentDetails.current_outstanding_principal)}.`);
            return;
        }


        setPaymentSubmitting(true);
        setPaymentError('');
        setPaymentSuccess('');
        try {
            const paymentData = {
                amount: numericPaymentAmount,
                paymentMethod: paymentMethod,
            };
            const response = await makePaymentAPI(repaymentId, paymentData);
            if (response.success) {
                setPaymentSuccess(response.message || "Payment initiated successfully! Details will update shortly.");
                setTimeout(() => {
                     setShowPaymentModal(false);
                     loadDetails(true); 
                }, 2500);
            } else {
                setPaymentError(response.message || "Payment initiation failed.");
            }
        } catch (err) {
            console.error("Payment submission error:", err);
            setPaymentError(err.response?.data?.message || err.message || "An error occurred during payment.");
        } finally {
            setPaymentSubmitting(false);
        }
    };

    const handleShowForeclosureQuoteModal = async () => {
        setShowForeclosureQuoteModal(true);
        setForeclosureLoading(true);
        setForeclosureError('');
        setForeclosureQuote(null);
        try {
            const quote = await fetchForeclosureQuoteAPI(repaymentId);
            setForeclosureQuote(quote);
        } catch (err) {
            console.error("Foreclosure quote error:", err);
            setForeclosureError(err.response?.data?.message || err.message || "Failed to fetch foreclosure quote.");
        } finally {
            setForeclosureLoading(false);
        }
    };
    const handleCloseForeclosureQuoteModal = () => setShowForeclosureQuoteModal(false);

    const handleShowConfirmForeclosureModal = () => {
        if (!foreclosureQuote) {
            alert("Please request a foreclosure quote first.");
            return;
        }
        setConfirmForeclosureError('');
        setConfirmForeclosureSuccess('');
        setForeclosurePaymentRef('');
        setShowConfirmForeclosureModal(true);
    };
    const handleCloseConfirmForeclosureModal = () => setShowConfirmForeclosureModal(false);

    const handleConfirmForeclosureSubmit = async (e) => {
        e.preventDefault();
        if (!foreclosureQuote || !foreclosureQuote.totalForeclosureAmount) {
            setConfirmForeclosureError("Foreclosure quote not available or invalid.");
            return;
        }
         if (!foreclosurePaymentRef.trim()) {
            setConfirmForeclosureError("Please enter the payment reference for the foreclosure amount.");
            return;
        }

        setConfirmForeclosureSubmitting(true);
        setConfirmForeclosureError('');
        setConfirmForeclosureSuccess('');
        try {
            const confirmationData = {
                paymentDetails: {
                    amountPaid: foreclosureQuote.totalForeclosureAmount,
                    transactionReference: foreclosurePaymentRef, 
                    paymentDate: new Date().toISOString(), 
                    paymentMethod: "Foreclosure Payment", 
                    foreclosureFeePaid: foreclosureQuote.foreclosureFee 
                },
                notes: "Applicant confirmed foreclosure payment."
            };
            const response = await confirmForeclosureAPI(repaymentId, confirmationData);
            if (response.success) {
                setConfirmForeclosureSuccess(response.message || "Foreclosure confirmed successfully! Loan details updated.");
                setTimeout(() => {
                     setShowConfirmForeclosureModal(false);
                     loadDetails(true); 
                }, 2500);
            } else {
                setConfirmForeclosureError(response.message || "Foreclosure confirmation failed.");
            }
        } catch (err) {
            console.error("Confirm foreclosure error:", err);
            setConfirmForeclosureError(err.response?.data?.message || err.message || "An error occurred during foreclosure confirmation.");
        } finally {
            setConfirmForeclosureSubmitting(false);
        }
    };


    if (loading && !repaymentDetails) { 
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <Spinner animation="border" variant="primary" />
                <span className="ms-2">Loading repayment details...</span>
            </Container>
        );
    }

    if (error && !repaymentDetails) { 
        return (
            <Container className="my-4">
                <Alert variant="danger" className="text-center">
                    <AlertTriangle size={48} className="mb-3" />
                    <h4>Error Loading Details</h4>
                    <p>{error}</p>
                    <Button variant="outline-primary" onClick={() => navigate(-1)}>
                        <ArrowLeft size={16} className="me-1" /> Go Back
                    </Button>
                </Alert>
            </Container>
        );
    }

    if (!repaymentDetails) { 
        return (
            <Container className="my-4">
                <Alert variant="warning">No repayment details found for this record, or an error occurred.</Alert>
                 <Button variant="outline-primary" onClick={() => navigate(-1)}>
                        <ArrowLeft size={16} className="me-1" /> Go Back
                </Button>
            </Container>
        );
    }
    
    const { 
        loan_id, 
        disbursed_amount, 
        initial_calculated_emi, 
        current_outstanding_principal, 
        next_due_date, 
        next_emi_amount, 
        loan_repayment_status, 
        scheduled_installments = [], 
        payment_transactions = [], 
        communication_log = [],
        agreed_interest_rate_pa,
        original_tenure_months,
        repayment_start_date,
        original_expected_closure_date,
        actual_closure_date,
        prepayment_configuration,
        total_principal_repaid = 0,
        total_interest_repaid = 0,
        total_penalties_paid = 0,
        days_past_due = 0,
        total_current_overdue_amount = 0
    } = repaymentDetails;

    const canMakePayment = ['Active', 'Active - Overdue', 'Active - Grace Period'].includes(loan_repayment_status);
    const canRequestForeclosure = prepayment_configuration?.allow_prepayment && canMakePayment; 
    const progressPercent = disbursed_amount > 0 ? ((total_principal_repaid / disbursed_amount) * 100) : 0;

    return (
        <Container fluid="lg" className="my-4 repayment-detail-page">
            <Button variant="link" onClick={() => navigate(-1)} className="mb-3 text-decoration-none ps-0 d-inline-flex align-items-center">
                <ArrowLeft size={18} className="me-1" /> Back to My Loans
            </Button>

            <Card className="shadow-sm mb-4">
                <Card.Header className="bg-light py-3">
                    <Row className="align-items-center">
                        <Col>
                             <h4 className="mb-0 d-flex align-items-center">
                                <FileText size={28} className="me-2 text-primary" /> Loan Repayment: {loan_id?.title || 'N/A'}
                            </h4>
                        </Col>
                        <Col xs="auto">
                            <Badge pill bg={getStatusBadgeVariant(loan_repayment_status)} 
                                   text={getStatusBadgeVariant(loan_repayment_status) === 'light' ? 'dark' : undefined} 
                                   className="fs-6 px-3 py-2">
                                {loan_repayment_status}
                            </Badge>
                        </Col>
                    </Row>
                </Card.Header>
                <Card.Body>
                    {/* Stats Cards */}
                    <Row className="g-3 mb-4">
                        <Col md={6} lg={3}>
                            <Card bg="primary" text="white" className="h-100 shadow-sm stat-card">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <DollarSignIcon size={32} />
                                        <TrendingDown size={24} />
                                    </div>
                                    <h6 className="text-uppercase opacity-75 small">Outstanding Principal</h6>
                                    <div className="fs-4 fw-bold">{formatCurrency(current_outstanding_principal)}</div>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={6} lg={3}>
                             <Card bg="info" text="white" className="h-100 shadow-sm stat-card">
                                <Card.Body>
                                     <div className="d-flex justify-content-between align-items-center mb-2">
                                        <CreditCard size={32} />
                                        {next_emi_amount > 0 && <TrendingUp size={24}/>}
                                    </div>
                                    <h6 className="text-uppercase opacity-75 small">Next EMI Amount</h6>
                                    <div className="fs-4 fw-bold">{next_emi_amount ? formatCurrency(next_emi_amount) : 'N/A'}</div>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={6} lg={3}>
                             <Card bg={days_past_due > 0 ? "danger" : "warning"} text={days_past_due > 0 ? "white" : "dark"} className="h-100 shadow-sm stat-card">
                                <Card.Body>
                                     <div className="d-flex justify-content-between align-items-center mb-2">
                                        <Calendar size={32} />
                                        {days_past_due > 0 && <AlertTriangle size={24} />}
                                    </div>
                                    <h6 className="text-uppercase opacity-75 small">Next Due Date</h6>
                                    <div className="fs-4 fw-bold">{formatDate(next_due_date)}</div>
                                    {days_past_due > 0 && <small>Overdue by {days_past_due} days</small>}
                                </Card.Body>
                            </Card>
                        </Col>
                         <Col md={6} lg={3}>
                             <Card bg="light" text="dark" className="h-100 shadow-sm stat-card">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <Landmark size={32} />
                                        <Percent size={24} />
                                    </div>
                                    <h6 className="text-uppercase opacity-75 small">Original EMI</h6>
                                    <div className="fs-4 fw-bold">{formatCurrency(initial_calculated_emi)}</div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>

                    {/* Progress Bar */}
                    <div className="mb-4">
                        <div className="d-flex justify-content-between mb-1 small">
                            <span>Loan Progress (Principal Repaid)</span>
                            <span>{formatCurrency(total_principal_repaid)} / {formatCurrency(disbursed_amount)}</span>
                        </div>
                        <ProgressBar now={progressPercent} label={`${Math.round(progressPercent)}%`} variant="success" striped animated />
                    </div>
                    
                    <hr className="my-4" />
                     <Row>
                        <Col md={7} className="mb-3 mb-md-0">
                            <h5>Loan Summary</h5>
                            <Table borderless hover size="sm" className="summary-table">
                                <tbody>
                                    <tr><td><strong>Loan Product:</strong></td><td>{loan_id?.title}</td></tr>
                                    <tr><td><strong>Disbursed Amount:</strong></td><td>{formatCurrency(disbursed_amount)}</td></tr>
                                    <tr><td><strong>Interest Rate:</strong></td><td>{agreed_interest_rate_pa}% p.a.</td></tr>
                                    <tr><td><strong>Original Tenure:</strong></td><td>{original_tenure_months} months</td></tr>
                                    <tr><td><strong>Repayment Start Date:</strong></td><td>{formatDate(repayment_start_date)}</td></tr>
                                    <tr><td><strong>Expected Closure:</strong></td><td>{formatDate(original_expected_closure_date)}</td></tr>
                                    {actual_closure_date && <tr><td><strong>Actual Closure:</strong></td><td>{formatDate(actual_closure_date)}</td></tr>}
                                    <tr><td><strong>Total Principal Repaid:</strong></td><td className="text-success fw-medium">{formatCurrency(total_principal_repaid)}</td></tr>
                                    <tr><td><strong>Total Interest Paid:</strong></td><td className="text-success fw-medium">{formatCurrency(total_interest_repaid)}</td></tr>
                                    {total_penalties_paid > 0 && <tr><td><strong>Total Penalties Paid:</strong></td><td className="text-danger fw-medium">{formatCurrency(total_penalties_paid)}</td></tr>}
                                    {total_current_overdue_amount > 0 &&  <tr><td><strong>Current Overdue Amount:</strong></td><td className="text-danger fw-bold">{formatCurrency(total_current_overdue_amount)}</td></tr>}
                                </tbody>
                            </Table>
                        </Col>
                        <Col md={5} className="d-flex flex-column justify-content-start align-items-center border-start-md ps-md-4">
                            <h5 className="mb-3">Actions</h5>
                            {canMakePayment ? (
                                <>
                                    <Button variant="success" size="lg" className="mb-3 w-100" onClick={() => handleShowPaymentModal()}>
                                        <DollarSignIcon size={20} className="me-2" /> Make Payment
                                    </Button>
                                    {canRequestForeclosure && (
                                    <Button variant="outline-info" className="mb-3 w-100" onClick={handleShowForeclosureQuoteModal}>
                                        <Quote size={18} className="me-2" /> Request Foreclosure Quote
                                    </Button>
                                    )}
                                    {foreclosureQuote && canRequestForeclosure && ( 
                                        <Button variant="info" className="w-100" onClick={handleShowConfirmForeclosureModal}>
                                            <Send size={18} className="me-2" /> Confirm Foreclosure Payment
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <Alert variant={loan_repayment_status === 'Fully Repaid' || loan_repayment_status === 'Foreclosed' ? 'success' : 'info'} className="text-center w-100">
                                    {loan_repayment_status === 'Fully Repaid' || loan_repayment_status === 'Foreclosed' ? <ShieldCheck size={24} className="mb-2" /> : <Info size={24} className="mb-2" />}
                                    This loan is currently <strong>{loan_repayment_status}</strong>.
                                </Alert>
                            )}
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Tabbed Sections for Details */}
            <Card className="shadow-sm">
                <Card.Header>
                     <Nav variant="tabs" defaultActiveKey="schedule" onSelect={(k) => setActiveTab(k)}>
                        <Nav.Item>
                            <Nav.Link eventKey="schedule" className="d-flex align-items-center"><Calendar size={18} className="me-2"/>Installment Schedule</Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="history" className="d-flex align-items-center"><History size={18} className="me-2"/>Payment History</Nav.Link> {/* Changed Icon */}
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="communication" className="d-flex align-items-center"><MessageSquare size={18} className="me-2"/>Communication Log</Nav.Link>
                        </Nav.Item>
                         <Nav.Item>
                            <Nav.Link eventKey="terms" className="d-flex align-items-center"><SlidersHorizontal size={18} className="me-2"/>Loan Terms & Conditions</Nav.Link>
                        </Nav.Item>
                    </Nav>
                </Card.Header>
                <Tab.Content>
                    <Tab.Pane eventKey="schedule" active={activeTab === 'schedule'}>
                        <Card.Body>
                            {scheduled_installments.length > 0 ? (
                                <Table responsive hover striped size="sm">
                                    <thead className="table-light">
                                        <tr>
                                            <th>#</th>
                                            <th>Due Date</th>
                                            <th className="text-end">Principal Due</th>
                                            <th className="text-end">Interest Due</th>
                                            <th className="text-end">Total EMI</th>
                                            <th className="text-end">Principal Paid</th>
                                            <th className="text-end">Interest Paid</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scheduled_installments.map(inst => (
                                            <tr key={inst.installment_number} className={inst.status === 'Overdue' ? 'table-danger' : ''}>
                                                <td>{inst.installment_number}</td>
                                                <td>{formatDate(inst.due_date)}</td>
                                                <td className="text-end">{formatCurrency(inst.principal_due)}</td>
                                                <td className="text-end">{formatCurrency(inst.interest_due)}</td>
                                                <td className="text-end fw-bold">{formatCurrency(inst.total_emi_due)}</td>
                                                <td className="text-end text-success">{formatCurrency(inst.principal_paid)}</td>
                                                <td className="text-end text-success">{formatCurrency(inst.interest_paid)}</td>
                                                <td>
                                                    <span className="me-1">{getInstallmentStatusIconElement(inst.status)}</span>
                                                    <Badge pill bg={getInstallmentStatusBadgeVariant(inst.status)} 
                                                           text={getInstallmentStatusBadgeVariant(inst.status) === 'light' ? 'dark' : undefined}>
                                                        {inst.status}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            ) : <Alert variant="light" className="text-center mt-3">No installment schedule available. This may be due to pending setup or if the loan type does not have a fixed schedule.</Alert>}
                        </Card.Body>
                    </Tab.Pane>
                    <Tab.Pane eventKey="history" active={activeTab === 'history'}>
                        <Card.Body>
                            {payment_transactions.length > 0 ? (
                                <Table responsive hover striped size="sm">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Transaction Date</th>
                                            <th className="text-end">Amount Received</th>
                                            <th>Method</th>
                                            <th>Reference</th>
                                            <th>Status</th>
                                            <th className="text-end">Principal Paid</th>
                                            <th className="text-end">Interest Paid</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payment_transactions.map(txn => (
                                            <tr key={txn._id}>
                                                <td>{formatDate(txn.transaction_date, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                                <td className="text-end">{formatCurrency(txn.amount_received)}</td>
                                                <td>{txn.payment_method}</td>
                                                <td>{txn.reference_id || 'N/A'}</td>
                                                <td>
                                                    <Badge bg={txn.status === 'Cleared' ? 'success' : (txn.status === 'Failed' || txn.status === 'Bounced' ? 'danger' : 'secondary')}>
                                                        {txn.status}
                                                    </Badge>
                                                </td>
                                                <td className="text-end">{formatCurrency(txn.principal_component)}</td>
                                                <td className="text-end">{formatCurrency(txn.interest_component)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            ) : <Alert variant="light" className="text-center mt-3">No payment transactions recorded yet.</Alert>}
                        </Card.Body>
                    </Tab.Pane>
                    <Tab.Pane eventKey="communication" active={activeTab === 'communication'}>
                         <Card.Body>
                            {communication_log.length > 0 ? (
                                <ListGroup variant="flush">
                                    {communication_log.map((log, index) => (
                                        <ListGroup.Item key={index} className="d-flex justify-content-between align-items-start py-2 px-0">
                                            <div>
                                                <div className="fw-bold">
                                                    <MessageSquare size={16} className="me-2 text-muted" /> 
                                                    {log.type} - {log.subject || 'General Communication'}
                                                </div>
                                                <small className="text-muted d-block ms-4 ps-1">{formatDate(log.log_date, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                                                <p className="mb-0 mt-1 ms-4 ps-1">{log.summary}</p>
                                            </div>
                                            <Badge bg={log.status === 'Delivered' || log.status === 'Sent' ? 'light' : 'warning'} 
                                                   text={(log.status === 'Delivered' || log.status === 'Sent') && getStatusBadgeVariant(log.status) === 'light' ? 'dark' : undefined}
                                                   className="ms-2">
                                                {log.status}
                                            </Badge>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            ) : <Alert variant="light" className="text-center mt-3">No communication logs available.</Alert>}
                        </Card.Body>
                    </Tab.Pane>
                     <Tab.Pane eventKey="terms" active={activeTab === 'terms'}>
                        <Card.Body>
                            <h5>Prepayment & Foreclosure Terms</h5>
                            {prepayment_configuration ? (
                                <ListGroup variant="flush" className="mb-3">
                                    <ListGroup.Item><strong>Allowed:</strong> {prepayment_configuration.allow_prepayment ? 'Yes' : 'No'}</ListGroup.Item>
                                    {prepayment_configuration.allow_prepayment && <>
                                        <ListGroup.Item><strong>Part Prepayment:</strong> {prepayment_configuration.allow_part_prepayment ? 'Yes' : 'No'}</ListGroup.Item>
                                        <ListGroup.Item><strong>Lock-in Period:</strong> {prepayment_configuration.lock_in_period_months || 0} months</ListGroup.Item>
                                        <ListGroup.Item><strong>Fee Type:</strong> {prepayment_configuration.prepayment_fee_type || 'None'}</ListGroup.Item>
                                        {prepayment_configuration.prepayment_fee_type !== 'None' && 
                                            <ListGroup.Item><strong>Fee Value:</strong> {prepayment_configuration.prepayment_fee_type.includes('Percentage') ? `${prepayment_configuration.prepayment_fee_value}%` : formatCurrency(prepayment_configuration.prepayment_fee_value)}</ListGroup.Item>
                                        }
                                    </>}
                                </ListGroup>
                            ) : <p>Prepayment terms not specified.</p>}
                            
                            <h5>Penalty Configuration</h5>
                             {repaymentDetails.penalty_configuration ? (
                                <ListGroup variant="flush">
                                    <ListGroup.Item><strong>Late Fee Type:</strong> {repaymentDetails.penalty_configuration.late_payment_fee_type || 'None'}</ListGroup.Item>
                                     {repaymentDetails.penalty_configuration.late_payment_fee_type !== 'None' && 
                                        <ListGroup.Item><strong>Late Fee Value:</strong> {repaymentDetails.penalty_configuration.late_payment_fee_type.includes('Percentage') ? `${repaymentDetails.penalty_configuration.late_payment_fee_value}%` : formatCurrency(repaymentDetails.penalty_configuration.late_payment_fee_value)}</ListGroup.Item>
                                    }
                                    <ListGroup.Item><strong>Grace Period:</strong> {repaymentDetails.penalty_configuration.late_payment_grace_period_days || 0} days</ListGroup.Item>
                                </ListGroup>
                            ) : <p>Penalty terms not specified.</p>}
                            <Alert variant="light" className="mt-3 small">
                                <HelpCircle size={16} className="me-1"/> For detailed terms and conditions, please refer to your loan agreement document or contact customer support.
                            </Alert>
                        </Card.Body>
                    </Tab.Pane>
                </Tab.Content>
            </Card>


            {/* Payment Modal (same as before) */}
            <Modal show={showPaymentModal} onHide={handleClosePaymentModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title><DollarSignIcon size={24} className="me-2" />Make a Payment</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handlePaymentSubmit}>
                    <Modal.Body>
                        {paymentSuccess && <Alert variant="success">{paymentSuccess}</Alert>}
                        {paymentError && <Alert variant="danger">{paymentError}</Alert>}
                        <Form.Group className="mb-3" controlId="paymentAmountModal"> 
                            <Form.Label>Amount to Pay</Form.Label>
                            <InputGroup>
                                <InputGroup.Text>₹</InputGroup.Text>
                                <Form.Control
                                    type="number"
                                    placeholder="Enter amount"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    min="1"
                                    step="0.01"
                                    required
                                    disabled={paymentSubmitting}
                                />
                            </InputGroup>
                             {repaymentDetails && parseFloat(paymentAmount) > repaymentDetails.current_outstanding_principal &&
                                <Form.Text className="text-danger">
                                    Payment amount exceeds total outstanding principal. Max payable: {formatCurrency(repaymentDetails.current_outstanding_principal)}.
                                </Form.Text>
                            }
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="paymentMethodModal"> 
                            <Form.Label>Payment Method</Form.Label>
                            <Form.Select 
                                value={paymentMethod} 
                                onChange={(e) => setPaymentMethod(e.target.value)} 
                                disabled={paymentSubmitting}
                            >
                                <option value="UPI">UPI</option>
                                <option value="Card">Credit/Debit Card</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                            </Form.Select>
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleClosePaymentModal} disabled={paymentSubmitting}>
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit" disabled={paymentSubmitting || !paymentAmount || (repaymentDetails && parseFloat(paymentAmount) > repaymentDetails.current_outstanding_principal + 0.01) }>
                            {paymentSubmitting ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Processing...</> : 'Proceed to Pay'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* Foreclosure Quote Modal (same as before) */}
            <Modal show={showForeclosureQuoteModal} onHide={handleCloseForeclosureQuoteModal} centered size="lg">
                 <Modal.Header closeButton>
                    <Modal.Title><Quote size={24} className="me-2" />Foreclosure Quote</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {foreclosureLoading && <div className="text-center p-3"><Spinner animation="border" variant="primary" /><p className="mt-2">Fetching quote...</p></div>}
                    {foreclosureError && <Alert variant="danger">{foreclosureError}</Alert>}
                    {foreclosureQuote && !foreclosureLoading && (
                        <>
                            <Alert variant="info">
                                <Info size={18} className="me-1" /> This is an indicative quote to close your loan early.
                                Valid until: <strong>{formatDate(foreclosureQuote.quoteValidUntil, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>.
                            </Alert>
                            <Table bordered className="mb-3">
                                <tbody>
                                    <tr><td>Current Outstanding Principal:</td><td className="text-end fw-bold">{formatCurrency(foreclosureQuote.outstandingPrincipal)}</td></tr>
                                    <tr><td>Estimated Accrued Interest:</td><td className="text-end">{formatCurrency(foreclosureQuote.accruedInterest)}</td></tr>
                                    <tr><td>Foreclosure Fee ({prepayment_configuration?.prepayment_fee_value}% of Principal):</td><td className="text-end">{formatCurrency(foreclosureQuote.foreclosureFee)}</td></tr>
                                    <tr className="table-primary">
                                        <td className="fw-bold fs-5">Total Amount Payable:</td>
                                        <td className="text-end fw-bold fs-5">{formatCurrency(foreclosureQuote.totalForeclosureAmount)}</td>
                                    </tr>
                                </tbody>
                            </Table>
                            <p className="small text-muted">{foreclosureQuote.notes}</p>
                            <div className="mt-3 text-center">
                                <p>To proceed with foreclosure, please make a payment for the 'Total Amount Payable'.</p>
                                <Button variant="success" className="mb-2" onClick={() => { 
                                    handleCloseForeclosureQuoteModal(); 
                                    handleShowPaymentModal(foreclosureQuote.totalForeclosureAmount, true); // Pass true for isForeclosurePayment
                                    }}>
                                    <DollarSignIcon size={18} className="me-1" /> Initiate Foreclosure Payment
                                </Button>
                                <p className="small mt-1">After successful payment, please use the "Confirm Foreclosure Payment" button on the main page.</p>
                            </div>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseForeclosureQuoteModal}>Close</Button>
                </Modal.Footer>
            </Modal>

            {/* Confirm Foreclosure Modal (same as before) */}
            <Modal show={showConfirmForeclosureModal} onHide={handleCloseConfirmForeclosureModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title><Send size={24} className="me-2" />Confirm Foreclosure Payment</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleConfirmForeclosureSubmit}>
                    <Modal.Body>
                        {confirmForeclosureSuccess && <Alert variant="success">{confirmForeclosureSuccess}</Alert>}
                        {confirmForeclosureError && <Alert variant="danger">{confirmForeclosureError}</Alert>}
                        <p>Please confirm that you have successfully paid the foreclosure amount of 
                           <strong> {formatCurrency(foreclosureQuote?.totalForeclosureAmount)}</strong>.
                        </p>
                        <Form.Group className="mb-3" controlId="foreclosurePaymentRef">
                            <Form.Label>Payment Reference ID</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter payment transaction ID or reference"
                                value={foreclosurePaymentRef}
                                onChange={(e) => setForeclosurePaymentRef(e.target.value)}
                                disabled={confirmForeclosureSubmitting}
                                required 
                            />
                             <Form.Text className="text-muted">
                                This helps us verify your payment quickly.
                            </Form.Text>
                        </Form.Group>
                         <Alert variant="warning" size="sm">
                            <AlertTriangle size={16} className="me-1"/> Ensure the payment has been successfully processed before confirming. This action will attempt to formally close your loan.
                        </Alert>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseConfirmForeclosureModal} disabled={confirmForeclosureSubmitting}>
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit" disabled={confirmForeclosureSubmitting || !foreclosureQuote || !foreclosurePaymentRef.trim()}>
                            {confirmForeclosureSubmitting ? <><Spinner as="span" animation="border" size="sm" /> Confirming...</> : 'Confirm Foreclosure'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

        </Container>
    );
}
