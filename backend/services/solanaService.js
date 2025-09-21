class SolanaService {
  async parseTransaction(txHash, txData) {
    // Mock implementation - In production, this would use Solana RPC or Helius API
    console.log(`Parsing Solana transaction: ${txHash || 'Raw data provided'}`);

    // Simulate API call delay
    await this.delay(500);

    // Mock transaction data
    const mockData = {
      type: 'token_transfer',
      amount: Math.random() > 0.5 ? '1000000000' : '50000000', // Different amounts for variety
      decimals: 6,
      from: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      contractAddress: Math.random() > 0.3 ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' : null, // USDC or SOL
      programId: Math.random() > 0.3 ? '11111111111111111111111111111111' : 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      blockTime: Date.now() - Math.floor(Math.random() * 3600000), // Random time within last hour
      signatures: txHash ? [txHash] : ['mock_signature'],
      isVerified: Math.random() > 0.2, // 80% chance of being verified
      holderCount: Math.floor(Math.random() * 10000) + 100,
      liquidityLevel: Math.random() > 0.3 ? 'high' : 'low'
    };

    return this.enrichTransactionData(mockData);
  }

  enrichTransactionData(data) {
    // Add computed fields
    data.amountInTokens = data.amount / Math.pow(10, data.decimals);
    data.isLargeTransfer = data.amountInTokens > 10000;
    data.recentTransaction = (Date.now() - data.blockTime) < 300000; // Within 5 minutes
    
    return data;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new SolanaService();