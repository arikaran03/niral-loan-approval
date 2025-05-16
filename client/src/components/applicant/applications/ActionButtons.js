// --- ActionButtons.js ---
// src/components/applicant/applications/ActionButtons.js
import React from 'react';
import PropTypes from 'prop-types';
import { Row, Col, Button, Spinner } from 'react-bootstrap';
import { FaCheckCircle, FaRegSave, FaCloudUploadAlt } from 'react-icons/fa';

const ActionButtons = ({
    isSubmitting,
    isSavingDraft,
    isFormValidForSubmit,
    submissionStatus,
    draftSaveStatus,
    handleSaveDraft,
}) => {
    return (
        <Row className="mt-4 pt-3 border-top">
            <Col className="d-flex justify-content-end">
                <Button
                    type="button"
                    variant={draftSaveStatus.saved ? "outline-success" : "outline-secondary"}
                    className="me-2 save-draft-button"
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft || isSubmitting}>
                    {isSavingDraft ? <><Spinner as="span" animation="border" size="sm" /> Saving...</> : (draftSaveStatus.saved ? <><FaCheckCircle className="me-1" />Draft Saved</> : <><FaRegSave className="me-1" />Save Draft</>)}
                </Button>
                <Button
                    type="submit" 
                    variant="primary"
                    className="submit-button"
                    disabled={isSubmitting || isSavingDraft || !isFormValidForSubmit}
                    title={!isFormValidForSubmit ? "Please complete all required fields and ensure KYC documents are verified or submitted." : "Submit Application"}>
                    {isSubmitting ? <><Spinner as="span" animation="border" size="sm" className="me-1" /> {submissionStatus.replace(/_/g, ' ')}...</> : <><FaCloudUploadAlt className="me-1" />Submit Application</>}
                </Button>
            </Col>
        </Row>
    );
};

ActionButtons.propTypes = {
    isSubmitting: PropTypes.bool.isRequired,
    isSavingDraft: PropTypes.bool.isRequired,
    isFormValidForSubmit: PropTypes.bool.isRequired,
    submissionStatus: PropTypes.string.isRequired,
    draftSaveStatus: PropTypes.object.isRequired,
    handleSaveDraft: PropTypes.func.isRequired,
};

export default ActionButtons;