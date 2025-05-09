const  sample = async (req, res) => {
    try {
        const document = await GovDocument.findById(req.params.id);
        
        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }
        
        res.status(200).json(document);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving document', error: error.message });
    }
}

exports = {
    sample
};
