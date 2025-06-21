// src/components/admin/WaiverBuilderContainer.js

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import LiquidLoader from '../../super/LiquidLoader.js';

const WaiverBuilderContainer = () => {
    const { waiverId: urlWaiverId } = useParams();
    const navigate = useNavigate();

    const [currentWaiverData, setCurrentWaiverData] = useState(null);
    const [availableLoans, setAvailableLoans] = useState([]);
    const [loansLoadingError, setLoansLoadingError] = useState(null);
    const [viewState, setViewState] = useState({
        isLoading: true,
        isSaving: false,
        error: null, // Only used for initial load errors
    });
    const [mode, setMode] = useState('create');

    // Fetch available loans (e.g., published loans)
    useEffect(() => {
        const fetchAvailableLoans = async () => {
            try {
                setLoansLoadingError(null);
                const response = await axiosInstance.get('/api/loans');
                setAvailableLoans(response.data || []);
            } catch (err) {
                console.error("Failed to fetch available loans:", err);
                setLoansLoadingError("Could not load available loan products. The form might not work as expected.");
                setAvailableLoans([]);
            }
        };
        fetchAvailableLoans();
    }, []);

    const loadWaiverForEditing = useCallback(async (waiverId) => {
        if (!waiverId) return;
        setViewState({ isLoading: true, isSaving: false, error: null });
        try {
            console.log(`Container: Loading waiver scheme for editing (ID: ${waiverId})`);
            const response = await axiosInstance.get(`/api/waiver-schemes/${waiverId}`);
            setCurrentWaiverData(response.data);
            setMode('edit');
            setViewState(prev => ({ ...prev, isLoading: false }));
        } catch (err) {
            console.error(`Error fetching waiver scheme ${waiverId}:`, err);
            const errorMsg = err.response?.data?.error || err.message || `Failed to load waiver scheme data (ID: ${waiverId}).`;
            setViewState({ isLoading: false, isSaving: false, error: errorMsg });
            setCurrentWaiverData(null);
        }
    }, []);

    const setupCreateNewWaiver = useCallback(() => {
        setCurrentWaiverData(null);
        setViewState({ isLoading: false, isSaving: false, error: null });
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
        setViewState(prev => ({ ...prev, isSaving: true }));
        const url = waiverId ? `/api/waiver-schemes/${waiverId}` : '/api/waiver-schemes';
        const method = waiverId ? 'patch' : 'post';
        const dataPayload = { ...formData, status: 'draft' };
        try {
            const response = await axiosInstance({ method, url, data: dataPayload });
            console.log('Container: Waiver scheme draft saved:', response.data);
            setCurrentWaiverData(response.data);
            setMode('edit');
            if (!waiverId && response.data?._id) {
                navigate(`/console/waiver-builder/${response.data._id}`, { replace: true });
            }
            return response.data;
        } catch (err) {
            console.error('Container: Error saving waiver scheme draft:', err);
            // Re-throw the error for the child component to catch and handle
            throw err;
        } finally {
            setViewState(prev => ({ ...prev, isSaving: false }));
        }
     }, [navigate]);

    const handlePublishWaiver = useCallback(async (formData, waiverId) => {
        if (!waiverId) {
            // This validation is better handled in the child component now
            throw new Error("Please save the waiver scheme as a draft before publishing.");
        }
        if (!formData.target_loan_id) {
            throw new Error("A target loan product must be selected before publishing.");
        }
        setViewState(prev => ({ ...prev, isSaving: true }));
        const url = `/api/waiver-schemes/${waiverId}`;
        const method = 'patch';
        const dataPayload = { ...formData, status: 'published' };
        try {
            const response = await axiosInstance({ method, url, data: dataPayload });
            setCurrentWaiverData(response.data);
            setMode('edit');
            return response.data;
        } catch (err) {
            console.error('Container: Error publishing waiver scheme:', err);
             // Re-throw the error for the child component to catch and handle
            throw err;
        } finally {
            setViewState(prev => ({ ...prev, isSaving: false }));
        }
    }, []);

    const navigateToCreate = () => {
        navigate('/console/waiver-builder');
    };

    const { isLoading, isSaving, error } = viewState;

    let statusContent = null;
    let statusVariant = 'light';
    if (isLoading) {
        statusContent = <><Spinner animation="border" size="sm" /> Loading Data...</>;
        statusVariant = 'info';
    } else if (isSaving) {
        statusContent = <><Spinner animation="border" size="sm" /> Saving...</>;
        statusVariant = 'warning';
    } else if (error) {
        statusContent = <><FaExclamationTriangle /> Error: {error}</>;
        statusVariant = 'danger';
    } else if (mode === 'create') {
        statusContent = 'Creating New Waiver Scheme';
        statusVariant = 'secondary';
    } else if (mode === 'edit') {
        if (currentWaiverData?.status === 'published') {
            statusContent = <><FaCheckCircle /> This waiver scheme is currently published.</>;
            statusVariant = 'success-subtle';
        } else if (currentWaiverData?.status === 'archived') {
            statusContent = <><FaExclamationTriangle /> This waiver scheme is archived.</>;
            statusVariant = 'secondary';
        } else {
            statusContent = <>Editing Waiver Scheme Draft (ID: {currentWaiverData?._id})</>;
            statusVariant = 'secondary';
        }
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

             <Alert variant={statusVariant} className={`d-flex align-items-center shadow-sm mb-4 status-alert ${error ? 'alert-dismissible' : ''}`}>
                {statusContent}
                 {error && <Button variant="close" onClick={() => setViewState(prev => ({...prev, error: null}))} aria-label="Close"></Button>}
            </Alert>

            {isLoading && <LiquidLoader/>}

            {!isLoading && (
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
