const express = require('express');
const GovDocument = require('../models/govDocument.model'); // Assuming this is the model with govDocumentSchema
const { sample } = require('../controllers/govDocument.controller'); // Assuming this is the controller with the sample function

const router = express.Router();

// GET a specific government document by ID
router.get('/:id', sample);

// Route to get all government documents
router.get('/', async (req, res) => {
    try {
        const documents = await GovDocument.find();
        res.status(200).json(documents);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving documents', error: error.message });
    }
});

module.exports = router;