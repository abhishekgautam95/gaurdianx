export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'OK',
    version: '2.2.0',
    engine: 'GuardianX Deterministic Invariant & PoE Engine (Vercel Serverless)',
    relays: [
      'Flashbots Protect',
      'Titan Builder',
      'Beaverbuild',
      'MEV-Blocker',
    ],
    timestamp: new Date().toISOString(),
  });
}
