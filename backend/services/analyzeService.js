const solanaService = require('./solanaService');
const avalancheService = require('./avalancheService');
const aiService = require('./aiService');
const riskRules = require('../utils/riskRules');

class AnalyzeService {
  async analyzeTransaction({ chain, txHash, txData }) {
    try {
      // Step 1: Parse transaction based on chain
      let transactionData;
      
      if (chain === 'solana') {
        transactionData = await solanaService.parseTransaction(txHash, txData);
      } else if (chain === 'avalanche') {
        transactionData = await avalancheService.parseTransaction(txHash, txData);
      } else {
        throw new Error(`Unsupported chain: ${chain}`);
      }

      // Step 2: Apply risk rules
      const riskFlags = riskRules.analyzeRisks(transactionData, chain);

      // Step 3: Get AI analysis
      const aiAnalysis = await aiService.analyzeWithAI({
        transactionData,
        riskFlags,
        chain
      });

      // Step 4: Combine results
      const result = {
        riskScore: aiAnalysis.riskScore,
        verdict: this.getVerdict(aiAnalysis.riskScore),
        explanation: aiAnalysis.explanation,
        flags: riskFlags.map(flag => flag.message),
        chain,
        txHash: txHash || 'Raw transaction data provided',
        timestamp: new Date().toISOString(),
        transactionSummary: {
          type: transactionData.type,
          amount: transactionData.amount,
          from: transactionData.from,
          to: transactionData.to,
          contractAddress: transactionData.contractAddress
        }
      };

      return result;
    } catch (error) {
      console.error('Error in analyzeTransaction:', error);
      throw new Error('Failed to analyze transaction');
    }
  }

  getVerdict(riskScore) {
    if (riskScore < 30) return 'Safe';
    if (riskScore < 70) return 'Medium Risk';
    return 'High Risk';
  }
}

module.exports = new AnalyzeService();