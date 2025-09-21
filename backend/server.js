const express = require('express');
const cors = require('cors');
require('dotenv').config();

const analyzeRoutes = require('./routes/analyze');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', analyzeRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'GuardianX Backend is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GuardianX Backend running on port ${PORT}`);
});