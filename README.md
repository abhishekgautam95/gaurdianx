# GuardianX - AI-Powered Wallet Guardian 🛡️

GuardianX is an innovative hackathon project that provides AI-powered protection against scams, rug pulls, and phishing attacks on Solana and Avalanche blockchains. Before any transaction is signed, GuardianX analyzes it in real-time and provides a comprehensive risk assessment.

![GuardianX Demo]
<img width="1920" height="1080" alt="Screenshot from 2025-09-21 20-46-59" src="https://github.com/user-attachments/assets/b7e84d55-2f87-4645-9fec-358f753bceca" />

<img width="1920" height="1080" alt="Screenshot from 2025-09-21 20-47-07" src="https://github.com/user-attachments/assets/3e1d0f1f-44f9-4c6b-a14b-feb2a0d334fc" />
<img width="1920" height="1080" alt="Screenshot from 2025-09-21 20-47-23" src="https://github.com/user-attachments/assets/19277bf0-9e70-4481-a4c5-657fd215cc19" />


## 🚀 Features

- **AI-Powered Risk Analysis**: Advanced machine learning algorithms analyze transaction patterns
- **Multi-Chain Support**: Compatible with Solana and Avalanche blockchains  
- **Real-Time Scanning**: Instant risk assessment with detailed explanations
- **Smart Risk Scoring**: Color-coded risk levels (Safe/Medium/High) with explanations
- **Comprehensive Detection**: Identifies rug pulls, phishing, unverified contracts, and more
- **Modern UI**: Clean, responsive interface with smooth animations
- **Developer-Friendly**: RESTful API for easy integration

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **React Router** for navigation
- **Lucide React** for icons

### Backend
- **Node.js** with Express
- **CORS** for cross-origin requests
- **Modular architecture** with services
- **Mock AI integration** (DeepSeek ready)

## 📦 Project Structure

```
guardianx/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   │   └── Navbar.tsx
│   │   ├── pages/           # Main pages
│   │   │   ├── Home.tsx
│   │   │   ├── Analyze.tsx
│   │   │   └── Result.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
├── backend/                 # Express API server
│   ├── routes/
│   │   └── analyze.js       # API routes
│   ├── services/            # Business logic
│   │   ├── analyzeService.js
│   │   ├── solanaService.js
│   │   ├── avalancheService.js
│   │   └── aiService.js
│   ├── utils/
│   │   └── riskRules.js     # Risk detection logic
│   └── server.js            # Main server file
├── README.md
└── .env.example            # Environment variables template
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- npm or yarn package manager

### Frontend Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser** to `http://localhost:5173`

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install backend dependencies**:
   ```bash
   npm install
   ```

3. **Create environment file**:
   ```bash
   cp ../.env.example .env
   ```

4. **Start the backend server**:
   ```bash
   npm start
   ```

5. **Backend will run** on `http://localhost:3001`

## 🔧 API Usage

### Analyze Transaction Endpoint

**POST** `/api/analyze-tx`

**Request Body**:
```json
{
  "chain": "solana",
  "txHash": "3Bxs4h6xjT8YP7K9mN2pQ7R...",
  "txData": "optional_raw_transaction_data"
}
```

**Response**:
```json
{
  "riskScore": 45,
  "verdict": "Medium Risk",
  "explanation": "AI analysis detected potential risks...",
  "flags": [
    "Contract is not verified, limiting transparency",
    "Limited number of token holders"
  ],
  "chain": "solana",
  "txHash": "3Bxs4h6xjT8YP7K9mN2pQ7R...",
  "timestamp": "2025-01-11T10:30:00.000Z"
}
```

### Example cURL Request

```bash
curl -X POST http://localhost:3001/api/analyze-tx \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "solana",
    "txHash": "example_transaction_hash_here"
  }'
```

## 🔮 Production Integration

To extend GuardianX with real APIs, update these components:

### 1. Solana Integration (Helius API)
```javascript
// In services/solanaService.js
async parseTransaction(txHash) {
  const response = await fetch(`https://api.helius.xyz/v0/transactions/${txHash}?api-key=${process.env.HELIUS_API_KEY}`);
  return response.json();
}
```

### 2. Avalanche Integration (Snowtrace API)
```javascript
// In services/avalancheService.js  
async parseTransaction(txHash) {
  const response = await fetch(`https://api.snowtrace.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${process.env.SNOWTRACE_API_KEY}`);
  return response.json();
}
```

### 3. AI Service (DeepSeek API)
```javascript
// In services/aiService.js
async analyzeWithAI(data) {
  const response = await fetch('https://api.deepseek.com/v1/analyze', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return response.json();
}
```

## 🎯 Demo Features

- **Interactive UI**: Beautiful, responsive design with smooth animations
- **Mock Analysis**: Realistic transaction analysis without requiring API keys
- **Multi-Chain**: Switch between Solana and Avalanche analysis
- **Risk Visualization**: Color-coded progress bars and detailed explanations
- **Mobile-Friendly**: Fully responsive design for all devices

## 🛡️ Security Features

- **Rug Pull Detection**: Analyzes holder distribution and liquidity patterns
- **Phishing Protection**: Detects suspicious approval patterns and unknown contracts
- **Smart Contract Analysis**: Verifies contract authenticity and security
- **Real-Time Monitoring**: Continuous analysis of blockchain activity

## 📱 Screenshots

The application features a modern, clean interface with:
- Landing page with hero section and feature highlights
- Transaction analysis form with chain selection
- Detailed results page with risk scores and recommendations
- Mobile-responsive design with smooth animations

## 🤝 Contributing

This is a hackathon project! Feel free to:
1. Fork the repository
2. Create feature branches
3. Submit pull requests
4. Report issues and suggestions

## 📄 License

MIT License - feel free to use this project for learning and development.

## 🌟 Future Enhancements

- Real-time WebSocket notifications
- User accounts and transaction history  
- Machine learning model training
- Additional blockchain support (Ethereum, Polygon, BSC)
- Mobile app development
- Advanced analytics dashboard

---

**Built with ❤️ for the hackathon community**

*GuardianX - Your AI-powered guardian in the crypto world* 🛡️✨
