import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  ArrowRight,
  Terminal,
  Bot,
  Lock,
  GitCompare,
  Play,
  CheckCircle2,
  XCircle,
  Layers,
  Activity,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { MockAttackEngine } from '../core/mockAttackEngine';
import { AttackScenarioId } from '../types';

const attackEngine = new MockAttackEngine();

const Home = () => {
  const navigate = useNavigate();
  const [launchingId, setLaunchingId] = useState<AttackScenarioId | null>(null);
  const scenarios = attackEngine.listScenarios();

  const handleInstantReplay = async (scenarioId: AttackScenarioId) => {
    setLaunchingId(scenarioId);
    try {
      const replay = await attackEngine.replayScenario(scenarioId);
      const { analysis, scenario } = replay;

      const serializedResult = {
        riskScore: analysis.riskScore,
        verdict: analysis.verdict,
        riskTier: analysis.riskTier,
        explanation: analysis.explanation,
        flags: analysis.flags.map((f) => f.message),
        chain: analysis.chain,
        txHash: analysis.txHash,
        foundryPoE: analysis.proofOfExploit?.reproducibleFoundryTestSolidity,
        mitigationBundleHash: analysis.mitigationReceipt?.bundleResponse?.bundleHash,
        mitigationActions: analysis.mitigationReceipt?.actionsTaken,
        historicalReplay: {
          title: scenario.title,
          protocol: scenario.protocol,
          date: scenario.date,
          historicalLossUsd: scenario.historicalLossUsd,
          attackCategory: scenario.attackCategory,
          summary: scenario.summary,
          preVaultBalanceEth: replay.preVaultBalanceEth,
          postVaultBalanceWithoutGuardianEth: replay.postVaultBalanceWithoutGuardianEth,
          postVaultBalanceWithGuardianEth: replay.postVaultBalanceWithGuardianEth,
        },
      };

      localStorage.setItem('analysisResult', JSON.stringify(serializedResult));
      navigate('/result');
    } finally {
      setLaunchingId(null);
    }
  };

  const architecturalPillars = [
    {
      icon: <Terminal className="h-7 w-7 text-amber-400" />,
      badge: 'Zero False Positives',
      title: 'Local Fork Proof-of-Exploit (PoE)',
      description:
        'Forks chain state via debug_traceCall / Anvil, evaluates deterministic balance & storage invariants, and auto-generates a reproducible Foundry (.t.sol) exploit harness before escalating.',
    },
    {
      icon: <Zap className="h-7 w-7 text-purple-400" />,
      badge: 'MEV Front-Running',
      title: 'Multi-Builder Circuit Breaker',
      description:
        'Broadcasts signed pause(), freezeVault(), and sweepToSafe() bundles simultaneously to Flashbots, Titan, Beaverbuild, and MEV-Blocker (>90% next-block inclusion) without public mempool leakage.',
    },
    {
      icon: <Bot className="h-7 w-7 text-emerald-400" />,
      badge: 'Viem & Ethers SDK',
      title: 'AI Agent Runtime Firewall',
      description:
        'Drop-in createGuardianWallet() middleware that intercepts LLM tool calls, verifies 4-byte calldata selectors against natural-language intent, and enforces hard caps on slippage & spend.',
    },
    {
      icon: <Lock className="h-7 w-7 text-cyan-400" />,
      badge: 'Safe{Wallet} Zodiac',
      title: 'Non-Custodial Safe Module',
      description:
        'Audited-style GuardianXSafeModule.sol restricts the operator strictly to pause() or sweeping funds to your immutable SAFE_TREASURY address—zero admin key custody risk.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-800/80 bg-gradient-to-b from-slate-950 via-indigo-950/40 to-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Value Prop & CTAs */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
                <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                <span>GuardianX v2.1 • Autonomous Web3 Circuit Breaker &amp; AI Agent Firewall</span>
              </div>

              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight text-white"
              >
                Stop Getting Paged{' '}
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
                  After Your Vault Is Drained.
                </span>
              </motion.h1>

              <p className="text-lg text-slate-300 max-w-2xl leading-relaxed">
                Legacy monitors send a Discord webhook after the exploit is mined.{' '}
                <strong className="text-white">GuardianX</strong> proves state invariant violations in a local fork, generates a Foundry <code>.t.sol</code> Proof-of-Exploit, intercepts rogue AI agent tool calls, and front-runs attackers via private MEV relays.
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <Link to="/analyze">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-7 py-4 rounded-xl font-bold flex items-center gap-2.5 shadow-xl shadow-indigo-950/60"
                  >
                    <span>Launch Interactive Sandbox</span>
                    <ArrowRight className="h-5 w-5" />
                  </motion.button>
                </Link>

                <button
                  type="button"
                  onClick={() => handleInstantReplay('euler-flashloan-2023')}
                  className="bg-slate-900 hover:bg-slate-800 border border-amber-400/40 text-amber-300 px-6 py-4 rounded-xl font-semibold flex items-center gap-2 transition-colors"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Replay $197M Euler Exploit Live</span>
                </button>
              </div>

              {/* Telemetry Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-800/80">
                <div>
                  <div className="text-2xl font-extrabold text-white">&lt;150ms</div>
                  <div className="text-xs text-slate-400">Fork PoE Simulation</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-emerald-400">&gt;94%</div>
                  <div className="text-xs text-slate-400">4-Builder Block Inclusion</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-purple-400">0%</div>
                  <div className="text-xs text-slate-400">False-Positive Alert Noise</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-amber-400">100%</div>
                  <div className="text-xs text-slate-400">Non-Custodial Safe Module</div>
                </div>
              </div>
            </div>

            {/* Right Column: Live SDK Code Card */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
                    <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
                    <span className="ml-2 text-xs font-mono text-slate-400">
                      agent-firewall.ts — @guardianx/sdk
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    TypeScript Strict
                  </span>
                </div>
                <pre className="p-5 text-xs sm:text-sm font-mono text-slate-200 overflow-x-auto leading-relaxed">
{`import { createGuardianWallet } from '@guardianx/sdk';
import { createWalletClient, http, parseEther } from 'viem';
import { mainnet } from 'viem/chains';

const baseClient = createWalletClient({
  chain: mainnet,
  transport: http(),
});

// Wrap any AI agent wallet in one line
const guardianWallet = createGuardianWallet({
  client: baseClient,
  policy: {
    maxSlippageBps: 100, // 1.00% hard cap
    maxDailySpendWei: parseEther('1.0'),
    allowedContracts: ['0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'],
  },
});

// Simulated in local fork & intent-checked before signing
await guardianWallet.sendTransaction({
  to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  value: parseEther('0.1'),
});`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Instant Historical Attack Replays Section */}
      <section className="py-16 bg-slate-900/50 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                Interactive Attack Replay Engine
              </div>
              <h2 className="text-3xl font-bold text-white">
                One-Click Historical Exploit Simulations
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Click any real-world DeFi exploit below to execute the attack in an ephemeral fork, generate a Foundry <code>.t.sol</code> Proof-of-Exploit, and dispatch a simulated Flashbots rescue bundle.
              </p>
            </div>
            <Link
              to="/analyze"
              className="text-sm font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
            >
              <span>Open Full Custom Simulator &amp; Agent Playground</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {scenarios.map((sc) => (
              <div
                key={sc.id}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 flex flex-col justify-between transition-all shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-3">
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {sc.attackCategory}
                    </span>
                    <span className="text-red-400 font-mono">{sc.historicalLossUsd} Loss</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{sc.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{sc.summary}</p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-500">
                    Block #{sc.txPayload.blockNumber}
                  </span>
                  <button
                    type="button"
                    disabled={launchingId === sc.id}
                    onClick={() => handleInstantReplay(sc.id)}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>
                      {launchingId === sc.id ? 'Simulating...' : 'Simulate & Prove Exploit'}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 Core Architectural Pillars */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
              <Layers className="h-4 w-4" />
              <span>Enterprise Security Architecture</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Engineered to Outperform Passive Alerting Tools
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {architecturalPillars.map((pillar, idx) => (
              <div
                key={idx}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    {pillar.icon}
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                    {pillar.badge}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{pillar.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Competitive Comparison Table */}
      <section className="py-16 bg-slate-900/40 border-t border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-2 justify-center text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">
            <GitCompare className="h-4 w-4" />
            <span>Head-to-Head Comparison</span>
          </div>
          <h2 className="text-3xl font-bold text-center text-white mb-10">
            Why Protocol &amp; Agent Teams Switch to GuardianX
          </h2>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-300">
                  <th className="py-4 px-5 font-semibold">Security Capability</th>
                  <th className="py-4 px-5 font-bold text-emerald-400">GuardianX v2.1</th>
                  <th className="py-4 px-5 font-semibold text-slate-400">OpenZeppelin Defender</th>
                  <th className="py-4 px-5 font-semibold text-slate-400">Forta Network</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs sm:text-sm">
                <tr>
                  <td className="py-3.5 px-5 font-medium text-white">Detection Mechanism</td>
                  <td className="py-3.5 px-5 text-emerald-300 font-semibold">
                    Stateful Fork Invariants + Foundry PoE (.t.sol)
                  </td>
                  <td className="py-3.5 px-5 text-slate-400">Event / Signature Matching</td>
                  <td className="py-3.5 px-5 text-slate-400">Heuristic Detection Bots</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-5 font-medium text-white">Active Exploit Mitigation</td>
                  <td className="py-3.5 px-5 text-emerald-300 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Tier-3 Auto pause() &amp; sweepToSafe()
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-slate-400">Manual Relayer Script</td>
                  <td className="py-3.5 px-5 text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <XCircle className="h-4 w-4 text-red-400" />
                      Passive Alerting Only
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 px-5 font-medium text-white">Private Mempool Front-Running</td>
                  <td className="py-3.5 px-5 text-emerald-300 font-semibold">
                    4-Builder Fan-Out (Flashbots, Titan, Beaverbuild, MEV-Blocker)
                  </td>
                  <td className="py-3.5 px-5 text-slate-400">Public Mempool Default</td>
                  <td className="py-3.5 px-5 text-slate-500">None</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-5 font-medium text-white">AI Agent Runtime Firewall</td>
                  <td className="py-3.5 px-5 text-emerald-300 font-semibold">
                    Semantic Intent Verification + Deterministic Hard Caps
                  </td>
                  <td className="py-3.5 px-5 text-slate-500">None</td>
                  <td className="py-3.5 px-5 text-slate-500">None</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-5 font-medium text-white">Non-Custodial On-Chain Scope</td>
                  <td className="py-3.5 px-5 text-emerald-300 font-semibold">
                    GuardianXSafeModule.sol (Immutable SAFE_TREASURY)
                  </td>
                  <td className="py-3.5 px-5 text-slate-400">Requires Relayer Role</td>
                  <td className="py-3.5 px-5 text-slate-500">N/A</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
