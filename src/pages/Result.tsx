import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, AlertTriangle, XCircle, CheckCircle, Info, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AnalysisResult {
  riskScore: number;
  verdict: string;
  riskTier?: number;
  explanation: string;
  flags: string[];
  chain: string;
  txHash: string;
  foundryPoE?: string;
  mitigationBundleHash?: string;
  mitigationActions?: string[];
}

const Result = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    const savedResult = localStorage.getItem('analysisResult');
    if (savedResult) {
      setResult(JSON.parse(savedResult));
    }
  }, []);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No analysis result found</p>
          <Link to="/analyze" className="text-blue-600 hover:underline">
            Go back to analyze
          </Link>
        </div>
      </div>
    );
  }

  const getRiskColor = (score: number) => {
    if (score < 30) return 'green';
    if (score < 70) return 'yellow';
    return 'red';
  };

  const getRiskIcon = (score: number) => {
    if (score < 30) return <CheckCircle className="h-6 w-6 text-green-500" />;
    if (score < 70) return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
    return <XCircle className="h-6 w-6 text-red-500" />;
  };

  const getRiskVerdict = (score: number) => {
    if (score < 30) return 'Safe';
    if (score < 70) return 'Medium Risk';
    return 'Critical Threat (Tier-3 Active Mitigation)';
  };

  const riskColor = getRiskColor(result.riskScore);
  const riskIcon = getRiskIcon(result.riskScore);
  const verdict = result.verdict || getRiskVerdict(result.riskScore);

  return (
    <div className="min-h-screen py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <Link to="/analyze" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Analyze
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Transaction Security &amp; PoE Report
          </h1>
          <p className="text-gray-600">
            Chain: <span className="font-medium capitalize">{result.chain}</span>
          </p>
          {result.txHash && (
            <p className="text-gray-600 break-all">
              Hash: <code className="bg-gray-100 px-2 py-1 rounded text-sm">{result.txHash}</code>
            </p>
          )}
        </motion.div>

        {/* Risk Score Card */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="bg-white rounded-2xl shadow-xl p-8 mb-8"
        >
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              {riskIcon}
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{verdict}</h2>
            <p className="text-gray-600">
              Risk Score: {result.riskScore}/100 {result.riskTier ? `• Tier ${result.riskTier}` : ''}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <div className="w-full bg-gray-200 rounded-full h-6 mb-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${result.riskScore}%` }}
                transition={{ duration: 1.5, delay: 0.5 }}
                className={`h-6 rounded-full ${
                  riskColor === 'green' ? 'bg-gradient-to-r from-green-400 to-green-600' :
                  riskColor === 'yellow' ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                  'bg-gradient-to-r from-red-400 to-red-600'
                }`}
              ></motion.div>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Tier 1: Safe / Log</span>
              <span>Tier 2: Throttle</span>
              <span>Tier 3: Circuit Breaker</span>
            </div>
          </div>
        </motion.div>

        {/* Explanation Card */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="bg-white rounded-2xl shadow-xl p-8 mb-8"
        >
          <div className="flex items-center mb-4">
            <Info className="h-6 w-6 text-blue-600 mr-2" />
            <h3 className="text-2xl font-bold text-gray-900">Simulation &amp; Invariant Analysis</h3>
          </div>
          <p className="text-gray-700 leading-relaxed">
            {result.explanation}
          </p>
          {result.mitigationBundleHash && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm font-semibold text-red-900">
                ⚡ Flashbots Front-Run Rescue Bundle Dispatched
              </p>
              <p className="text-xs text-red-800 mt-1 font-mono break-all">
                Bundle Hash: {result.mitigationBundleHash}
              </p>
              {result.mitigationActions && (
                <p className="text-xs text-red-800 mt-1">
                  Executed Calls: <code>{result.mitigationActions.join('(), ')}()</code>
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* Proof of Exploit Foundry Test Card */}
        {result.foundryPoE && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="bg-gray-900 text-gray-100 rounded-2xl shadow-xl p-8 mb-8"
          >
            <div className="flex items-center mb-4">
              <Terminal className="h-6 w-6 text-green-400 mr-2" />
              <h3 className="text-2xl font-bold text-white">Generated Foundry Proof-of-Exploit (.t.sol)</h3>
            </div>
            <pre className="text-xs font-mono overflow-x-auto bg-black/50 p-4 rounded-xl leading-relaxed">
              {result.foundryPoE}
            </pre>
          </motion.div>
        )}

        {/* Flags Card */}
        {result.flags && result.flags.length > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="bg-white rounded-2xl shadow-xl p-8 mb-8"
          >
            <div className="flex items-center mb-4">
              <Shield className="h-6 w-6 text-purple-600 mr-2" />
              <h3 className="text-2xl font-bold text-gray-900">Detection &amp; Invariant Flags</h3>
            </div>
            <div className="space-y-3">
              {result.flags.map((flag, index) => (
                <motion.div
                  key={index}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                  className="flex items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
                  <span className="text-gray-700">{flag}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Link to="/analyze" className="flex-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-shadow duration-200"
            >
              Simulate Another Transaction
            </motion.button>
          </Link>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const resultText = `GuardianX Analysis Result\n\nRisk Score: ${result.riskScore}/100\nVerdict: ${verdict}\nChain: ${result.chain}\n\nExplanation: ${result.explanation}`;
              navigator.clipboard.writeText(resultText);
            }}
            className="flex-1 border-2 border-gray-300 text-gray-700 py-4 px-6 rounded-lg font-semibold hover:border-blue-600 hover:text-blue-600 transition-colors duration-200"
          >
            Copy Security Report
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default Result;
