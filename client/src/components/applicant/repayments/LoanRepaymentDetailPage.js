// src/components/applicant/repayments/LoanRepaymentDetailPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Row, Col, Table, Button, Spinner, Alert, Badge, Modal, Form, InputGroup, ListGroup } from 'react-bootstrap';
import { ArrowLeft, Calendar, CheckCircle, XCircle, Info, FileText, DollarSign as DollarSignIcon, CreditCard, Landmark, MessageSquare, Quote, ShieldCheck, ShieldX, Hourglass, AlertTriangle, Send } from 'lucide-react';
import { formatCurrency, formatDate, getStatusBadgeVariant, getInstallmentStatusBadgeVariant } from '../../../utils/formatters'; 
import { axiosInstance } from '../../../config'; 

// API call functions
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
    
    const loadDetails = useCallback(async () => { 
        if (!repaymentId) {
            setError("Repayment ID is missing.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const data = await fetchLoanRepaymentDetailsAPI(repaymentId);
            setRepaymentDetails(data);
            // Pre-fill payment amount only if it's not already focused for foreclosure payment
            if (!showPaymentModal || paymentAmount === '') {
                 setPaymentAmount(data?.next_emi_amount?.toString() || '');
            }
        } catch (err) {
            console.error("Fetch detail error:", err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch repayment details.');
        } finally {
            setLoading(false);
        }
    }, [repaymentId, showPaymentModal, paymentAmount]); // Added dependencies

    useEffect(() => {
        loadDetails();
    }, [loadDetails]); // useEffect will call loadDetails

    const handleShowPaymentModal = (amountToPay = null) => {
        setPaymentError('');
        setPaymentSuccess('');
        const nextEmi = repaymentDetails?.next_emi_amount;
        setPaymentAmount(amountToPay ? amountToPay.toString() : (nextEmi && nextEmi > 0 ? nextEmi.toString() : ''));
        setPaymentMethod('UPI'); // Reset to default
        setShowPaymentModal(true);
    };
    const handleClosePaymentModal = () => setShowPaymentModal(false);

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!paymentAmount || isNaN(parseFloat(paymentAmount)) || parseFloat(paymentAmount) <= 0) {
            setPaymentError("Please enter a valid payment amount.");
            return;
        }
        setPaymentSubmitting(true);
        setPaymentError('');
        setPaymentSuccess('');
        try {
            const paymentData = {
                amount: parseFloat(paymentAmount),
                paymentMethod: paymentMethod,
                // You might want to add a field for payment reference if user provides it
                // referenceId: 'USER_PROVIDED_REF_IF_ANY' 
            };
            const response = await makePaymentAPI(repaymentId, paymentData);
            if (response.success) {
                setPaymentSuccess(response.message || "Payment initiated successfully! Details will update shortly.");
                setTimeout(() => {
                     setShowPaymentModal(false);
                     loadDetails(); 
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
                    paymentDate: new Date().toISOString(), // Assuming payment is made now
                    paymentMethod: "Foreclosure Payment", // Or collect this
                    foreclosureFeePaid: foreclosureQuote.foreclosureFee 
                },
                notes: "Applicant confirmed foreclosure payment."
            };
            const response = await confirmForeclosureAPI(repaymentId, confirmationData);
            if (response.success) {
                setConfirmForeclosureSuccess(response.message || "Foreclosure confirmed successfully! Loan details updated.");
                setTimeout(() => {
                     setShowConfirmForeclosureModal(false);
                     loadDetails(); 
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


    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <Spinner animation="border" variant="primary" />
                <span className="ms-2">Loading repayment details...</span>
            </Container>
        );
    }

    if (error) {
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
                <Alert variant="warning">No repayment details found for this record.</Alert>
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
        prepayment_configuration
    } = repaymentDetails;

    const canMakePayment = ['Active', 'Active - Overdue', 'Active - Grace Period'].includes(loan_repayment_status);
    const canRequestForeclosure = prepayment_configuration?.allow_prepayment && canMakePayment; // Allow foreclosure if payments are generally allowed

    return (
        <Container fluid="lg" className="my-4 repayment-detail-page">
            <Button variant="link" onClick={() => navigate(-1)} className="mb-3 text-decoration-none ps-0">
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
                    {/* Stats Cards ... (same as before) */}
                    <Row className="g-4">
                        <Col md={6} lg={3}>
                            <Card bg="primary" text="white" className="h-100 shadow-sm stat-card">
                                <Card.Body className="text-center">
                                    <DollarSignIcon size={32} className="mb-2" />
                                    <Card.Title as="h6" className="text-uppercase opacity-75">Outstanding Principal</Card.Title>
                                    <Card.Text className="fs-4 fw-bold">{formatCurrency(current_outstanding_principal)}</Card.Text>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={6} lg={3}>
                             <Card bg="info" text="white" className="h-100 shadow-sm stat-card">
                                <Card.Body className="text-center">
                                    <CreditCard size={32} className="mb-2" />
                                    <Card.Title as="h6" className="text-uppercase opacity-75">Next EMI Amount</Card.Title>
                                    <Card.Text className="fs-4 fw-bold">{next_emi_amount ? formatCurrency(next_emi_amount) : 'N/A'}</Card.Text>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={6} lg={3}>
                             <Card bg="warning" text="dark" className="h-100 shadow-sm stat-card">
                                <Card.Body className="text-center">
                                    <Calendar size={32} className="mb-2" />
                                    <Card.Title as="h6" className="text-uppercase opacity-75">Next Due Date</Card.Title>
                                    <Card.Text className="fs-4 fw-bold">{formatDate(next_due_date)}</Card.Text>
                                </Card.Body>
                            </Card>
                        </Col>
                         <Col md={6} lg={3}>
                             <Card bg="light" text="dark" className="h-100 shadow-sm stat-card">
                                <Card.Body className="text-center">
                                    <Landmark size={32} className="mb-2" />
                                    <Card.Title as="h6" className="text-uppercase opacity-75">Original EMI</Card.Title>
                                    <Card.Text className="fs-4 fw-bold">{formatCurrency(initial_calculated_emi)}</Card.Text>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                    <hr className="my-4" />
                     <Row>
                        <Col md={6}>
                            <h5>Loan Summary</h5>
                            <Table borderless size="sm" className="summary-table">
                                <tbody>
                                    <tr><td><strong>Loan Product:</strong></td><td>{loan_id?.title}</td></tr>
                                    <tr><td><strong>Disbursed Amount:</strong></td><td>{formatCurrency(disbursed_amount)}</td></tr>
                                    <tr><td><strong>Interest Rate:</strong></td><td>{agreed_interest_rate_pa}% p.a.</td></tr>
                                    <tr><td><strong>Original Tenure:</strong></td><td>{original_tenure_months} months</td></tr>
                                    <tr><td><strong>Repayment Start Date:</strong></td><td>{formatDate(repayment_start_date)}</td></tr>
                                    <tr><td><strong>Expected Closure:</strong></td><td>{formatDate(original_expected_closure_date)}</td></tr>
                                    {actual_closure_date && <tr><td><strong>Actual Closure:</strong></td><td>{formatDate(actual_closure_date)}</td></tr>}
                                </tbody>
                            </Table>
                        </Col>
                        <Col md={6} className="d-flex flex-column justify-content-center align-items-center">
                            {canMakePayment ? (
                                <>
                                    <Button variant="success" size="lg" className="mb-3 w-75" onClick={() => handleShowPaymentModal()}>
                                        <DollarSignIcon size={20} className="me-2" /> Make a Payment
                                    </Button>
                                    {canRequestForeclosure && (
                                    <Button variant="outline-info" className="mb-3 w-75" onClick={handleShowForeclosureQuoteModal}>
                                        <Quote size={18} className="me-2" /> Request Foreclosure Quote
                                    </Button>
                                    )}
                                    {foreclosureQuote && canRequestForeclosure && ( // Show confirm button if quote is available
                                        <Button variant="info" className="w-75" onClick={handleShowConfirmForeclosureModal}>
                                            <Send size={18} className="me-2" /> Confirm Foreclosure Payment
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <Alert variant={loan_repayment_status === 'Fully Repaid' ? 'success' : 'info'} className="text-center w-75">
                                    {loan_repayment_status === 'Fully Repaid' ? <ShieldCheck size={24} className="mb-2" /> : <Info size={24} className="mb-2" />}
                                    This loan is currently <strong>{loan_repayment_status}</strong>.
                                </Alert>
                            )}
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Installment Schedule Table ... (same as before) */}
            <Card className="shadow-sm mb-4">
                <Card.Header><h5 className="mb-0">Installment Schedule</h5></Card.Header>
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
                    ) : <p>No installment schedule available.</p>}
                </Card.Body>
            </Card>

            {/* Payment History Table ... (same as before) */}
            <Card className="shadow-sm mb-4">
                <Card.Header><h5 className="mb-0">Payment History</h5></Card.Header>
                <Card.Body>
                    {payment_transactions.length > 0 ? (
                        <Table responsive hover striped size="sm">
                            <thead className="table-light">
                                <tr>
                                    <th>Date</th>
                                    <th className="text-end">Amount Received</th>
                                    <th>Method</th>
                                    <th>Reference</th>
                                    <th>Status</th>
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
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    ) : <p>No payment transactions recorded yet.</p>}
                </Card.Body>
            </Card>
            
            {/* Communication Log ... (same as before) */}
            {communication_log.length > 0 && (
                 <Card className="shadow-sm">
                    <Card.Header><h5 className="mb-0">Communication Log</h5></Card.Header>
                    <Card.Body>
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
                    </Card.Body>
                </Card>
            )}

            {/* Payment Modal (same as before) */}
            <Modal show={showPaymentModal} onHide={handleClosePaymentModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title><DollarSignIcon size={24} className="me-2" />Make a Payment</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handlePaymentSubmit}>
                    <Modal.Body>
                        {paymentSuccess && <Alert variant="success">{paymentSuccess}</Alert>}
                        {paymentError && <Alert variant="danger">{paymentError}</Alert>}
                        <Form.Group className="mb-3" controlId="paymentAmountModal"> {/* Changed ID to avoid conflict */}
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
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="paymentMethodModal"> {/* Changed ID */}
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
                        <Button variant="primary" type="submit" disabled={paymentSubmitting || !paymentAmount}>
                            {paymentSubmitting ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Processing...</> : 'Proceed to Pay'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* Foreclosure Quote Modal (updated Pay button) */}
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
                                    handleShowPaymentModal(foreclosureQuote.totalForeclosureAmount);
                                    }}>
                                    <DollarSignIcon size={18} className="me-1" /> Initiate Foreclosure Payment
                                </Button>
                                <p className="small mt-1">After successful payment, you may need to confirm the foreclosure.</p>
                            </div>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseForeclosureQuoteModal}>Close</Button>
                </Modal.Footer>
            </Modal>

            {/* Confirm Foreclosure Modal */}
            <Modal show={showConfirmForeclosureModal} onHide={handleCloseConfirmForeclosureModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title><Send size={24} className="me-2" />Confirm Foreclosure Payment</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleConfirmForeclosureSubmit}>
                    <Modal.Body>
                        {confirmForeclosureSuccess && <Alert variant="success">{confirmForeclosureSuccess}</Alert>}
                        {confirmForeclosureError && <Alert variant="danger">{confirmForeclosureError}</Alert>}
                        <p>Please confirm that you have successfully paid the foreclosure amount of <strong>{formatCurrency(foreclosureQuote?.totalForeclosureAmount)}</strong>.</p>
                        <Form.Group className="mb-3" controlId="foreclosurePaymentRef">
                            <Form.Label>Payment Reference ID (Optional but Recommended)</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter payment transaction ID or reference"
                                value={foreclosurePaymentRef}
                                onChange={(e) => setForeclosurePaymentRef(e.target.value)}
                                disabled={confirmForeclosureSubmitting}
                            />
                        </Form.Group>
                         <Alert variant="warning" size="sm">
                            <AlertTriangle size={16} className="me-1"/> Ensure the payment has been successfully processed before confirming. This action will attempt to formally close your loan.
                        </Alert>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseConfirmForeclosureModal} disabled={confirmForeclosureSubmitting}>
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit" disabled={confirmForeclosureSubmitting || !foreclosureQuote}>
                            {confirmForeclosureSubmitting ? <><Spinner as="span" animation="border" size="sm" /> Confirming...</> : 'Confirm Foreclosure'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

        </Container>
    );
}
