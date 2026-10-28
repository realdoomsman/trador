# TRADOR - AI-Powered Solana Memecoin Trading System

<div align="center">

![TRADOR Logo](https://img.shields.io/badge/TRADOR-AI%20Trading-00ff88?style=for-the-badge&logo=solana)

**A self-learning, multi-model AI analysis and paper-trading system for Solana memecoins**

![Solana](https://img.shields.io/badge/Solana-Blockchain-9945FF?style=flat&logo=solana)
![AI Powered](https://img.shields.io/badge/AI-Multi--Model-00ccff?style=flat)

[Architecture](#architecture) • [Installation](#installation) • [Whitepaper](#whitepaper)

</div>

---

## Overview

TRADOR is an AI trading system designed specifically for Solana memecoins. It combines multiple AI models, on-chain analysis, wallet intelligence, and social signals to identify high-potential trading opportunities while avoiding rugs and scams.

### Key Features

- **Multi-AI Consensus** - Combines Gemini, GPT-4, Claude, Groq, and Perplexity for trading decisions
- **Deep On-Chain Analysis** - Analyzes holder distribution, whale wallets, and transaction patterns
- **Security Scanning** - Integrates RugCheck and GoPlus for automated rug detection
- **Self-Learning AI** - Continuously improves from trading outcomes
- **Social Intelligence** - Tracks narratives, viral potential, and market sentiment
- **Wallet Intelligence** - Identifies dev wallets, snipers, whales, and profitable traders

---

## Table of Contents

- [Architecture](#architecture)
- [Components](#components)
- [AI Systems](#ai-systems)
- [Security Features](#security-features)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Whitepaper](#whitepaper)
- [Roadmap](#roadmap)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRADOR SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Birdeye   │  │   Helius    │  │  DexScreener│  Data       │
│  │   API       │  │   RPC       │  │   API       │  Sources    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    TRADING BRAIN                          │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │ │
│  │  │Analytics│ │ Learner │ │  Alpha  │ │ Wallet  │         │ │
│  │  │ Engine  │ │   AI    │ │ Engine  │ │  Intel  │         │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │ │
│  │  │Multi-AI │ │External │ │ Social  │ │ Gemini  │         │ │
│  │  │Consensus│ │ Tools   │ │  Intel  │ │Analyzer │         │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                          │                                      │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                   DECISION ENGINE                         │ │
│  │  Score Calculation → Risk Assessment → Trade Execution    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Dashboard  │  │  REST API   │  │   Storage   │             │
│  │    (React)  │  │  (Express)  │  │   (JSON)    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Trading Brain (`brain.js`)
The central intelligence that coordinates all analysis systems and makes trading decisions.

- Manages token analysis pipeline
- Coordinates multi-AI consensus
- Tracks virtual trades for learning
- Calculates confidence scores

### 2. Analytics Engine (`analytics.js`)
Advanced pattern recognition and scoring system.

- 60+ data points per token
- Multi-timeframe analysis
- Pattern recognition
- Backtesting capabilities

### 3. Self-Learning AI (`learner.js`)
Continuously improves from trading outcomes.

- Adjusts signal weights based on performance
- Dynamic threshold optimization
- Auto-optimization every 50 outcomes
- Tracks accuracy and win rate

### 4. Alpha Engine (`alpha.js`)
Profit maximization strategies.

- Market regime detection (Bull/Bear/Neutral/Volatile)
- Kelly Criterion position sizing
- Dynamic exit strategies (Scalp/Swing/Moon)
- Optimal trading time detection

### 5. Wallet Intelligence (`walletIntel.js`)
Deep wallet analysis and tracking.

- Dev wallet identification
- Sniper bot detection
- Whale tracking
- Cluster/bubble map analysis
- Rugger wallet blacklist
- Profitable wallet whitelist

### 6. Multi-AI Engine (`multiAI.js`)
Combines multiple AI models for consensus.

- Gemini 1.5 Flash
- OpenAI GPT-4
- Anthropic Claude
- Groq (Llama 3.1)
- Perplexity (Real-time search)

### 7. External Tools (`externalTools.js`)
Third-party security integrations.

- RugCheck.xyz - Rug detection
- GoPlus Security - Token scanning
- Social sentiment analysis

### 8. Social Intelligence (`socialIntel.js`)
Social signal analysis.

- Narrative detection (AI, Animal, Meme, Political, etc.)
- Viral potential scoring
- Hype analysis
- Pump & dump detection
- Community strength metrics

---

## AI Systems

### Multi-AI Consensus

TRADOR uses multiple AI models to reach consensus on trading decisions:

| AI Model | Purpose | Speed | Accuracy |
|----------|---------|-------|----------|
| Gemini 1.5 | Primary analysis | Fast | High |
| GPT-4 | Deep reasoning | Medium | Very High |
| Claude | Risk assessment | Medium | Very High |
| Groq | Real-time decisions | Very Fast | High |
| Perplexity | News/Alpha search | Medium | High |

**Consensus Algorithm:**
1. All available AIs analyze the token in parallel
2. Each AI votes: BUY, SELL, or HOLD
3. Agreement percentage calculated
4. Weighted confidence based on agreement
5. Final signal requires >60% agreement

### Self-Learning System

The AI continuously learns from outcomes:

```
Token Tracked → 30min Wait → Check Price → Classify Outcome
                                              ↓
                              PUMP (>20%) / DUMP (<-20%) / NEUTRAL
                                              ↓
                              Adjust Weights & Thresholds
                                              ↓
                              Save to Training Data
```

**Learned Signals:**
- Market cap ranges
- Liquidity thresholds
- Buy pressure patterns
- Holder distribution
- Whale activity
- Volume patterns

---

## Security Features

### Automated Security Checks

Every token is scanned for:

| Check | Source | Risk Factor |
|-------|--------|-------------|
| Mint Authority | RugCheck/GoPlus | Can create more tokens |
| Freeze Authority | RugCheck/GoPlus | Can freeze transfers |
| LP Locked | RugCheck | Liquidity protection |
| Honeypot | GoPlus | Can't sell |
| Hidden Owner | GoPlus | Ownership obfuscation |
| Buy/Sell Tax | GoPlus | Hidden fees |
| Creator Holdings | Birdeye | Insider risk |

### Wallet Risk Assessment

| Wallet Type | Risk Level | Action |
|-------------|------------|--------|
| Dev Wallet | High | Flag + reduce score |
| Sniper Bot | Medium | Track + caution |
| Whale | Variable | Track behavior |
| Insider | High | Flag + avoid |
| Rugger | Critical | Blacklist |
| Profitable | Low | Follow signals |

---

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Quick Start

```bash
# Clone repository
git clone https://github.com/realdoomsman/trador.git
cd trador

# Install AI system
cd trador-ai
npm install
cp .env.example .env
# Edit .env with your API keys

# Start AI system
npm start

# Install dashboard (new terminal)
cd ../trador-ai-dashboard
npm install
npm run dev
```

### Production Deployment

```bash
# Using PM2
pm2 start trador-ai/src/index.js --name trador-ai
pm2 start "npm run preview" --name trador-dashboard --cwd trador-ai-dashboard
pm2 save
```

---

## Configuration

### Environment Variables

```env
# Required
BIRDEYE_API_KEY=your_birdeye_key
GEMINI_API_KEY=your_gemini_key

# Optional (for Multi-AI)
OPENAI_API_KEY=sk-your-openai-key
CLAUDE_API_KEY=sk-ant-your-claude-key
GROQ_API_KEY=gsk_your-groq-key
PERPLEXITY_API_KEY=pplx-your-perplexity-key

# Helius (optional)
HELIUS_API_KEY=your_helius_key
HELIUS_PLAN=free

# Settings
USE_GPU=false
SCAN_INTERVAL=60000
API_PORT=3003
```

### Risk Profiles

| Profile | Position Size | Stop Loss | Take Profit |
|---------|--------------|-----------|-------------|
| Low | 2% | 5% | 10% |
| Medium | 5% | 10% | 25% |
| High | 10% | 20% | 50% |

---

## API Reference

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | System status and stats |
| `/api/positions` | GET | Active virtual positions |
| `/api/trades` | GET | Recent closed trades |
| `/api/patterns` | GET | Learned patterns |
| `/api/alpha` | GET | Alpha engine status |
| `/api/wallet-intel` | GET | Wallet intelligence stats |
| `/api/multi-ai` | GET | Multi-AI status |
| `/api/social` | GET | Social intelligence stats |
| `/api/start` | POST | Start the bot |
| `/api/stop` | POST | Stop the bot |
| `/api/risk-profile` | POST | Set risk profile |

### Example Response

```json
{
  "confidence": 65,
  "dataPoints": 15000,
  "aiAccuracy": 58.5,
  "marketRegime": "volatile",
  "hotNarratives": ["AI", "ANIMAL"],
  "knownWallets": 250,
  "trackedClusters": 15
}
```

---

## Whitepaper

### Abstract

TRADOR combines multiple artificial intelligence models with deep on-chain analysis and social intelligence. The system learns from every trade outcome, continuously improving its ability to identify profitable opportunities while avoiding scams and rugs.

### Problem Statement

The Solana memecoin market presents unique challenges:
1. **High Rug Rate** - 90%+ of new tokens are scams
2. **Information Asymmetry** - Insiders have advantages
3. **Speed Requirements** - Opportunities last minutes
4. **Emotional Trading** - FOMO leads to losses

### Solution

TRADOR addresses these challenges through:

1. **Multi-Layer Security**
   - Automated rug detection
   - Wallet behavior analysis
   - Cluster identification

2. **AI Consensus**
   - Multiple models reduce bias
   - Agreement-weighted confidence
   - Real-time adaptation

3. **Self-Learning**
   - Outcome-based optimization
   - Dynamic threshold adjustment
   - Pattern recognition

4. **Social Intelligence**
   - Narrative tracking
   - Viral detection
   - Sentiment analysis

### Technical Specifications

- **Blockchain**: Solana
- **Data Sources**: Birdeye, Helius, DexScreener
- **AI Models**: 5 (Gemini, GPT-4, Claude, Groq, Perplexity)
- **Analysis Points**: 60+ per token
- **Scan Interval**: 60 seconds
- **Learning Cycle**: 30 minutes per token

---

## Roadmap

### Phase 1 (Complete)
- [x] Core trading brain
- [x] Birdeye integration
- [x] Basic analytics
- [x] Virtual trading
- [x] Dashboard v1

### Phase 2 (Complete)
- [x] Self-learning AI
- [x] Multi-AI consensus
- [x] Wallet intelligence
- [x] Security scanning
- [x] Social intelligence

### Phase 3 (In Progress)
- [ ] Live trading integration
- [ ] Telegram bot
- [ ] Mobile app
- [ ] Advanced backtesting

### Phase 4 (Planned)
- [ ] Copy trading
- [ ] API access tiers

---

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| AI Accuracy | >60% | Learning |
| Rug Detection | >95% | Active |
| Scan Speed | <5s | ~3s |
| Uptime | 99.9% | 99.9% |

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

## Disclaimer

This software is for educational purposes only. Trading cryptocurrencies involves significant risk. Past performance does not guarantee future results. Always do your own research and never invest more than you can afford to lose.

