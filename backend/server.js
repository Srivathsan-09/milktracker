const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const milkRoutes = require('./routes/milkRoutes');

const app = express();

/* -------------------- DATABASE -------------------- */
connectDB();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors());

app.use(bodyParser.json());

/* -------------------- ROUTES -------------------- */
app.use('/api/milk', milkRoutes);

/* -------------------- STATIC FILES -------------------- */
const path = require('path');
app.use(express.static(path.join(__dirname, '../Front end/public')));

// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, '../Front end/public', 'index.html'));
// });

/* -------------------- EXPORT (IMPORTANT) -------------------- */
/*

*/
module.exports = app;
