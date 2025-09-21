import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Upload, Zap, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Analyze = () => {
  const [formData, setFormData] = useState({
    chain: 'solana',
    txHash: '',
    txData: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [inputMethod, setInputMethod] = useState('hash');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/analyze-tx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        localStorage.setItem('analysisResult', JSON.stringify(result));
        navigate('/result');
      } else {
        throw new Error('Analysis failed');
      }
    } catch (error) {
      console.error('Error analyzing transaction:', error);
      // For demo purposes, create mock result
      const mockResult = {
        riskScore: Math.floor(Math.random() * 100),
        verdict: 'Medium Risk',
        explanation: 'This is a demo analysis. In production, this would be a real AI-powered analysis.',
        flags: ['Demo Mode Active', 'Simulated Analysis'],
        chain: formData.chain,
        txHash: formData.txHash
      };
      localStorage.setItem('analysisResult', JSON.stringify(mockResult));
      navigate('/result');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Analyze Transaction
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Submit your transaction for AI-powered risk analysis and protection
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="bg-white rounded-2xl shadow-xl p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Chain Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Select Blockchain
              </label>
              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setFormData({ ...formData, chain: 'solana' })}
                  className={`p-4 rounded-xl border-2 transition-colors duration-200 ${
                    formData.chain === 'solana'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-6 h-6 bg-gradient-to-r from-purple-400 to-purple-600 rounded-full"></div>
                    <span className="font-medium">Solana</span>
                  </div>
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setFormData({ ...formData, chain: 'avalanche' })}
                  className={`p-4 rounded-xl border-2 transition-colors duration-200 ${
                    formData.chain === 'avalanche'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-red-300'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-6 h-6 bg-gradient-to-r from-red-400 to-red-600 rounded-full"></div>
                    <span className="font-medium">Avalanche</span>
                  </div>
                </motion.button>
              </div>
            </div>

            {/* Input Method Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Input Method
              </label>
              <div className="flex space-x-4">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setInputMethod('hash')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                    inputMethod === 'hash'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Search className="h-4 w-4" />
                  <span>Transaction Hash</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setInputMethod('data')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                    inputMethod === 'data'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  <span>Raw Transaction Data</span>
                </motion.button>
              </div>
            </div>

            {/* Transaction Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                {inputMethod === 'hash' ? 'Transaction Hash' : 'Transaction Data'}
              </label>
              {inputMethod === 'hash' ? (
                <input
                  type="text"
                  value={formData.txHash}
                  onChange={(e) => setFormData({ ...formData, txHash: e.target.value })}
                  placeholder="Enter transaction hash..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                  required
                />
              ) : (
                <textarea
                  value={formData.txData}
                  onChange={(e) => setFormData({ ...formData, txData: e.target.value })}
                  placeholder="Paste raw transaction data..."
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                  required
                />
              )}
            </div>

            {/* Warning Box */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5 mr-3" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">
                    Demo Mode Active
                  </h3>
                  <p className="mt-1 text-sm text-yellow-700">
                    This is a demonstration version. Real transaction analysis requires API keys and live blockchain connections.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg font-semibold flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transition-shadow duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  <span>Analyze Transaction</span>
                </>
              )}
            </motion.button>
          </form>
        </motion.div>

        {/* Example Transactions */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Example Transactions
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Solana Example</h4>
              <p className="text-sm text-gray-600 mb-3">Legitimate DeFi transaction</p>
              <code className="text-xs bg-gray-100 p-2 rounded block break-all">
                3Bxs4h6xjT8YP...K9mN2pQ7R
              </code>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Avalanche Example</h4>
              <p className="text-sm text-gray-600 mb-3">Token swap transaction</p>
              <code className="text-xs bg-gray-100 p-2 rounded block break-all">
                0x8f5e3d2c1b...a9e7f4d8c2
              </code>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Analyze;