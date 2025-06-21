import mongoose from 'mongoose';

const loggerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    requestBody: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    urlPath: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const Logger = mongoose.model('Logger', loggerSchema);

export default Logger;