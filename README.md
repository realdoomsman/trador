# TRADOR 🔥

**Autonomous trading bot that trades Pump.fun memecoins and uses 100% of profits to buy back TRADOR.**

> Bot wins = Buybacks = Chart pumps 📈

---

## What Is TRADOR?

TRADOR is a Pump.fun token with a twist: an autonomous bot trades other memecoins 24/7, and every SOL of profit automatically buys TRADOR - creating constant buy pressure on the chart.

- **100% profit buyback** - Every winning trade buys TRADOR
- **Never sells** - Bot accumulates TRADOR forever
- **Fully transparent** - One public wallet, verify everything on-chain
- **No token taxes** - Standard Pump.fun token

---

## The Flywheel

```
Bot trades memecoins → Profits → Buybacks → Chart support → Repeat
```

1. Bot scans Pump.fun for opportunities
2. Enters positions based on scoring algorithm
3. Takes profits via TP/trailing stops
4. 100% of profits buy TRADOR
5. TRADOR supply absorbed, price supported
6. Cycle continues 24/7

---

## Trading Strategy

### Tier System

| Tier | Market Cap | Position | Take Profit | Stop Loss |
|------|------------|----------|-------------|-----------|
| A (Degen) | <$25k | 15% | +100% | -35% |
| B (Momentum) | $25k-$150k | 25% | +60% | -25% |
| C (Swing) | >$150k | 40% | +35% | -15% |

### Scoring Algorithm

- Volume Acceleration (40%) - Is volume increasing?
- Buy Pressure (25%) - More buyers than sellers?
- Trade Breadth (20%) - Many traders vs whales
- Momentum (15%) - Price trending up

---

## Quick Start

```bash
# Bot
cd trador-bot
cp .env.example .env
# Add your PRIVATE_KEY and TRADOR_MINT
npm install
npm start

# Dashboard
cd trador-dashboard
npm install
npm run dev
```

- Dashboard: http://localhost:3000
- API: http://localhost:3001

---

## Configuration

Edit `trador-bot/.env`:

```env
RPC_URL=https://api.mainnet-beta.solana.com
PRIVATE_KEY=your_base58_private_key
TRADOR_MINT=your_token_mint_address
MIN_SOL_RESERVE=0.5
TELEGRAM_BOT_TOKEN=optional
TELEGRAM_CHAT_ID=optional
```

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /api/state | Full bot state |
| GET /api/stats | Trading statistics |
| GET /api/trades | Recent trades |
| GET /api/buybacks | Buyback history |
| GET /api/position | Current position |

---

## Transparency

Everything is verifiable on-chain:
- All trades visible on Solscan
- All buybacks are on-chain swaps
- Wallet balance is public
- No hidden mechanics

---

## License

MIT
