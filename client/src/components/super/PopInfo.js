import { Modal, Button } from 'react-bootstrap';
import { FaInfoCircle } from 'react-icons/fa';
import "./PopInfo.css";

const PopInfo = ({ title, description, status, toggleModelStatus }) => {
  return (
    <Modal 
      show={status} 
      onHide={toggleModelStatus} 
      centered
      className="banking-modal"
    >
      <Modal.Header className="modal-header-banking">
        <div className="modal-icon-container">
          <FaInfoCircle className="modal-icon" />
        </div>
        <Modal.Title className="modal-title-banking">
          {title}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="modal-body-banking">
        <div className="modal-content-wrapper">
          <p className="modal-description">{description}</p>
        </div>
      </Modal.Body>
      
      <Modal.Footer className="modal-footer-banking">
        <Button 
          variant="primary" 
          onClick={toggleModelStatus}
          className="modal-button"
        >
          Confirm
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PopInfo;