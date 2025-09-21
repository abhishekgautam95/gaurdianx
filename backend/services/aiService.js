class AIService {
  async analyzeWithAI({ transactionData, riskFlags, chain }) {
    // Mock AI analysis - In production, this would call DeepSeek or OpenAI API
    console.log(`Analyzing ${chain} transaction with AI...`);

    // Simulate API call delay
    await this.delay(1000);

    // Calculate base risk score from flags
    let baseRiskScore = Math.floor(Math.random() * 20) + 10; // Base: 10-30
    
    // Increase risk based on flags
    baseRiskScore += riskFlags.length * 15;
    
    // Add some randomness and specific risk factors
    if (transactionData.isLargeTransfer) baseRiskScore += 10;
    if (!transactionData.isVerified || !transactionData.isContractVerified) baseRiskScore += 20;
    if (transactionData.holderCount < 1000) baseRiskScore += 15;
    if (transactionData.liquidityLevel === 'low') baseRiskScore += 25;
    if (transactionData.hasUnlimitedApproval) baseRiskScore += 30;

    // Cap at 100
    const riskScore = Math.min(baseRiskScore, 100);

    // Generate contextual explanation
    const explanation = this.generateExplanation(riskScore, transactionData, riskFlags, chain);

    return {
      riskScore,
      explanation,
      confidence: Math.random() * 20 + 80, // 80-100% confidence
      model: 'mock-deepseek-v2',
      analysisTime: Date.now()
    };
  }

  generateExplanation(riskScore, transactionData, riskFlags, chain) {
    const chainName = chain === 'solana' ? 'Solana' : 'Avalanche';
    
    let explanation = `Our AI analysis of this ${chainName} transaction reveals `;

    if (riskScore < 30) {
      explanation += "a low-risk profile. The transaction appears to follow standard patterns with no significant red flags. ";
      explanation += "The contract is verified, has adequate liquidity, and shows normal transfer behavior.";
    } else if (riskScore < 70) {
      explanation += "a medium-risk profile with some concerning elements. ";
      if (!transactionData.isVerified) {
        explanation += "The contract is not fully verified, which limits transparency. ";
      }
      if (transactionData.holderCount < 1000) {
        explanation += "The token has a relatively small holder base, indicating potential concentration risk. ";
      }
      if (transactionData.liquidityLevel === 'low') {
        explanation += "Limited liquidity could make it difficult to exit positions. ";
      }
      explanation += "We recommend additional due diligence before proceeding.";
    } else {
      explanation += "a high-risk profile with multiple warning signs. ";
      if (riskFlags.length > 2) {
        explanation += `${riskFlags.length} risk factors were identified including potential rug pull indicators. `;
      }
      if (transactionData.hasUnlimitedApproval) {
        explanation += "The transaction involves unlimited token approval, which poses significant security risks. ";
      }
      if (!transactionData.isVerified) {
        explanation += "The unverified contract raises serious transparency concerns. ";
      }
      explanation += "We strongly advise against proceeding with this transaction.";
    }

    return explanation;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new AIService();