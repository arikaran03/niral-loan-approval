// src/components/verification/FaceVerificationApp.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Form, Button, Alert, Spinner, Image, Row, Col, Badge } from 'react-bootstrap';
import PropTypes from 'prop-types'; 
import io from 'socket.io-client';
import 'bootstrap/dist/css/bootstrap.min.css';
import { axiosInstance } from '../../../config'; // To fetch reference image from main app backend
import { FaCheckCircle } from 'react-icons/fa';

// --- Configuration for FaceVerificationApp's OWN backend ---
// IMPORTANT: This BASE_URL is for the Face Verification service,
// NOT necessarily the same as the main application's backend.
const FACE_VERIFICATION_SERVICE_BASE_URL = 'https://45vz631c-5000.inc1.devtunnels.ms'; // Your FV Service URL
const FV_INITIAL_IMAGE_UPLOAD_URL = `${FACE_VERIFICATION_SERVICE_BASE_URL}/upload_target`; // For Face Verif. backend
const FV_SOCKET_SERVER_URL = FACE_VERIFICATION_SERVICE_BASE_URL; // For Face Verif. backend

const FRAME_INTERVAL_MS = 200; // Approx 5 FPS
const VERIFICATION_TIMEOUT_MS = 10000; // 10 seconds for live verification part
const START_FRAMING_DELAY_MS = 500; // Delay before starting to send frames

// --- Main Component ---
function FaceVerificationApp({ referenceImageId, onVerificationComplete }) {
  // --- State Variables ---
  // For handling the reference image passed by ID
  const [referenceImageFile, setReferenceImageFile] = useState(null); // Stores the fetched File object
  const [referenceImagePreview, setReferenceImagePreview] = useState(null); // For displaying the fetched image
  const [isFetchingReference, setIsFetchingReference] = useState(false);
  const [fetchReferenceError, setFetchReferenceError] = useState('');
  const [isReferenceProcessedByFVBackend, setIsReferenceProcessedByFVBackend] = useState(false);
  const [processingReferenceError, setProcessingReferenceError] = useState('');

  // For manual upload (will be hidden if referenceImageId is provided)
  const [initialImage, setInitialImage] = useState(null);
  const [initialImagePreviewManual, setInitialImagePreviewManual] = useState(null); 
  const [isUploadingInitial, setIsUploadingInitial] = useState(false); // For manual upload spinner
  const [uploadInitialError, setUploadInitialError] = useState(''); // For manual upload error

  // Common state
  const [socketId, setSocketId] = useState(null); // For FV Service Socket.IO
  const [verificationStatus, setVerificationStatus] = useState('idle');
  // Possible statuses: idle, connecting_socket, fetching_ref, processing_ref, ready_to_verify, webcam_starting, streaming, verifying, success, failed, error
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [webcamError, setWebcamError] = useState('');
  const [socketError, setSocketError] = useState(''); // For FV Socket connection errors


  // --- Refs ---
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null); // For FV Socket.IO instance
  const streamRef = useRef(null);
  const frameIntervalRef = useRef(null); // Stores the setInterval ID
  const verificationTimeoutRef = useRef(null);
  const startFramingTimeoutRef = useRef(null);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      console.log('FV Client: Webcam stopped.');
    }
  }, []); // Empty dependency array: stable function reference

  const resetAllTimers = useCallback(() => {
    if (startFramingTimeoutRef.current) clearTimeout(startFramingTimeoutRef.current);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (verificationTimeoutRef.current) clearTimeout(verificationTimeoutRef.current);
    startFramingTimeoutRef.current = null;
    frameIntervalRef.current = null;
    verificationTimeoutRef.current = null;
    console.log("FV Client: All timers reset.");
  }, []);

  const stopLiveVerificationProcess = useCallback((message, type = 'failed', internalStop = false) => {
    console.log("FV Client: Stopping live verification. Message:", message, "Type:", type);
    resetAllTimers();
    stopWebcam();

    const success = type === 'success';
    // Only update status if it's not already in a terminal success/failure state from a more definitive source
    setVerificationStatus(prevStatus => {
        if (prevStatus === 'success' && !success) return 'success'; // Don't override success with failure
        if (prevStatus === 'failed' && success) return 'success'; // Allow override to success
        return success ? 'success' : 'failed';
    });
    setStatusMessage(message || (success ? 'Verification Successful!' : 'Verification Failed.'));
    
    if (!internalStop && typeof onVerificationComplete === 'function') {
        onVerificationComplete(success, success ? "" : (message || "Verification process ended."));
    }
  }, [stopWebcam, onVerificationComplete, resetAllTimers]);


  // Effect 1: Initialize canvas
  useEffect(() => {
    const c = document.createElement('canvas');
    canvasRef.current = c;
  }, []);

  // Effect 2: Manage Face Verification Socket.IO connection
  useEffect(() => {
    // Connect if we have a referenceImageId to process OR if in manual mode and initialImage is set
    if ((referenceImageId || initialImage) && !socketRef.current) { 
      console.log(`FV Client: Attempting to connect to FV Socket.IO server at ${FV_SOCKET_SERVER_URL} using POLLING only.`);
      setVerificationStatus('connecting_socket');
      setStatusMessage('Connecting to verification service...');

      const newSocket = io(FV_SOCKET_SERVER_URL, { 
        reconnectionAttempts: 3,
        transports: ['polling'] // Force polling, disable WebSocket upgrade
      });
      socketRef.current = newSocket;

      newSocket.on('connect', () => {
        console.log('FV Client: Socket.IO Connected! SID:', newSocket.id, 'Transport:', newSocket.io.engine.transport.name);
        setSocketId(newSocket.id);
        setSocketError('');
        
        // Determine next step based on whether reference image (from ID or manual) is ready
        if (referenceImageFile && !isReferenceProcessedByFVBackend) { // Image fetched via ID is ready
            setStatusMessage('Processing reference image with verification service...');
            uploadReferenceToFVBackend(referenceImageFile, newSocket.id);
        } else if (initialImage && !referenceImageId && !isReferenceProcessedByFVBackend) { // Manual image is ready
            setStatusMessage('Processing uploaded reference image...');
            uploadReferenceToFVBackend(initialImage, newSocket.id);
        } else if (referenceImageId && !referenceImageFile) { // ID provided, but image not fetched yet
            setStatusMessage('Awaiting reference image data...');
        } else if (isReferenceProcessedByFVBackend) { // Already processed
            setStatusMessage('Reference ready. Click "Start Live Verification".');
            setVerificationStatus('ready_to_verify');
        } else if (!referenceImageId && !initialImage) { // Manual mode, no image selected yet
             setStatusMessage('Please select a reference image.');
             setVerificationStatus('idle'); // Or a specific state like 'awaiting_manual_image'
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('FV Client: Socket.IO Disconnected. Reason:', reason);
        setSocketId(null);
        if (frameIntervalRef.current || verificationTimeoutRef.current || startFramingTimeoutRef.current) {
          stopLiveVerificationProcess('Disconnected from verification service.', 'failed');
        } else {
          setVerificationStatus('error'); 
        }
        if (reason !== 'io client disconnect') {
          setSocketError('Disconnected from verification service.');
        }
      });

      newSocket.on('connect_error', (err) => {
        console.error('FV Client: Socket.IO Connection Error:', err);
        const errMsg = `FV Service Connection Error: ${err.message}`;
        setSocketError(errMsg);
        setVerificationStatus('error');
        if (typeof onVerificationComplete === 'function') onVerificationComplete(false, errMsg);
      });

      newSocket.on('verification_status', (data) => { 
        console.log('FV Client: FV Server "verification_status":', data);
        setStatusMessage(data.message || 'Verification server processing...');
        if (data.status === 'started' && verificationStatus !== 'streaming' && verificationStatus !== 'verifying') {
          // Ensure client is in a state that expects streaming to start
           setVerificationStatus(prevStatus => (prevStatus === 'webcam_starting' || prevStatus === 'ready_to_verify') ? 'streaming' : prevStatus);
        }
      });

      newSocket.on('verification_result', (data) => { 
        console.log('FV Client: FV Server "verification_result":', data);
        const isActiveClientProcess = frameIntervalRef.current || verificationTimeoutRef.current || startFramingTimeoutRef.current;

        if (isActiveClientProcess) {
            stopLiveVerificationProcess(data.message, data.status);
        } else { // Process was already stopped on client, but server might send a late result
             console.log("FV Client: Received 'verification_result' but client process was already stopped/not active:", data);
             if (data.status === 'success' && verificationStatus !== 'success') {
                console.warn("FV Client: Server reported SUCCESS after client process was stopped/failed. Overriding to success.");
                stopLiveVerificationProcess(data.message, 'success', true); // internalStop = true to prevent double callback
             }
             // If server says failed and client already failed, it's fine.
        }
      });
    }
    return () => { 
      if (socketRef.current) {
        console.log('FV Client: Cleaning up FV socket connection.');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      resetAllTimers(); 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceImageId, initialImage]); // Dependencies control when to attempt initial socket connection

  // Effect 3: Fetch reference image using referenceImageId (if provided)
  useEffect(() => {
    // Only fetch if referenceImageId is present, we haven't started fetching, and no file is loaded yet, and no major error
    if (referenceImageId && !referenceImageFile && !isFetchingReference && verificationStatus !== 'error') {
      const fetchImage = async () => {
        console.log(`FV Client: Fetching reference image with ID: ${referenceImageId}`);
        setIsFetchingReference(true);
        setFetchReferenceError('');
        setVerificationStatus('fetching_ref');
        setStatusMessage('Fetching reference photo for verification...');
        try {
          // API endpoint to get image data from your MAIN application backend
          const response = await axiosInstance.get(`/api/image/${referenceImageId}`, { 
            responseType: 'blob', 
          });
          const file = new File([response.data], "reference_image.jpg", { type: response.data.type || 'image/jpeg' });
          setReferenceImageFile(file); // This state update will be caught by Effect 4
          if(referenceImagePreview) URL.revokeObjectURL(referenceImagePreview); // Clean up old preview
          setReferenceImagePreview(URL.createObjectURL(file));
          setIsFetchingReference(false);
          // Don't immediately call uploadReferenceToFVBackend here, let Effect 4 handle it when socket is also ready
          setStatusMessage('Reference photo fetched. Waiting for verification service connection if not already connected...');

        } catch (error) {
          console.error('FV Client: Error fetching reference image:', error);
          const errMsg = `Failed to fetch reference image: ${error.response?.data?.message || error.message}`;
          setFetchReferenceError(errMsg);
          setIsFetchingReference(false);
          setVerificationStatus('error');
          if (typeof onVerificationComplete === 'function') onVerificationComplete(false, errMsg);
        }
      };
      fetchImage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceImageId, onVerificationComplete]); // Removed file and fetching state from deps to avoid loops, relies on initial check

  // Effect 4: Process reference image (if it becomes available and socket is ready)
  useEffect(() => {
    // This effect triggers when the image file is ready (either fetched or manually set) AND socket is connected
    if (socketRef.current && socketRef.current.connected && socketId && !isReferenceProcessedByFVBackend && verificationStatus !== 'processing_ref') {
        const imageToProcess = referenceImageId ? referenceImageFile : initialImage;
        if (imageToProcess) {
            console.log("FV Client: Effect4 trigger - Socket connected and reference image ready. Uploading to FV backend.");
            uploadReferenceToFVBackend(imageToProcess, socketId);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceImageFile, initialImage, socketId, isReferenceProcessedByFVBackend, referenceImageId, verificationStatus]);

  const uploadReferenceToFVBackend = async (fileToProcess, currentSocketId) => {
    if (!fileToProcess || !currentSocketId) {
        console.warn("FV Client: Cannot process reference, file or socketId missing.");
        const errMsg = "Internal error: Missing data for reference processing.";
        setProcessingReferenceError(errMsg);
        setVerificationStatus('error');
        if(typeof onVerificationComplete === 'function') onVerificationComplete(false, errMsg);
        return;
    }
    console.log(`FV Client: Uploading reference to FV backend. Socket ID: ${currentSocketId}`);
    setVerificationStatus('processing_ref');
    setStatusMessage('Preparing reference image for verification...');
    setProcessingReferenceError('');
    setIsUploadingInitial(true); // Used for spinner in manual mode

    const formData = new FormData();
    formData.append('target_image', fileToProcess);
    formData.append('socket_id', currentSocketId);

    try {
      const response = await fetch(FV_INITIAL_IMAGE_UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `FV Backend Error: ${response.status}`);
      }
      console.log('FV Client: Reference image processed by FV backend successfully.', result);
      setIsReferenceProcessedByFVBackend(true);
      setVerificationStatus('ready_to_verify');
      setStatusMessage('Reference image ready. Click "Start Live Verification".');
      if (!referenceImageId) setUploadInitialError(''); // Clear manual upload error on success
    } catch (error) {
      console.error('FV Client: Error processing reference image with FV backend:', error);
      const errMsg = `Failed to prepare reference: ${error.message}`;
      setProcessingReferenceError(errMsg);
      if (!referenceImageId) setUploadInitialError(errMsg); // Show error for manual upload
      setVerificationStatus('error');
      if (typeof onVerificationComplete === 'function') onVerificationComplete(false, errMsg);
    } finally {
        setIsUploadingInitial(false);
    }
  };

  const handleManualImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setInitialImage(file);
      if(initialImagePreviewManual) URL.revokeObjectURL(initialImagePreviewManual);
      setInitialImagePreviewManual(URL.createObjectURL(file));
      setUploadInitialError('');
      setIsReferenceProcessedByFVBackend(false); 
      setProcessingReferenceError(''); 
      setVerificationStatus('idle'); // Reset status to allow processing
      setStatusMessage('Manual image selected. Click "Use This Image" to process.');
    } else {
      setInitialImage(null);
      if(initialImagePreviewManual) URL.revokeObjectURL(initialImagePreviewManual);
      setInitialImagePreviewManual(null);
    }
  };

  const handleManualImageUpload = () => { 
    if (!initialImage) {
      setUploadInitialError('Please select an image first.');
      return;
    }
    if (!socketId) { // Check if socket is connected
      setUploadInitialError('Not connected to verification service. Please wait.');
      // Attempt to connect socket if not already trying
      if(!socketRef.current) {
          // This will trigger Effect 2
          console.log("FV Client: Manual upload triggered, attempting socket connection first.");
          setStatusMessage("Connecting to service for manual upload...");
          // The effect will handle the rest once connected
      }
      return;
    }
    // If socket is connected, proceed to upload
    uploadReferenceToFVBackend(initialImage, socketId);
  };


  const sendFrameToFVServer = useCallback(() => {
    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || !canvasRef.current || !socketRef.current || !socketRef.current.connected) {
      return;
    }
    // This check is crucial: only send frames if in the correct state
    if (verificationStatus !== 'streaming' && verificationStatus !== 'verifying') {
      // console.warn(`FV Client: Not sending frame, status is ${verificationStatus}`);
      return;
    }
    const video = videoRef.current; const canvas = canvasRef.current; const context = canvas.getContext('2d');
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frameDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    try {
      socketRef.current.emit('video_frame', frameDataUrl);
    } catch (e) {
      console.error("FV Client: Error sending frame:", e);
      stopLiveVerificationProcess('Error sending frame data.', 'failed');
    }
  }, [verificationStatus, stopLiveVerificationProcess]);

  useEffect(() => { // Manages the frame sending interval
    let intervalId = null;
    if (verificationStatus === 'streaming' || verificationStatus === 'verifying') {
      if (!frameIntervalRef.current) { 
        intervalId = setInterval(sendFrameToFVServer, FRAME_INTERVAL_MS);
        frameIntervalRef.current = intervalId;
        console.log("FV Client: Frame sending interval started.", intervalId);
      }
    } else { // Not streaming or verifying
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
        console.log("FV Client: Frame sending interval cleared because status is no longer streaming/verifying.");
      }
    }
    return () => { 
      if (frameIntervalRef.current) { 
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
         console.log("FV Client: Frame sending interval cleared on effect cleanup for verificationStatus/sendFrameToFVServer.");
      }
    };
  }, [verificationStatus, sendFrameToFVServer]);


  const startLiveVerification = async () => {
    if (!isReferenceProcessedByFVBackend) {
      setStatusMessage('Reference image not yet processed. Please wait.');
      setProcessingReferenceError('Reference image not ready for verification.');
      if(typeof onVerificationComplete === 'function') onVerificationComplete(false, 'Reference image not ready.');
      return;
    }
    if (!socketRef.current || !socketRef.current.connected) {
      setStatusMessage('Not connected to verification service.');
      setSocketError('Not connected to the verification service.');
      if(typeof onVerificationComplete === 'function') onVerificationComplete(false, 'Not connected to verification service.');
      return;
    }
    setVerificationStatus('webcam_starting');
    setStatusMessage('Initializing webcam...');
    setWebcamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current.play();
            console.log('FV Client: Webcam video playing.');
            setStatusMessage('Camera active. Starting live verification...');
            socketRef.current.emit('start_verify'); 
            
            resetAllTimers(); 

            startFramingTimeoutRef.current = setTimeout(() => {
              if (streamRef.current && streamRef.current.active) {
                console.log('FV Client: Delay complete. Setting status to STREAMING.');
                setVerificationStatus('streaming'); // This will trigger the useEffect for setInterval
              } else {
                stopLiveVerificationProcess('Webcam became inactive.', 'failed');
              }
            }, START_FRAMING_DELAY_MS);

            const totalClientTimeout = VERIFICATION_TIMEOUT_MS + START_FRAMING_DELAY_MS;
            verificationTimeoutRef.current = setTimeout(() => {
              console.log("FV Client: Overall verification timeout.");
              if (frameIntervalRef.current || startFramingTimeoutRef.current) {
                if (socketRef.current && socketRef.current.connected) socketRef.current.emit('stop_verify');
                stopLiveVerificationProcess('Live verification timed out.', 'failed');
              }
            }, totalClientTimeout);
          } catch (playError) {
            console.error('FV Client: Video play failed:', playError);
            setWebcamError('Could not play video stream.');
            setVerificationStatus('error');
            stopWebcam();
            if(typeof onVerificationComplete === 'function') onVerificationComplete(false, 'Could not play video stream.');
          }
        };
        if (videoRef.current.readyState >= 2) videoRef.current.onloadedmetadata();
      }
    } catch (err) {
      console.error('FV Client: Error accessing webcam:', err);
      const errMsg = `Failed to access webcam: ${err.message}.`;
      setWebcamError(errMsg);
      setVerificationStatus('error');
      if(typeof onVerificationComplete === 'function') onVerificationComplete(false, errMsg);
    }
  };

  const handleStopProcessByUser = () => {
    console.log("FV Client: User clicked stop process.");
    if (socketRef.current && socketRef.current.connected && (frameIntervalRef.current || verificationTimeoutRef.current || startFramingTimeoutRef.current)) {
      socketRef.current.emit('stop_verify');
    }
    stopLiveVerificationProcess('Live verification stopped by user.', 'failed'); 
  };

  // UI Rendering
  if (referenceImageId && isFetchingReference) {
    return (
        <div className="text-center my-3 p-3 border rounded bg-light">
            <Spinner animation="border" size="sm" className="me-2"/> Fetching reference photo for verification...
        </div>
    );
  }
  if (referenceImageId && fetchReferenceError) {
    return <Alert variant="danger" className="py-2">{fetchReferenceError}</Alert>;
  }
  if (referenceImageId && !referenceImageFile && !isFetchingReference && verificationStatus !== 'error') {
      return <Alert variant="info">Preparing reference image...</Alert>;
  }


  const getOverallStatusVariant = () => {
    if (verificationStatus === 'success') return 'success';
    if (verificationStatus === 'failed' || verificationStatus === 'error' || webcamError || socketError || fetchReferenceError || processingReferenceError) return 'danger';
    return 'info';
  };
  
  const isLoading = ['connecting_socket', 'fetching_ref', 'processing_ref', 'webcam_starting', 'streaming', 'verifying'].includes(verificationStatus);


  return (
    <Card className="face-verification-app-card shadow-sm"> 
        <Card.Body>
            {!referenceImageId && (
                <div className="mb-4 p-3 border rounded">
                    <h6 className="mb-3">Reference Image for Verification</h6>
                    <Form.Group controlId="fvFormFile" className="mb-2">
                    <Form.Label className="small">Select an image for reference:</Form.Label>
                    <Form.Control 
                        type="file" 
                        accept="image/*" 
                        onChange={handleManualImageChange} 
                        disabled={isUploadingInitial || isLoading || verificationStatus === 'success'}
                        size="sm"
                    />
                    </Form.Group>
                    {initialImagePreviewManual && (
                    <div className="text-center mb-2">
                        <Image src={initialImagePreviewManual} alt="Manual preview" thumbnail style={{ maxHeight: '100px' }} />
                    </div>
                    )}
                    {uploadInitialError && <Alert variant="danger" className="mt-1 py-1 small">{uploadInitialError}</Alert>}
                    
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={handleManualImageUpload}
                        disabled={!initialImage || isUploadingInitial || isLoading || isReferenceProcessedByFVBackend || verificationStatus === 'success'}
                        className="w-100"
                    >
                    {isUploadingInitial && verificationStatus === 'processing_ref' ? <><Spinner as="span" animation="border" size="sm" /> Processing...</> : 'Use This Image as Reference'}
                    </Button>
                </div>
            )}

            {referenceImageId && referenceImagePreview && !isFetchingReference && (
                <Row className="mb-3 align-items-center p-2 border rounded bg-light-subtle">
                    <Col xs="auto">
                        <Image src={referenceImagePreview} alt="Reference preview" thumbnail style={{ maxHeight: '70px', maxWidth: '70px' }} />
                    </Col>
                    <Col>
                        <small className="text-muted d-block">Reference photo (from Aadhaar) loaded.</small>
                        {isReferenceProcessedByFVBackend && verificationStatus !== 'success' && verificationStatus !== 'failed' &&
                            <Badge bg="light" text="success" pill className="border border-success"><FaCheckCircle size={12}/> Ready for live check</Badge>
                        }
                         {verificationStatus === 'processing_ref' &&
                            <Badge bg="light" text="info" pill className="border border-info"><Spinner size="sm" animation="border" className="me-1"/> Processing ref...</Badge>
                        }
                    </Col>
                </Row>
            )}
            {processingReferenceError && <Alert variant="danger" className="py-1 small">{processingReferenceError}</Alert>}

            {(isReferenceProcessedByFVBackend || (!referenceImageId && isReferenceProcessedByFVBackend) ) && 
             verificationStatus !== 'success' && verificationStatus !== 'failed' && verificationStatus !== 'error' && (
                 <>
                    <div className="text-center mb-2 webcam-feed-container bg-light p-1" style={{minHeight: '180px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px dashed #ccc', borderRadius:'4px'}}>
                        <video 
                            ref={videoRef} 
                            style={{ width: '100%', maxWidth: '240px', height:'auto', borderRadius: '4px', display: streamRef.current ? 'block' : 'none' }} 
                            playsInline muted
                        >Webcam feed</video>
                        {!streamRef.current && <p className="text-muted small m-0">Webcam will appear here for live verification.</p>}
                    </div>
                    {webcamError && <Alert variant="danger" className="mt-1 py-1 small">{webcamError}</Alert>}
                 </>
            )}

            <Alert variant={getOverallStatusVariant()} className="text-center py-2 status-alert small">
                {isLoading && <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2"/>}
                {statusMessage}
            </Alert>

            {verificationStatus !== 'success' && ( 
                 <div className="d-grid gap-2 mt-2">
                    <Button
                        variant="primary"
                        onClick={startLiveVerification}
                        disabled={!isReferenceProcessedByFVBackend || isLoading || verificationStatus === 'success' || verificationStatus === 'webcam_starting' || verificationStatus === 'streaming' || verificationStatus === 'verifying' }
                        size="sm"
                    >
                        { (verificationStatus === 'webcam_starting' || verificationStatus === 'streaming' || verificationStatus === 'verifying') ? 
                            <><Spinner as="span" animation="border" size="sm"/> Verifying Live...</> : 
                            'Start Live Verification'
                        }
                    </Button>
                    { (isLoading || verificationStatus === 'failed' || verificationStatus === 'error' || verificationStatus === 'ready_to_verify') && verificationStatus !== 'idle' && verificationStatus !== 'success' &&
                        <Button variant="outline-secondary" size="xs" onClick={handleStopProcessByUser}>
                            Cancel
                        </Button>
                    }
                </div>
            )}
        </Card.Body>
    </Card>
  );
}

FaceVerificationApp.propTypes = {
    referenceImageId: PropTypes.string, 
    onVerificationComplete: PropTypes.func.isRequired,
};

export default FaceVerificationApp;
