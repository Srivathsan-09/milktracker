const mongoose = require('mongoose');

const MilkEntrySchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        unique: true
    },
    morningLitres: {
        type: Number,
        default: 0
    },
    nightLitres: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        required: true
    },
    notes: {
        type: String,
        default: ''
    }
});

module.exports = mongoose.model('MilkEntry', MilkEntrySchema);
