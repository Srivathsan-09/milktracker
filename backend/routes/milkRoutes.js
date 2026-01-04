const express = require('express');
const router = express.Router();
const MilkEntry = require('../models/MilkEntry');

/**
 * @route   GET /api/milk
 * @desc    Get all milk entries (default route)
 */
router.get('/', async (req, res) => {
    try {
        const entries = await MilkEntry.find().sort({ date: 1 });
        res.json(entries);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/', (req, res) => {
    res.json({ message: 'Milk API running' });
});


/**
 * @route   GET /api/milk/all
 * @desc    Get all entries
 */
router.get('/all', async (req, res) => {
    try {
        const entries = await MilkEntry.find().sort({ date: 1 });
        res.json(entries);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   GET /api/milk/month?year=YYYY&month=MM
 * @desc    Get entries for a specific month
 */
router.get('/month', async (req, res) => {
    const { year, month } = req.query;

    if (!year || !month) {
        return res.status(400).json({ message: 'Year and month are required' });
    }

    try {
        const regex = new RegExp(`^${year}-${month}`);
        const entries = await MilkEntry.find({ date: regex }).sort({ date: 1 });
        res.json(entries);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   POST /api/milk/entry
 * @desc    Add or update a milk entry
 */
router.post('/entry', async (req, res) => {
    const { date, morningLitres, nightLitres, total, notes } = req.body;

    if (!date || total === undefined) {
        return res.status(400).json({ message: 'Date and total are required' });
    }

    const entryData = {
        date,
        morningLitres: morningLitres || 0,
        nightLitres: nightLitres || 0,
        total,
        notes: notes || ''
    };

    try {
        const entry = await MilkEntry.findOneAndUpdate(
            { date },
            entryData,
            { new: true, upsert: true }
        );
        res.json(entry);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

/**
 * @route   DELETE /api/milk/entry/:date
 * @desc    Delete an entry
 */
router.delete('/entry/:date', async (req, res) => {
    try {
        await MilkEntry.findOneAndDelete({ date: req.params.date });
        res.json({ message: 'Entry deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
