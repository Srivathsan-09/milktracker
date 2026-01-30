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

/* -------------------- EXPORT (IMPORTANT) -------------------- */
/*

*/
module.exports = app;
