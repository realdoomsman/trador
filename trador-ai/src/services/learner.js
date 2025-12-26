import storage from './storage.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      // Bonding curve signals
      bondingCurveProgress: 1.0,
      bondingCurveVelocity: 1.0,
      isNearGraduation: 1.0,
      tokenAge: 1.0,
      // NEW: Early pump.fun signals
      buyersPerMinute: 1.0,
      newBuyers: 1.0,
      repeatBuyers: 1.0,
      avgBuySize: 1.0,
      topHolderPercent: 1.0
    };
    
    // NO HARD THRESHOLDS - use soft penalties instead
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
      lastUpdate: null,
      // NEW: Volatility prediction stats
      volatilityPredictions: 0,
      volatilityAccuracy: 0,
      avgPredictedVolatility: 0,
      avgActualVolatility: 0
    };
    
    // Dynamic learning rate - higher for early samples, decay later
    this.baseLearningRate = 0.15;
    this.minSamples = 5; // Start learning after just 5 samples
  }

  // Calculate dynamic learning rate
  getLearningRate() {
    const samples = this.performance.totalPredictions;
    if (samples < 20) return this.baseLearningRate * 1.5; // Aggressive early learning
    if (samples < 50) return this.baseLearningRate;
    if (samples < 100) return this.baseLearningRate * 0.8;
    return this.baseLearningRate * 0.5; // Slower learning once stable
  }

  async initialize() {
    const saved = await storage.loadLearnerState();
    if (saved) {
      this.weights = { ...this.weights, ...saved.weights };
      this.softPenalties = { ...this.softPenalties, ...saved.softPenalties };
      this.performance = { ...this.performance, ...saved.performance };
      console.log(`Learner loaded: ${this.performance.accuracy.toFixed(1)}% accuracy, ${this.performance.volatilityAccuracy.toFixed(1)}% volatility accuracy`);
    }
  }

  async save() {
    await storage.saveLearnerState({
      weights: this.weights,
      softPenalties: this.softPenalties,
      performance: this.performance
    });
  }

  // NEW: Learn from volatility outcome (not just pump/dump)
  async learnFromVolatility(signals, maxUp, maxDown, finalPnl, windowMinutes) {
    const volatilityScore = Math.max(Math.abs(maxUp), Math.abs(maxDown));
    const volatilityBucket = this.getVolatilityBucket(volatilityScore);
    const direction = maxUp > Math.abs(maxDown) ? 'up' : 'down';
    
    // Predict what we thought would happen
    const predictedVolatility = this.predictVolatility(signals);
    const predictedBucket = this.getVolatilityBucket(predictedVolatility);
    
    this.performance.volatilityPredictions++;
    
    // Track accuracy
    const bucketMatch = predictedBucket === volatilityBucket;
    if (bucketMatch) {
      this.performance.correctPredictions++;
    }
    
    // Update running averages
    this.performance.avgPredictedVolatility = 
      (this.performance.avgPredictedVolatility * (this.performance.volatilityPredictions - 1) + predictedVolatility) / 
      this.performance.volatilityPredictions;
    this.performance.avgActualVolatility = 
      (this.performance.avgActualVolatility * (this.performance.volatilityPredictions - 1) + volatilityScore) / 
      this.performance.volatilityPredictions;
    
    this.performance.volatilityAccuracy = this.performance.totalPredictions > 0 
      ? (this.performance.correctPredictions / this.performance.totalPredictions) * 100 
      : 0;
    
    // Adjust weights based on volatility, not direction
    if (this.performance.volatilityPredictions >= this.minSamples) {
      await this.adjustWeightsForVolatility(signals, volatilityScore, predictedVolatility, windowMinutes);
    }
    
    this.performance.totalPredictions++;
    this.performance.accuracy = this.performance.volatilityAccuracy;
    this.performance.lastUpdate = Date.now();
    
    await this.save();
    
    return { volatilityBucket, direction, volatilityScore, predictedVolatility };
  }

  // Get volatility bucket - LOWERED THRESHOLDS for memecoins
  getVolatilityBucket(volatilityScore) {
    if (volatilityScore < 4) return 'dead';        // <4% = dead
    if (volatilityScore < 8) return 'tradeable';   // 4-8% = tradeable (was 5-10%)
    if (volatilityScore < 15) return 'high_alpha'; // 8-15% = high alpha (was 10-20%)
    return 'extreme';                               // 15%+ = extreme (was 20%+)
  }

  // Predict volatility (not direction)
  predictVolatility(signals) {
    let score = 0;
    
    // Early tokens = more volatile
    const age = signals.tokenAge || signals.ageMinutes || 60;
    if (age < 2) score += 15 * this.weights.tokenAge;
    else if (age < 5) score += 10 * this.weights.tokenAge;
    else if (age < 15) score += 5 * this.weights.tokenAge;
    
    // Bonding curve progress - graduation zone is volatile
    const bcProgress = signals.bondingCurveProgress || 0;
    if (bcProgress >= 60 && bcProgress < 85) {
      score += 12 * this.weights.bondingCurveProgress;
    }
    
    // Bonding curve velocity - fast progress = volatile
    const bcVelocity = signals.bondingCurveVelocity || 0;
    if (bcVelocity > 2) score += 10 * this.weights.bondingCurveVelocity;
    else if (bcVelocity > 0.5) score += 5 * this.weights.bondingCurveVelocity;
    
    // Buy pressure extremes = volatile
    const bp = signals.buyPressure || 50;
    if (bp > 70 || bp < 30) score += 8 * this.weights.buyPressure;
    
    // Volume to mcap ratio - high = volatile
    const vtm = signals.volumeToMcap || 0;
    if (vtm > 0.5) score += 10 * this.weights.volumeToMcap;
    else if (vtm > 0.2) score += 5 * this.weights.volumeToMcap;
    
    // Buyers per minute - high activity = volatile
    const bpm = signals.buyersPerMinute || 0;
    if (bpm > 10) score += 12 * this.weights.buyersPerMinute;
    else if (bpm > 5) score += 6 * this.weights.buyersPerMinute;
    
    // Low holder count = more volatile
    const holders = signals.holders || 0;
    if (holders < 50) score += 5 * this.weights.holders;
    
    // Apply soft penalties (reduce score, don't eliminate)
    score = this.applySoftPenalties(signals, score);
    
    return Math.max(0, Math.min(30, score)); // Cap at 30% predicted volatility
  }

  // Apply soft penalties instead of hard filters
  applySoftPenalties(signals, score) {
    const mcap = signals.marketCap || 0;
    const liq = signals.liquidity || 0;
    const holders = signals.holders || 0;
    const topHolder = signals.topHolderPercent || signals.top1Percent || 0;
    
    if (mcap < this.softPenalties.marketCapTooLow.threshold) {
      score *= this.softPenalties.marketCapTooLow.penalty;
    }
    if (mcap > this.softPenalties.marketCapTooHigh.threshold) {
      score *= this.softPenalties.marketCapTooHigh.penalty;
    }
    if (liq < this.softPenalties.liquidityTooLow.threshold) {
      score *= this.softPenalties.liquidityTooLow.penalty;
    }
    if (holders < this.softPenalties.holdersTooFew.threshold) {
      score *= this.softPenalties.holdersTooFew.penalty;
    }
    if (topHolder > this.softPenalties.topHolderTooHigh.threshold) {
      score *= this.softPenalties.topHolderTooHigh.penalty;
    }
    
    return score;
  }

  // Adjust weights based on volatility prediction error
  async adjustWeightsForVolatility(signals, actualVolatility, predictedVolatility, windowMinutes) {
    const error = actualVolatility - predictedVolatility;
    const learningRate = this.getLearningRate();
    
    // Weight adjustment based on prediction error
    // If we under-predicted volatility, increase weights of signals that were high
    // If we over-predicted, decrease weights of signals that were high
    
    const signalContributions = {
      tokenAge: this.getAgeContribution(signals.tokenAge || signals.ageMinutes),
      bondingCurveProgress: this.getBCProgressContribution(signals.bondingCurveProgress),
      bondingCurveVelocity: signals.bondingCurveVelocity > 1 ? 1 : 0,
      buyPressure: Math.abs((signals.buyPressure || 50) - 50) > 20 ? 1 : 0,
      volumeToMcap: (signals.volumeToMcap || 0) > 0.2 ? 1 : 0,
      buyersPerMinute: (signals.buyersPerMinute || 0) > 5 ? 1 : 0,
      holders: (signals.holders || 100) < 50 ? 1 : 0
    };
    
    for (const [signal, contribution] of Object.entries(signalContributions)) {
      if (contribution === 0) continue;
      
      // If we under-predicted and this signal was active, increase its weight
      // If we over-predicted and this signal was active, decrease its weight
      const adjustment = (error > 0 ? 1 : -1) * learningRate * contribution * (Math.abs(error) / 20);
      
      if (this.weights[signal] !== undefined) {
        this.weights[signal] = Math.max(0.1, Math.min(3.0, this.weights[signal] + adjustment));
      }
    }
    
    // Also adjust soft penalties based on outcomes
    if (actualVolatility > 10) {
      // High volatility token - loosen penalties slightly
      this.softPenalties.marketCapTooLow.penalty = Math.min(0.95, this.softPenalties.marketCapTooLow.penalty + 0.01);
      this.softPenalties.holdersTooFew.penalty = Math.min(0.95, this.softPenalties.holdersTooFew.penalty + 0.01);
    }
  }

  getAgeContribution(age) {
    if (!age) return 0;
    if (age < 2) return 1;
    if (age < 5) return 0.7;
    if (age < 15) return 0.3;
    return 0;
  }

  getBCProgressContribution(progress) {
    if (!progress) return 0;
    if (progress >= 60 && progress < 85) return 1;
    if (progress >= 40 && progress < 60) return 0.5;
    return 0;
  }

  // LEGACY: Keep for backward compatibility
  async learnFromOutcome(signals, outcome, pnlPercent) {
    // Convert to volatility-based learning
    const maxUp = outcome === 'pump' || outcome === 'strong_pump' || outcome === 'weak_pump' 
      ? Math.abs(pnlPercent) : 0;
    const maxDown = outcome === 'dump' || outcome === 'strong_dump' || outcome === 'weak_dump'
      ? -Math.abs(pnlPercent) : 0;
    
    return this.learnFromVolatility(signals, maxUp, maxDown, pnlPercent, 10);
  }

  // LEGACY: Keep for backward compatibility
  predictPump(signals) {
    const volatility = this.predictVolatility(signals);
    return volatility >= 4; // 4%+ = tradeable (lowered from 7%)
  }

  // LEGACY: Keep for backward compatibility  
  calculateWeightedScore(signals) {
    return this.predictVolatility(signals) * 3 + 50; // Scale to 50-100 range
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
      softPenalties: this.softPenalties,
      performance: this.performance,
      topSignals: this.getTopSignals(),
      recommendation: this.getRecommendation(),
      learningRate: this.getLearningRate()
    };
  }

  getRecommendation() {
    if (this.performance.totalPredictions < 20) {
      return 'Still learning - need more data';
    }
    if (this.performance.volatilityAccuracy >= 60) {
      return 'Volatility prediction performing well';
    }
    if (this.performance.volatilityAccuracy >= 45) {
      return 'Volatility prediction needs improvement';
    }
    return 'Volatility prediction underperforming - adjusting';
  }

  // Auto-optimize based on recent performance
  async autoOptimize(recentOutcomes) {
    if (recentOutcomes.length < 10) return;

    // Calculate recent volatility prediction accuracy
    let correctBuckets = 0;
    for (const o of recentOutcomes) {
      const predicted = this.predictVolatility(o.signals);
      const actual = Math.max(Math.abs(o.maxUp || 0), Math.abs(o.maxDown || 0));
      if (this.getVolatilityBucket(predicted) === this.getVolatilityBucket(actual)) {
        correctBuckets++;
      }
    }
    
    const recentAccuracy = correctBuckets / recentOutcomes.length;
    console.log(`Recent volatility accuracy: ${(recentAccuracy * 100).toFixed(1)}%`);

    // Adjust base learning rate based on recent performance
    if (recentAccuracy < 0.4) {
      this.baseLearningRate = Math.min(0.25, this.baseLearningRate * 1.2);
      console.log(`Increased base learning rate to ${this.baseLearningRate}`);
    } else if (recentAccuracy > 0.6) {
      this.baseLearningRate = Math.max(0.05, this.baseLearningRate * 0.9);
      console.log(`Decreased base learning rate to ${this.baseLearningRate}`);
    }

    await this.save();
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
      data.earlySignals,
      data.token
    ];

    for (const source of sources) {
      if (source) {
        Object.assign(flat, source);
      }
    }
    return flat;
  }

  // TRAINING DATA PERSISTENCE - Save every completed outcome to JSONL for ML training
  // Schema: all input signals + interaction features + labels (maxUp, maxDown, volatilityBucket)
  async saveTrainingData(tracked, windowMinutes, volatilityOutcome) {
    try {
      const trainingDataPath = path.join(__dirname, '../../data/training_data.jsonl');
      
      // Build the training record with all signals
      const tokenData = tracked.tokenData || {};
      const holderAnalysis = tracked.holderAnalysis || {};
      
      // Calculate interaction features
      const mcap = tokenData.marketCap || 0;
      const velocity = tokenData.bondingCurveVelocity || 0;
      const velocityToMcapRatio = mcap > 0 ? (velocity / (mcap / 1000)) : 0; // Velocity per $1k mcap
      
      const trainingRecord = {
        // Timestamp
        timestamp: Date.now(),
        windowMinutes,
        
        // INPUT SIGNALS - Basic
        mcap: tokenData.marketCap || 0,
        liquidity: tokenData.liquidity || 0,
        holders: tokenData.holders || 0,
        tokenAge: tokenData.tokenAge || 0,
        
        // INPUT SIGNALS - Bonding Curve
        bcProgress: tokenData.bondingCurveProgress || 0,
        bcVelocity: tokenData.bondingCurveVelocity || 0,
        
        // INPUT SIGNALS - Trading Activity
        buyPressure: tokenData.buyPressure || 50,
        buyersPerMinute: tokenData.buyersPerMinute || 0,
        volume24h: tokenData.volume24h || 0,
        txns24h: tokenData.txns24h || 0,
        volumeToMcap: tokenData.volumeToMcap || 0,
        
        // INPUT SIGNALS - Price Changes
        priceChange1h: tokenData.priceChange1h || 0,
        priceChange24h: tokenData.priceChange24h || 0,
        
        // INPUT SIGNALS - Holder Distribution
        top1Percent: holderAnalysis.top1Percent || 0,
        top10Percent: holderAnalysis.top10Percent || 0,
        distributionScore: holderAnalysis.distributionScore || 0,
        
        // INPUT SIGNALS - Sniper/Bundle Detection
        sniperCount: tokenData.sniperCount || 0,
        isBundled: tokenData.isBundled ? 1 : 0,
        
        // INTERACTION FEATURES
        velocity_to_mcap_ratio: velocityToMcapRatio,
        buyers_per_holder: tokenData.holders > 0 ? (tokenData.buyersPerMinute || 0) / tokenData.holders : 0,
        volume_per_holder: tokenData.holders > 0 ? (tokenData.volume24h || 0) / tokenData.holders : 0,
        
        // LABELS - What actually happened
        maxUp: tracked.maxUp || 0,
        maxDown: tracked.maxDown || 0,
        finalPnl: tracked.currentPnl || 0,
        volatilityBucket: volatilityOutcome.bucket,
        direction: volatilityOutcome.direction,
        volatilityScore: volatilityOutcome.volatilityScore,
        
        // METADATA
        symbol: tokenData.symbol || tracked.symbol,
        mint: tokenData.mint || tracked.mint,
        source: tokenData.source || 'unknown'
      };
      
      // Append to JSONL file
      const jsonLine = JSON.stringify(trainingRecord) + '\n';
      fs.appendFileSync(trainingDataPath, jsonLine);
      
      // Log every 10th save
      const lineCount = this.getTrainingDataCount();
      if (lineCount % 10 === 0) {
        console.log(`[ML-DATA] Saved ${lineCount} training samples to training_data.jsonl`);
      }
      
      return true;
    } catch (err) {
      console.error('[ML-DATA] Failed to save training data:', err.message);
      return false;
    }
  }

  // Get count of training data samples
  getTrainingDataCount() {
    try {
      const trainingDataPath = path.join(__dirname, '../../data/training_data.jsonl');
      if (!fs.existsSync(trainingDataPath)) return 0;
      const content = fs.readFileSync(trainingDataPath, 'utf8');
      return content.split('\n').filter(line => line.trim()).length;
    } catch (err) {
      return 0;
    }
  }

  // Load training data for ML model training
  loadTrainingData() {
    try {
      const trainingDataPath = path.join(__dirname, '../../data/training_data.jsonl');
      if (!fs.existsSync(trainingDataPath)) return [];
      const content = fs.readFileSync(trainingDataPath, 'utf8');
      return content.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    } catch (err) {
      console.error('[ML-DATA] Failed to load training data:', err.message);
      return [];
    }
  }
}

export default new SelfLearner();
