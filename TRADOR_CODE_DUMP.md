# TRADOR AI - Code Dump for LLM Discussion

## PROMPT TO INITIATE DISCUSSION

```
I'm building TRADOR, a self-learning AI trading bot for Solana memecoins (specifically pump.fun tokens). I need your help analyzing the architecture and suggesting improvements.

**Current System:**
- Scans tokens from Birdeye API + DexScreener + Pump.fun every 15 seconds
- Analyzes each token using multiple AI models (Gemini, Claude, GPT, Groq, Perplexity) for consensus
- Tracks tokens for 3/5/10 minutes to learn outcomes (pump = +15%, dump = -15%)
- Has a self-learning system that adjusts signal weights based on what actually predicts pumps
- Runs virtual trades to test strategies before real money

**Known Issues We've Been Debugging:**
1. The learning loop was broken - confidence requirements were too high so nothing could trade, so nothing could learn
2. Entry prices were being calculated wrong (market_cap / 1e9 instead of actual price)
3. Same tokens kept appearing because Birdeye returns high-volume established tokens
4. Outcome checking only happened at 10 minutes, missing pumps that reversed
5. The learner's predictions weren't actually being used in trade decisions

**Recent Fixes:**
- Lowered confidence thresholds to break the chicken-egg loop
- Combined multiple token sources (Birdeye + DexScreener + Pump.fun)
- Added multiple outcome windows (3, 5, 10 minutes)
- Made shouldTradeAdvanced() actually use learner.predictPump()
- Fixed price fetching with multiple fallbacks

**Questions for Discussion:**
1. Is the overall architecture sound for a self-learning trading bot?
2. What are the biggest remaining flaws you see?
3. How should the learning feedback loop actually work?
4. Should we be watching real-time transactions instead of polling token lists?
5. How can we catch tokens BEFORE they pump instead of after?
6. What signals actually matter for predicting memecoin pumps?
7. Is the multi-AI consensus approach useful or just adding latency?

Please analyze the code below and provide specific, actionable recommendations.
```

---

## FILE: trador-ai/src/index.js (Main Entry Point)

```javascript
import config from './config.js';
import brain from './services/brain.js';
import helius from './services/helius.js';
import rateLimiter from './services/rateLimiter.js';
import gpuWorker from './services/gpuWorker.js';
import alpha from './services/alpha.js';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

let isRunning = false;
let isIdle = false;
let scanInterval = null;
let positionInterval = null;
let patternInterval = null;
let idleInterval = null;
let outcomeInterval = null;

// API Endpoints
app.get('/api/status', (req, res) => {
  const dataSource = helius.getDataSource();
  res.json({
    running: isRunning,
    idle: isIdle,
    gpu: gpuWorker.getStatus(),
    rateLimit: rateLimiter.getUsage(),
    dataSource: dataSource,
    isRealData: dataSource !== 'synthetic' && dataSource !== 'none',
    ...brain.getStatus()
  });
});

app.get('/api/recent', (req, res) => {
  res.json(brain.recentAnalyses || []);
});

// Main scan loop with rate limiting
async function scanLoop() {
  try {
    isIdle = false;
    await rateLimiter.throttle();
    
    console.log('Fetching tokens...');
    const tokens = await helius.getPumpFunTokens();
    
    if (!tokens?.length) {
      console.log('No tokens found from API');
      return;
    }

    const dataSource = helius.getDataSource();
    const isReal = dataSource !== 'synthetic' && dataSource !== 'none';
    console.log(`[${isReal ? 'REAL' : 'SYNTHETIC'}] Scanning ${tokens.length} tokens from ${dataSource}...`);
    
    // Update market regime detection
    const solPrice = await helius.getSolPrice();
    const regime = alpha.detectMarketRegime(tokens, solPrice, []);
    
    // Process tokens in parallel
    const results = await gpuWorker.processParallel(
      tokens.slice(0, 35),
      async (token) => {
        await rateLimiter.throttle();
        return brain.analyzeToken(token);
      }
    );

    // Execute trades on valid signals
    for (const result of results) {
      if (result?.shouldTrade && brain.state.canVirtualTrade) {
        const riskConfig = brain.getRiskConfig();
        const todayTrades = brain.state.virtualTrades.filter(
          t => t.entryTime > Date.now() - 86400000
        ).length;
        
        if (todayTrades < riskConfig.maxDailyTrades) {
          await brain.executeVirtualTrade(result.token, result.analysis);
        }
      }
    }
    
    await brain.flushDataBuffer();
  } catch (err) {
    console.error('Scan error:', err.message);
  }
}

async function startBot() {
  console.log('Starting TRADOR AI...');
  
  await gpuWorker.initialize();
  await brain.initialize();
  
  isRunning = true;
  
  // Scan every 15s for faster reaction
  scanInterval = setInterval(scanLoop, config.scanInterval);
  scanLoop();
  
  // Update positions every 5s
  positionInterval = setInterval(() => brain.updateVirtualPositions(), config.priceUpdateInterval);
  
  // Check tracked token outcomes every 30 seconds (multiple windows)
  outcomeInterval = setInterval(() => brain.checkTrackedOutcomes(), 30000);
  
  // Pattern analysis every 15min
  patternInterval = setInterval(() => brain.analyzePatterns(), 900000);
  
  console.log(`TRADOR AI started | GPU: ${gpuWorker.getStatus().mode} | Plan: ${config.heliusPlan}`);
}

app.listen(config.apiPort, () => console.log(`API on port ${config.apiPort}`));
startBot();
```

---

## FILE: trador-ai/src/config.js (Configuration)

```javascript
export default {
  // API Keys (from .env)
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  claudeApiKey: process.env.CLAUDE_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  perplexityApiKey: process.env.PERPLEXITY_API_KEY,
  birdeyeApiKey: process.env.BIRDEYE_API_KEY,
  heliusApiKey: process.env.HELIUS_API_KEY,
  
  // Confidence thresholds (lowered to break the learning loop)
  minConfidenceVirtual: 30,  // Was 60 - too high, nothing could trade
  minConfidenceLive: 70,
  
  // Risk Profiles
  riskProfiles: {
    low: { maxPositionSize: 0.02, stopLoss: 0.05, takeProfit: 0.10, maxDailyTrades: 5, minMarketCap: 50000, maxMarketCap: 5000000 },
    medium: { maxPositionSize: 0.05, stopLoss: 0.10, takeProfit: 0.25, maxDailyTrades: 15, minMarketCap: 10000, maxMarketCap: 2000000 },
    high: { maxPositionSize: 0.10, stopLoss: 0.20, takeProfit: 0.50, maxDailyTrades: 30, minMarketCap: 5000, maxMarketCap: 1000000 }
  },
  
  // Timing
  scanInterval: 15000,          // 15 seconds
  priceUpdateInterval: 5000,    // 5 seconds
  
  // Outcome tracking
  outcomeWindows: [3, 5, 10],   // Check at 3, 5, and 10 minutes
  pumpThreshold: 15,            // 15% = pump
  dumpThreshold: -15,           // -15% = dump
  
  // Learning requirements
  minDataPointsForTraining: 20,
  minDataPointsForVirtualTrading: 30,
};
```

---

## FILE: trador-ai/src/services/brain.js (Core Trading Logic - Key Parts)

```javascript
class TradingBrain {
  constructor() {
    this.state = {
      confidence: 50,
      dataPoints: 0,
      canVirtualTrade: true, // START ENABLED - learn by doing
      riskProfile: 'high',   // Start aggressive to learn faster
      stats: { tokensTracked: 0, pumps: 0, dumps: 0, neutral: 0 }
    };
    this.trackedTokens = new Map();
    this.recentAnalyses = [];
  }

  async analyzeToken(tokenData) {
    // Skip if already seen in 30-min window
    if (this.seenTokens.has(tokenData.mint)) return null;
    this.seenTokens.add(tokenData.mint);

    // Get deep analysis
    const deepAnalysis = await helius.getDeepTokenAnalysis(tokenData.mint);
    const advancedAnalysis = await analytics.analyzeToken(tokenData, deepAnalysis);
    const geminiAnalysis = await gemini.analyzeToken(tokenData, marketContext);
    
    // Multi-AI consensus
    const aiConsensus = await multiAI.getConsensus(tokenData, { walletRisk: null });
    
    // Security + Social checks
    const securityCheck = await externalTools.runSecurityCheck(tokenData.mint);
    const socialAnalysis = await socialIntel.analyzeSocialSignals(tokenData);
    
    // Combine all analyses
    const combinedAnalysis = {
      advancedScore: advancedAnalysis.score,
      advancedRecommendation: advancedAnalysis.recommendation,
      aiConsensus, aiSignal: aiConsensus?.consensus || 'HOLD',
      securityRisk: securityCheck?.riskScore || 50,
      socialScore: socialAnalysis?.socialScore || 50,
      // ... many more fields
    };
    
    // Track for outcome learning
    await this.trackToken(tokenData, combinedAnalysis);

    // Build signals for learner
    const tokenSignals = {
      marketCap: tokenData.usd_market_cap,
      liquidity: tokenData.virtual_sol_reserves,
      buyPressure: tokenData.buyPressure || 50,
      holders: tokenData.holders,
      priceChange1h: tokenData.priceChange1h || 0
    };
    
    // Use learner + analysis to decide
    const shouldTrade = this.shouldTradeAdvanced(combinedAnalysis, tokenSignals);
    
    return { token: tokenData, analysis: combinedAnalysis, shouldTrade };
  }

  shouldTradeAdvanced(analysis, tokenSignals = null) {
    // CRITICAL: Use learner's prediction if we have enough data
    if (tokenSignals && learner.performance.totalPredictions >= 20) {
      const learnerPredicts = learner.predictPump(tokenSignals);
      const learnerScore = learner.calculateWeightedScore(tokenSignals);
      
      if (learnerScore >= 70 && learnerPredicts) return true;
      if (learnerScore <= 30) return false;
    }
    
    // Fallback to analysis-based decision
    const score = analysis.advancedScore || 50;
    const rec = analysis.advancedRecommendation;
    
    if (rec === 'AVOID') return false;
    if (rec === 'STRONG_BUY') return true;
    if (rec === 'BUY' && score >= 55) return true;
    if (analysis.aiSignal === 'BUY' && analysis.aiAgreement >= 60) return true;
    
    return score >= 60;
  }

  async trackToken(tokenData, analysis) {
    // Get accurate entry price
    let price = tokenData.price;
    if (!price || price <= 0) {
      const priceData = await this.getTokenPrice(tokenData.mint);
      price = priceData?.price || 0;
    }
    if (price <= 0) return;
    
    this.trackedTokens.set(tokenData.mint, {
      mint: tokenData.mint,
      symbol: tokenData.symbol,
      entryPrice: price,
      entryTime: Date.now(),
      tokenData: { /* all metrics */ },
      analysis
    });
  }

  async checkTrackedOutcomes() {
    const windows = [3, 5, 10]; // minutes
    const pumpThreshold = 15;
    
    for (const [mint, tracked] of this.trackedTokens) {
      const ageMinutes = (Date.now() - tracked.entryTime) / 60000;
      
      for (const windowMin of windows) {
        if (ageMinutes < windowMin) continue;
        if (tracked[`checked_${windowMin}m`]) continue;
        
        const currentData = await this.getTokenPrice(mint);
        if (!currentData?.price) continue;
        
        const pnlPercent = ((currentData.price - tracked.entryPrice) / tracked.entryPrice) * 100;
        
        // Track max pump seen
        tracked.maxPump = Math.max(tracked.maxPump || 0, pnlPercent);
        tracked.maxDump = Math.min(tracked.maxDump || 0, pnlPercent);
        tracked[`checked_${windowMin}m`] = { pnl: pnlPercent };
        
        // Learn from significant moves
        if (pnlPercent >= pumpThreshold || pnlPercent <= -pumpThreshold) {
          const outcome = pnlPercent >= pumpThreshold ? 'pump' : 'dump';
          await this.recordOutcome(tracked, currentData.price, pnlPercent, outcome);
        }
      }
    }
  }

  async recordOutcome(tracked, exitPrice, pnlPercent, outcome) {
    // Update stats
    if (outcome === 'pump') this.state.stats.pumps++;
    else if (outcome === 'dump') this.state.stats.dumps++;
    else this.state.stats.neutral++;
    
    // Teach the learner
    const flatSignals = learner.flattenSignals(tracked);
    await learner.learnFromOutcome(flatSignals, outcome, pnlPercent);
  }

  async getTokenPrice(mint) {
    // Try Birdeye -> Jupiter -> DexScreener
    // Returns { price, source }
  }
}
```

---

## FILE: trador-ai/src/services/learner.js (Self-Learning System)

```javascript
class SelfLearner {
  constructor() {
    this.weights = {
      marketCap: 1.0, liquidity: 1.0, volume24h: 1.0, buyPressure: 1.0,
      holders: 1.0, priceChange1h: 1.0, priceChange24h: 1.0, volumeToMcap: 1.0,
      distributionScore: 1.0, whalePercent: 1.0, top10Percent: 1.0,
      isBuyHeavy: 1.0, hasWhaleInterest: 1.0, isLpBurned: 1.0
    };
    
    this.thresholds = {
      minMarketCap: 20000, maxMarketCap: 500000,
      minLiquidity: 5, minHolders: 20, minBuyPressure: 50, minScore: 60
    };
    
    this.performance = { totalPredictions: 0, correctPredictions: 0, accuracy: 0 };
    this.learningRate = 0.1;
  }

  predictPump(signals) {
    const score = this.calculateWeightedScore(signals);
    return score >= this.thresholds.minScore;
  }

  calculateWeightedScore(signals) {
    let score = 50;
    
    // Market cap in range?
    const mcap = signals.marketCap || 0;
    if (mcap >= this.thresholds.minMarketCap && mcap <= this.thresholds.maxMarketCap) {
      score += 10 * this.weights.marketCap;
    } else {
      score -= 10 * this.weights.marketCap;
    }
    
    // Buy pressure
    const bp = signals.buyPressure || 50;
    score += ((bp - 50) / 5) * this.weights.buyPressure;
    
    // Price momentum
    const pc1h = signals.priceChange1h || 0;
    if (pc1h > 5 && pc1h < 50) score += 5 * this.weights.priceChange1h;
    else if (pc1h > 100) score -= 5 * this.weights.priceChange1h;
    
    // Whale risk
    const whaleP = signals.whalePercent || 0;
    if (whaleP > 50) score -= 10 * this.weights.whalePercent;
    
    // ... more signal evaluations
    
    return Math.max(0, Math.min(100, score));
  }

  async learnFromOutcome(signals, outcome, pnlPercent) {
    this.performance.totalPredictions++;
    
    const wasPump = outcome === 'pump';
    const predictedPump = this.predictPump(signals);
    
    if ((wasPump && predictedPump) || (!wasPump && !predictedPump)) {
      this.performance.correctPredictions++;
    }
    
    this.performance.accuracy = (this.performance.correctPredictions / this.performance.totalPredictions) * 100;

    // Adjust weights based on what worked
    if (this.performance.totalPredictions >= 20) {
      await this.adjustWeights(signals, wasPump, pnlPercent);
    }
  }

  async adjustWeights(signals, wasPump, pnlPercent) {
    const signalMap = {
      marketCap: this.evaluateMarketCap(signals.marketCap),
      buyPressure: signals.buyPressure > 50 ? 1 : -1,
      whalePercent: signals.whalePercent < 30 ? 1 : -1,
      // ... more
    };

    for (const [signal, direction] of Object.entries(signalMap)) {
      const signalPredictedPump = direction > 0;
      const wasCorrect = signalPredictedPump === wasPump;
      
      const adjustment = wasCorrect 
        ? this.learningRate * Math.abs(pnlPercent) / 100
        : -this.learningRate * Math.abs(pnlPercent) / 100;
      
      this.weights[signal] = Math.max(0.1, Math.min(3.0, this.weights[signal] + adjustment));
    }
  }
}
```

---

## FILE: trador-ai/src/services/helius.js (Data Fetching - Key Parts)

```javascript
class HeliusService {
  // Combines multiple sources for token variety
  async getPumpFunTokens() {
    const allTokens = [];
    const seenMints = new Set();
    
    // SOURCE 1: Birdeye (established tokens with good data)
    const birdeyeTokens = await this.getBirdeyeTokens();
    for (const t of birdeyeTokens) {
      if (!seenMints.has(t.mint)) {
        seenMints.add(t.mint);
        allTokens.push({ ...t, source: 'birdeye' });
      }
    }
    
    // SOURCE 2: DexScreener (fresh pump.fun tokens)
    const dexTokens = await this.getDexScreenerPumpFunTokens();
    for (const t of dexTokens) {
      if (!seenMints.has(t.mint)) {
        seenMints.add(t.mint);
        allTokens.push({ ...t, source: 'dexscreener' });
      }
    }
    
    // SOURCE 3: Pump.fun API (newest tokens, often blocked)
    const pumpTokens = await this.getPumpFunCoins();
    // ... add unique ones
    
    // Shuffle to mix sources
    return shuffled(allTokens);
  }

  async getBirdeyeTokens() {
    // Fetches from multiple Birdeye endpoints:
    // - 24h volume (most active)
    // - 1h volume (recent activity)
    // - Market cap ascending (smaller tokens)
    // - Liquidity (tradeable tokens)
    // Returns tokens with: price, priceChange, volume, holders, buyPressure, etc.
  }

  async getDeepTokenAnalysis(mintAddress) {
    // Returns holder distribution, security info, etc.
    return {
      holders: { top1Percent, top10Percent, whaleCount, distributionScore },
      security: { isMintable, isFreezable, lpBurnedPercent }
    };
  }

  async getBirdeyeRecentTrades(mintAddress) {
    // Returns recent trade analysis
    return {
      buyCount, sellCount, buyRatio,
      avgBuySize, avgSellSize,
      whaleBuys, whaleSells,
      isBuyHeavy, hasWhaleInterest
    };
  }
}
```

---

## CURRENT STATS (from logs)

```
Data Points: ~200
Pumps detected: 0
Dumps detected: 0  
Neutral: ~170
AI Accuracy: 84.1% (but meaningless since no pumps/dumps recorded)
Learner predictions: ~170
```

---

## INFRASTRUCTURE

- Google Cloud VM (us-central1)
- PM2 process manager
- Birdeye Standard Plan ($100/mo, 500 req/min)
- Helius Free Tier
- 5 AI APIs: Gemini, OpenAI, Claude, Groq, Perplexity

---

## KEY QUESTIONS

1. Why are we seeing 0 pumps and 0 dumps despite tracking 170+ tokens?
2. Is the 15% threshold too high? Or is price tracking broken?
3. Should we use WebSocket streams instead of polling?
4. How do we find tokens BEFORE they pump?
5. Is the multi-AI consensus adding value or just latency?
6. What's the optimal learning feedback loop architecture?


---

## IMPLEMENTED FIXES (December 2024)

### 1. WebSocket Real-Time Token Detection (`pumpfunWS.js`)
- Connects to Helius WebSocket for real-time Pump.fun program logs
- Catches `Create` events the moment new tokens are minted
- Triggers immediate analysis instead of waiting for 15s polling
- Tracks recent tokens and trade events
- Auto-reconnect with exponential backoff

### 2. AI Race/Threshold Logic (`multiAI.js`)
- Fast AIs (Groq, Gemini) run first with 1.5s timeout
- If 2+ fast AIs agree with 80%+ confidence → execute immediately
- Slow AIs (Claude, OpenAI) only run if no early consensus
- Reduces latency from 3-5s to ~500ms for high-confidence signals

### 3. Bonding Curve Price Calculator (`bondingCurve.js`)
- Calculates exact prices from `x * y = k` formula
- Tracks graduation progress (80% = frenzy zone)
- Calculates price impact for buys/sells
- Generates trading signals based on curve state

### 4. Multi-Window Outcome Tracking (`brain.js`)
- Checks outcomes at 3, 5, and 10 minute windows
- Dynamic thresholds based on token age:
  - New (<10 min): 25% threshold
  - Young (10-30 min): 20% threshold
  - Established (>30 min): 15% threshold
- Tracks max pump/dump seen during tracking period
- Prevents duplicate outcome recording

### 5. Enhanced Learner Signals (`learner.js`)
- Added `bondingCurveProgress` weight (75-85% = graduation frenzy)
- Added `tokenAge` weight (newer = higher potential)
- Signals now include bonding curve state

### Key Files Modified:
- `trador-ai/src/index.js` - WebSocket integration
- `trador-ai/src/services/multiAI.js` - Race/threshold logic
- `trador-ai/src/services/learner.js` - New signals
- `trador-ai/src/services/helius.js` - Bonding curve data

### New Files:
- `trador-ai/src/services/pumpfunWS.js` - WebSocket service
- `trador-ai/src/services/bondingCurve.js` - Price calculator

### New API Endpoints:
- `GET /api/websocket` - WebSocket connection stats and recent tokens
