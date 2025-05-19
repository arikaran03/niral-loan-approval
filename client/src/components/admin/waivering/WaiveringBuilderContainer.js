// src/components/admin/WaiverBuilderContainer.js

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
// Assuming you will create a WaiverSchemeFormBuilder similar to LoanFormBuilder
import WaiverSchemeFormBuilder from './WaiverSchemeFormBuilder';
import { axiosInstance } from '../../../config.js'; // Ensure this path is correct
import {
    Container,
    Row,
    Col,
    Button,
    Spinner,
    Alert,
    Card,
    Breadcrumb,
} from 'react-bootstrap';
import {
    FaPlus,
    FaExclamationTriangle,
    FaCheckCircle,
    FaEdit,
} from 'react-icons/fa';

const WaiverBuilderContainer = () => {
    const { waiverId: urlWaiverId } = useParams();
    const navigate = useNavigate();

    const [currentWaiverData, setCurrentWaiverData] = useState(null);
    const [availableLoans, setAvailableLoans] = useState([]); // State for available loans
    const [loansLoadingError, setLoansLoadingError] = useState(null); // State for loan loading error
    const [viewState, setViewState] = useState({
        isLoading: true, // True initially to load either waiver data or set up create mode
        isSaving: false,
        error: null,
        message: null
    });
    const [mode, setMode] = useState('create');

    // Fetch available loans (e.g., published loans)
    useEffect(() => {
        const fetchAvailableLoans = async () => {
            try {
                setLoansLoadingError(null);
                // Fetch only published loans, or adjust query as needed
                const response = await axiosInstance.get('/api/loans');
                console.log("Fetched available loans:", response.data);
                setAvailableLoans(response.data || []);
            } catch (err) {
                console.error("Failed to fetch available loans:", err);
                setLoansLoadingError("Could not load available loan products. Please try again.");
                setAvailableLoans([]);
            }
        };
        fetchAvailableLoans();
    }, []); // Fetch once on mount

    const loadWaiverForEditing = useCallback(async (waiverId) => {
        if (!waiverId) return;
        console.log(`Loading waiver scheme ${waiverId} for editing...`);
        // Keep isLoading true while fetching waiver data specifically
        setViewState({ isLoading: true, isSaving: false, error: null, message: 'Loading waiver scheme data...' });
        try {
            const response = await axiosInstance.get(`/api/waiver-schemes/${waiverId}`);
            console.log("Fetched waiver scheme data:", response.data);
            setCurrentWaiverData(response.data);
            setMode('edit');
            setViewState(prev => ({ ...prev, isLoading: false, message: null }));
        } catch (err) {
            console.error(`Error fetching waiver scheme ${waiverId}:`, err);
            const errorMsg = err.response?.data?.error || err.message || `Failed to load waiver scheme data (ID: ${waiverId}).`;
            setViewState({ isLoading: false, isSaving: false, error: { type: 'danger', message: errorMsg }, message: null });
            setCurrentWaiverData(null);
            setMode('create');
        }
    }, []);

    const setupCreateNewWaiver = useCallback(() => {
        console.log("Setting up for new waiver scheme creation...");
        setCurrentWaiverData(null);
        // Set isLoading to false as we are ready for creation form
        setViewState({ isLoading: false, isSaving: false, error: null, message: null });
        setMode('create');
    }, []);

    useEffect(() => {
        if (urlWaiverId) {
            loadWaiverForEditing(urlWaiverId);
        } else {
            setupCreateNewWaiver();
        }
    }, [urlWaiverId, loadWaiverForEditing, setupCreateNewWaiver]);


    const handleSaveWaiverDraft = useCallback(async (formData, waiverId) => {
        console.log('Container: handleSaveWaiverDraft called with formData:', formData);
        setViewState(prev => ({ ...prev, isSaving: true, error: null, message: 'Saving waiver scheme draft...' }));
        const url = waiverId ? `/api/waiver-schemes/${waiverId}` : '/api/waiver-schemes';
        const method = waiverId ? 'patch' : 'post';
        // Ensure target_loan_id is included if present in formData
        const dataPayload = { ...formData, status: 'draft' };
        console.log(`API Call: ${method.toUpperCase()} ${url}`, dataPayload);
        try {
            const response = await axiosInstance({ method, url, data: dataPayload });
            console.log('API Response (Waiver Draft Save):', response.data);
            setCurrentWaiverData(response.data);
            setMode('edit');
            if (!waiverId && response.data?._id) {
                navigate(`/console/waiver-builder/${response.data._id}`, { replace: true });
            }
            setViewState(prev => ({ ...prev, isSaving: false, error: { type: 'success', message: `Waiver scheme draft ${waiverId ? 'updated' : 'created'} successfully!` }, message: null }));
            setTimeout(() => setViewState(prev => ({...prev, error: null})), 4000);
            return response.data;
        } catch (err) {
            console.error('Container: Error saving waiver scheme draft:', err.response || err);
            const errorMsg = err.response?.data?.error || err.message || 'Failed to save waiver scheme draft.';
            setViewState(prev => ({ ...prev, isSaving: false, error: { type: 'danger', message: errorMsg }, message: null }));
            throw new Error(errorMsg);
        }
     }, [navigate]);

    const handlePublishWaiver = useCallback(async (formData, waiverId) => {
        console.log('Container: handlePublishWaiver called with formData:', formData);
        if (!waiverId) {
            const errorMsg = "Please save the waiver scheme as a draft before publishing.";
            setViewState(prev => ({ ...prev, error: { type: 'warning', message: errorMsg } }));
            throw new Error(errorMsg); // Throw error to be caught by form builder
        }
        // Critical check: Ensure a target loan is selected from formData
        if (!formData.target_loan_id) {
            const errorMsg = "A target loan product must be selected before publishing the waiver scheme.";
            setViewState(prev => ({ ...prev, error: { type: 'warning', message: errorMsg }, message: null }));
            // It's important that the form builder also handles this error or prevents submission
            throw new Error(errorMsg);
        }
        setViewState(prev => ({ ...prev, isSaving: true, error: null, message: 'Publishing waiver scheme...' }));
        const url = `/api/waiver-schemes/${waiverId}`;
        const method = 'patch';
        const dataPayload = { ...formData, status: 'published' };
        console.log(`API Call: ${method.toUpperCase()} ${url}`, dataPayload);
        try {
            const response = await axiosInstance({ method, url, data: dataPayload });
            console.log('API Response (Waiver Publish):', response.data);
            setCurrentWaiverData(response.data);
            setMode('edit');
            setViewState(prev => ({ ...prev, isSaving: false, error: { type: 'success', message: 'Waiver scheme published successfully!' }, message: null }));
            return response.data;
        } catch (err) {
            console.error('Container: Error publishing waiver scheme:', err.response || err);
            const errorMsg = err.response?.data?.error || err.message || 'Failed to publish waiver scheme.';
            setViewState(prev => ({ ...prev, isSaving: false, error: { type: 'danger', message: errorMsg }, message: null }));
            throw new Error(errorMsg);
        }
    }, []);

    const navigateToCreate = () => {
        navigate('/console/waiver-builder');
    };

    const { isLoading, isSaving, error, message } = viewState;

    let statusContent = null;
    let statusVariant = 'light';
    if (isLoading && (mode === 'edit' || !availableLoans.length)) { // Show loading if fetching waiver or initial loans
        statusContent = <><Spinner animation="border" size="sm" /> Loading Data...</>;
        statusVariant = 'info';
    } else if (isSaving) {
        statusContent = <><Spinner animation="border" size="sm" /> {message || 'Saving...'}</>;
        statusVariant = 'warning';
    } else if (error) {
        statusContent = <><FaExclamationTriangle /> Error: {error.message}</>;
        statusVariant = error.type || 'danger';
    } else if (loansLoadingError && mode === 'create') { // Show loan loading error prominently in create mode
        statusContent = <><FaExclamationTriangle /> {loansLoadingError}</>;
        statusVariant = 'danger';
    } else if (message) {
        statusContent = message;
        statusVariant = 'light';
    } else if (mode === 'edit' && currentWaiverData?.status === 'published') {
        statusContent = <><FaCheckCircle /> This waiver scheme is currently published.</>;
        statusVariant = 'success-subtle';
    } else if (mode === 'edit' && currentWaiverData?.status === 'archived') {
        statusContent = <><FaExclamationTriangle /> This waiver scheme is archived.</>;
        statusVariant = 'secondary';
    } else if (mode === 'edit') {
        statusContent = <>Editing Waiver Scheme Draft (ID: {currentWaiverData?._id})</>;
        statusVariant = 'secondary';
    } else { // Create mode, and loans have loaded (or attempted to load)
        statusContent = 'Creating New Waiver Scheme Definition';
        statusVariant = 'secondary';
    }

    return (
        <Container fluid className="form-builder-page-container p-3 p-md-4 bg-light">
            <Row className="align-items-center mb-3">
                <Col>
                    <Breadcrumb listProps={{ className: "mb-0 bg-transparent p-0" }}>
                        <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/console" }}>Dashboard</Breadcrumb.Item>
                        <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/console/waiver-schemes" }}>Waiver Schemes</Breadcrumb.Item>
                        <Breadcrumb.Item active>
                            {mode === 'create' ? 'Create New Scheme' : 'Edit Waiver Scheme'}
                        </Breadcrumb.Item>
                    </Breadcrumb>
                    <h1 className="h3 mb-0 text-dark">
                        {mode === 'create' ? 'Create Waiver Scheme Definition' : `Edit Waiver Scheme: ${currentWaiverData?.title || '...'}` }
                    </h1>
                </Col>
                <Col xs="auto">
                    {mode === 'edit' && (
                         <Button variant="outline-primary" onClick={navigateToCreate} disabled={isSaving || isLoading}>
                            <FaPlus className="me-1" /> Create New Scheme
                        </Button>
                    )}
                </Col>
            </Row>

             <Alert variant={statusVariant} className={`d-flex align-items-center shadow-sm mb-4 status-alert ${error || (loansLoadingError && mode === 'create') ? 'alert-dismissible' : ''}`}>
                {statusContent}
                 {(error || (loansLoadingError && mode === 'create')) && <Button variant="close" onClick={() => {
                    if (error) setViewState(prev => ({...prev, error: null}));
                    if (loansLoadingError) setLoansLoadingError(null); // Allow dismissing loan loading error
                 }} aria-label="Close"></Button>}
            </Alert>

            {/* Show loading spinner if initial waiver data is loading in edit mode, OR if loans are still loading in create mode */}
            {isLoading && (mode === 'edit' || (mode === 'create' && availableLoans.length === 0 && !loansLoadingError)) && (
                 <div className="text-center p-5">
                    <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }}/>
                    <p className="mt-3 text-muted">
                        {mode === 'edit' ? 'Loading Waiver Scheme Data...' : 'Loading available loan products...'}
                    </p>
                 </div>
            )}

            {/* Render FormBuilder only when not initial loading OR if loans failed to load (still show form) */}
            {(!isLoading || (mode === 'create' && (availableLoans.length > 0 || loansLoadingError))) && (
                 <Card className="shadow-sm">
                    <Card.Header className="bg-light">
                        <h5 className="mb-0 d-flex align-items-center text-dark">
                            <FaEdit className="me-2 text-primary"/>
                            {mode === 'create' ? 'Enter Waiver Scheme Details' : `Editing Details (Status: ${currentWaiverData?.status || 'draft'})`}
                        </h5>
                    </Card.Header>
                    <Card.Body className="p-4">
                        <WaiverSchemeFormBuilder
                            key={urlWaiverId || 'new-waiver'}
                            initialData={currentWaiverData}
                            availableLoans={availableLoans}
                            loansLoadingError={loansLoadingError}
                            onSaveDraft={handleSaveWaiverDraft}
                            onPublish={handlePublishWaiver}
                            isSaving={isSaving}
                        />
                    </Card.Body>
                 </Card>
            )}
        </Container>
    );
};

export default WaiverBuilderContainer;
