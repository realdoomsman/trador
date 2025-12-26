import config from '../config.js';
import storage from './storage.js';
import gemini from './gemini.js';
import helius from './helius.js';
import analytics from './analytics.js';
import learner from './learner.js';
import alpha from './alpha.js';
import walletIntel from './walletIntel.js';
import multiAI from './multiAI.js';
import externalTools from './externalTools.js';
import socialIntel from './socialIntel.js';
import bondingCurve from './bondingCurve.js';
import pumpfunWS from './pumpfunWS.js';

class TradingBrain {
  constructor() {
    this.state = {
      confidence: 50, // Start at 50% - not 0
      dataPoints: 0,
      dataSizeBytes: 0,
      lastTrainingUpdate: null,
      patterns: null,
      isLearning: true,
      canVirtualTrade: true, // START ENABLED - learn by doing
      canLiveTrade: false,
      riskProfile: 'high', // Start aggressive to learn faster
      virtualTrades: [],
      pnl: { daily: 0, weekly: 0, monthly: 0, allTime: 0 },
      stats: {
        totalAnalyzed: 0,
        totalVirtualTrades: 0,
        virtualWins: 0,
        virtualLosses: 0,
        avgWinPercent: 0,
        avgLossPercent: 0,
        tokensTracked: 0,
        pumps: 0,
        dumps: 0,
        neutral: 0,
        // NEW: MFE/MAE stats
        avgMFE: 0,  // Average Maximum Favorable Excursion
        avgMAE: 0,  // Average Maximum Adverse Excursion
        pumpsCaughtByMFE: 0,
        missedPumps: 0
      },
      backtestResults: null,
      learnedPatterns: null
    };
    this.activeVirtualPositions = new Map();
    this.seenTokens = new Set();
    this.lastSeenClear = Date.now();
    this.dataBuffer = [];
    this.bufferFlushSize = 5; // Flush even more frequently
    
    // Price tracking with MFE/MAE - continuous monitoring
    this.trackedTokens = new Map();
    this.maxTrackedTokens = 300;
    
    // MFE/MAE thresholds
    this.MFE_PUMP_THRESHOLD = 15;  // 15% gain at any point = PUMP
    this.MAE_DUMP_THRESHOLD = -10; // 10% loss before pump = DUMP
    this.MAX_TRACK_TIME = 10 * 60 * 1000; // 10 minutes max tracking
    
    // Recent analyses for dashboard display
    this.recentAnalyses = [];
    this.maxRecentAnalyses = 100;
  }

  async initialize() {
    console.log('Initializing Trading Brain...');
    
    
    // Initialize self-learner
    await learner.initialize();
    
    // Initialize wallet intelligence
    await walletIntel.initialize();
    const walletStats = walletIntel.getStats();
    console.log(`Wallet Intel: ${walletStats.totalKnownWallets} wallets, ${walletStats.clusters} clusters`);
    
    // Initialize multi-AI engine
    const availableAIs = await multiAI.initialize();
    console.log(`Multi-AI: ${availableAIs.length} AI models available`);
    
    // Load alpha engine state
    const alphaState = await storage.loadAlphaState();
    if (alphaState) {
      alpha.fromJSON(alphaState);
      console.log(`Alpha engine loaded: ${alpha.marketRegime} regime, ${alpha.smartMoney.size} smart wallets`);
    }
    
    // Load saved state
    const savedState = await storage.loadModelState();
    if (savedState) {
      this.state = { ...this.state, ...savedState };
      // ALWAYS allow virtual trading to learn
      this.state.canVirtualTrade = true;
      console.log(`Loaded state: ${this.state.dataPoints} data points, ${this.state.confidence}% confidence`);
    }
    
    // Get current data size
    this.state.dataSizeBytes = await storage.getDataSize();
    this.state.dataPoints = await storage.getDataPointCount();
    
    // Load virtual trades for PnL calculation
    const virtualTrades = await storage.loadVirtualTrades(30);
    this.state.virtualTrades = virtualTrades;
    this.calculatePnL();
    
    // FIXED: Start with ability to trade
    this.state.canVirtualTrade = true;
    this.state.confidence = Math.max(50, this.state.confidence);
    
    console.log(`Brain initialized. Confidence: ${this.state.confidence}%, Can virtual trade: ${this.state.canVirtualTrade}`);
    console.log(`Learner accuracy: ${learner.performance.accuracy.toFixed(1)}% from ${learner.performance.totalPredictions} predictions`);
  }

  updateCapabilities() {
    // Determine what the AI can do based on data and confidence
    this.state.canVirtualTrade = 
      this.state.dataPoints >= config.minDataPointsForVirtualTrading &&
      this.state.confidence >= config.minConfidenceVirtual;
    
    this.state.canLiveTrade = 
      this.state.canVirtualTrade &&
      this.state.confidence >= config.minConfidenceLive &&
      this.state.stats.virtualWins > 10 &&
      (this.state.stats.virtualWins / Math.max(1, this.state.stats.totalVirtualTrades)) > 0.55;
  }

  setRiskProfile(profile) {
    if (['low', 'medium', 'high'].includes(profile)) {
      this.state.riskProfile = profile;
      this.saveState();
    }
  }

  getRiskConfig() {
    return config.riskProfiles[this.state.riskProfile];
  }

  // Collect data point for learning
  async collectDataPoint(tokenData, priceHistory, outcome = null) {
    const dataPoint = {
      timestamp: Date.now(),
      token: {
        mint: tokenData.mint,
        symbol: tokenData.symbol,
        name: tokenData.name,
        marketCap: tokenData.usd_market_cap,
        liquidity: tokenData.virtual_sol_reserves,
        holders: tokenData.holder_count,
        ageMinutes: (Date.now() - new Date(tokenData.created_timestamp).getTime()) / 60000
      },
      priceHistory,
      outcome, // null if still collecting, or { pnlPercent, holdTime, exitReason }
      marketContext: {
        solPrice: await helius.getSolPrice(),
        hour: new Date().getHours(),
        dayOfWeek: new Date().getDay()
      }
    };

    this.dataBuffer.push(dataPoint);
    this.state.totalAnalyzed++;

    // Flush buffer periodically
    if (this.dataBuffer.length >= this.bufferFlushSize) {
      await this.flushDataBuffer();
    }

    return dataPoint;
  }

  async flushDataBuffer() {
    if (this.dataBuffer.length === 0) return;
    
    await storage.saveBatch('market_data', this.dataBuffer);
    this.state.dataPoints += this.dataBuffer.length;
    this.dataBuffer = [];
    
    // Update data size
    this.state.dataSizeBytes = await storage.getDataSize();
    
    // Recalculate confidence
    await this.updateConfidence();
    this.saveState();
  }

  async updateConfidence() {
    // Base confidence from data quantity
    let confidence = Math.min(50, (this.state.dataPoints / config.minDataPointsForVirtualTrading) * 50);
    
    // Add confidence from virtual trading performance
    if (this.state.stats.totalVirtualTrades > 0) {
      const winRate = this.state.stats.virtualWins / this.state.stats.totalVirtualTrades;
      const performanceBonus = Math.min(30, winRate * 50);
      confidence += performanceBonus;
    }
    
    // Add confidence from pattern recognition
    if (this.state.patterns?.confidenceInPatterns) {
      confidence += Math.min(20, this.state.patterns.confidenceInPatterns * 0.2);
    }
    
    // Apply decay if no recent data
    const hoursSinceUpdate = (Date.now() - (this.state.lastTrainingUpdate || 0)) / 3600000;
    confidence *= Math.max(0.5, 1 - (hoursSinceUpdate * config.confidenceDecayRate));
    
    this.state.confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    this.state.lastTrainingUpdate = Date.now();
    this.updateCapabilities();
  }

  // Analyze a token for potential trade
  async analyzeToken(tokenData) {
    // Clear seen tokens cache every 30 minutes to allow re-analysis
    if (!this.lastSeenClear || Date.now() - this.lastSeenClear > 30 * 60 * 1000) {
      this.seenTokens.clear();
      this.lastSeenClear = Date.now();
      console.log('[CACHE] Cleared seen tokens cache - will re-analyze all tokens');
    }
    
    // Skip if already seen in this 30-min window
    if (this.seenTokens.has(tokenData.mint)) {
      return null;
    }
    this.seenTokens.add(tokenData.mint);

    const riskConfig = this.getRiskConfig();
    
    // Basic filters
    const marketCap = tokenData.usd_market_cap || 0;
    if (marketCap < riskConfig.minMarketCap || marketCap > riskConfig.maxMarketCap) {
      return null;
    }

    // Get additional data
    const [activity, solPrice] = await Promise.all([
      helius.analyzeTokenActivity(tokenData.mint, 1),
      helius.getSolPrice()
    ]);

    // Prepare data for Gemini
    const enrichedData = {
      ...tokenData,
      marketCap,
      holders: tokenData.holder_count,
      liquidity: tokenData.virtual_sol_reserves,
      ageMinutes: (Date.now() - new Date(tokenData.created_timestamp).getTime()) / 60000,
      txCount: activity.transactionCount,
      uniqueWallets: activity.uniqueWallets
    };

    const marketContext = {
      solPrice,
      sentiment: 'neutral',
      pumpfunActivity: 'normal'
    };

    // Get deep analysis for this token
    let deepAnalysis = null;
    try {
      deepAnalysis = await helius.getDeepTokenAnalysis(tokenData.mint);
    } catch (err) {
      // Continue without deep analysis
    }

    // Use advanced analytics engine
    const advancedAnalysis = await analytics.analyzeToken(enrichedData, deepAnalysis);
    
    // Get AI analysis (Gemini or rule-based)
    const geminiAnalysis = await gemini.analyzeToken(enrichedData, marketContext, this.state.patterns);
    
    // MULTI-AI CONSENSUS - Get opinions from multiple AI models
    let aiConsensus = null;
    try {
      aiConsensus = await multiAI.getConsensus(enrichedData, {
        walletRisk: null,
        hasDevRisk: false,
        hasClusterRisk: false
      });
    } catch (err) {
      // Continue without multi-AI
    }
    
    // EXTERNAL SECURITY CHECK - RugCheck, GoPlus, etc.
    let securityCheck = null;
    try {
      securityCheck = await externalTools.runSecurityCheck(tokenData.mint);
    } catch (err) {
      // Continue without security check
    }
    
    // SOCIAL INTELLIGENCE - Narrative, viral, hype analysis
    let socialAnalysis = null;
    try {
      socialAnalysis = await socialIntel.analyzeSocialSignals(enrichedData);
    } catch (err) {
      // Continue without social analysis
    }
    
    // Get alpha engine insights
    const momentumScore = alpha.calculateMomentumScore(enrichedData);
    const exitStrategy = alpha.selectExitStrategy(enrichedData, advancedAnalysis, alpha.marketRegime);
    const profitTargets = alpha.calculateProfitTargets(advancedAnalysis, alpha.marketRegime);
    const isOptimalTime = alpha.isOptimalTradingTime();
    
    // WALLET INTELLIGENCE - Analyze top holders
    let walletAnalysis = null;
    try {
      if (deepAnalysis?.holders?.topHolderAddresses) {
        const topHolders = deepAnalysis.holders.topHolderAddresses.map((addr, i) => ({
          address: addr,
          percentage: i === 0 ? deepAnalysis.holders.top1Percent : 
                     i < 5 ? deepAnalysis.holders.top5Percent / 5 : 
                     deepAnalysis.holders.top10Percent / 10
        }));
        walletAnalysis = await walletIntel.analyzeTokenHolders(tokenData.mint, topHolders);
      }
    } catch (err) {
      // Continue without wallet analysis
    }
    
    // Combine analyses - ensure flags is always an array
    // advancedAnalysis.flags is an object { red: [], yellow: [], green: [] }
    const flagsObj = advancedAnalysis.flags || { red: [], yellow: [], green: [] };
    const allFlags = [
      ...(flagsObj.red || []).map(f => `RED:${f}`),
      ...(flagsObj.yellow || []).map(f => `YELLOW:${f}`),
      ...(flagsObj.green || []).map(f => `GREEN:${f}`)
    ];
    
    const combinedAnalysis = {
      ...geminiAnalysis,
      advancedScore: advancedAnalysis.score,
      advancedRecommendation: advancedAnalysis.recommendation,
      multiTimeframe: advancedAnalysis.multiTimeframe,
      smartWalletBuying: advancedAnalysis.smartWalletBuying,
      dynamicExits: advancedAnalysis.exits,
      flags: [...allFlags], // Ensure flags is always a fresh array
      flagsObj: flagsObj,
      finalConfidence: advancedAnalysis.confidence,
      // Alpha engine additions
      momentumScore,
      exitStrategy,
      profitTargets,
      isOptimalTime: isOptimalTime.isOptimal,
      marketRegime: alpha.marketRegime,
      // Wallet intelligence
      walletAnalysis,
      walletRisk: walletAnalysis?.overallRisk || 50,
      hasDevRisk: walletAnalysis?.devWallets?.length > 0,
      hasSniperRisk: walletAnalysis?.sniperWallets?.length > 0,
      hasClusterRisk: walletAnalysis?.clusters?.hasCoordinatedHolding || false,
      smartWalletsHolding: walletAnalysis?.profitableWallets?.length || 0,
      walletSignals: walletAnalysis?.signals || [],
      // Multi-AI consensus
      aiConsensus: aiConsensus,
      aiAgreement: aiConsensus?.agreement || 0,
      aiSignal: aiConsensus?.consensus || 'HOLD',
      aiCount: aiConsensus?.aiCount || 0,
      // Security check
      securityCheck: securityCheck,
      securityRisk: securityCheck?.riskScore || 50,
      securityFlags: securityCheck?.flags || [],
      isSecure: securityCheck?.isSafe || false,
      // Social intelligence
      socialAnalysis: socialAnalysis,
      socialScore: socialAnalysis?.socialScore || 50,
      narrative: socialAnalysis?.narrative?.primaryNarrative || 'UNKNOWN',
      isHotNarrative: socialAnalysis?.narrative?.isHotNarrative || false,
      isViral: socialAnalysis?.viral?.isViral || false,
      viralPotential: socialAnalysis?.viral?.viralPotential || 50,
      isHyped: socialAnalysis?.hype?.isHyped || false,
      socialSignals: socialAnalysis?.signals || [],
      socialRisks: socialAnalysis?.risks || []
    };
    
    // NO HARDCODED PENALTIES - Let the learning system figure out what matters
    // Just add flags for tracking, don't adjust scores
    if (walletAnalysis) {
      if (walletAnalysis.overallRisk > 70) {
        if (Array.isArray(combinedAnalysis.flags)) combinedAnalysis.flags.push('HIGH_WALLET_RISK');
      }
      if (walletAnalysis.profitableWallets?.length > 2) {
        if (Array.isArray(combinedAnalysis.flags)) combinedAnalysis.flags.push('SMART_MONEY_HOLDING');
      }
      if (walletAnalysis.clusters?.hasCoordinatedHolding) {
        if (Array.isArray(combinedAnalysis.flags)) combinedAnalysis.flags.push('COORDINATED_HOLDING');
      }
    }
    
    if (socialAnalysis) {
      if (socialAnalysis.narrative?.isHotNarrative) {
        if (Array.isArray(combinedAnalysis.flags)) combinedAnalysis.flags.push('HOT_NARRATIVE');
      }
      if (socialAnalysis.viral?.isViral) {
        if (Array.isArray(combinedAnalysis.flags)) combinedAnalysis.flags.push('VIRAL');
      }
      if (socialAnalysis.viral?.isFading) {
        if (Array.isArray(combinedAnalysis.flags)) combinedAnalysis.flags.push('HYPE_FADING');
      }
      if (socialAnalysis.hype?.isPumpAndDump) {
        if (Array.isArray(combinedAnalysis.flags)) combinedAnalysis.flags.push('PUMP_AND_DUMP_PATTERN');
      }
    }
    
    if (aiConsensus && aiConsensus.aiCount >= 2) {
      if (aiConsensus.consensus === 'BUY' && aiConsensus.agreement >= 70) {
        if (Array.isArray(combinedAnalysis.flags)) combinedAnalysis.flags.push('AI_CONSENSUS_BUY');
      }
      if (aiConsensus.consensus === 'SELL' && aiConsensus.agreement >= 70) {
        if (Array.isArray(combinedAnalysis.flags)) combinedAnalysis.flags.push('AI_CONSENSUS_SELL');
      }
    }
    
    if (securityCheck) {
      if (securityCheck.riskScore > 70) {
        if (Array.isArray(combinedAnalysis.flags)) combinedAnalysis.flags.push('SECURITY_RISK');
      }
      if (securityCheck.isSafe) {
        if (Array.isArray(combinedAnalysis.flags)) combinedAnalysis.flags.push('SECURITY_PASSED');
      }
    }
    
    // Collect data point for learning
    await this.collectDataPoint(tokenData, null, null);
    
    // Track this token to learn outcome later (with deep analysis)
    await this.trackToken(enrichedData, combinedAnalysis);

    // Build signals for learner
    const tokenSignals = { marketCap: enrichedData.usd_market_cap, liquidity: enrichedData.virtual_sol_reserves, buyPressure: enrichedData.buyPressure || 50, holders: enrichedData.holders, priceChange1h: enrichedData.priceChange1h || 0 };
    const shouldTrade = this.shouldTradeAdvanced(combinedAnalysis, tokenSignals);
    const learnerScore = learner.calculateWeightedScore(tokenSignals);
    const aiVotes = aiConsensus ? `${aiConsensus.votes?.buy || 0}B/${aiConsensus.votes?.sell || 0}S/${aiConsensus.votes?.hold || 0}H` : 'N/A';
    const topFlags = combinedAnalysis.flags?.slice(0, 3).join(', ') || 'none';
    
    console.log(`[ANALYZE] ${enrichedData.symbol} | $${(marketCap/1000).toFixed(0)}k | Score: ${combinedAnalysis.advancedScore || 0} | AI: ${aiVotes} | ${combinedAnalysis.advancedRecommendation || 'HOLD'} | ${shouldTrade ? 'TRADE' : 'SKIP'} | Flags: ${topFlags}`);


    // Store for dashboard display
    this.recentAnalyses.unshift({
      timestamp: Date.now(),
      symbol: enrichedData.symbol,
      name: enrichedData.name,
      mint: enrichedData.mint,
      marketCap,
      score: combinedAnalysis.advancedScore || 0,
      recommendation: combinedAnalysis.advancedRecommendation || "HOLD",
      shouldTrade,
      aiVotes: aiConsensus?.votes || { buy: 0, sell: 0, hold: 0 },
      aiConsensus: aiConsensus?.consensus || "HOLD",
      aiAgreement: aiConsensus?.agreement || 0,
      flags: combinedAnalysis.flags?.slice(0, 5) || [],
      holders: enrichedData.holders || 0,
      liquidity: enrichedData.liquidity || 0,
      priceChange24h: enrichedData.priceChange24h || 0,
      isPumpFun: tokenData.isPumpFun || false,
      source: tokenData.source || 'unknown'
    });
    if (this.recentAnalyses.length > this.maxRecentAnalyses) {
      this.recentAnalyses = this.recentAnalyses.slice(0, this.maxRecentAnalyses);
    }
    return {
      token: enrichedData,
      analysis: combinedAnalysis,
      shouldTrade
    };
  }

  shouldTradeAdvanced(analysis, tokenSignals = null) {
    if (!analysis) return false;
    
    // CRITICAL: Use learner's prediction if we have enough data
    if (tokenSignals && learner.performance.totalPredictions >= 20) {
      const learnerPredicts = learner.predictPump(tokenSignals);
      const learnerScore = learner.calculateWeightedScore(tokenSignals);
      
      // If learner is confident (high score), trust it
      if (learnerScore >= 70 && learnerPredicts) {
        console.log(`[LEARNER] Predicts PUMP with score ${learnerScore.toFixed(0)}`);
        return true;
      }
      if (learnerScore <= 30) {
        console.log(`[LEARNER] Predicts DUMP with score ${learnerScore.toFixed(0)}`);
        return false;
      }
    }
    
    // Fallback to analysis-based decision
    const score = analysis.advancedScore || analysis.confidence || 50;
    const rec = analysis.advancedRecommendation || analysis.recommendation;
    
    // Simple rules - don't overthink it
    if (rec === 'AVOID') return false;
    if (rec === 'STRONG_BUY') return true;
    if (rec === 'BUY' && score >= 55) return true;
    
    // AI consensus as tiebreaker
    if (analysis.aiSignal === 'BUY' && analysis.aiAgreement >= 60) return true;
    if (analysis.aiSignal === 'SELL' && analysis.aiAgreement >= 60) return false;
    
    return score >= 60;
  }

  shouldTrade(analysis, tokenSignals = null) {
    return this.shouldTradeAdvanced(analysis, tokenSignals);
  }

  // Execute virtual trade with dynamic exits
  async executeVirtualTrade(tokenData, analysis) {
    if (!this.state.canVirtualTrade) {
      console.log('Cannot virtual trade yet - insufficient learning');
      return null;
    }

    const riskConfig = this.getRiskConfig();
    const currentPrice = tokenData.price || (tokenData.usd_market_cap / 1e9);
    
    // Use Kelly criterion for position sizing
    const winRate = this.state.stats.totalVirtualTrades > 10 
      ? this.state.stats.virtualWins / this.state.stats.totalVirtualTrades 
      : 0.5;
    const avgWin = this.state.stats.avgWinPercent || 20;
    const avgLoss = this.state.stats.avgLossPercent || 10;
    const kellySize = alpha.calculateOptimalPositionSize(winRate, avgWin, avgLoss, this.state.confidence);
    
    // Use alpha's dynamic profit targets
    const targets = alpha.calculateProfitTargets(analysis, alpha.marketRegime);
    
    const trade = {
      id: `vt_${Date.now()}_${tokenData.mint.slice(0, 8)}`,
      type: 'virtual',
      mint: tokenData.mint,
      symbol: tokenData.symbol,
      entryPrice: currentPrice,
      entryMarketCap: tokenData.usd_market_cap,
      entryTime: Date.now(),
      positionSize: Math.min(kellySize, riskConfig.maxPositionSize),
      stopLoss: currentPrice * (1 - targets.stopLoss),
      takeProfit: currentPrice * (1 + targets.takeProfit),
      trailingActivation: currentPrice * (1 + targets.trailingActivation),
      trailingDistance: targets.trailingDistance,
      strategy: targets.strategy,
      analysis: analysis,
      status: 'open',
      marketRegime: alpha.marketRegime
    };

    this.activeVirtualPositions.set(trade.id, trade);
    this.state.stats.totalVirtualTrades++;
    
    console.log(`Virtual trade: ${trade.symbol} | Strategy: ${targets.strategy} | Size: ${(kellySize * 100).toFixed(1)}%`);
    
    return trade;
  }

  // Update virtual positions
  async updateVirtualPositions() {
    for (const [id, position] of this.activeVirtualPositions) {
      try {
        const tokenData = await helius.getPumpFunToken(position.mint);
        if (!tokenData) continue;

        const currentPrice = tokenData.price || (tokenData.usd_market_cap / 1e9);
        const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
        
        // Check exit conditions
        let shouldExit = false;
        let exitReason = '';

        if (currentPrice <= position.stopLoss) {
          shouldExit = true;
          exitReason = 'stop_loss';
        } else if (currentPrice >= position.takeProfit) {
          shouldExit = true;
          exitReason = 'take_profit';
        } else if (Date.now() - position.entryTime > 24 * 60 * 60 * 1000) {
          shouldExit = true;
          exitReason = 'time_limit';
        }

        if (shouldExit) {
          await this.closeVirtualPosition(id, currentPrice, exitReason);
        }
      } catch (err) {
        console.error(`Error updating position ${id}:`, err.message);
      }
    }
  }

  async closeVirtualPosition(id, exitPrice, exitReason) {
    const position = this.activeVirtualPositions.get(id);
    if (!position) return;

    const pnlPercent = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
    const holdTimeMinutes = (Date.now() - position.entryTime) / 60000;

    const closedTrade = {
      ...position,
      exitPrice,
      exitTime: Date.now(),
      exitReason,
      pnlPercent,
      holdTimeMinutes,
      status: 'closed'
    };

    // Update stats
    if (pnlPercent > 0) {
      this.state.stats.virtualWins++;
      this.state.stats.avgWinPercent = 
        (this.state.stats.avgWinPercent * (this.state.stats.virtualWins - 1) + pnlPercent) / this.state.stats.virtualWins;
    } else {
      this.state.stats.virtualLosses++;
      this.state.stats.avgLossPercent = 
        (this.state.stats.avgLossPercent * (this.state.stats.virtualLosses - 1) + Math.abs(pnlPercent)) / Math.max(1, this.state.stats.virtualLosses);
    }

    // Save trade
    await storage.saveVirtualTrade(closedTrade);
    this.state.virtualTrades.push(closedTrade);
    
    // Learn from trade
    const evaluation = await gemini.evaluateTrade({
      symbol: position.symbol,
      entryPrice: position.entryPrice,
      exitPrice,
      pnlPercent,
      holdTimeMinutes,
      entryMarketCap: position.entryMarketCap,
      exitMarketCap: exitPrice * 1e9,
      entryReasoning: position.analysis?.reasoning
    });

    if (evaluation) {
      await this.collectDataPoint(position, null, { pnlPercent, holdTimeMinutes, exitReason, evaluation });
    }

    this.activeVirtualPositions.delete(id);
    this.calculatePnL();
    this.updateCapabilities();
    this.saveState();

    console.log(`Virtual trade closed: ${position.symbol} | PnL: ${pnlPercent.toFixed(2)}% | Reason: ${exitReason}`);
    
    return closedTrade;
  }

  calculatePnL() {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const closedTrades = this.state.virtualTrades.filter(t => t.status === 'closed');
    
    this.state.pnl = {
      daily: closedTrades.filter(t => t.exitTime > dayAgo).reduce((sum, t) => sum + t.pnlPercent, 0),
      weekly: closedTrades.filter(t => t.exitTime > weekAgo).reduce((sum, t) => sum + t.pnlPercent, 0),
      monthly: closedTrades.filter(t => t.exitTime > monthAgo).reduce((sum, t) => sum + t.pnlPercent, 0),
      allTime: closedTrades.reduce((sum, t) => sum + t.pnlPercent, 0)
    };
  }

  // Periodic pattern analysis
  async analyzePatterns() {
    console.log('Running pattern analysis...');
    const trainingData = await storage.loadTrainingData('market_data', 500);
    
    if (trainingData.length < 100) {
      console.log('Not enough data for pattern analysis');
      return;
    }

    const patterns = await gemini.analyzePatterns(trainingData);
    if (patterns) {
      this.state.patterns = patterns;
      await this.updateConfidence();
      this.saveState();
      console.log('Pattern analysis complete. Confidence in patterns:', patterns.confidenceInPatterns);
    }
  }

  async saveState() {
    await storage.saveModelState({
      confidence: this.state.confidence,
      dataPoints: this.state.dataPoints,
      dataSizeBytes: this.state.dataSizeBytes,
      lastTrainingUpdate: this.state.lastTrainingUpdate,
      patterns: this.state.patterns,
      riskProfile: this.state.riskProfile,
      stats: this.state.stats,
      pnl: this.state.pnl
    });
    
    // Save alpha engine state
    await storage.saveAlphaState(alpha.toJSON());
  }

  getStatus() {
    const dataSizeMB = this.state.dataSizeBytes / (1024 * 1024);
    const dataSizeFormatted = dataSizeMB > 1024 
      ? `${(dataSizeMB / 1024).toFixed(2)} GB` 
      : `${dataSizeMB.toFixed(2)} MB`;

    const learnerStrategy = learner.getStrategy();
    const alphaStatus = alpha.getStatus();
    const portfolioHeat = alpha.calculatePortfolioHeat(
      Array.from(this.activeVirtualPositions.values()), 
      10000 // Assume $10k virtual capital
    );
    const walletStats = walletIntel.getStats();

    return {
      confidence: this.state.confidence,
      dataPoints: this.state.dataPoints,
      dataSize: dataSizeFormatted,
      dataSizeBytes: this.state.dataSizeBytes,
      isLearning: this.state.isLearning,
      canVirtualTrade: this.state.canVirtualTrade,
      canLiveTrade: this.state.canLiveTrade,
      riskProfile: this.state.riskProfile,
      activePositions: this.activeVirtualPositions.size,
      pnl: this.state.pnl,
      stats: this.state.stats,
      trackedTokens: this.trackedTokens.size,
      // Self-learning AI stats
      aiAccuracy: learnerStrategy.performance.accuracy,
      aiPredictions: learnerStrategy.performance.totalPredictions,
      topSignals: learnerStrategy.topSignals,
      aiRecommendation: learnerStrategy.recommendation,
      // Alpha engine stats
      marketRegime: alphaStatus.marketRegime,
      regimeRecommendation: alphaStatus.regimeRecommendation,
      portfolioHeat: portfolioHeat,
      smartMoneyTracked: alphaStatus.smartMoneyCount,
      isOptimalTime: alphaStatus.isOptimalTime,
      bestTradingTimes: alphaStatus.optimalTimes,
      // Wallet intelligence stats
      walletIntel: walletStats,
      knownWallets: walletStats.totalKnownWallets,
      trackedClusters: walletStats.clusters,
      ruggerWallets: walletStats.ruggerWallets,
      profitableWalletsTracked: walletStats.profitableWallets,
      // Multi-AI stats
      multiAI: multiAI.getStatus(),
      availableAIs: multiAI.getStatus().availableAIs,
      aiModelsCount: multiAI.getStatus().aiCount,
      // Social intelligence stats
      socialIntel: socialIntel.getStatus(),
      hotNarratives: socialIntel.getStatus().hotNarratives,
      viralTokens: socialIntel.getStatus().viralTokensCount,
      patterns: this.state.patterns ? {
        hasPatterns: true,
        confidenceInPatterns: this.state.patterns.confidenceInPatterns
      } : null
    };
  }

  // Track a token to learn its outcome - WITH DEEP ANALYSIS
  async trackToken(tokenData, analysis) {
    if (this.trackedTokens.size >= this.maxTrackedTokens) {
      // Remove oldest tracked token
      const oldest = [...this.trackedTokens.entries()].sort((a, b) => a[1].entryTime - b[1].entryTime)[0];
      if (oldest) this.trackedTokens.delete(oldest[0]);
    }

    // Get accurate entry price - this is critical for outcome learning
    let price = tokenData.price;
    
    // If no price from token data, fetch it
    if (!price || price <= 0) {
      const priceData = await this.getTokenPrice(tokenData.mint);
      price = priceData?.price || 0;
    }
    
    if (price <= 0) {
      console.log(`[TRACK] Skipping ${tokenData.symbol} - no valid price`);
      return;
    }
    
    console.log(`[TRACK] ${tokenData.symbol} at $${price.toFixed(8)} (mcap: $${(tokenData.usd_market_cap/1000).toFixed(0)}k)`);

    // Get deep on-chain analysis (holder distribution, security, etc)
    let deepAnalysis = null;
    let recentTrades = null;
    let tokenOverview = null;
    
    try {
      // Run deep analysis in parallel
      const [deep, trades, overview] = await Promise.all([
        helius.getDeepTokenAnalysis(tokenData.mint),
        helius.getBirdeyeRecentTrades(tokenData.mint, 30),
        helius.getBirdeyeTokenOverview(tokenData.mint)
      ]);
      deepAnalysis = deep;
      recentTrades = trades;
      tokenOverview = overview;
    } catch (err) {
      // Continue without deep analysis
    }

    this.trackedTokens.set(tokenData.mint, {
      mint: tokenData.mint,
      symbol: tokenData.symbol,
      name: tokenData.name,
      entryPrice: price,
      entryMarketCap: tokenData.usd_market_cap,
      entryTime: Date.now(),
      analysis: analysis,
      // Store ALL token data for learning
      tokenData: {
        // Basic info
        mint: tokenData.mint,
        symbol: tokenData.symbol,
        name: tokenData.name,
        // Price metrics
        price: tokenData.price,
        priceChange30m: tokenData.priceChange30m || 0,
        priceChange1h: tokenData.priceChange1h || 0,
        priceChange4h: tokenData.priceChange4h || 0,
        priceChange24h: tokenData.priceChange24h || 0,
        // Market metrics
        marketCap: tokenData.usd_market_cap || 0,
        fdv: tokenData.fdv || 0,
        liquidity: tokenData.virtual_sol_reserves || 0,
        // Volume metrics
        volume30m: tokenData.volume30m || 0,
        volume1h: tokenData.volume1h || 0,
        volume4h: tokenData.volume4h || 0,
        volume24h: tokenData.volume24h || 0,
        // Trading activity
        txns24h: tokenData.txns24h || 0,
        buys24h: tokenData.buys24h || 0,
        sells24h: tokenData.sells24h || 0,
        buyVolume24h: tokenData.buyVolume24h || 0,
        sellVolume24h: tokenData.sellVolume24h || 0,
        // Holder metrics
        holders: tokenData.holder_count || 0,
        uniqueWallets24h: tokenData.uniqueWallet24h || 0,
        // Supply
        supply: tokenData.supply || 0,
        circulatingSupply: tokenData.circulatingSupply || 0,
        // Calculated signals
        buyPressure: tokenData.buyPressure || 50,
        volumeToMcap: tokenData.volumeToMcap || 0,
        // Time context
        hour: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        timestamp: Date.now()
      },
      // DEEP ON-CHAIN DATA
      holderAnalysis: deepAnalysis?.holders || null,
      securityAnalysis: deepAnalysis?.security || null,
      recentTrades: recentTrades || null,
      tokenOverview: tokenOverview || null
    });
    
    this.state.stats.tokensTracked++;
  }

  // UPDATE TRACKED PRICES - Called every 5s for MFE/MAE tracking
  async updateTrackedPrices() {
    const now = Date.now();
    const batchSize = 15; // Update 15 tokens at a time
    const tokens = [...this.trackedTokens.values()]
      .filter(t => !t.outcomeDecided && (now - (t.lastPriceUpdate || 0)) > 4000)
      .slice(0, batchSize);
    
    if (tokens.length === 0) return;
    
    for (const tracked of tokens) {
      try {
        const priceData = await this.getTokenPrice(tracked.mint);
        if (!priceData?.price || priceData.price <= 0) continue;
        
        const currentPrice = priceData.price;
        const pnlPercent = ((currentPrice - tracked.entryPrice) / tracked.entryPrice) * 100;
        
        // Initialize MFE/MAE if not set
        if (!tracked.highestPrice) tracked.highestPrice = tracked.entryPrice;
        if (!tracked.lowestPrice) tracked.lowestPrice = tracked.entryPrice;
        if (!tracked.mfePercent) tracked.mfePercent = 0;
        if (!tracked.maePercent) tracked.maePercent = 0;
        
        // Update MFE (highest price seen)
        if (currentPrice > tracked.highestPrice) {
          tracked.highestPrice = currentPrice;
          tracked.highestPriceTime = now;
          tracked.mfePercent = ((currentPrice - tracked.entryPrice) / tracked.entryPrice) * 100;
        }
        
        // Update MAE (lowest price seen)
        if (currentPrice < tracked.lowestPrice) {
          tracked.lowestPrice = currentPrice;
          tracked.lowestPriceTime = now;
          tracked.maePercent = ((currentPrice - tracked.entryPrice) / tracked.entryPrice) * 100;
        }
        
        tracked.lastPriceUpdate = now;
        tracked.currentPrice = currentPrice;
        tracked.currentPnl = pnlPercent;
        
        // CHECK FOR EARLY OUTCOME DECISION
        // If MFE >= 15%, it's a PUMP (even if it retraces later)
        if (tracked.mfePercent >= this.MFE_PUMP_THRESHOLD && !tracked.outcomeDecided) {
          tracked.outcomeDecided = true;
          tracked.outcome = 'pump';
          console.log(`[MFE-PUMP] ${tracked.symbol} hit +${tracked.mfePercent.toFixed(1)}%! Marking as PUMP`);
        }
        
        // If MAE <= -10% before hitting pump threshold, it's a DUMP
        if (tracked.maePercent <= this.MAE_DUMP_THRESHOLD && tracked.mfePercent < this.MFE_PUMP_THRESHOLD && !tracked.outcomeDecided) {
          tracked.outcomeDecided = true;
          tracked.outcome = 'dump';
          console.log(`[MAE-DUMP] ${tracked.symbol} hit ${tracked.maePercent.toFixed(1)}%! Marking as DUMP`);
        }
        
      } catch (err) {
        // Skip this token
      }
    }
  }

  // Check tracked tokens and learn from outcomes - MFE/MAE BASED
  async checkTrackedOutcomes() {
    const now = Date.now();
    const toRemove = [];
    const readyCount = [...this.trackedTokens.values()].filter(t => now - t.entryTime >= this.trackDuration).length;
    
    if (readyCount > 0) {
      console.log(`[OUTCOME] Checking ${readyCount} tokens ready for outcome learning...`);
    }
    
    for (const [mint, tracked] of this.trackedTokens) {
      // Check if tracking period is over
      if (now - tracked.entryTime < this.trackDuration) continue;
      
      try {
        // Get current price from multiple sources
        const currentData = await this.getTokenPrice(mint);
        
        // Debug: Log price fetch results
        if (!currentData || !currentData.price) {
          console.log(`[OUTCOME] No price for ${tracked.symbol} - entry was $${tracked.entryPrice?.toFixed(8) || 'N/A'}`);
          toRemove.push(mint);
          continue;
        }
        
        // Validate entry price
        if (!tracked.entryPrice || tracked.entryPrice <= 0) {
          console.log(`[OUTCOME] Invalid entry price for ${tracked.symbol}: ${tracked.entryPrice}`);
          toRemove.push(mint);
          continue;
        }

        const pnlPercent = ((currentData.price - tracked.entryPrice) / tracked.entryPrice) * 100;
        
        // Debug: Log price comparison
        console.log(`[OUTCOME] ${tracked.symbol}: $${tracked.entryPrice.toFixed(8)} -> $${currentData.price.toFixed(8)} = ${pnlPercent.toFixed(1)}% (${currentData.source})`);
        
        // Classify outcome - 20% threshold for pump/dump
        let outcome;
        if (pnlPercent >= 15) {
          outcome = 'pump';
          this.state.stats.pumps++;
        } else if (pnlPercent <= -15) {
          outcome = 'dump';
          this.state.stats.dumps++;
        } else {
          outcome = 'neutral';
          this.state.stats.neutral++;
        }

        // Save learning data with outcome - SUPER DETAILED
        const learningData = {
          timestamp: Date.now(),
          token: tracked.tokenData,
          entryPrice: tracked.entryPrice,
          exitPrice: currentData.price,
          pnlPercent,
          outcome,
          holdTimeMinutes: (now - tracked.entryTime) / 60000,
          analysis: tracked.analysis,
          
          // PRICE & MOMENTUM SIGNALS
          priceSignals: {
            priceChange30m: tracked.tokenData.priceChange30m,
            priceChange1h: tracked.tokenData.priceChange1h,
            priceChange4h: tracked.tokenData.priceChange4h,
            priceChange24h: tracked.tokenData.priceChange24h
          },
          
          // MARKET SIZE SIGNALS
          marketSignals: {
            marketCap: tracked.tokenData.marketCap,
            fdv: tracked.tokenData.fdv,
            liquidity: tracked.tokenData.liquidity,
            mcapToLiquidity: tracked.tokenData.liquidity > 0 ? tracked.tokenData.marketCap / tracked.tokenData.liquidity : 0
          },
          
          // VOLUME SIGNALS
          volumeSignals: {
            volume30m: tracked.tokenData.volume30m,
            volume1h: tracked.tokenData.volume1h,
            volume24h: tracked.tokenData.volume24h,
            volumeToMcap: tracked.tokenData.volumeToMcap
          },
          
          // TRADING PRESSURE SIGNALS
          tradingSignals: {
            buys24h: tracked.tokenData.buys24h,
            sells24h: tracked.tokenData.sells24h,
            buyPressure: tracked.tokenData.buyPressure,
            txns24h: tracked.tokenData.txns24h,
            buyToSellRatio: tracked.tokenData.sells24h > 0 ? tracked.tokenData.buys24h / tracked.tokenData.sells24h : 1
          },
          
          // HOLDER SIGNALS
          holderSignals: {
            holders: tracked.tokenData.holders,
            uniqueWallets24h: tracked.tokenData.uniqueWallets24h,
            // Deep holder analysis
            top1Percent: tracked.holderAnalysis?.top1Percent || null,
            top5Percent: tracked.holderAnalysis?.top5Percent || null,
            top10Percent: tracked.holderAnalysis?.top10Percent || null,
            whaleCount: tracked.holderAnalysis?.whaleCount || null,
            whalePercent: tracked.holderAnalysis?.whalePercent || null,
            distributionScore: tracked.holderAnalysis?.distributionScore || null,
            isHighlyConcentrated: tracked.holderAnalysis?.isHighlyConcentrated || null,
            hasWhaleRisk: tracked.holderAnalysis?.hasWhaleRisk || null
          },
          
          // SECURITY SIGNALS
          securitySignals: {
            isMintable: tracked.securityAnalysis?.isMintable || null,
            isFreezable: tracked.securityAnalysis?.isFreezable || null,
            hasMintRisk: tracked.securityAnalysis?.hasMintRisk || null,
            hasFreezeRisk: tracked.securityAnalysis?.hasFreezeRisk || null,
            creatorPercentage: tracked.securityAnalysis?.creatorPercentage || null,
            ownerPercentage: tracked.securityAnalysis?.ownerPercentage || null,
            lpBurnedPercent: tracked.securityAnalysis?.lpBurnedPercent || null,
            isLpBurned: tracked.securityAnalysis?.isLpBurned || null,
            mutableMetadata: tracked.securityAnalysis?.mutableMetadata || null
          },
          
          // RECENT TRADE SIGNALS
          recentTradeSignals: {
            buyCount: tracked.recentTrades?.buyCount || null,
            sellCount: tracked.recentTrades?.sellCount || null,
            buyRatio: tracked.recentTrades?.buyRatio || null,
            avgBuySize: tracked.recentTrades?.avgBuySize || null,
            avgSellSize: tracked.recentTrades?.avgSellSize || null,
            whaleBuys: tracked.recentTrades?.whaleBuys || null,
            whaleSells: tracked.recentTrades?.whaleSells || null,
            uniqueBuyers: tracked.recentTrades?.uniqueBuyers || null,
            uniqueSellers: tracked.recentTrades?.uniqueSellers || null,
            isBuyHeavy: tracked.recentTrades?.isBuyHeavy || null,
            isSellHeavy: tracked.recentTrades?.isSellHeavy || null,
            hasWhaleInterest: tracked.recentTrades?.hasWhaleInterest || null
          },
          
          // TIME CONTEXT
          timeSignals: {
            hour: tracked.tokenData.hour,
            dayOfWeek: tracked.tokenData.dayOfWeek,
            isWeekend: tracked.tokenData.dayOfWeek === 0 || tracked.tokenData.dayOfWeek === 6,
            isUSMarketHours: tracked.tokenData.hour >= 13 && tracked.tokenData.hour <= 21,
            isAsiaHours: tracked.tokenData.hour >= 0 && tracked.tokenData.hour <= 8
          }
        };

        this.dataBuffer.push(learningData);
        
        // SELF-LEARNING: Teach the AI from this outcome
        const flatSignals = learner.flattenSignals(learningData);
        await learner.learnFromOutcome(flatSignals, outcome, pnlPercent);
        await storage.saveOutcome({ signals: flatSignals, outcome, pnlPercent, timestamp: Date.now() });
        
        if (outcome === 'pump') {
          console.log(`LEARNED: ${tracked.symbol} pumped ${pnlPercent.toFixed(1)}% | AI accuracy: ${learner.performance.accuracy.toFixed(1)}%`);
        } else if (outcome === 'dump') {
          console.log(`LEARNED: ${tracked.symbol} dumped ${pnlPercent.toFixed(1)}% | AI accuracy: ${learner.performance.accuracy.toFixed(1)}%`);
        }

        toRemove.push(mint);
      } catch (err) {
        toRemove.push(mint);
      }
    }

    // Clean up
    toRemove.forEach(mint => this.trackedTokens.delete(mint));
    
    // Auto-optimize every 50 outcomes
    if (this.state.stats.pumps + this.state.stats.dumps > 0 && 
        (this.state.stats.pumps + this.state.stats.dumps) % 50 === 0) {
      const recentOutcomes = await storage.loadRecentOutcomes(100);
      await learner.autoOptimize(recentOutcomes);
    }
    
    // Flush if we have enough data
    if (this.dataBuffer.length >= 20) {
      await this.flushDataBuffer();
    }
  }

  // Get token price from multiple sources
  async getTokenPrice(mint) {
    // Try Birdeye first
    try {
      const res = await fetch(`https://public-api.birdeye.so/defi/price?address=${mint}`, {
        headers: {
          'X-API-KEY': config.birdeyeApiKey,
          'x-chain': 'solana'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data?.value && data.data.value > 0) {
          return { price: data.data.value, source: 'birdeye' };
        }
      }
    } catch (err) {
      // Try fallback
    }
    
    // Fallback to Jupiter
    try {
      const res = await fetch(`https://price.jup.ag/v6/price?ids=${mint}`);
      if (res.ok) {
        const data = await res.json();
        if (data.data?.[mint]?.price && data.data[mint].price > 0) {
          return { price: data.data[mint].price, source: 'jupiter' };
        }
      }
    } catch (err) {
      // Try DexScreener
    }
    
    // Fallback to DexScreener
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      if (res.ok) {
        const data = await res.json();
        if (data.pairs?.[0]?.priceUsd) {
          return { price: parseFloat(data.pairs[0].priceUsd), source: 'dexscreener' };
        }
      }
    } catch (err) {
      // All failed
    }
    
    return null;
  }

  // Run pattern analysis using analytics engine
  async runPatternAnalysis() {
    console.log('Running advanced pattern analysis...');
    const trainingData = await storage.loadTrainingData('market_data', 1000);
    
    if (trainingData.length < 50) {
      console.log('Not enough data for pattern analysis');
      return null;
    }

    const patterns = await analytics.analyzePatterns(trainingData);
    if (patterns) {
      this.state.learnedPatterns = patterns;
      console.log(`Pattern analysis complete. Found ${patterns.winningCombos?.length || 0} winning combos`);
      
      // Run backtest
      const backtest = await analytics.runBacktest({ minScore: 60 }, trainingData);
      this.state.backtestResults = backtest;
      console.log(`Backtest: ${backtest.totalTrades} trades, ${(backtest.winRate * 100).toFixed(1)}% win rate, ${backtest.returnPercent?.toFixed(1)}% return`);
      
      this.saveState();
    }
    
    return patterns;
  }

  // Run backtest with custom strategy
  async runBacktest(strategy = { minScore: 60 }) {
    const trainingData = await storage.loadTrainingData('market_data', 500);
    return analytics.runBacktest(strategy, trainingData);
  }
}

export default new TradingBrain();
