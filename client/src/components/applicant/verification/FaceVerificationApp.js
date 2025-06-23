// src/components/verification/FaceVerificationApp.js
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Card,
  Form,
  Button,
  Alert,
  Spinner,
  Image,
  Stack,
} from "react-bootstrap";
import PropTypes from "prop-types";
import io from "socket.io-client";
import "bootstrap/dist/css/bootstrap.min.css";
import { axiosInstance } from "../../../config"; // To fetch reference image from main app backend
import { FaCheckCircle, FaCamera, FaUserCheck, FaExclamationTriangle } from "react-icons/fa";

// --- Configuration ---
const FACE_VERIFICATION_SERVICE_BASE_URL = "https://45vz631c-5000.inc1.devtunnels.ms"; // Your FV Service URL
const FV_INITIAL_IMAGE_UPLOAD_URL = `${FACE_VERIFICATION_SERVICE_BASE_URL}/upload_target`;
const FV_SOCKET_SERVER_URL = FACE_VERIFICATION_SERVICE_BASE_URL;

const FRAME_INTERVAL_MS = 200; // Approx 5 FPS
const VERIFICATION_TIMEOUT_MS = 10000; // 10 seconds for live verification
const START_FRAMING_DELAY_MS = 500; // Small delay before sending frames

// --- User-Friendly Text ---
const MESSAGES = {
  initializing: "Initializing...",
  serviceConnecting: "Connecting to verification service...",
  serviceConnected: "Service connected.",
  fetchingReference: "Loading your reference photo...",
  processingReference: "Analyzing your reference photo...",
  referenceReady: "Ready for your live check.",
  referenceFetchFailed: "Could not load your reference photo. Please check your connection and try again.",
  referenceProcessFailed: "Could not process the reference photo. The image might be unclear.",
  selectManualImage: "Select a clear photo of your face.",
  useThisImage: "Set as Reference",
  processingManual: "Processing...",
  webcamStarting: "Starting your camera...",
  lookAtCamera: "Look straight at the camera.",
  verifying: "Verifying...",
  success: "Verification Successful!",
  verification_failed: "Verification Failed. Please try again.",
  timeout: "Live verification timed out. Please try again.",
  webcamAccessFailed: "Could not access your camera. Please check browser permissions.",
  webcamPlayFailed: "Could not start the camera feed.",
  connection_failed: "Could not connect to the verification service.",
  userStopped: "Verification cancelled.",
};

// --- Main Component ---
function FaceVerificationApp({ referenceImageId, onVerificationComplete }) {
  // --- State Variables ---
  const [referenceImageFile, setReferenceImageFile] = useState(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState(null);
  const [isReferenceProcessed, setIsReferenceProcessed] = useState(false);
  
  const [manualImage, setManualImage] = useState(null);
  const [manualImagePreview, setManualImagePreview] = useState(null);

  // Status now includes more specific failure states
  const [status, setStatus] = useState("idle"); 
  // idle, connecting, fetching_ref, processing_ref, ready, webcam_starting, streaming, success, 
  // connection_failed, upload_failed, verification_failed
  const [statusMessage, setStatusMessage] = useState(MESSAGES.initializing);
  const [errorMessage, setErrorMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Refs ---
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const allTimersRef = useRef([]);

  // --- Core Functions ---

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    allTimersRef.current.forEach(clearTimeout);
    allTimersRef.current = [];
  }, []);

  const handleFailure = useCallback((failureType, message) => {
    clearAllTimers();
    stopWebcam();
    setIsProcessing(false);
    setStatus(failureType); // e.g., 'connection_failed', 'upload_failed'
    setErrorMessage(message);
    setStatusMessage(message); // Also update main status for immediate feedback
  }, [clearAllTimers, stopWebcam]);
  
  const handleSuccess = useCallback((message) => {
    clearAllTimers();
    stopWebcam();
    setIsProcessing(false);
    setStatus('success');
    setStatusMessage(message);
    setErrorMessage('');
    if (typeof onVerificationComplete === "function") {
      onVerificationComplete(true, message);
    }
  }, [clearAllTimers, stopWebcam, onVerificationComplete]);

  // --- Socket Connection Management ---
  const disconnectSocket = useCallback(() => {
      if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
      }
  }, []);
  
  const ensureSocketConnection = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (socketRef.current?.connected) {
        resolve(socketRef.current);
        return;
      }
      disconnectSocket();
      setStatus('connecting');
      setStatusMessage(MESSAGES.serviceConnecting);
      setErrorMessage('');

      const newSocket = io(FV_SOCKET_SERVER_URL, { reconnectionAttempts: 2, transports: ["polling"] });
      socketRef.current = newSocket;

      const connectErrorHandler = (err) => {
        const errorMsg = err ? err.message : "Connection timed out.";
        handleFailure('connection_failed', `${MESSAGES.connection_failed}`);
        reject(new Error(errorMsg));
      };

      newSocket.on("connect", () => {
        newSocket.off("connect_error", connectErrorHandler); // Remove listener on success
        setStatusMessage(MESSAGES.serviceConnected);
        resolve(newSocket);
      });
      newSocket.on("connect_error", connectErrorHandler);
      newSocket.on("verification_result", (data) => {
        if (data.status === 'success') {
          handleSuccess(data.message);
        } else {
          // All other live verification failures fall here
          handleFailure('verification_failed', data.message);
        }
      });
    });
  }, [disconnectSocket, handleFailure, handleSuccess]);

  // --- Image Handling ---
  const processReferenceImage = useCallback(async (file, socketId) => {
      setIsProcessing(true);
      setStatus("processing_ref");
      setStatusMessage(MESSAGES.processingReference);
      setErrorMessage("");

      const formData = new FormData();
      formData.append("target_image", file);
      formData.append("socket_id", socketId);
      
      try {
          const response = await fetch(FV_INITIAL_IMAGE_UPLOAD_URL, { method: "POST", body: formData });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || "Server could not process image");
          
          setIsReferenceProcessed(true);
          setStatus("ready");
          setStatusMessage(MESSAGES.referenceReady);
      } catch (error) {
          handleFailure('upload_failed', MESSAGES.referenceProcessFailed);
      } finally {
          setIsProcessing(false);
      }
  }, [handleFailure]);
  
  const runInitialSetup = useCallback(async () => {
    if (!referenceImageId) return;
    try {
      setIsProcessing(true);
      setStatus("fetching_ref");
      setStatusMessage(MESSAGES.fetchingReference);
      setErrorMessage('');

      const response = await axiosInstance.get(`/api/image/${referenceImageId}`, { responseType: "blob" });
      const file = new File([response.data], "reference_image.jpg", { type: "image/jpeg" });

      if (referenceImagePreview) URL.revokeObjectURL(referenceImagePreview);
      setReferenceImageFile(file);
      setReferenceImagePreview(URL.createObjectURL(file));

      const socket = await ensureSocketConnection();
      await processReferenceImage(file, socket.id);
    } catch (error) {
      // Errors from ensureSocketConnection or processReferenceImage are handled internally
      // This catch is for the initial axiosInstance fetch
      if (!status.endsWith('_failed')) {
        handleFailure('upload_failed', MESSAGES.referenceFetchFailed);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [referenceImageId, ensureSocketConnection, processReferenceImage, handleFailure]);


  // Effect 1: Initialize and fetch reference image if ID is provided
  useEffect(() => {
    if (referenceImageId) {
        runInitialSetup();
    } else {
        setStatus("idle");
        setStatusMessage(MESSAGES.selectManualImage);
    }
    return () => {
      disconnectSocket();
      clearAllTimers();
      if (referenceImagePreview) URL.revokeObjectURL(referenceImagePreview);
    };
  }, [referenceImageId, runInitialSetup, disconnectSocket, clearAllTimers]);


  // Effect 2: Initialize Canvas
  useEffect(() => { canvasRef.current = document.createElement("canvas"); }, []);

  // --- Live Verification Logic ---
  const startLiveVerification = async () => {
    if (!isReferenceProcessed || isProcessing) return;
    try {
        setIsProcessing(true);
        setErrorMessage("");
        await ensureSocketConnection();
        setStatus("webcam_starting");
        setStatusMessage(MESSAGES.webcamStarting);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
                videoRef.current.play().then(() => {
                    socketRef.current.emit("start_verify");
                    clearAllTimers();
                    const t1 = setTimeout(() => { setStatus('streaming'); setStatusMessage(MESSAGES.lookAtCamera);
                        const t2 = setInterval(() => { if (videoRef.current && !videoRef.current.paused && socketRef.current?.connected) { const canvas = canvasRef.current; const context = canvas.getContext("2d"); canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight; context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height); socketRef.current.emit("video_frame", canvas.toDataURL("image/jpeg", 0.8));}}, FRAME_INTERVAL_MS);
                        allTimersRef.current.push(t2);
                    }, START_FRAMING_DELAY_MS);
                    const t3 = setTimeout(() => { handleFailure('verification_failed', MESSAGES.timeout); socketRef.current.emit("stop_verify"); }, VERIFICATION_TIMEOUT_MS + START_FRAMING_DELAY_MS);
                    allTimersRef.current.push(t1, t3);
                }).catch(() => handleFailure('verification_failed', MESSAGES.webcamPlayFailed));
            };
        }
    } catch (err) {
        handleFailure('verification_failed', MESSAGES.webcamAccessFailed);
    }
  };

  // --- User Action Handlers ---
  const handleManualImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setManualImage(file);
      if (manualImagePreview) URL.revokeObjectURL(manualImagePreview);
      setManualImagePreview(URL.createObjectURL(file));
      setIsReferenceProcessed(false);
      setStatus("idle");
      setErrorMessage("");
    }
  };

  const handleManualImageUpload = async () => {
    if (!manualImage) return;
    try {
        const socket = await ensureSocketConnection();
        await processReferenceImage(manualImage, socket.id);
    } catch (error) { /* Handled internally */ }
  };
  
  // --- RETRY HANDLERS ---
  const handleConnectionOrUploadRetry = () => {
      if (referenceImageId) {
          runInitialSetup(); // Re-run the entire setup for the ID flow
      } else {
          handleManualImageUpload(); // Re-run the manual upload process
      }
  };

  const handleLiveCheckRetry = () => {
      setStatus('ready');
      setStatusMessage(MESSAGES.referenceReady);
      setErrorMessage('');
      startLiveVerification();
  };

  const handleCancel = () => {
      if (socketRef.current?.connected) socketRef.current.emit("stop_verify");
      handleFailure('verification_failed', MESSAGES.userStopped);
      if (typeof onVerificationComplete === "function") {
          onVerificationComplete(false, MESSAGES.userStopped);
      }
  };

  // --- UI Rendering ---
const renderReferenceImage = () => {
      const previewSrc = referenceImageId ? referenceImagePreview : manualImagePreview;
      if (!previewSrc) return null;

      return (
        <div className="d-flex align-items-center p-2 rounded bg-light mb-3">
          <Image src={previewSrc} alt="Reference" thumbnail style={{ maxHeight: "60px", maxWidth: "60px" }} />
          <div className="ms-3">
            <p className="mb-0 small text-muted">Reference Photo</p>
            {isReferenceProcessed && status !== 'success' && (
              <span className="text-success small d-flex align-items-center">
                <FaCheckCircle size={14} className="me-1" /> Ready
              </span>
            )}
          </div>
        </div>
      );
  };
  
  const renderWebcamFeed = () => (
      <div className="text-center mb-3 webcam-feed-container bg-secondary-subtle p-2"
          style={{ minHeight: "180px", display: "flex", justifyContent: "center", alignItems: "center", borderRadius: "8px" }}>
          <video ref={videoRef} style={{ width: "100%", maxWidth: "240px", height: "auto", borderRadius: "4px", display: streamRef.current ? "block" : "none" }} playsInline muted />
          {!streamRef.current && (
              <div className="text-muted text-center">
                  <FaCamera size={30} className="mb-2" />
                  <p className="small m-0">Your camera feed will appear here.</p>
              </div>
          )}
      </div>
  );

  const getStatusVariant = () => {
    if (status === 'success') return 'success';
    if (status.endsWith('_failed')) return 'danger';
    return 'info';
  }

  // RENDER ACTION BUTTONS BASED ON STATUS
  const renderActionButtons = () => {
    if (status === 'success') {
      return (
        <div className="text-center text-success">
          <FaUserCheck size={40} />
          <p className="mt-2 fw-bold">{MESSAGES.success}</p>
        </div>
      );
    }
    
    if (status === 'connection_failed' || status === 'upload_failed') {
      return <Button variant="primary" onClick={handleConnectionOrUploadRetry} disabled={isProcessing}>Retry</Button>;
    }
    
    if (status === 'verification_failed') {
      return <Button variant="primary" onClick={handleLiveCheckRetry}>Try Live Check Again</Button>;
    }
    
    if (isReferenceProcessed && status === 'ready') {
      return (
        <Button variant="primary" onClick={startLiveVerification} disabled={isProcessing}>
          {isProcessing ? <><Spinner size="sm" className="me-1" /> {statusMessage}</> : "Start Live Check"}
        </Button>
      );
    }
    return null; // No primary action button
  };


  return (
    <Card className="face-verification-app-card border-0 shadow-sm">
      <Card.Body className="p-4">
        {!referenceImageId && (
            <div className="mb-3">
                <Form.Group controlId="fvFormFile" className="mb-2">
                    <Form.Label className="small fw-bold">Reference Photo</Form.Label>
                    <Form.Control type="file" accept="image/*" onChange={handleManualImageChange} disabled={isProcessing} size="sm"/>
                </Form.Group>
                {renderReferenceImage()}
                <Button variant="outline-primary" size="sm" className="w-100" onClick={handleManualImageUpload} disabled={!manualImage || isProcessing || isReferenceProcessed}>
                    {isProcessing && status === 'processing_ref' ? (<><Spinner size="sm" className="me-1"/> {MESSAGES.processingManual}</>) : MESSAGES.useThisImage}
                </Button>
            </div>
        )}

        {referenceImageId && renderReferenceImage()}
        {isReferenceProcessed && status !== 'success' && !status.endsWith('_failed') && renderWebcamFeed()}
        
        <Alert variant={getStatusVariant()} className="text-center py-2 small d-flex justify-content-center align-items-center">
          {isProcessing && <Spinner size="sm" className="me-2" />}
          {status.endsWith('_failed') && <FaExclamationTriangle className="me-2"/>}
          <span>{statusMessage}</span>
        </Alert>

        <Stack gap={2} className="mt-3">
          {renderActionButtons()}
          {isProcessing && status !== 'success' && (
            <Button variant="outline-secondary" size="sm" onClick={handleCancel}>Cancel</Button>
          )}
        </Stack>
      </Card.Body>
    </Card>
  );
}

// PropTypes and DefaultProps remain unchanged
FaceVerificationApp.propTypes = {
  referenceImageId: PropTypes.string,
  onVerificationComplete: PropTypes.func.isRequired,
};
FaceVerificationApp.defaultProps = {
    referenceImageId: null,
};

export default FaceVerificationApp;