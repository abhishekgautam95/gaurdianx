class RiskRules {
  analyzeRisks(transactionData, chain) {
    const flags = [];

    // Contract verification check
    const isVerified = chain === 'solana' ? transactionData.isVerified : transactionData.isContractVerified;
    if (!isVerified) {
      flags.push({
        type: 'unverified_contract',
        severity: 'high',
        message: 'Contract is not verified, limiting transparency'
      });
    }

    // Holder count check
    if (transactionData.holderCount < 100) {
      flags.push({
        type: 'low_holders',
        severity: 'high',
        message: 'Very low number of token holders (potential rug pull risk)'
      });
    } else if (transactionData.holderCount < 1000) {
      flags.push({
        type: 'medium_holders',
        severity: 'medium',
        message: 'Limited number of token holders'
      });
    }

    // Large transfer check
    if (transactionData.isLargeTransfer) {
      flags.push({
        type: 'large_transfer',
        severity: 'medium',
        message: 'Large token transfer detected'
      });
    }

    // Liquidity check
    if (transactionData.liquidityLevel === 'low') {
      flags.push({
        type: 'low_liquidity',
        severity: 'high',
        message: 'Low liquidity detected - exit may be difficult'
      });
    }

    // Recent transaction check
    if (transactionData.recentTransaction) {
      flags.push({
        type: 'recent_activity',
        severity: 'low',
        message: 'Recent transaction activity detected'
      });
    }

    // Unlimited approval check (Avalanche specific)
    if (chain === 'avalanche' && transactionData.hasUnlimitedApproval) {
      flags.push({
        type: 'unlimited_approval',
        severity: 'critical',
        message: 'Unlimited token approval detected - high security risk'
      });
    }

    // Gas analysis (Avalanche specific)
    if (chain === 'avalanche' && transactionData.gasCost > 0.1) {
      flags.push({
        type: 'high_gas',
        severity: 'medium',
        message: 'High gas cost for this transaction type'
      });
    }

    // Program/Contract analysis (Solana specific)
    if (chain === 'solana' && transactionData.programId !== '11111111111111111111111111111111' && 
        transactionData.programId !== 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
      flags.push({
        type: 'unknown_program',
        severity: 'medium',
        message: 'Transaction uses non-standard program'
      });
    }

    return flags;
  }

  // Helper methods for specific risk patterns
  detectRugPullPatterns(transactionData) {
    // Mock rug pull detection logic
    const indicators = [];
    
    if (transactionData.holderCount < 50) {
      indicators.push('very_low_holders');
    }
    
    if (transactionData.liquidityLevel === 'low' && !transactionData.isVerified) {
      indicators.push('low_liquidity_unverified');
    }
    
    return indicators;
  }

  detectPhishingPatterns(transactionData) {
    // Mock phishing detection logic
    const indicators = [];
    
    if (transactionData.hasUnlimitedApproval) {
      indicators.push('unlimited_approval');
    }
    
    return indicators;
  }
}

module.exports = new RiskRules();