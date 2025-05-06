// src/components/admin/FormBuilderContainer.js

import React, { useState, useEffect, useCallback, useRef } from 'react';
// Import Link along with other router hooks
import { useParams, useNavigate, Link } from 'react-router-dom';
import LoanFormBuilder from './LoanFormBuilder';
import { axiosInstance } from "../../config";
import {
    Container,
    Row,
    Col,
    Button,
    Spinner,
    Alert,
    Card,
    Breadcrumb, // Keep Breadcrumb
    InputGroup, // Keep InputGroup
    FormControl // Keep FormControl
} from 'react-bootstrap';
import {
    FaPlus,
    FaInfoCircle,
    FaExclamationTriangle,
    FaCheckCircle,
    FaEdit,
    FaSync,
    FaSearch // Keep FaSearch
} from 'react-icons/fa';

const FormBuilderContainer = () => {
    const { loanId: urlLoanId } = useParams();
    const navigate = useNavigate();

    const [currentLoanData, setCurrentLoanData] = useState(null);
    const [viewState, setViewState] = useState({
        isLoading: true,
        isSaving: false,
        error: null,
        message: null
    });
    const [mode, setMode] = useState('create');
    // const loadInputRef = useRef(null); // Ref removed as load input was removed

    // --- Data Fetching ---
    const loadLoanForEditing = useCallback(async (loanId) => {
        // ... (loadLoanForEditing logic remains the same)
        if (!loanId) return;
        console.log(`Loading loan ${loanId} for editing...`);
        setViewState({ isLoading: true, isSaving: false, error: null, message: 'Loading loan data...' });
        try {
            const response = await axiosInstance.get(`/api/loans/${loanId}`);
            console.log("Fetched loan data:", response.data);
            setCurrentLoanData(response.data);
            setMode('edit');
            setViewState(prev => ({ ...prev, isLoading: false, message: null }));
        } catch (err) {
            console.error(`Error fetching loan ${loanId}:`, err);
            const errorMsg = err.response?.data?.error || err.message || `Failed to load loan data (ID: ${loanId}).`;
            setViewState({ isLoading: false, isSaving: false, error: { type: 'danger', message: errorMsg }, message: null });
            setCurrentLoanData(null);
            setMode('create');
        }
    }, []);

    const setupCreateNewLoan = useCallback(() => {
        console.log("Setting up for new loan creation...");
        setCurrentLoanData(null);
        // Correctly reset viewState, removing the call to the old setError
        setViewState({ isLoading: false, isSaving: false, error: null, message: null });
        setMode('create');
    }, []); // Added empty dependency array

    // Effect to load data based on URL param or set up create mode
    useEffect(() => {
        if (urlLoanId) {
            loadLoanForEditing(urlLoanId);
        } else {
            setupCreateNewLoan();
        }
        // Added setupCreateNewLoan to dependencies as it's used inside
    }, [urlLoanId, loadLoanForEditing, setupCreateNewLoan]);


    // --- Callback Handlers for FormBuilder ---
    const handleSaveLoanDraft = useCallback(async (formData, loanId) => {
        // ... (handleSaveLoanDraft logic remains the same) ...
        console.log('Container: handleSaveLoanDraft called.');
        setViewState(prev => ({ ...prev, isSaving: true, error: null, message: 'Saving draft...' }));
        const url = loanId ? `/api/loans/${loanId}` : '/api/loans'; const method = loanId ? 'patch' : 'post';
        const dataPayload = { ...formData, status: 'draft' };
        console.log(`API Call: ${method.toUpperCase()} ${url}`);
        try {
            const response = await axiosInstance({ method, url, data: dataPayload });
            console.log('API Response (Draft Save):', response.data);
            setCurrentLoanData(response.data); setMode('edit');
            if (!loanId && response.data?._id) { navigate(`/console/form-builder/${response.data._id}`, { replace: true }); }
            setViewState(prev => ({ ...prev, isSaving: false, error: { type: 'success', message: `Draft ${loanId ? 'updated' : 'created'} successfully!` }, message: null }));
            setTimeout(() => setViewState(prev => ({...prev, error: null})), 4000);
            return response.data;
        } catch (err) {
            console.error('Container: Error saving draft:', err);
            const errorMsg = err.response?.data?.error || err.message || 'Failed to save draft.';
            setViewState(prev => ({ ...prev, isSaving: false, error: { type: 'danger', message: errorMsg }, message: null }));
            throw new Error(errorMsg);
        }
     }, [navigate]); // Added navigate dependency

    const handlePublishLoan = useCallback(async (formData, loanId) => {
        // ... (handlePublishLoan logic remains the same) ...
        console.log('Container: handlePublishLoan called.');
        if (!loanId) { const errorMsg = "Please save the loan as a draft before publishing."; setViewState(prev => ({ ...prev, error: { type: 'warning', message: errorMsg } })); throw new Error(errorMsg); }
        setViewState(prev => ({ ...prev, isSaving: true, error: null, message: 'Publishing loan...' }));
        const url = `/api/loans/${loanId}`; const method = 'patch'; const dataPayload = { ...formData, status: 'published' };
        console.log(`API Call: ${method.toUpperCase()} ${url}`);
        try {
            const response = await axiosInstance({ method, url, data: dataPayload });
            console.log('API Response (Publish):', response.data);
            setCurrentLoanData(response.data); setMode('edit');
            setViewState(prev => ({ ...prev, isSaving: false, error: { type: 'success', message: 'Loan published successfully!' }, message: null }));
             // setTimeout(() => setViewState(prev => ({...prev, error: null})), 5000); // Optional longer success display
            return response.data;
        } catch (err) {
            console.error('Container: Error publishing loan:', err);
            const errorMsg = err.response?.data?.error || err.message || 'Failed to publish loan.';
            setViewState(prev => ({ ...prev, isSaving: false, error: { type: 'danger', message: errorMsg }, message: null }));
            throw new Error(errorMsg);
        }
    }, []);


    // --- Navigation Handler ---
    const navigateToCreate = () => {
        // Optional: Check for unsaved changes
        navigate('/console/form-builder');
    };

    // --- Render Logic ---
    const { isLoading, isSaving, error, message } = viewState;

    // Determine status bar content and style (logic remains the same)
    let statusContent = null; let statusVariant = 'light';
    if (isLoading && mode === 'edit') { statusContent = <><Spinner animation="border" size="sm" /> Loading Loan Data...</>; statusVariant = 'info'; }
    else if (isSaving) { statusContent = <><Spinner animation="border" size="sm" /> {message || 'Saving...'}</>; statusVariant = 'warning'; }
    else if (error) { statusContent = <><FaExclamationTriangle /> Error: {error.message}</>; statusVariant = error.type || 'danger'; }
    else if (message) { statusContent = message; statusVariant = 'light'; }
    else if (mode === 'edit' && currentLoanData?.status === 'published'){ statusContent = <><FaCheckCircle /> This loan definition is currently published.</>; statusVariant = 'success-subtle' }
    else if (mode === 'edit') { statusContent = <>Editing Draft (ID: {currentLoanData?._id})</>; statusVariant = 'secondary'; }
    else { statusContent = 'Creating New Loan Definition'; statusVariant = 'secondary'; }


    return (
        <Container fluid className="form-builder-page-container p-3 p-md-4 bg-light">

            {/* Header Row with Title and Create Button */}
            <Row className="align-items-center mb-3">
                <Col>
                    {/* Ensure Link is imported from react-router-dom */}
                    <Breadcrumb listProps={{ className: "mb-0 bg-transparent p-0" }}>
                        <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/console" }}>Dashboard</Breadcrumb.Item>
                        <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/console/loans" }}>Loan Schemes</Breadcrumb.Item>
                        <Breadcrumb.Item active>
                            {mode === 'create' ? 'Create New' : 'Edit Loan'}
                        </Breadcrumb.Item>
                    </Breadcrumb>
                    <h1 className="h3 mb-0 text-dark">
                        {mode === 'create' ? 'Create Loan Definition' : `Edit Loan: ${currentLoanData?.title || '...'}` }
                    </h1>
                </Col>
                <Col xs="auto">
                    {mode === 'edit' && (
                         <Button variant="outline-primary" onClick={navigateToCreate} disabled={isSaving || isLoading}>
                            <FaPlus className="me-1" /> Create New
                        </Button>
                    )}
                </Col>
            </Row>

            {/* Status Bar / Feedback Area */}
             <Alert variant={statusVariant} className={`d-flex align-items-center shadow-sm mb-4 status-alert ${error ? 'alert-dismissible' : ''}`}>
                {statusContent}
                {/* Add close button ONLY if it's a dismissible error */}
                 {error && <Button variant="close" onClick={() => setViewState(prev => ({...prev, error: null}))} aria-label="Close"></Button>}
            </Alert>

            {/* Loading State specifically for initial load */}
            {isLoading && mode === 'edit' && (
                 <div className="text-center p-5">
                    <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }}/>
                    <p className="mt-3 text-muted">Loading Loan Data...</p>
                 </div>
            )}

            {/* Render FormBuilder only when not initial loading or in create mode */}
            {(!isLoading || mode === 'create') && (
                 <Card className="shadow-sm">
                    <Card.Header className="bg-light">
                        <h5 className="mb-0 d-flex align-items-center text-dark">
                            <FaEdit className="me-2 text-primary mr-2"/>
                            {mode === 'create' ? 'Enter Loan Details' : `Editing Details (Status: ${currentLoanData?.status || 'draft'})`}
                        </h5>
                    </Card.Header>
                    <Card.Body className="p-4">
                        <LoanFormBuilder
                            key={urlLoanId || 'new'} // Use urlLoanId here
                            initialData={currentLoanData}
                            onSaveDraft={handleSaveLoanDraft}
                            onPublish={handlePublishLoan}
                            isSaving={isSaving} // Pass saving state down
                        />
                    </Card.Body>
                 </Card>
            )}
        </Container>
    );
};

export default FormBuilderContainer;