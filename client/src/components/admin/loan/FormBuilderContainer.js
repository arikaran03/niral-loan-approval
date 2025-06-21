// src/components/admin/FormBuilderContainer.js

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import LoanFormBuilder from './LoanFormBuilder';
import { axiosInstance } from '../../../config';
import {
    Container,
    Row,
    Col,
    Button,
    Spinner,
    Alert,
    Card,
    Breadcrumb
} from 'react-bootstrap';
import {
    FaPlus,
    FaExclamationTriangle,
    FaCheckCircle,
    FaEdit,
} from 'react-icons/fa';
import LiquidLoader from '../../super/LiquidLoader.js';

const FormBuilderContainer = () => {
    const { loanId: urlLoanId } = useParams();
    const navigate = useNavigate();

    const [currentLoanData, setCurrentLoanData] = useState(null);
    const [viewState, setViewState] = useState({
        isLoading: true,
        isSaving: false,
        error: null, // Only for initial load errors
    });
    const [mode, setMode] = useState('create');

    const loadLoanForEditing = useCallback(async (loanId) => {
        if (!loanId) return;
        setViewState({ isLoading: true, isSaving: false, error: null });
        try {
            console.log(`Container: Loading loan for editing (ID: ${loanId})`);
            const response = await axiosInstance.get(`/api/loans/${loanId}`);
            setCurrentLoanData(response.data);
            setMode('edit');
        } catch (err) {
            console.error(`Error fetching loan ${loanId}:`, err);
            const errorMsg = err.response?.data?.error || err.message || `Failed to load loan data (ID: ${loanId}).`;
            setViewState(prev => ({ ...prev, error: errorMsg }));
            setCurrentLoanData(null);
        } finally {
            setViewState(prev => ({ ...prev, isLoading: false }));
        }
    }, []);

    const setupCreateNewLoan = useCallback(() => {
        setCurrentLoanData(null);
        setViewState({ isLoading: false, isSaving: false, error: null });
        setMode('create');
    }, []);

    useEffect(() => {
        if (urlLoanId) {
            loadLoanForEditing(urlLoanId);
        } else {
            setupCreateNewLoan();
        }
    }, [urlLoanId, loadLoanForEditing, setupCreateNewLoan]);


    const handleSaveLoanDraft = useCallback(async (formData, loanId) => {
        setViewState(prev => ({ ...prev, isSaving: true }));
        const url = loanId ? `/api/loans/${loanId}` : '/api/loans'; 
        const method = loanId ? 'patch' : 'post';
        const dataPayload = { ...formData, status: 'draft' };
        try {
            const response = await axiosInstance({ method, url, data: dataPayload });
            console.log('Container: Loan draft saved:', response.data);
            setCurrentLoanData(response.data); 
            setMode('edit');
            if (!loanId && response.data?._id) { 
                navigate(`/console/form-builder/${response.data._id}`, { replace: true }); 
            }
            return response.data;
        } catch (err) {
            console.error('Container: Error saving loan draft:', err);
            throw err; // Re-throw for the child to catch
        } finally {
            setViewState(prev => ({ ...prev, isSaving: false }));
        }
     }, [navigate]);

    const handlePublishLoan = useCallback(async (formData, loanId) => {
        if (!loanId) {
            throw new Error("Please save the loan as a draft before publishing.");
        }
        setViewState(prev => ({ ...prev, isSaving: true }));
        const url = `/api/loans/${loanId}`; 
        const method = 'patch'; 
        const dataPayload = { ...formData, status: 'published' };
        try {
            const response = await axiosInstance({ method, url, data: dataPayload });
            setCurrentLoanData(response.data); 
            setMode('edit');
            return response.data;
        } catch (err) {
            console.error('Container: Error publishing loan:', err);
            throw err; // Re-throw for the child to catch
        } finally {
            setViewState(prev => ({ ...prev, isSaving: false }));
        }
    }, []);


    const navigateToCreate = () => {
        navigate('/console/form-builder');
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
        statusContent = 'Creating New Loan Definition'; 
        statusVariant = 'secondary'; 
    } else if (mode === 'edit') {
        if (currentLoanData?.status === 'published') { 
            statusContent = <><FaCheckCircle /> This loan definition is currently published.</>; 
            statusVariant = 'success-subtle'; 
        } else if (currentLoanData?.status === 'archived') { 
            statusContent = <><FaExclamationTriangle /> This loan definition is archived.</>; 
            statusVariant = 'secondary'; 
        } else { 
            statusContent = <>Editing Draft (ID: {currentLoanData?._id})</>; 
            statusVariant = 'secondary'; 
        }
    }


    return (
        <Container fluid className="form-builder-page-container p-3 p-md-4 bg-light">

            <Row className="align-items-center mb-3">
                <Col>
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

             <Alert variant={statusVariant} className={`d-flex align-items-center shadow-sm mb-4 status-alert ${error ? 'alert-dismissible' : ''}`}>
                {statusContent}
                 {error && <Button variant="close" onClick={() => setViewState(prev => ({...prev, error: null}))} aria-label="Close"></Button>}
            </Alert>

            {isLoading && <LiquidLoader/>}

            {!isLoading && (
                 <Card className="shadow-sm">
                    <Card.Header className="bg-light">
                        <h5 className="mb-0 d-flex align-items-center text-dark">
                            <FaEdit className="me-2 text-primary mr-2"/>
                            {mode === 'create' ? 'Enter Loan Details' : `Editing Details (Status: ${currentLoanData?.status || 'draft'})`}
                        </h5>
                    </Card.Header>
                    <Card.Body className="p-4">
                        <LoanFormBuilder
                            key={urlLoanId || 'new-loan'}
                            initialData={currentLoanData}
                            onSaveDraft={handleSaveLoanDraft}
                            onPublish={handlePublishLoan}
                            isSaving={isSaving}
                        />
                    </Card.Body>
                 </Card>
            )}
        </Container>
    );
};

export default FormBuilderContainer;
