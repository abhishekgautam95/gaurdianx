const express = require('express');
const analyzeService = require('../services/analyzeService');
const router = express.Router();

// POST /api/analyze-tx
router.post('/analyze-tx', async (req, res) => {
  try {
    const { chain, txHash, txData } = req.body;

    // Validate input
    if (!chain || (!txHash && !txData)) {
      return res.status(400).json({
        error: 'Missing required fields: chain and (txHash or txData)'
      });
    }

    // Validate chain
    if (!['solana', 'avalanche'].includes(chain.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid chain. Supported chains: solana, avalanche'
      });
    }

    // Analyze transaction
    const result = await analyzeService.analyzeTransaction({
      chain: chain.toLowerCase(),
      txHash,
      txData
    });

    res.json(result);
  } catch (error) {
    console.error('Error analyzing transaction:', error);
    res.status(500).json({
      error: 'Internal server error during transaction analysis'
    });
  }
});

module.exports = router;