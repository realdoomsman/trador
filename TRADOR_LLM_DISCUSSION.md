# TRADOR AI - Code Dump for LLM Discussion

## PROMPT TO INITIATE DISCUSSION

Copy this entire document and paste it to another LLM with this prompt:

---

**PROMPT:**

I'm building TRADOR, an AI-powered Solana memecoin trading system. I need your help analyzing the architecture and suggesting improvements. The system:

1. **Scans tokens** from Birdeye, DexScreener, and Pump.fun APIs
2. **Analyzes tokens** using multiple AI models (Gemini, GPT-4, Claude, Groq) for consensus
3. **Tracks outcomes** - records entry price, waits 10 minutes, checks if token pumped (>10%) or dumped (<-10%)
4. **Self-learns** - adjusts signal weights based on what actually predicts pumps vs dumps
5. **Virtual trades** - paper trades to validate strategy before real money

**Current Issues:**
- Most outcomes are "neutral" (not enough pumps/dumps detected)
- Learning is slow - need more data points faster
- Not catching the best pump.fun tokens early enough
- Multi-AI consensus sometimes too slow

**Questions for you:**
1. What architectural improvements would you suggest?
2. How can we detect pumps/dumps more reliably?
3. What signals are we missing that could predict pumps?
4. How can we speed up the learning loop?
5. Any ML/statistical techniques we should add?

Please analyze the code below and provide specific, actionable recommendations.

---

## SYSTEM OVERVIEW

**Tech Stack:**
- Node.js backend running on Google Cloud VM
- Express API server (port 3003)
- React dashboard (Vite)
- PM2 process manager
- File-based storage (JSON)

**Data Sources:**
- Birdeye API ($100/mo plan) - token lists, prices, security data
- DexScreener API (free) - pump.fun token discovery
- Helius RPC (free tier) - on-chain data, holder analysis
- Jupiter API (free) - price feeds

**AI Models:**
- Google Gemini 1.5 Flash
- OpenAI GPT-4 Turbo
- Anthropic Claude 3 Haiku
- Groq Llama 3.1 70B
- Perplexity (web search)

---

## CORE FILES

### 1. config.js - Configuration

```javascript
// Key configuration values
export default {
  // Birdeye API (best for Pump.fun tokens)
  birdeyeApiKey: process.env.BIRDEYE_API_KEY,
  
  // Helius RPC
  heliusApiKey: process.env.HELIUS_API_KEY,
  heliusRpcUrl: `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
  
  // Multi-AI Keys
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  claudeApiKey: process.env.CLAUDE_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  perplexityApiKey: process.env.PERPLEXITY_API_KEY,
  
  // Confidence thresholds
  minConfidenceVirtual: 30,  // Min confidence to virtual trade
  minConfidenceLive: 70,     // Min confidence for live trading
  
  // Risk Profiles
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
  scanInterval: 15000,          // 15 seconds between scans
  priceUpdateInterval: 5000,    // 5 seconds for position updates
  
  // Outcome detection
  outcomeWindows: [3, 5, 10],   // Check at 3, 5, and 10 minutes
  pumpThreshold: 15,            // 15% = pump (lowered from 20%)
  dumpThreshold: -15,           // -15% = dump
  
  // Learning requirements
  minDataPointsForVirtualTrading: 30,
};
```

### 2. index.js - Main Entry Point

```javascript
// Main scan loop
async function scanLoop() {
  try {
    console.log('Fetching tokens...');
    const tokens = await helius.getPumpFunTokens();
    
    if (!tokens?.length) return;

    const dataSource = helius.getDataSource();
    console.log(`Scanning ${tokens.length} tokens from ${dataSource}...`);
    
    // Update market regime detection
    const solPrice = await helius.getSolPrice();
    const regime = alpha.detectMarketRegime(tokens, solPrice, []);
    
    // Process tokens in parallel
    const results = await gpuWorker.processParallel(
      tokens.slice(0, 35),
      async (token) => brain.analyzeToken(token)
    );

    // Execute trades on valid signals
    for (const result of results) {
      if (result?.shouldTrade && brain.state.canVirtualTrade) {
        await brain.executeVirtualTrade(result.token, result.analysis);
      }
    }
  } catch (err) {
    console.error('Scan error:', err.message);
  }
}

// Intervals
scanInterval = setInterval(scanLoop, 15000);           // Scan every 15s
positionInterval = setInterval(() => brain.updateVirtualPositions(), 5000);
outcomeInterval = setInterval(() => brain.checkTrackedOutcomes(), 30000);
patternInterval = setInterval(() => brain.analyzePatterns(), 900000);
```

### 3. brain.js - Core Trading Brain (Key Functions)

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
        neutral: 0
      }
    };
    
    // Price tracking for learning outcomes
    this.trackedTokens = new Map();
    this.maxTrackedTokens = 200;
    
    // Recent analyses for dashboard
    this.recentAnalyses = [];
  }

  // ANALYZE TOKEN - Main analysis function
  async analyzeToken(tokenData) {
    // Skip if already seen in 30-min window
    if (this.seenTokens.has(tokenData.mint)) return null;
    this.seenTokens.add(tokenData.mint);

    // Basic filters
    const marketCap = tokenData.usd_market_cap || 0;
    if (marketCap < 5000 || marketCap > 1000000) return null;

    // Get deep analysis
    const deepAnalysis = await helius.getDeepTokenAnalysis(tokenData.mint);
    
    // Advanced analytics scoring
    const advancedAnalysis = await analytics.analyzeToken(tokenData, deepAnalysis);
    
    // Multi-AI consensus
    const aiConsensus = await multiAI.getConsensus(tokenData, {
      walletRisk: null,
      hasDevRisk: false
    });
    
    // Security check
    const securityCheck = await externalTools.runSecurityCheck(tokenData.mint);
    
    // Combine all analyses
    const combinedAnalysis = {
      advancedScore: advancedAnalysis.score,
      advancedRecommendation: advancedAnalysis.recommendation,
      aiConsensus: aiConsensus,
      aiAgreement: aiConsensus?.agreement || 0,
      aiSignal: aiConsensus?.consensus || 'HOLD',
      securityRisk: securityCheck?.riskScore || 50,
      flags: advancedAnalysis.flags
    };
    
    // Track token for outcome learning
    await this.trackToken(tokenData, combinedAnalysis);
    
    // Determine if we should trade
    const shouldTrade = this.shouldTradeAdvanced(combinedAnalysis);
    
    return { token: tokenData, analysis: combinedAnalysis, shouldTrade };
  }

  // TRACK TOKEN - Record entry for outcome learning
  async trackToken(tokenData, analysis) {
    // Get accurate entry price
    let price = tokenData.price;
    if (!price || price <= 0) {
      const priceData = await this.getTokenPrice(tokenData.mint);
      price = priceData?.price || 0;
    }
    
    if (price <= 0) return;
    
    console.log(`[TRACK] ${tokenData.symbol} at $${price.toFixed(8)}`);

    this.trackedTokens.set(tokenData.mint, {
      mint: tokenData.mint,
      symbol: tokenData.symbol,
      entryPrice: price,
      entryMarketCap: tokenData.usd_market_cap,
      entryTime: Date.now(),
      analysis: analysis,
      tokenData: {
        marketCap: tokenData.usd_market_cap,
        liquidity: tokenData.virtual_sol_reserves,
        buyPressure: tokenData.buyPressure || 50,
        holders: tokenData.holder_count,
        priceChange1h: tokenData.priceChange1h || 0,
        volume24h: tokenData.volume24h || 0
      }
    });
  }

  // CHECK OUTCOMES - Learn from price changes
  async checkTrackedOutcomes() {
    const now = Date.now();
    const trackDuration = 10 * 60 * 1000; // 10 minutes
    
    for (const [mint, tracked] of this.trackedTokens) {
      if (now - tracked.entryTime < trackDuration) continue;
      
      // Get current price
      const currentData = await this.getTokenPrice(mint);
      if (!currentData?.price || !tracked.entryPrice) continue;

      const pnlPercent = ((currentData.price - tracked.entryPrice) / tracked.entryPrice) * 100;
      
      console.log(`[OUTCOME] ${tracked.symbol}: ${pnlPercent.toFixed(1)}%`);
      
      // Classify outcome (±10% threshold)
      let outcome;
      if (pnlPercent >= 10) {
        outcome = 'pump';
        this.state.stats.pumps++;
      } else if (pnlPercent <= -10) {
        outcome = 'dump';
        this.state.stats.dumps++;
      } else {
        outcome = 'neutral';
        this.state.stats.neutral++;
      }

      // LEARN FROM OUTCOME
      const flatSignals = learner.flattenSignals(tracked.tokenData);
      await learner.learnFromOutcome(flatSignals, outcome, pnlPercent);
      
      this.trackedTokens.delete(mint);
    }
  }

  // GET TOKEN PRICE - Multi-source fallback
  async getTokenPrice(mint) {
    // Try Birdeye
    try {
      const res = await fetch(`https://public-api.birdeye.so/defi/price?address=${mint}`, {
        headers: { 'X-API-KEY': config.birdeyeApiKey, 'x-chain': 'solana' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data?.value > 0) return { price: data.data.value, source: 'birdeye' };
      }
    } catch (err) {}
    
    // Try Jupiter
    try {
      const res = await fetch(`https://price.jup.ag/v6/price?ids=${mint}`);
      if (res.ok) {
        const data = await res.json();
        if (data.data?.[mint]?.price > 0) return { price: data.data[mint].price, source: 'jupiter' };
      }
    } catch (err) {}
    
    // Try DexScreener
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      if (res.ok) {
        const data = await res.json();
        if (data.pairs?.[0]?.priceUsd) return { price: parseFloat(data.pairs[0].priceUsd), source: 'dexscreener' };
      }
    } catch (err) {}
    
    return null;
  }

  // SHOULD TRADE - Decision logic
  shouldTradeAdvanced(analysis) {
    if (!analysis) return false;
    
    // Use learner's prediction if enough data
    if (learner.performance.totalPredictions >= 20) {
      const learnerScore = learner.calculateWeightedScore(analysis);
      if (learnerScore >= 70) return true;
      if (learnerScore <= 30) return false;
    }
    
    // Fallback to analysis-based decision
    const score = analysis.advancedScore || 50;
    const rec = analysis.advancedRecommendation;
    
    if (rec === 'AVOID') return false;
    if (rec === 'STRONG_BUY') return true;
    if (rec === 'BUY' && score >= 55) return true;
    
    // AI consensus as tiebreaker
    if (analysis.aiSignal === 'BUY' && analysis.aiAgreement >= 60) return true;
    
    return score >= 60;
  }
}
```

### 4. learner.js - Self-Learning System

```javascript
class SelfLearner {
  constructor() {
    this.weights = {
      // Signal weights - AI adjusts these based on what works
      marketCap: 1.0,
      liquidity: 1.0,
      volume24h: 1.0,
      buyPressure: 1.0,
      holders: 1.0,
      priceChange1h: 1.0,
      priceChange24h: 1.0,
      volumeToMcap: 1.0,
      distributionScore: 1.0,
      whalePercent: 1.0,
      bondingCurveProgress: 1.0,
      tokenAge: 1.0
    };
    
    this.thresholds = {
      minMarketCap: 20000,
      maxMarketCap: 500000,
      minLiquidity: 5,
      minHolders: 20,
      minBuyPressure: 50,
      minScore: 60
    };
    
    this.performance = {
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0
    };
    
    this.learningRate = 0.1;
  }

  // LEARN FROM OUTCOME
  async learnFromOutcome(signals, outcome, pnlPercent) {
    this.performance.totalPredictions++;
    
    const wasPump = outcome === 'pump';
    const predictedPump = this.predictPump(signals);
    
    if ((wasPump && predictedPump) || (!wasPump && !predictedPump)) {
      this.performance.correctPredictions++;
    }
    
    this.performance.accuracy = (this.performance.correctPredictions / this.performance.totalPredictions) * 100;

    // Adjust weights after enough samples
    if (this.performance.totalPredictions >= 20) {
      await this.adjustWeights(signals, wasPump, pnlPercent);
    }
  }

  // CALCULATE WEIGHTED SCORE
  calculateWeightedScore(signals) {
    let score = 50;

    // Market cap
    const mcap = signals.marketCap || 0;
    if (mcap >= this.thresholds.minMarketCap && mcap <= this.thresholds.maxMarketCap) {
      score += 10 * this.weights.marketCap;
    }

    // Buy pressure
    const bp = signals.buyPressure || 50;
    if (bp >= 50) score += ((bp - 50) / 5) * this.weights.buyPressure;

    // Volume to mcap ratio
    const vtm = signals.volumeToMcap || 0;
    if (vtm > 0.3) score += 10 * this.weights.volumeToMcap;

    // Price momentum
    const pc1h = signals.priceChange1h || 0;
    if (pc1h > 5 && pc1h < 50) score += 5 * this.weights.priceChange1h;

    // Bonding curve progress (75-85% = graduation frenzy)
    const bcProgress = signals.bondingCurveProgress || 0;
    if (bcProgress >= 75 && bcProgress < 85) {
      score += 15 * this.weights.bondingCurveProgress;
    }

    // Token age (newer = more potential)
    const ageMinutes = signals.tokenAge || 60;
    if (ageMinutes < 5) score += 10 * this.weights.tokenAge;

    return Math.max(0, Math.min(100, score));
  }

  // ADJUST WEIGHTS based on outcome
  async adjustWeights(signals, wasPump, pnlPercent) {
    const signalMap = {
      marketCap: this.evaluateMarketCap(signals.marketCap),
      liquidity: signals.liquidity >= this.thresholds.minLiquidity ? 1 : -1,
      buyPressure: signals.buyPressure > 50 ? 1 : -1,
      volumeToMcap: signals.volumeToMcap > 0.1 ? 1 : -1,
      priceChange1h: signals.priceChange1h > 0 && signals.priceChange1h < 50 ? 1 : -1
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

### 5. helius.js - Data Fetching (Key Functions)

```javascript
class HeliusService {
  // GET TOKENS - Combine multiple sources
  async getPumpFunTokens() {
    const allTokens = [];
    const seenMints = new Set();
    
    // SOURCE 1: Birdeye for established tokens
    if (this.birdeyeKey) {
      const birdeyeTokens = await this.getBirdeyeTokens();
      for (const t of birdeyeTokens) {
        if (!seenMints.has(t.mint)) {
          seenMints.add(t.mint);
          allTokens.push({ ...t, source: 'birdeye' });
        }
      }
    }
    
    // SOURCE 2: DexScreener for fresh pump.fun tokens
    const dexTokens = await this.getDexScreenerPumpFunTokens();
    for (const t of dexTokens) {
      if (!seenMints.has(t.mint)) {
        seenMints.add(t.mint);
        allTokens.push({ ...t, source: 'dexscreener' });
      }
    }
    
    // SOURCE 3: Pump.fun API (often blocked)
    const pumpTokens = await this.getPumpFunCoins();
    for (const t of pumpTokens) {
      if (!seenMints.has(t.mint)) {
        seenMints.add(t.mint);
        allTokens.push({ ...t, source: 'pumpfun' });
      }
    }
    
    // Shuffle to mix sources
    return this.shuffle(allTokens);
  }

  // BIRDEYE API - Multiple sort options
  async getBirdeyeTokens() {
    const endpoints = [
      { url: 'tokenlist?sort_by=v24hUSD&sort_type=desc&limit=50', name: '24h vol' },
      { url: 'tokenlist?sort_by=v1hUSD&sort_type=desc&limit=50', name: '1h vol' },
      { url: 'tokenlist?sort_by=mc&sort_type=asc&limit=50', name: 'low mcap' },
      { url: 'tokenlist?sort_by=liquidity&sort_type=desc&limit=50', name: 'liquidity' }
    ];
    
    const allTokens = [];
    for (const { url, name } of endpoints) {
      const res = await fetch(`https://public-api.birdeye.so/defi/${url}`, {
        headers: { 'X-API-KEY': this.birdeyeKey, 'x-chain': 'solana' }
      });
      
      const data = await res.json();
      for (const t of data.data?.tokens || []) {
        if (allTokens.find(x => x.mint === t.address)) continue;
        if ((t.mc || 0) < 1000) continue; // Skip dead tokens
        
        allTokens.push({
          mint: t.address,
          symbol: t.symbol,
          price: t.price || 0,
          priceChange1h: t.v1hChangePercent || 0,
          priceChange24h: t.v24hChangePercent || 0,
          usd_market_cap: t.mc || 0,
          virtual_sol_reserves: t.liquidity || 0,
          volume24h: t.v24hUSD || 0,
          holder_count: t.holder || 0,
          buyPressure: t.buy24h && t.sell24h ? (t.buy24h / (t.buy24h + t.sell24h)) * 100 : 50,
          volumeToMcap: t.mc ? (t.v24hUSD || 0) / t.mc : 0
        });
      }
    }
    return allTokens;
  }

  // DEEP TOKEN ANALYSIS - Holder distribution, security
  async getDeepTokenAnalysis(mintAddress) {
    const [holders, tokenInfo, securityInfo] = await Promise.all([
      this.analyzeHolderDistribution(mintAddress),
      this.getTokenSecurityInfo(mintAddress),
      this.getBirdeyeTokenSecurity(mintAddress)
    ]);

    return {
      holders,
      security: { ...tokenInfo, ...securityInfo }
    };
  }

  // HOLDER DISTRIBUTION
  async analyzeHolderDistribution(mintAddress) {
    const largestAccounts = await this.rpc('getTokenLargestAccounts', [mintAddress]);
    const holders = largestAccounts?.value || [];
    const totalHeld = holders.reduce((sum, h) => sum + parseFloat(h.amount), 0);
    
    const top1Percent = holders[0] ? (parseFloat(holders[0].amount) / totalHeld) * 100 : 0;
    const top10Percent = holders.slice(0, 10).reduce((sum, h) => sum + parseFloat(h.amount), 0) / totalHeld * 100;
    const whales = holders.filter(h => (parseFloat(h.amount) / totalHeld) > 0.05);
    
    return {
      totalHolders: holders.length,
      top1Percent,
      top10Percent,
      whaleCount: whales.length,
      distributionScore: Math.max(0, 100 - top10Percent),
      isHighlyConcentrated: top1Percent > 50
    };
  }
}
```

### 6. multiAI.js - Multi-AI Consensus

```javascript
class MultiAIEngine {
  // GET CONSENSUS - Race fast AIs, use slow as backup
  async getConsensus(tokenData, context) {
    const analyses = [];
    
    // PHASE 1: Fast AIs (Groq ~200ms, Gemini ~500ms)
    const fastAIs = [];
    if (this.groqKey) fastAIs.push(() => this.analyzeWithGroq(tokenData, context));
    if (this.geminiKey) fastAIs.push(() => this.analyzeWithGemini(tokenData, context));
    
    const fastPromises = fastAIs.map(fn => 
      Promise.race([fn(), new Promise(r => setTimeout(() => r(null), 1500))])
    );
    
    const fastResults = await Promise.allSettled(fastPromises);
    for (const result of fastResults) {
      if (result.status === 'fulfilled' && result.value) {
        analyses.push(result.value);
      }
    }
    
    // EARLY EXIT: If 2+ fast AIs agree with high confidence
    if (analyses.length >= 2) {
      const earlyConsensus = this.checkEarlyConsensus(analyses);
      if (earlyConsensus) return this.buildConsensusResult(analyses, tokenData, true);
    }
    
    // PHASE 2: Slow AIs (Claude, OpenAI) with 3s timeout
    const slowAIs = [];
    if (this.claudeKey) slowAIs.push(() => this.analyzeWithClaude(tokenData, context));
    if (this.openaiKey) slowAIs.push(() => this.analyzeWithOpenAI(tokenData, context));
    
    const slowPromises = slowAIs.map(fn =>
      Promise.race([fn(), new Promise(r => setTimeout(() => r(null), 3000))])
    );
    
    const slowResults = await Promise.allSettled(slowPromises);
    for (const result of slowResults) {
      if (result.status === 'fulfilled' && result.value) {
        analyses.push(result.value);
      }
    }
    
    return this.buildConsensusResult(analyses, tokenData, false);
  }

  // BUILD CONSENSUS RESULT
  buildConsensusResult(analyses, tokenData, wasEarlyExit) {
    const buyVotes = analyses.filter(a => a.signal === 'BUY').length;
    const sellVotes = analyses.filter(a => a.signal === 'SELL').length;
    const holdVotes = analyses.filter(a => a.signal === 'HOLD').length;
    
    let consensus = 'HOLD';
    if (buyVotes > sellVotes && buyVotes > holdVotes) consensus = 'BUY';
    if (sellVotes > buyVotes && sellVotes > holdVotes) consensus = 'SELL';
    
    const maxVotes = Math.max(buyVotes, sellVotes, holdVotes);
    const agreement = (maxVotes / analyses.length) * 100;
    
    return {
      consensus,
      agreement: Math.round(agreement),
      votes: { buy: buyVotes, sell: sellVotes, hold: holdVotes },
      aiCount: analyses.length,
      wasEarlyExit
    };
  }
}
```

### 7. analytics.js - Token Scoring

```javascript
class AnalyticsEngine {
  // SCORE TOKEN - 0-100 score with flags
  scoreToken(tokenData, deepAnalysis) {
    let score = 50;
    const flags = { red: [], yellow: [], green: [] };

    // Market cap
    const mcap = tokenData.usd_market_cap || 0;
    if (mcap >= 20000 && mcap <= 200000) { score += 10; flags.green.push('Good mcap'); }
    else if (mcap < 5000) { score -= 15; flags.red.push('Mcap too low'); }

    // Liquidity
    const liq = tokenData.virtual_sol_reserves || 0;
    if (liq >= 20) { score += 10; flags.green.push('Strong liquidity'); }
    else if (liq < 2) { score -= 15; flags.red.push('Low liquidity'); }

    // Volume/mcap ratio
    const volToMcap = mcap > 0 ? (tokenData.volume24h || 0) / mcap : 0;
    if (volToMcap > 0.5) { score += 10; flags.green.push('High volume/mcap'); }

    // Buy pressure
    const buyPressure = tokenData.buyPressure || 50;
    if (buyPressure > 60) { score += 10; flags.green.push('Buy pressure'); }
    else if (buyPressure < 40) { score -= 10; flags.red.push('Sell pressure'); }

    // Holder analysis
    if (deepAnalysis?.holders) {
      if (deepAnalysis.holders.distributionScore > 60) { score += 10; flags.green.push('Good distribution'); }
      if (deepAnalysis.holders.top1Percent > 30) { score -= 10; flags.red.push('Top holder >30%'); }
    }

    // Security
    if (deepAnalysis?.security) {
      if (deepAnalysis.security.isLpBurned) { score += 10; flags.green.push('LP burned'); }
      if (deepAnalysis.security.hasMintRisk) { score -= 10; flags.yellow.push('Mintable'); }
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      flags,
      recommendation: score >= 70 ? 'STRONG_BUY' : score >= 60 ? 'BUY' : score >= 45 ? 'HOLD' : 'AVOID'
    };
  }
}
```

### 8. alpha.js - Market Regime & Position Sizing

```javascript
class AlphaEngine {
  // MARKET REGIME DETECTION
  detectMarketRegime(recentTokens, solPrice, solPriceHistory) {
    let avgPriceChange = 0;
    let bullishTokens = 0;
    let bearishTokens = 0;

    for (const token of recentTokens) {
      const change = token.priceChange24h || 0;
      avgPriceChange += change;
      if (change > 10) bullishTokens++;
      if (change < -10) bearishTokens++;
    }

    avgPriceChange /= recentTokens.length || 1;

    let regime = 'neutral';
    if (avgPriceChange > 20 && bullishTokens > recentTokens.length * 0.6) regime = 'bull';
    else if (avgPriceChange < -15 && bearishTokens > recentTokens.length * 0.5) regime = 'bear';

    return { regime, recommendation: this.getRegimeRecommendation(regime) };
  }

  // KELLY CRITERION - Optimal position sizing
  calculateOptimalPositionSize(winRate, avgWin, avgLoss, confidence) {
    const b = avgWin / avgLoss;
    const p = winRate;
    const q = 1 - p;
    
    let kelly = (b * p - q) / b;
    kelly *= 0.25; // Fractional Kelly (conservative)
    kelly *= (confidence / 100);
    
    return Math.max(0.01, Math.min(0.15, kelly));
  }

  // DYNAMIC PROFIT TARGETS
  calculateProfitTargets(analysis, marketRegime) {
    let tpMultiplier = 1.0;
    let slMultiplier = 1.0;
    
    if (marketRegime === 'bull') { tpMultiplier = 1.5; slMultiplier = 0.8; }
    if (marketRegime === 'bear') { tpMultiplier = 0.6; slMultiplier = 1.2; }
    
    const score = analysis?.advancedScore || 50;
    if (score >= 80) { tpMultiplier *= 1.3; }
    
    return {
      takeProfit: 0.25 * tpMultiplier,
      stopLoss: 0.10 * slMultiplier,
      trailingActivation: 0.125 * tpMultiplier,
      trailingDistance: 0.10
    };
  }
}
```

---

## CURRENT STATS (Example Output)

```
Learner accuracy: 42.9% from 170 predictions
Stats: 0 pumps, 0 dumps, 69 neutral
Tracked tokens: 45
Data points: 170
```

## KEY PROBLEMS TO SOLVE

1. **All outcomes are neutral** - Not detecting enough pumps/dumps
2. **Learning is slow** - Need more data points faster
3. **Missing early pump.fun tokens** - By the time we see them, they've already pumped
4. **Multi-AI consensus latency** - Sometimes takes 3-5 seconds

## QUESTIONS FOR DISCUSSION

1. What architectural changes would improve pump/dump detection?
2. Should we use shorter time windows (3-5 min instead of 10)?
3. What additional signals should we track?
4. How can we detect tokens earlier (before they pump)?
5. Should we use ML models instead of weighted scoring?
6. How can we speed up the learning feedback loop?
7. What's the best way to handle the "neutral" problem?

---

*End of code dump. Please analyze and provide recommendations.*
