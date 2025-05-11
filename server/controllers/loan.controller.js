// src/controllers/loan.controller.js
import Loan from '../database/models/LoanModel.js';
import { randomUUID } from 'crypto';

/**
 * Helper to format Mongoose validation errors into a single string.
 */
function formatMongooseError(err) {
  if (err.name === 'ValidationError') {
    // join all field messages
    const messages = Object.values(err.errors).map((e) => e.message);
    return messages.join('; ');
  }
  return err.message || 'Server error';
}

export default {
  async create(req, res, next) {
    // Attach creator and generate field IDs/timestamps
    req.body.created_by = req.user._id;
    req.body.fields = (req.body.fields || []).map((field) => ({
      ...field,
      field_id: randomUUID(),
      created_at: new Date(),
      updated_at: new Date(),
    }));

    try {
      const loan = await Loan.create(req.body);
      return res.status(201).json({ loan });
    } catch (err) {
      const msg = formatMongooseError(err);
      return res.status(400).json({ error: msg });
    }
  },

  async list(req, res, next) {
    try {
      const loans = await Loan.find()
      return res.json(loans);
    } catch (err) {
      // unexpected error
      return res.status(500).json({ error: err });
    }
  },

  async getById(req, res, next) {
    const { id } = req.params;
    try {
      const loan = await Loan.findById(id);
      if (!loan) {
        return res.status(404).json({ error: 'Loan not found.' });
      }
      return res.json(loan);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid loan ID.' });
    }
  },

  async update(req, res, next) {
    const { id } = req.params;
    try {
      const loan = await Loan.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!loan) {
        return res.status(404).json({ error: 'Loan not found.' });
      }
      return res.json(loan);
    } catch (err) {
      const msg = formatMongooseError(err);
      return res.status(400).json({ error: msg });
    }
  },

  async remove(req, res, next) {
    try {
      const result = await Loan.findByIdAndDelete(req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Loan not found.' });
      }
      return res.status(204).end();
    } catch (err) {
      return res.status(400).json({ error: 'Invalid loan ID.' });
    }
  },
};
