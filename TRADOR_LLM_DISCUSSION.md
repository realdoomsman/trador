# TRADOR AI - Updated Code Dump (December 2024)

## PROMPT FOR OTHER LLMs

Copy this entire document and paste it to another LLM with this prompt:

---

**PROMPT:**

I'm building TRADOR, an AI-powered Solana memecoin trading system. I've made significant improvements based on previous analysis. Please review the updated architecture and suggest further optimizations.

**Recent Changes Made:**
1. Lowered pump/dump thresholds from 15% to 8% (most good pumps are 8-12%)
2. Added 1-minute outcome window for faster learning (now 1, 3, 5, 10 min)
3. Added micro-learning from active positions (learn from 4%+ moves while tracking)
4. Added fast entry filter for early pump.fun tokens (skip AI for <2min tokens)
5. Sped up AI consensus (only call slow AIs when fast ones disagree)
6. Changed learning target from direction to volatility prediction

**Current Architecture:**
- Multi-window outcome tracking (1, 3, 5, 10 minutes)
- Volatility-based learning (not direction-based)
- Fast entry path for early pump.fun tokens (no AI latency)
- Multi-AI consensus with early exit optimization
- Bonding curve velocity tracking
- Micro-learning from active positions

**Questions:**
1. Are the new 8% thresholds appropriate for memecoins?
2. Should we add more outcome windows (30s, 2min)?
3. What other signals should we track for early pump.fun detection?
4. How can we improve the volatility prediction model?
5. Should we implement a proper ML model instead of weighted scoring?

---

## SYSTEM OVERVIEW

**Tech Stack:**
- Node.js backend on Google Cloud VM
- Express API server (port 3003)
- React dashboard (Vite)
- PM2 process manager
- File-based storage (JSON)

**Data Sources:**
- Birdeye API ($100/mo) - token lists, prices, security
- DexScreener API (free) - pump.fun discovery
- Helius RPC (free tier) - on-chain data
- Jupiter API (free) - price feeds

**AI Models:**
- Google Gemini 1.5 Flash (fast)
- Groq Llama 3.1 70B (fast)
- OpenAI GPT-4 Turbo (slow)
- Anthropic Claude 3 Haiku (slow)
- Perplexity (web search)

---

## RECENT CHANGES SUMMARY

### 1. Lowered Thresholds (8% instead of 15%)
```
OLD: pumpThreshold: 15%, dumpThreshold: -15%
NEW: pumpThreshold: 8%, dumpThreshold: -8%

Volatility Buckets:
- strong_pump: ≥12% (was ≥15%)
- weak_pump: ≥8% (was ≥7%)
- micro_move: ≥4% (NEW)
- chop: <4% (was <7%)
- weak_dump: ≤-8% (was ≤-7%)
- strong_dump: ≤-12% (was ≤-15%)
```

### 2. Added 1-Minute Window
```
OLD: outcomeWindows: [3, 5, 10]
NEW: outcomeWindows: [1, 3, 5, 10]

Each token now generates 4+ learning samples instead of 3
```

### 3. Micro-Learning from Active Positions
```javascript
// After 30 seconds, if token moves 4%+, learn immediately
if (!tracked.microLearned && ageMinutes >= 0.5) {
  const volatility = Math.max(Math.abs(tracked.maxUp), Math.abs(tracked.maxDown));
  if (volatility >= 4) {
    tracked.microLearned = true;
    await learner.learnFromVolatility(signals, maxUp, maxDown, pnl, ageMinutes);
  }
}
```

### 4. Fast Entry Filter (No AI for Early Tokens)
```javascript
// Skip AI consensus for tokens < 2 minutes old
passesFastEntryFilter(tokenData, deepAnalysis) {
  // Criteria:
  // - tokenAge < 2 minutes
  // - bondingCurveProgress 60-85%
  // - velocity > 0 (buyers increasing)
  // - topHolderPercent < 15%
  // - marketCap > $5k
}
```

### 5. Faster AI Consensus
```javascript
// Fast AIs: Groq (~200ms), Gemini (~500ms) - 1s timeout
// Slow AIs: Claude, OpenAI (~1-2s) - 2s timeout
// Skip slow AIs if:
// - 2+ fast AIs agree with 80%+ confidence
// - 1 fast AI has 90%+ confidence
// - Fast AIs agree and have 60%+ confidence
```

---

## CORE FILES (UPDATED)

### 1. config.js - Configuration

```javascript
export default {
  // API Keys
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  claudeApiKey: process.env.CLAUDE_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  birdeyeApiKey: process.env.BIRDEYE_API_KEY,
  heliusApiKey: process.env.HELIUS_API_KEY,
  
  // Confidence thresholds
  minConfidenceVirtual: 30,
  minConfidenceLive: 70,
  
  // Risk Profile (high)
  riskProfiles: {
    high: {
      maxPositionSize: 0.10,
      stopLoss: 0.20,
      takeProfit: 0.50,
      maxDailyTrades: 30,
      minMarketCap: 5000,
      maxMarketCap: 1000000,
    }
  },
  
  // Timing
  scanInterval: 15000,          // 15s main scan
  fastPollInterval: 3000,       // 3s fast poll for new tokens
  priceUpdateInterval: 5000,    // 5s price tracking
  outcomeCheckInterval: 30000,  // 30s outcome checks
  
  // UPDATED: Outcome detection
  outcomeWindows: [1, 3, 5, 10],  // Added 1-minute window
  pumpThreshold: 8,               // Lowered from 10%
  microPumpThreshold: 4,          // 4-8% = micro-pump
  dumpThreshold: -8,              // Lowered from -10%
  mfePumpThreshold: 8,            // Lowered from 15%
  maeDumpThreshold: -8,           // Lowered from -10%
  
  // Token tracking
  maxTrackedTokens: 800,
  maxTrackTimeMinutes: 10,
  tokensPerScan: 100,
  
  // Learning
  minDataPointsForVirtualTrading: 30,
  learnerMinSamples: 10,
};
```

### 2. learner.js - Self-Learning System (REWRITTEN)

```javascript
class SelfLearner {
  constructor() {
    this.weights = {
      // Signal weights - adjusted based on outcomes
      marketCap: 1.0,
      liquidity: 1.0,
      buyPressure: 1.0,
      holders: 1.0,
      priceChange1h: 1.0,
      volumeToMcap: 1.0,
      // Bonding curve signals
      bondingCurveProgress: 1.0,
      bondingCurveVelocity: 1.0,
      tokenAge: 1.0,
      // Early pump.fun signals
      buyersPerMinute: 1.0,
      newBuyers: 1.0,
      avgBuySize: 1.0,
      topHolderPercent: 1.0
    };
    
    // Soft penalties instead of hard filters
    this.softPenalties = {
      marketCapTooLow: { threshold: 5000, penalty: 0.8 },
      marketCapTooHigh: { threshold: 2000000, penalty: 0.9 },
      liquidityTooLow: { threshold: 2, penalty: 0.7 },
      holdersTooFew: { threshold: 10, penalty: 0.8 },
      topHolderTooHigh: { threshold: 15, penalty: 0.85 }
    };
    
    this.performance = {
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      volatilityPredictions: 0,
      volatilityAccuracy: 0,
      avgPredictedVolatility: 0,
      avgActualVolatility: 0
    };
    
    this.baseLearningRate = 0.15;
    this.minSamples = 5;
  }

  // Dynamic learning rate
  getLearningRate() {
    const samples = this.performance.totalPredictions;
    if (samples < 20) return this.baseLearningRate * 1.5;
    if (samples < 50) return this.baseLearningRate;
    if (samples < 100) return this.baseLearningRate * 0.8;
    return this.baseLearningRate * 0.5;
  }

  // NEW: Learn from volatility (not direction)
  async learnFromVolatility(signals, maxUp, maxDown, finalPnl, windowMinutes) {
    const volatilityScore = Math.max(Math.abs(maxUp), Math.abs(maxDown));
    const volatilityBucket = this.getVolatilityBucket(volatilityScore);
    
    const predictedVolatility = this.predictVolatility(signals);
    const predictedBucket = this.getVolatilityBucket(predictedVolatility);
    
    // Track accuracy
    if (predictedBucket === volatilityBucket) {
      this.performance.correctPredictions++;
    }
    
    // Adjust weights based on prediction error
    if (this.performance.volatilityPredictions >= this.minSamples) {
      await this.adjustWeightsForVolatility(signals, volatilityScore, predictedVolatility);
    }
    
    this.performance.totalPredictions++;
    this.performance.volatilityPredictions++;
  }

  // UPDATED: Volatility buckets with lower thresholds
  getVolatilityBucket(volatilityScore) {
    if (volatilityScore < 4) return 'dead';
    if (volatilityScore < 8) return 'tradeable';
    if (volatilityScore < 15) return 'high_alpha';
    return 'extreme';
  }

  // Predict volatility magnitude (not direction)
  predictVolatility(signals) {
    let score = 0;
    
    // Early tokens = more volatile
    const age = signals.tokenAge || 60;
    if (age < 2) score += 15 * this.weights.tokenAge;
    else if (age < 5) score += 10 * this.weights.tokenAge;
    
    // Bonding curve graduation zone = volatile
    const bcProgress = signals.bondingCurveProgress || 0;
    if (bcProgress >= 60 && bcProgress < 85) {
      score += 12 * this.weights.bondingCurveProgress;
    }
    
    // Bonding curve velocity
    const bcVelocity = signals.bondingCurveVelocity || 0;
    if (bcVelocity > 2) score += 10 * this.weights.bondingCurveVelocity;
    
    // Buy pressure extremes
    const bp = signals.buyPressure || 50;
    if (bp > 70 || bp < 30) score += 8 * this.weights.buyPressure;
    
    // Volume to mcap ratio
    const vtm = signals.volumeToMcap || 0;
    if (vtm > 0.5) score += 10 * this.weights.volumeToMcap;
    
    // Buyers per minute
    const bpm = signals.buyersPerMinute || 0;
    if (bpm > 10) score += 12 * this.weights.buyersPerMinute;
    
    // Apply soft penalties
    score = this.applySoftPenalties(signals, score);
    
    return Math.max(0, Math.min(30, score));
  }

  // Soft penalties instead of hard filters
  applySoftPenalties(signals, score) {
    const mcap = signals.marketCap || 0;
    if (mcap < 5000) score *= 0.8;
    if (mcap > 2000000) score *= 0.9;
    
    const holders = signals.holders || 0;
    if (holders < 10) score *= 0.8;
    
    const topHolder = signals.topHolderPercent || 0;
    if (topHolder > 15) score *= 0.85;
    
    return score;
  }
}
```

### 3. brain.js - Core Trading Brain (KEY FUNCTIONS)

```javascript
class TradingBrain {
  constructor() {
    this.state = {
      confidence: 50,
      dataPoints: 0,
      canVirtualTrade: true,
      riskProfile: 'high',
      stats: {
        tokensTracked: 0,
        pumps: 0,
        dumps: 0,
        neutral: 0,
        strong_pumps: 0,
        weak_pumps: 0,
        micro_moves: 0,
        chops: 0,
        weak_dumps: 0,
        strong_dumps: 0
      }
    };
    
    this.trackedTokens = new Map();
    this.maxTrackedTokens = 800;
    this.outcomeWindows = [1, 3, 5, 10]; // Added 1-minute
  }

  // ANALYZE TOKEN - With fast entry path
  async analyzeToken(tokenData) {
    // FAST ENTRY CHECK - For early pump.fun tokens
    const isPumpFun = tokenData.isPumpFun || tokenData.source === 'pumpfun';
    const fastEntryResult = isPumpFun ? this.passesFastEntryFilter(tokenData) : { pass: false };
    
    if (fastEntryResult.pass) {
      // FAST PATH - No AI, trade immediately
      console.log(`[FAST-ENTRY] ${tokenData.symbol} | BC: ${fastEntryResult.signals.bondingCurveProgress}%`);
      return { token: tokenData, analysis: { fastEntryApproved: true }, shouldTrade: true };
    }

    // STANDARD PATH - Full analysis with AI
    const advancedAnalysis = await analytics.analyzeToken(tokenData);
    const aiConsensus = await multiAI.getConsensus(tokenData, context);
    
    // Track for outcome learning
    await this.trackToken(tokenData, combinedAnalysis);
    
    return { token: tokenData, analysis: combinedAnalysis, shouldTrade };
  }

  // FAST ENTRY FILTER - No AI latency for early tokens
  passesFastEntryFilter(tokenData, deepAnalysis = null) {
    const ageMinutes = tokenData.ageMinutes || 60;
    
    // Only for very early tokens (< 2 minutes)
    if (ageMinutes >= 2) return { pass: false, reason: 'too_old' };
    
    // Must be in graduation zone (60-85%)
    const bcProgress = bondingCurve.calculateProgress(tokenData.virtual_sol_reserves);
    if (bcProgress < 60 || bcProgress > 85) return { pass: false, reason: 'bc_progress' };
    
    // Must have positive velocity
    const velocity = bondingCurve.getVelocityAnalysis(tokenData.mint, tokenData.virtual_sol_reserves);
    if (velocity.velocity <= 0) return { pass: false, reason: 'no_momentum' };
    
    // No whale concentration (>15%)
    const topHolder = deepAnalysis?.holders?.top1Percent || 0;
    if (topHolder > 15) return { pass: false, reason: 'whale_concentration' };
    
    // Market cap minimum
    if (tokenData.usd_market_cap < 5000) return { pass: false, reason: 'mcap_too_low' };
    
    return { 
      pass: true, 
      signals: {
        tokenAge: ageMinutes,
        bondingCurveProgress: bcProgress,
        bondingCurveVelocity: velocity.velocity,
        buyersPerMinute: this.calculateBuyersPerMinute(tokenData)
      }
    };
  }

  // TRACK TOKEN - With per-window learning flags
  async trackToken(tokenData, analysis) {
    this.trackedTokens.set(tokenData.mint, {
      mint: tokenData.mint,
      symbol: tokenData.symbol,
      entryPrice: tokenData.price,
      entryTime: Date.now(),
      // Track maxUp/maxDown during lifetime
      maxUp: 0,
      maxDown: 0,
      // Per-window learning flags
      learned_1min: false,
      learned_3min: false,
      learned_5min: false,
      learned_10min: false,
      // Token data for learning
      tokenData: {
        marketCap: tokenData.usd_market_cap,
        liquidity: tokenData.virtual_sol_reserves,
        buyPressure: tokenData.buyPressure,
        holders: tokenData.holder_count,
        bondingCurveProgress: tokenData.bondingCurveProgress,
        bondingCurveVelocity: tokenData.bondingCurveVelocity,
        buyersPerMinute: tokenData.buyersPerMinute,
        tokenAge: tokenData.ageMinutes
      }
    });
  }

  // UPDATE PRICES - With micro-learning
  async updateTrackedPrices() {
    for (const tracked of this.trackedTokens.values()) {
      const priceData = await this.getTokenPrice(tracked.mint);
      const pnlPercent = ((priceData.price - tracked.entryPrice) / tracked.entryPrice) * 100;
      
      // Update maxUp/maxDown
      if (pnlPercent > tracked.maxUp) tracked.maxUp = pnlPercent;
      if (pnlPercent < tracked.maxDown) tracked.maxDown = pnlPercent;
      
      // MICRO-LEARNING: Learn from 4%+ moves while still tracking
      const ageMinutes = (Date.now() - tracked.entryTime) / 60000;
      if (!tracked.microLearned && ageMinutes >= 0.5) {
        const volatility = Math.max(Math.abs(tracked.maxUp), Math.abs(tracked.maxDown));
        if (volatility >= 4) {
          tracked.microLearned = true;
          const outcome = this.classifyVolatility(tracked.maxUp, tracked.maxDown);
          console.log(`[MICRO-LEARN] ${tracked.symbol}: ${outcome.bucket}`);
          await learner.learnFromVolatility(tracked.tokenData, tracked.maxUp, tracked.maxDown, pnlPercent, ageMinutes);
        }
      }
    }
  }

  // CHECK OUTCOMES - Multi-window learning
  async checkTrackedOutcomes() {
    for (const [mint, tracked] of this.trackedTokens) {
      const ageMinutes = (Date.now() - tracked.entryTime) / 60000;
      
      // Learn at each window (1, 3, 5, 10 minutes)
      for (const windowMinutes of this.outcomeWindows) {
        if (ageMinutes >= windowMinutes && !tracked[`learned_${windowMinutes}min`]) {
          tracked[`learned_${windowMinutes}min`] = true;
          
          const outcome = this.classifyVolatility(tracked.maxUp, tracked.maxDown);
          console.log(`[LEARN-${windowMinutes}min] ${tracked.symbol}: ${outcome.bucket}`);
          
          await learner.learnFromVolatility(
            tracked.tokenData,
            tracked.maxUp,
            tracked.maxDown,
            tracked.currentPnl,
            windowMinutes
          );
        }
      }
    }
  }

  // CLASSIFY VOLATILITY - Lowered thresholds
  classifyVolatility(maxUp, maxDown) {
    const volatilityScore = Math.max(Math.abs(maxUp), Math.abs(maxDown));
    const direction = maxUp > Math.abs(maxDown) ? 'up' : 'down';
    
    let bucket;
    if (maxUp >= 12) bucket = 'strong_pump';
    else if (maxUp >= 8) bucket = 'weak_pump';
    else if (maxDown <= -12) bucket = 'strong_dump';
    else if (maxDown <= -8) bucket = 'weak_dump';
    else if (maxUp >= 4 || maxDown <= -4) bucket = 'micro_move';
    else bucket = 'chop';
    
    return { bucket, direction, volatilityScore };
  }
}
```

### 4. multiAI.js - Optimized AI Consensus

```javascript
class MultiAIEngine {
  // GET CONSENSUS - Optimized with early exit
  async getConsensus(tokenData, context) {
    const analyses = [];
    const startTime = Date.now();
    
    // FAST AIs (Groq ~200ms, Gemini ~500ms)
    const fastAIs = [
      () => this.analyzeWithGroq(tokenData, context),
      () => this.analyzeWithGemini(tokenData, context)
    ];
    
    // SLOW AIs (Claude ~1-2s, OpenAI ~1-2s)
    const slowAIs = [
      () => this.analyzeWithClaude(tokenData, context),
      () => this.analyzeWithOpenAI(tokenData, context)
    ];
    
    // PHASE 1: Race fast AIs with 1s timeout
    const fastPromises = fastAIs.map(fn => 
      Promise.race([fn(), new Promise(r => setTimeout(() => r(null), 1000))])
    );
    const fastResults = await Promise.allSettled(fastPromises);
    for (const r of fastResults) {
      if (r.status === 'fulfilled' && r.value) analyses.push(r.value);
    }
    
    // EARLY EXIT: If 2+ fast AIs agree with 80%+ confidence
    if (analyses.length >= 2) {
      const earlyConsensus = this.checkEarlyConsensus(analyses);
      if (earlyConsensus) {
        console.log(`[AI-RACE] Early consensus: ${earlyConsensus.consensus} (${Date.now() - startTime}ms)`);
        return this.buildConsensusResult(analyses, true);
      }
    }
    
    // EARLY EXIT: If 1 fast AI has 90%+ confidence
    if (analyses.find(a => a.confidence >= 90)) {
      return this.buildConsensusResult(analyses, true);
    }
    
    // PHASE 2: Only run slow AIs if needed
    const needSlowAIs = analyses.length < 2 || 
      analyses.some(a => a.confidence < 60) ||
      (analyses[0]?.signal !== analyses[1]?.signal);
    
    if (needSlowAIs) {
      const slowPromises = slowAIs.map(fn =>
        Promise.race([fn(), new Promise(r => setTimeout(() => r(null), 2000))])
      );
      const slowResults = await Promise.allSettled(slowPromises);
      for (const r of slowResults) {
        if (r.status === 'fulfilled' && r.value) analyses.push(r.value);
      }
    }
    
    console.log(`[AI-RACE] ${needSlowAIs ? 'Full' : 'Fast-only'} consensus (${Date.now() - startTime}ms)`);
    return this.buildConsensusResult(analyses, !needSlowAIs);
  }

  checkEarlyConsensus(analyses) {
    const buyVotes = analyses.filter(a => a.signal === 'BUY');
    const sellVotes = analyses.filter(a => a.signal === 'SELL');
    
    // Both say BUY with 80%+ confidence
    if (buyVotes.length >= 2) {
      const avgConf = buyVotes.reduce((s, a) => s + a.confidence, 0) / buyVotes.length;
      if (avgConf >= 80) return { consensus: 'BUY', confidence: avgConf };
    }
    
    // Both say SELL with 80%+ confidence
    if (sellVotes.length >= 2) {
      const avgConf = sellVotes.reduce((s, a) => s + a.confidence, 0) / sellVotes.length;
      if (avgConf >= 80) return { consensus: 'SELL', confidence: avgConf };
    }
    
    return null;
  }
}
```

### 5. bondingCurve.js - Velocity Tracking

```javascript
class BondingCurveCalculator {
  constructor() {
    this.GRADUATION_SOL = 85;
    this.progressHistory = new Map();
    this.velocityWindow = 60000; // 60 seconds
  }

  calculateProgress(virtualSolReserves) {
    const solReserves = virtualSolReserves / 1e9;
    return Math.min(100, (solReserves / this.GRADUATION_SOL) * 100);
  }

  recordProgress(mint, virtualSolReserves) {
    const progress = this.calculateProgress(virtualSolReserves);
    if (!this.progressHistory.has(mint)) {
      this.progressHistory.set(mint, []);
    }
    this.progressHistory.get(mint).push({ progress, timestamp: Date.now() });
    return progress;
  }

  calculateVelocity(mint) {
    const history = this.progressHistory.get(mint);
    if (!history || history.length < 2) return 0;
    
    const recentPoints = history.filter(p => p.timestamp >= Date.now() - this.velocityWindow);
    if (recentPoints.length < 2) return 0;
    
    const oldest = recentPoints[0];
    const newest = recentPoints[recentPoints.length - 1];
    const timeDiffMinutes = (newest.timestamp - oldest.timestamp) / 60000;
    
    return timeDiffMinutes > 0 ? (newest.progress - oldest.progress) / timeDiffMinutes : 0;
  }

  getVelocityAnalysis(mint, virtualSolReserves) {
    const progress = this.recordProgress(mint, virtualSolReserves);
    const velocity = this.calculateVelocity(mint);
    
    return {
      progress,
      velocity,
      velocityClass: velocity > 5 ? 'accelerating_fast' : velocity > 2 ? 'accelerating' : 'stable',
      isGraduationFrenzy: progress >= 60 && progress < 85 && velocity > 1,
      isGoodEntry: (progress >= 60 && progress < 85 && velocity > 0.5)
    };
  }
}
```

---

## EXPECTED LOG OUTPUT

After deploying, you should see:

```
[FAST-ENTRY] PEPE PASSED | Age: 0.8min | BC: 72% | Velocity: 3.2%/min
[FAST-ENTRY] PEPE - Trading without AI consensus
[TRACK] PEPE at 0.00000123 (mcap: 45k)

[MICRO-LEARN] DOGE: weak_pump at 0.6min | maxUp=5.2% maxDown=-1.1%

[LEARN-1min] SHIB: maxUp=3.2% maxDown=-0.8% => micro_move (up)
[LEARN-3min] SHIB: maxUp=8.5% maxDown=-2.1% => weak_pump (up)
[LEARN-5min] SHIB: maxUp=12.3% maxDown=-3.2% => strong_pump (up)

[AI-RACE] Early consensus: BUY (450ms)
[AI-RACE] Fast-only consensus: 2 AIs (520ms)

[FINAL] BONK: strong_pump | maxUp=15.2% maxDown=-4.1% | AI accuracy: 58.3%
```

---

## QUESTIONS FOR ANALYSIS

1. **Threshold Tuning**: Are 8%/12% thresholds optimal for memecoins? Should we use different thresholds for different market caps?

2. **Window Optimization**: Should we add 30-second and 2-minute windows? What's the tradeoff between more data points and noise?

3. **Early Signals**: What other signals predict early pump.fun success?
   - Transaction velocity (txns/min)?
   - Unique wallet growth rate?
   - Average buy size trends?
   - Social mentions correlation?

4. **Volatility Prediction**: How can we improve the weighted scoring model?
   - Add non-linear relationships?
   - Use gradient boosting instead?
   - Add time-of-day features?

5. **Fast Entry Criteria**: Should we adjust the fast entry filter?
   - Lower age threshold to 1 minute?
   - Widen bonding curve range (50-90%)?
   - Add minimum velocity requirement?

6. **Learning Rate**: Is the dynamic learning rate (1.5x early, 0.5x late) optimal?

7. **ML Upgrade**: Should we replace weighted scoring with:
   - XGBoost/LightGBM?
   - Neural network?
   - Reinforcement learning?

---

## DEPLOYMENT

```bash
# SSH to VM
ssh 34.123.211.253

# Pull and restart
cd trador && git pull && pm2 restart trador-ai

# Monitor logs
pm2 logs trador-ai --lines 100
```

---

*End of code dump. Please analyze and provide recommendations.*
