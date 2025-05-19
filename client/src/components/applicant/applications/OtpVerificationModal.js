// src/components/application/OtpVerificationModal.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { Modal, Form, Button, Spinner, Alert, InputGroup } from 'react-bootstrap';
import { MessageSquareText, RefreshCw } from 'lucide-react';
import { axiosInstance } from '../../../config'; // Assuming axiosInstance is correctly configured

const OtpVerificationModal = ({ show, handleClose, mobileNumber, loanTitle, onSubmitOtp, loanId }) => {
    const [otp, setOtp] = useState('');
    const [currentRequestId, setCurrentRequestId] = useState(null); // To store the requestId from the backend
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [otpSentSuccessfully, setOtpSentSuccessfully] = useState(false);
    const [sendError, setSendError] = useState('');
    const [verifyError, setVerifyError] = useState(''); // This will be set by the parent ApplicationForm
    const [resendTimer, setResendTimer] = useState(0);
    const timerRef = useRef(null);

    // Clears the resend OTP timer
    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Starts the resend OTP timer (e.g., for 60 seconds)
    const startResendTimer = useCallback(() => {
        clearTimer();
        setResendTimer(60);
        timerRef.current = setInterval(() => {
            setResendTimer(prev => {
                if (prev <= 1) {
                    clearTimer();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [clearTimer]);

    // Function to request OTP from the backend
    const sendOtpRequest = useCallback(async (isResend = false) => {
        if (!mobileNumber) {
            setSendError("Mobile number is not available to send OTP.");
            return;
        }
        setIsSendingOtp(true);
        setSendError('');
        setVerifyError(''); // Clear previous local verification errors if any
        if (!isResend) {
            setOtpSentSuccessfully(false);
            setCurrentRequestId(null); // Reset request ID on a new send attempt
        }

        try {
            // The backend now generates the message, so we only send mobileNumber.
            // The loanTitle and loanId might still be useful if your backend
            // uses them for logging or context, but not for the message itself.
            const payload = {
                mobileNumber: mobileNumber,
                // loanId: loanId, // Optional: if backend uses it for context
                // loanTitle: loanTitle // Optional: for logging or context
            };

            console.log("Sending OTP request with payload:", payload);
            const response = await axiosInstance.post('/api/otp/send', payload);

            if (response.data && response.data.requestId) {
                setCurrentRequestId(response.data.requestId); // Store the requestId
                setOtpSentSuccessfully(true);
                startResendTimer();
                console.log("OTP Sent. Request ID:", response.data.requestId);
            } else {
                // This case should ideally be handled by the error block if API doesn't return requestId on success
                console.error("OTP send response missing requestId:", response.data);
                setSendError(response.data.message || "Failed to initialize OTP process. Request ID missing.");
                setOtpSentSuccessfully(false);
            }
        } catch (error) {
            console.error("Error sending OTP:", error);
            const errMsg = error.response?.data?.error || error.response?.data?.message || "Failed to send OTP. Please try again.";
            setSendError(errMsg);
            setOtpSentSuccessfully(false);
            setCurrentRequestId(null);
        } finally {
            setIsSendingOtp(false);
        }
    }, [mobileNumber, startResendTimer, loanId, loanTitle]); // Dependencies for sendOtpRequest

    // Effect to automatically send OTP when the modal becomes visible and conditions are met
    useEffect(() => {
        if (show && mobileNumber && !otpSentSuccessfully && !isSendingOtp && !sendError) {
            sendOtpRequest(false); // Initial OTP send
        }
        // Cleanup timer if modal is hidden or component unmounts
        return () => {
            clearTimer();
        };
    }, [show, mobileNumber, otpSentSuccessfully, isSendingOtp, sendError, sendOtpRequest, clearTimer]);

    // Handles the submission of the entered OTP
    const handleSubmitOtp = (e) => {
        e.preventDefault();
        setVerifyError(''); // Clear local error message
        if (!otp || !/^\d{4,6}$/.test(otp)) {
            setVerifyError("Please enter a valid OTP (4-6 digits)."); // Local validation
            return;
        }
        if (!currentRequestId) {
            setVerifyError("Cannot verify OTP. Session ID is missing. Please try sending OTP again.");
            return;
        }
        // Pass currentRequestId and otp to the parent (ApplicationForm) for actual verification
        onSubmitOtp(currentRequestId, otp);
    };

    // Handles closing the modal and resetting its internal state
    const handleModalCloseInternal = () => {
        setOtp('');
        // Do not reset otpSentSuccessfully or currentRequestId here if you want the "OTP sent to..." message
        // and the ability to verify to persist if the user reopens the modal without a new send.
        // However, if closing means cancelling the current OTP flow, then reset them:
        // setOtpSentSuccessfully(false);
        // setCurrentRequestId(null);

        setSendError('');
        setVerifyError(''); // Clear local verify error on close
        clearTimer();
        setResendTimer(0);
        handleClose(); // Call parent's close handler
    }

    // Handles the resend OTP action
    const handleResendOtp = () => {
        if (resendTimer === 0 && !isSendingOtp && mobileNumber) {
            setOtp(''); // Clear previous OTP input
            sendOtpRequest(true); // true indicates it's a resend action, will get a new requestId
        }
    }

    // Propagate verification error from parent (ApplicationForm)
    // This useEffect is if onSubmitOtp in parent sets an error that needs to be displayed here.
    // For this component, verifyError state is mainly for its own input validation.
    // The actual API verification error will be handled in ApplicationForm.js
    // and displayed there. If you want to show parent's verify error here,
    // you'd need to pass it as a prop. For now, this `verifyError` is local.

    return (
        <Modal show={show} onHide={handleModalCloseInternal} centered backdrop="static" keyboard={false}>
            <Modal.Header closeButton>
                <Modal.Title>
                    <MessageSquareText size={24} className="me-2 align-middle" />
                    Verify Mobile Number
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {/* Display error if OTP sending failed */}
                {sendError && <Alert variant="danger" className="text-center small py-2">{sendError}</Alert>}
                {/* Display error if local OTP input validation failed */}
                {verifyError && <Alert variant="danger" className="text-center small py-2">{verifyError}</Alert>}

                {/* Message indicating OTP has been sent */}
                {otpSentSuccessfully && !sendError && (
                    <Alert variant="success" className="text-center small py-2">
                        An OTP has been sent to your mobile number: <strong>{mobileNumber}</strong>.
                        {currentRequestId && <small className="d-block text-muted">Ref ID: {currentRequestId.substring(0,8)}...</small>}
                    </Alert>
                )}
                {/* Loading spinner while sending OTP */}
                 {!otpSentSuccessfully && isSendingOtp && (
                    <Alert variant="info" className="text-center small py-2">
                        <Spinner animation="border" size="sm" className="me-2" /> Sending OTP...
                    </Alert>
                )}
                {/* Initial state or if mobile number is missing */}
                {!otpSentSuccessfully && !isSendingOtp && !sendError && !mobileNumber && (
                     <Alert variant="warning" className="text-center small py-2">
                        Mobile number not provided for OTP. Please ensure it's filled in the form.
                     </Alert>
                )}


                <Form onSubmit={handleSubmitOtp}>
                    <Form.Group className="mb-3" controlId="otpInputModal">
                        <Form.Label>Enter OTP</Form.Label>
                        <InputGroup>
                            <Form.Control
                                type="text"
                                placeholder="Enter 4-6 digit OTP"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                maxLength={6}
                                disabled={!otpSentSuccessfully || isSendingOtp || !mobileNumber || !currentRequestId}
                                required
                                autoFocus
                                className="text-center fs-5"
                                style={{ letterSpacing: '0.5em' }}
                            />
                        </InputGroup>
                    </Form.Group>

                    <div className="d-flex justify-content-end align-items-center mb-3">
                        <Button
                            variant="link"
                            onClick={handleResendOtp}
                            disabled={resendTimer > 0 || isSendingOtp || !mobileNumber} // Removed !otpSentSuccessfully as resend should be possible if initial send failed but number is present
                            size="sm"
                            className="p-0 text-decoration-none"
                        >
                           <RefreshCw size={14} className="me-1 align-middle" />
                           Resend OTP {resendTimer > 0 ? `(${resendTimer}s)` : ''}
                        </Button>
                    </div>

                    <div className="d-grid">
                        <Button 
                            variant="primary" 
                            type="submit" 
                            disabled={isSendingOtp || !otpSentSuccessfully || !otp || !mobileNumber || otp.length < 4 || !currentRequestId}
                        >
                            Verify & Proceed
                        </Button>
                    </div>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

OtpVerificationModal.propTypes = {
    show: PropTypes.bool.isRequired,
    handleClose: PropTypes.func.isRequired,
    mobileNumber: PropTypes.string,
    loanTitle: PropTypes.string,    // Kept for potential logging, not for message construction
    onSubmitOtp: PropTypes.func.isRequired, // Now expects (requestId, otp)
    loanId: PropTypes.string        // Kept for potential logging
};

export default OtpVerificationModal;