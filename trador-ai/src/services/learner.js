import storage from './storage.js';

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
      top10Percent: 1.0,
      uniqueWallets24h: 1.0,
      isBuyHeavy: 1.0,
      hasWhaleInterest: 1.0,
      isLpBurned: 1.0,
      // NEW: Bonding curve signals
      bondingCurveProgress: 1.0,
      isNearGraduation: 1.0,
      tokenAge: 1.0
    };
    
    this.thresholds = {
      // Dynamic thresholds - AI adjusts based on performance
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
      accuracy: 0,
      lastUpdate: null
    };
    
    this.learningRate = 0.1; // How fast to adjust weights
    this.minSamples = 20; // Min samples before adjusting
  }

  async initialize() {
    const saved = await storage.loadLearnerState();
    if (saved) {
      this.weights = { ...this.weights, ...saved.weights };
      this.thresholds = { ...this.thresholds, ...saved.thresholds };
      this.performance = { ...this.performance, ...saved.performance };
      console.log(`Learner loaded: ${this.performance.accuracy.toFixed(1)}% accuracy`);
    }
  }

  async save() {
    await storage.saveLearnerState({
      weights: this.weights,
      thresholds: this.thresholds,
      performance: this.performance
    });
  }

  // Learn from a completed outcome
  async learnFromOutcome(signals, outcome, pnlPercent) {
    this.performance.totalPredictions++;
    
    const wasPump = outcome === 'pump';
    const predictedPump = this.predictPump(signals);
    
    if ((wasPump && predictedPump) || (!wasPump && !predictedPump)) {
      this.performance.correctPredictions++;
    }
    
    this.performance.accuracy = this.performance.totalPredictions > 0 
      ? (this.performance.correctPredictions / this.performance.totalPredictions) * 100 
      : 0;

    // Only adjust weights after enough samples
    if (this.performance.totalPredictions >= this.minSamples) {
      await this.adjustWeights(signals, wasPump, pnlPercent);
      await this.adjustThresholds(signals, wasPump);
    }

    this.performance.lastUpdate = Date.now();
    await this.save();
  }

  // Predict if token will pump based on current weights
  predictPump(signals) {
    const score = this.calculateWeightedScore(signals);
    return score >= this.thresholds.minScore;
  }

  // Calculate weighted score using learned weights
  calculateWeightedScore(signals) {
    let score = 50;
    let totalWeight = 0;

    // Market cap
    const mcap = signals.marketCap || 0;
    if (mcap >= this.thresholds.minMarketCap && mcap <= this.thresholds.maxMarketCap) {
      score += 10 * this.weights.marketCap;
    } else if (mcap < this.thresholds.minMarketCap * 0.5 || mcap > this.thresholds.maxMarketCap * 2) {
      score -= 10 * this.weights.marketCap;
    }
    totalWeight += this.weights.marketCap;

    // Liquidity
    const liq = signals.liquidity || 0;
    if (liq >= this.thresholds.minLiquidity) {
      score += 10 * this.weights.liquidity;
    } else {
      score -= 10 * this.weights.liquidity;
    }
    totalWeight += this.weights.liquidity;

    // Buy pressure
    const bp = signals.buyPressure || 50;
    if (bp >= this.thresholds.minBuyPressure) {
      score += ((bp - 50) / 5) * this.weights.buyPressure;
    } else {
      score -= ((50 - bp) / 5) * this.weights.buyPressure;
    }
    totalWeight += this.weights.buyPressure;

    // Holders
    const holders = signals.holders || 0;
    if (holders >= this.thresholds.minHolders) {
      score += 5 * this.weights.holders;
    } else {
      score -= 5 * this.weights.holders;
    }
    totalWeight += this.weights.holders;

    // Volume to mcap ratio
    const vtm = signals.volumeToMcap || 0;
    if (vtm > 0.3) score += 10 * this.weights.volumeToMcap;
    else if (vtm > 0.1) score += 5 * this.weights.volumeToMcap;
    totalWeight += this.weights.volumeToMcap;

    // Price momentum
    const pc1h = signals.priceChange1h || 0;
    if (pc1h > 5 && pc1h < 50) score += 5 * this.weights.priceChange1h;
    else if (pc1h > 100) score -= 5 * this.weights.priceChange1h;
    else if (pc1h < -20) score -= 10 * this.weights.priceChange1h;
    totalWeight += this.weights.priceChange1h;

    // Distribution score
    const dist = signals.distributionScore || 50;
    if (dist > 60) score += 5 * this.weights.distributionScore;
    else if (dist < 30) score -= 10 * this.weights.distributionScore;
    totalWeight += this.weights.distributionScore;

    // Whale risk
    const whaleP = signals.whalePercent || 0;
    if (whaleP > 50) score -= 10 * this.weights.whalePercent;
    else if (whaleP < 20) score += 5 * this.weights.whalePercent;
    totalWeight += this.weights.whalePercent;

    // Buy heavy
    if (signals.isBuyHeavy) score += 5 * this.weights.isBuyHeavy;
    totalWeight += this.weights.isBuyHeavy;

    // Whale interest
    if (signals.hasWhaleInterest) score += 5 * this.weights.hasWhaleInterest;
    totalWeight += this.weights.hasWhaleInterest;

    // LP burned
    if (signals.isLpBurned) score += 5 * this.weights.isLpBurned;
    totalWeight += this.weights.isLpBurned;

    // NEW: Bonding curve progress (75-85% = graduation frenzy zone)
    const bcProgress = signals.bondingCurveProgress || 0;
    if (bcProgress >= 75 && bcProgress < 85) {
      score += 15 * this.weights.bondingCurveProgress; // Graduation frenzy!
    } else if (bcProgress >= 60 && bcProgress < 75) {
      score += 8 * this.weights.bondingCurveProgress;
    } else if (bcProgress < 20) {
      score += 3 * this.weights.bondingCurveProgress; // Very early, risky but potential
    }
    totalWeight += this.weights.bondingCurveProgress;

    // Token age (newer = more volatile = higher potential)
    const ageMinutes = signals.tokenAge || signals.ageMinutes || 60;
    if (ageMinutes < 5) {
      score += 10 * this.weights.tokenAge; // Brand new
    } else if (ageMinutes < 15) {
      score += 5 * this.weights.tokenAge;
    } else if (ageMinutes > 60) {
      score -= 5 * this.weights.tokenAge; // Old token, less likely to pump
    }
    totalWeight += this.weights.tokenAge;

    // Normalize
    return Math.max(0, Math.min(100, score));
  }


  // Adjust weights based on outcome
  async adjustWeights(signals, wasPump, pnlPercent) {
    const signalMap = {
      marketCap: this.evaluateMarketCap(signals.marketCap),
      liquidity: signals.liquidity >= this.thresholds.minLiquidity ? 1 : -1,
      buyPressure: signals.buyPressure > 50 ? 1 : -1,
      holders: signals.holders >= this.thresholds.minHolders ? 1 : -1,
      volumeToMcap: signals.volumeToMcap > 0.1 ? 1 : -1,
      priceChange1h: signals.priceChange1h > 0 && signals.priceChange1h < 50 ? 1 : -1,
      distributionScore: signals.distributionScore > 50 ? 1 : -1,
      whalePercent: signals.whalePercent < 30 ? 1 : -1,
      isBuyHeavy: signals.isBuyHeavy ? 1 : 0,
      hasWhaleInterest: signals.hasWhaleInterest ? 1 : 0,
      isLpBurned: signals.isLpBurned ? 1 : 0
    };

    for (const [signal, direction] of Object.entries(signalMap)) {
      if (direction === 0) continue;
      
      // If signal direction matched outcome, increase weight
      // If signal direction didn't match outcome, decrease weight
      const signalPredictedPump = direction > 0;
      const wasCorrect = signalPredictedPump === wasPump;
      
      const adjustment = wasCorrect 
        ? this.learningRate * Math.abs(pnlPercent) / 100
        : -this.learningRate * Math.abs(pnlPercent) / 100;
      
      this.weights[signal] = Math.max(0.1, Math.min(3.0, this.weights[signal] + adjustment));
    }

    console.log(`Weights adjusted. Top signals: ${this.getTopSignals().join(', ')}`);
  }

  evaluateMarketCap(mcap) {
    if (mcap >= this.thresholds.minMarketCap && mcap <= this.thresholds.maxMarketCap) return 1;
    return -1;
  }

  // Adjust thresholds based on what's working
  async adjustThresholds(signals, wasPump) {
    // If pump happened outside our thresholds, expand them
    // If dump happened inside our thresholds, tighten them
    
    const mcap = signals.marketCap || 0;
    
    if (wasPump) {
      // Expand thresholds to include this pump
      if (mcap < this.thresholds.minMarketCap && mcap > 5000) {
        this.thresholds.minMarketCap = Math.max(5000, mcap * 0.8);
        console.log(`Lowered minMarketCap to ${this.thresholds.minMarketCap}`);
      }
      if (mcap > this.thresholds.maxMarketCap && mcap < 2000000) {
        this.thresholds.maxMarketCap = Math.min(2000000, mcap * 1.2);
        console.log(`Raised maxMarketCap to ${this.thresholds.maxMarketCap}`);
      }
      
      // Lower minScore if we're missing pumps
      if (this.calculateWeightedScore(signals) < this.thresholds.minScore) {
        this.thresholds.minScore = Math.max(40, this.thresholds.minScore - 2);
      }
    } else {
      // Tighten thresholds to exclude this dump
      if (this.calculateWeightedScore(signals) >= this.thresholds.minScore) {
        this.thresholds.minScore = Math.min(80, this.thresholds.minScore + 1);
      }
    }
  }

  // Get top performing signals
  getTopSignals() {
    return Object.entries(this.weights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, weight]) => `${name}(${weight.toFixed(2)})`);
  }

  // Get current strategy summary
  getStrategy() {
    return {
      weights: this.weights,
      thresholds: this.thresholds,
      performance: this.performance,
      topSignals: this.getTopSignals(),
      recommendation: this.getRecommendation()
    };
  }

  getRecommendation() {
    if (this.performance.totalPredictions < 50) {
      return 'Still learning - need more data';
    }
    if (this.performance.accuracy >= 65) {
      return 'Strategy performing well';
    }
    if (this.performance.accuracy >= 55) {
      return 'Strategy needs improvement';
    }
    return 'Strategy underperforming - adjusting';
  }

  // Auto-optimize based on recent performance
  async autoOptimize(recentOutcomes) {
    if (recentOutcomes.length < 20) return;

    const recentAccuracy = recentOutcomes.filter(o => {
      const predicted = this.predictPump(o.signals);
      const actual = o.outcome === 'pump';
      return predicted === actual;
    }).length / recentOutcomes.length;

    console.log(`Recent accuracy: ${(recentAccuracy * 100).toFixed(1)}%`);

    // If recent accuracy is bad, increase learning rate temporarily
    if (recentAccuracy < 0.5) {
      this.learningRate = Math.min(0.3, this.learningRate * 1.5);
      console.log(`Increased learning rate to ${this.learningRate}`);
    } else if (recentAccuracy > 0.65) {
      this.learningRate = Math.max(0.05, this.learningRate * 0.8);
      console.log(`Decreased learning rate to ${this.learningRate}`);
    }

    // Find which signals are most predictive recently
    const signalCorrelations = {};
    for (const signal of Object.keys(this.weights)) {
      let correct = 0;
      let total = 0;
      
      for (const o of recentOutcomes) {
        const signalValue = this.getSignalValue(o.signals, signal);
        if (signalValue === null) continue;
        
        const signalPositive = signalValue > 0;
        const wasPump = o.outcome === 'pump';
        
        if (signalPositive === wasPump) correct++;
        total++;
      }
      
      if (total > 10) {
        signalCorrelations[signal] = correct / total;
      }
    }

    // Boost weights of highly correlated signals
    for (const [signal, correlation] of Object.entries(signalCorrelations)) {
      if (correlation > 0.6) {
        this.weights[signal] = Math.min(3.0, this.weights[signal] * 1.1);
      } else if (correlation < 0.4) {
        this.weights[signal] = Math.max(0.1, this.weights[signal] * 0.9);
      }
    }

    await this.save();
  }

  getSignalValue(signals, signal) {
    const value = signals[signal];
    if (value === undefined || value === null) return null;
    
    // Normalize to positive/negative
    switch (signal) {
      case 'buyPressure': return value - 50;
      case 'priceChange1h':
      case 'priceChange24h': return value;
      case 'whalePercent':
      case 'top10Percent': return -value; // Lower is better
      case 'distributionScore': return value - 50;
      default: return value > 0 ? 1 : -1;
    }
  }

  // Flatten signals from nested structure
  flattenSignals(data) {
    const flat = {};
    const sources = [
      data.signals,
      data.priceSignals,
      data.marketSignals,
      data.volumeSignals,
      data.tradingSignals,
      data.holderSignals,
      data.securitySignals,
      data.recentTradeSignals,
      data.token
    ];

    for (const source of sources) {
      if (source) {
        Object.assign(flat, source);
      }
    }
    return flat;
  }
}

export default new SelfLearner();
