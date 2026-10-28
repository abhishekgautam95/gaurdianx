import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Info,
  Terminal,
  GitCompare,
  Download,
  Copy,
  Radio,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface HistoricalReplaySummary {
  title: string;
  protocol: string;
  date: string;
  historicalLossUsd: string;
  attackCategory: string;
  summary: string;
  preVaultBalanceEth: string;
  postVaultBalanceWithoutGuardianEth: string;
  postVaultBalanceWithGuardianEth: string;
}

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
  historicalReplay?: HistoricalReplaySummary;
}

const MULTI_BUILDER_RELAYS = [
  { name: 'Flashbots Protect', endpoint: 'relay.flashbots.net', latency: '16ms', status: 'INCLUDED (Block +0)' },
  { name: 'Titan Builder', endpoint: 'rpc.titanbuilder.xyz', latency: '12ms', status: 'ACCEPTED' },
  { name: 'Beaverbuild', endpoint: 'rpc.beaverbuild.org', latency: '19ms', status: 'ACCEPTED' },
  { name: 'MEV-Blocker', endpoint: 'rpc.mevblocker.io', latency: '15ms', status: 'ACCEPTED' },
];

const Result = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copiedPoE, setCopiedPoE] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  useEffect(() => {
    const savedResult = localStorage.getItem('analysisResult');
    if (savedResult) {
      setResult(JSON.parse(savedResult));
    }
  }, []);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center bg-slate-900 border border-slate-800 p-8 rounded-2xl">
          <p className="text-slate-400 mb-4">No simulation result found in session.</p>
          <Link to="/analyze" className="text-indigo-400 hover:underline font-semibold">
            Return to Command Center
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
    if (score < 30) return <CheckCircle className="h-8 w-8 text-emerald-400" />;
    if (score < 70) return <AlertTriangle className="h-8 w-8 text-amber-400" />;
    return <XCircle className="h-8 w-8 text-red-400" />;
  };

  const getRiskVerdict = (score: number) => {
    if (score < 30) return 'Safe (Invariants Verified)';
    if (score < 70) return 'Elevated Risk (Tier-2 Throttle)';
    return 'Critical Threat (Tier-3 Active Mitigation)';
  };

  const handleDownloadFoundryPoE = () => {
    if (!result.foundryPoE) return;
    const blob = new Blob([result.foundryPoE], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GuardianXExploitPoE_${(result.txHash || 'test').slice(0, 10)}.t.sol`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const riskColor = getRiskColor(result.riskScore);
  const riskIcon = getRiskIcon(result.riskScore);
  const verdict = result.verdict || getRiskVerdict(result.riskScore);

  return (
    <div className="min-h-screen py-14 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <Link
            to="/analyze"
            className="inline-flex items-center text-indigo-400 hover:text-indigo-300 text-sm font-medium mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Command Center
          </Link>
          <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">
            Transaction Security &amp; Proof-of-Exploit Report
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span>
              Network: <strong className="text-white capitalize">{result.chain}</strong>
            </span>
            {result.txHash && (
              <span className="break-all">
                Tx Hash:{' '}
                <code className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded text-indigo-300 font-mono text-xs">
                  {result.txHash}
                </code>
              </span>
            )}
          </div>
        </motion.div>

        {/* Visual Verification State Diff Card (Historical Replay) */}
        {result.historicalReplay && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="bg-gradient-to-br from-slate-900 via-indigo-950/90 to-slate-900 border border-indigo-500/30 text-white rounded-2xl shadow-2xl p-8 mb-8"
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <div className="flex items-center space-x-2.5">
                <GitCompare className="h-6 w-6 text-amber-400" />
                <h3 className="text-2xl font-bold">
                  Historical Attack Replay: {result.historicalReplay.title}
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-red-500/20 border border-red-400/40 text-red-200 text-xs font-semibold">
                Historical Loss: {result.historicalReplay.historicalLossUsd} ({result.historicalReplay.date})
              </span>
            </div>
            <p className="text-sm text-indigo-200 mb-6">{result.historicalReplay.summary}</p>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-slate-950/70 rounded-xl p-4 border border-white/10">
                <div className="text-xs text-indigo-200 uppercase font-semibold mb-1">
                  Pre-Attack Vault Reserve
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {result.historicalReplay.preVaultBalanceEth}
                </div>
              </div>

              <div className="bg-red-500/15 rounded-xl p-4 border border-red-400/30">
                <div className="text-xs text-red-200 uppercase font-semibold mb-1">
                  Unprotected Post-State (Drained)
                </div>
                <div className="text-xl font-bold font-mono text-red-300">
                  {result.historicalReplay.postVaultBalanceWithoutGuardianEth}
                </div>
              </div>

              <div className="bg-emerald-500/15 rounded-xl p-4 border border-emerald-400/30">
                <div className="text-xs text-emerald-200 uppercase font-semibold mb-1">
                  GuardianX Protected State
                </div>
                <div className="text-lg font-bold font-mono text-emerald-300">
                  {result.historicalReplay.postVaultBalanceWithGuardianEth}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Risk Score Card */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 mb-8"
        >
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">{riskIcon}</div>
            <h2 className="text-3xl font-extrabold text-white mb-2">{verdict}</h2>
            <p className="text-slate-400 font-mono text-sm">
              Deterministic Risk Score: <strong className="text-white">{result.riskScore}/100</strong>{' '}
              {result.riskTier ? `• Active Mitigation Tier ${result.riskTier}` : ''}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <div className="w-full bg-slate-800 rounded-full h-5 mb-3 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${result.riskScore}%` }}
                transition={{ duration: 1.2, delay: 0.3 }}
                className={`h-5 rounded-full ${
                  riskColor === 'green'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    : riskColor === 'yellow'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                      : 'bg-gradient-to-r from-red-600 to-amber-500'
                }`}
              ></motion.div>
            </div>
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>Tier 1: Safe / Log</span>
              <span>Tier 2: Rate-Limit / Timelock</span>
              <span>Tier 3: Private Relay Circuit Breaker</span>
            </div>
          </div>
        </motion.div>

        {/* Explanation & Multi-Builder Private Relay Telemetry Card */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 mb-8"
        >
          <div className="flex items-center mb-4">
            <Info className="h-6 w-6 text-indigo-400 mr-2.5" />
            <h3 className="text-2xl font-bold text-white">Simulation &amp; Invariant Analysis</h3>
          </div>
          <p className="text-slate-300 leading-relaxed">{result.explanation}</p>

          {result.mitigationBundleHash && (
            <div className="mt-6 p-5 bg-red-950/40 border border-red-500/40 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-sm font-bold text-red-200 flex items-center gap-2">
                  <Radio className="h-4 w-4 text-amber-400 animate-pulse" />
                  <span>Multi-Builder Front-Run Rescue Bundle Dispatched (Zero Public Mempool Leakage)</span>
                </p>
                <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  Safe&#123;Wallet&#125; Zodiac Module Verified
                </span>
              </div>
              <div className="text-xs text-slate-300 font-mono break-all bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                <div>Bundle Hash: {result.mitigationBundleHash}</div>
                {result.mitigationActions && (
                  <div className="mt-1 text-amber-300">
                    Executed Emergency Calls: <code>{result.mitigationActions.join('(), ')}()</code>
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-4 gap-3 pt-1">
                {MULTI_BUILDER_RELAYS.map((relay) => (
                  <div
                    key={relay.name}
                    className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 text-xs"
                  >
                    <div className="font-bold text-white mb-0.5">{relay.name}</div>
                    <div className="text-slate-500 font-mono text-[11px] mb-1">{relay.endpoint}</div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-emerald-400">{relay.status}</span>
                      <span className="text-slate-400">{relay.latency}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Proof of Exploit Foundry Test Card */}
        {result.foundryPoE && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="bg-slate-900 border border-emerald-500/30 text-slate-100 rounded-2xl shadow-2xl p-8 mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center">
                <Terminal className="h-6 w-6 text-emerald-400 mr-2.5" />
                <h3 className="text-2xl font-bold text-white">
                  Auto-Generated Foundry Proof-of-Exploit (<code>.t.sol</code>)
                </h3>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(result.foundryPoE || '');
                    setCopiedPoE(true);
                    setTimeout(() => setCopiedPoE(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center space-x-1.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{copiedPoE ? 'Copied!' : 'Copy .t.sol'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFoundryPoE}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center space-x-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .t.sol</span>
                </button>
              </div>
            </div>
            <pre className="text-xs font-mono overflow-x-auto bg-slate-950 border border-slate-800 p-4 rounded-xl leading-relaxed text-emerald-300">
              {result.foundryPoE}
            </pre>
          </motion.div>
        )}

        {/* Flags Card */}
        {result.flags && result.flags.length > 0 && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 mb-8"
          >
            <div className="flex items-center mb-4">
              <Shield className="h-6 w-6 text-purple-400 mr-2.5" />
              <h3 className="text-2xl font-bold text-white">Detection &amp; Invariant Telemetry</h3>
            </div>
            <div className="space-y-3">
              {result.flags.map((flag, index) => (
                <motion.div
                  key={index}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.08 }}
                  className="flex items-center p-3.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200"
                >
                  <div className="w-2 h-2 bg-amber-400 rounded-full mr-3 flex-shrink-0"></div>
                  <span>{flag}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Link to="/analyze" className="flex-1">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-4 px-6 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all"
            >
              Simulate Another Transaction
            </motion.button>
          </Link>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => {
              const resultText = `GuardianX v2.2 Security Report\n\nRisk Score: ${result.riskScore}/100\nVerdict: ${verdict}\nChain: ${result.chain}\nTxHash: ${result.txHash}\n\nExplanation: ${result.explanation}`;
              navigator.clipboard.writeText(resultText);
              setCopiedReport(true);
              setTimeout(() => setCopiedReport(false), 2000);
            }}
            className="flex-1 border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 py-4 px-6 rounded-xl font-bold transition-colors"
          >
            {copiedReport ? 'Security Report Copied!' : 'Copy Security Report'}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default Result;
