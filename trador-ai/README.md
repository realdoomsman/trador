# TRADOR AI

AI-powered Solana memecoin trading bot that learns from Pump.fun market data.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TRADOR AI                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Helius  │───▶│  Brain   │───▶│  Gemini  │───▶│  Storage │  │
│  │   RPC    │    │ (Core)   │    │   LLM    │    │   GCS    │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │               │               │               │         │
│       ▼               ▼               ▼               ▼         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Learning Pipeline                      │  │
│  │  1. Scan Pump.fun tokens                                 │  │
│  │  2. Collect market data                                  │  │
│  │  3. Analyze with Gemini                                  │  │
│  │  4. Store patterns in GCS                                │  │
│  │  5. Build confidence over time                           │  │
│  │  6. Virtual trade when confident                         │  │
│  │  7. Learn from results                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Requirements

- Node.js 18+
- Google Cloud account with Storage bucket
- Gemini API key
- Helius API key

## Setup

1. Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

2. Create a Google Cloud Storage bucket named `trador-ai-data`

3. Download your GCP service account JSON and save as `service-account.json`

4. Install dependencies:

```bash
cd trador-ai
npm install

cd ../trador-ai-dashboard
npm install
```

5. Start the AI:

```bash
cd trador-ai
npm start
```

6. Start the dashboard:

```bash
cd trador-ai-dashboard
npm run dev
```

## How It Works

### Learning Phase

The AI starts in learning mode, collecting data about:
- Token launches on Pump.fun
- Price movements over time
- Market cap changes
- Trading volume patterns
- Holder distribution

Data is stored in Google Cloud Storage and analyzed by Gemini to identify patterns.

### Confidence Building

Confidence increases based on:
- Amount of data collected (0-50%)
- Virtual trading performance (0-30%)
- Pattern recognition quality (0-20%)

Thresholds:
- **60%** - Can start virtual trading
- **85%** - Ready for live trading (requires manual enable)

### Risk Profiles

| Profile | Position Size | Stop Loss | Take Profit | Daily Trades |
|---------|--------------|-----------|-------------|--------------|
| Low     | 2%           | 5%        | 10%         | 3            |
| Medium  | 5%           | 10%       | 25%         | 8            |
| High    | 10%          | 20%       | 50%         | 15           |

### Virtual Trading

Once confidence reaches 60%, the AI begins virtual trading:
- Simulates trades without real money
- Tracks entry/exit prices
- Calculates PnL
- Learns from each trade outcome

### Dashboard Metrics

- **Confidence %** - Overall AI confidence level
- **Data Size** - Total learning data in MB/GB
- **Daily/Weekly/Monthly PnL** - Virtual trading performance
- **Win Rate** - Percentage of profitable trades

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Get AI status and metrics |
| `/api/start` | POST | Start the AI |
| `/api/stop` | POST | Stop the AI |
| `/api/risk-profile` | POST | Set risk profile |
| `/api/positions` | GET | Get active positions |
| `/api/trades` | GET | Get trade history |
| `/api/patterns` | GET | Get learned patterns |

## Google Cloud VM Setup

Recommended: e2-standard-4 (4 vCPU, 16GB RAM) with L4 GPU

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <your-repo>
cd trador-ai
npm install

# Run with PM2
npm install -g pm2
pm2 start src/index.js --name trador-ai
pm2 save
```

## Safety Notes

- The AI only virtual trades until manually enabled for live trading
- Live trading requires 85%+ confidence AND positive virtual PnL
- Always start with LOW risk profile
- Monitor the dashboard regularly
- The AI is experimental - use at your own risk
