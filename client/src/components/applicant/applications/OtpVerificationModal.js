// src/components/application/OtpVerificationModal.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { Modal, Form, Button, Spinner, Alert, InputGroup } from 'react-bootstrap';
import { MessageSquareText, RefreshCw } from 'lucide-react';
import { axiosInstance } from '../../../config'; // Assuming axiosInstance is correctly configured

const OtpVerificationModal = ({ show, handleClose, mobileNumber, loanTitle, onSubmitOtp, loanId }) => {
    const [otp, setOtp] = useState('');
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [otpSentSuccessfully, setOtpSentSuccessfully] = useState(false);
    const [sendError, setSendError] = useState('');
    const [verifyError, setVerifyError] = useState('');
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
        setVerifyError(''); // Clear previous verification errors
        if (!isResend) setOtpSentSuccessfully(false); // Reset sent status only if it's not a resend

        try {
            // Construct the message for the OTP.
            // IMPORTANT: The backend should generate and manage the actual OTP.
            // This message is a template that the backend might use.
            let message = `Your One-Time Password for your loan application`;
            if (loanTitle) {
                message += ` for "${loanTitle}"`;
            }
            message += ` is {OTP}. This OTP is valid for 5 minutes. Please do not share it with anyone.`;

            const payload = {
                mobileNumber: mobileNumber,
                message: message, // The backend should replace {OTP}
                // loanId: loanId, // Optional: Include loanId if your backend OTP service requires it for context
            };

            console.log("Sending OTP request with payload:", payload);
            // Replace '/api/otp/send' with your actual backend endpoint for sending OTP
            // This endpoint should handle OTP generation and sending via SMS gateway.
            await axiosInstance.post('/api/otp/send', payload);

            setOtpSentSuccessfully(true);
            startResendTimer(); // Start timer for resend option
        } catch (error) {
            console.error("Error sending OTP:", error);
            const errMsg = error.response?.data?.error || error.response?.data?.message || "Failed to send OTP. Please try again.";
            setSendError(errMsg);
            setOtpSentSuccessfully(false);
        } finally {
            setIsSendingOtp(false);
        }
    }, [mobileNumber, loanTitle, loanId, startResendTimer]); // Added loanId to dependencies

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
        setVerifyError('');
        if (!otp || !/^\d{4,6}$/.test(otp)) { // Basic validation for 4-6 digit OTP
            setVerifyError("Please enter a valid OTP (4-6 digits).");
            return;
        }
        onSubmitOtp(otp); // Pass the entered OTP to the parent component
    };

    // Handles closing the modal and resetting its internal state
    const handleModalCloseInternal = () => {
        setOtp('');
        // Don't reset otpSentSuccessfully here if you want the "OTP sent to..." message to persist
        // until a new attempt or successful verification.
        // setOtpSentSuccessfully(false);
        setSendError('');
        setVerifyError('');
        clearTimer();
        setResendTimer(0);
        handleClose(); // Call parent's close handler
    }

    // Handles the resend OTP action
    const handleResendOtp = () => {
        if (resendTimer === 0 && !isSendingOtp && mobileNumber) {
            setOtp(''); // Clear previous OTP input
            sendOtpRequest(true); // true indicates it's a resend action
        }
    }

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
                {/* Display error if OTP verification failed */}
                {verifyError && <Alert variant="danger" className="text-center small py-2">{verifyError}</Alert>}

                {/* Message indicating OTP has been sent */}
                {otpSentSuccessfully && !sendError && (
                    <Alert variant="success" className="text-center small py-2">
                        An OTP has been sent to your mobile number: <strong>{mobileNumber}</strong>.
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
                                type="text" // Using text to allow better control over input format
                                placeholder="Enter 4-6 digit OTP"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} // Allow only digits, max 6
                                maxLength={6}
                                disabled={!otpSentSuccessfully || isSendingOtp || !mobileNumber} // Disable if OTP not sent or currently sending
                                required
                                autoFocus // Focus on this field when modal opens
                                className="text-center fs-5"
                                style={{ letterSpacing: '0.5em' }} // Adds spacing between digits
                            />
                        </InputGroup>
                    </Form.Group>

                    <div className="d-flex justify-content-end align-items-center mb-3">
                        <Button
                            variant="link"
                            onClick={handleResendOtp}
                            disabled={resendTimer > 0 || isSendingOtp || !mobileNumber || !otpSentSuccessfully} // Disable if timer active, sending, no number, or initial send failed
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
                            disabled={isSendingOtp || !otpSentSuccessfully || !otp || !mobileNumber || otp.length < 4} // Disable if OTP not fully entered or conditions not met
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
    mobileNumber: PropTypes.string, // Mobile number to send OTP to
    loanTitle: PropTypes.string,    // Optional: For context in the OTP message
    onSubmitOtp: PropTypes.func.isRequired, // Callback when user submits OTP
    loanId: PropTypes.string        // Optional: If backend needs loanId for OTP context
};

export default OtpVerificationModal;