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
    this.maxTrackedTokens = config.maxTrackedTokens || 800;
    
    // MFE/MAE thresholds from config
    this.MFE_PUMP_THRESHOLD = config.mfePumpThreshold || 15;  // 15% gain at any point = PUMP
    this.MAE_DUMP_THRESHOLD = config.maeDumpThreshold || -10; // 10% loss before pump = DUMP
    this.MICRO_PUMP_THRESHOLD = config.microPumpThreshold || 5; // 5-10% = micro-pump
    this.MAX_TRACK_TIME = (config.maxTrackTimeMinutes || 10) * 60 * 1000; // Max tracking time
    
    // Multi-window outcome checking (3, 5, 10 minutes)
    this.outcomeWindows = config.outcomeWindows || [3, 5, 10];
    
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

    // SNIPER & BUNDLE DETECTION - For pump.fun tokens, analyze first-block buyers
    // This detects coordinated launches (bundles) which have high pump potential but extreme dump risk
    const isPumpFun = tokenData.isPumpFun || tokenData.source === 'pumpfun' || tokenData.bonding_curve;
    
    if (isPumpFun) {
      try {
        // Get sniper analysis
        const sniperAnalysis = await helius.getSniperAnalysis(tokenData.mint);
        if (sniperAnalysis?.analyzed) {
          enrichedData.sniperCount = sniperAnalysis.sniperCount;
          enrichedData.isBundled = sniperAnalysis.isBundled;
          enrichedData.isHighSniperCount = sniperAnalysis.isHighSniperCount;
          enrichedData.bundleRisk = sniperAnalysis.bundleRisk;
          enrichedData.sniperConcentration = sniperAnalysis.sniperConcentration;
        }
        
        // Get high-edge early signals for sub-2min tokens
        if (enrichedData.ageMinutes < 2) {
          const earlySignals = await helius.getEarlySignals(tokenData.mint, enrichedData.ageMinutes);
          if (earlySignals?.analyzed) {
            enrichedData.txnsPerMinute = earlySignals.txnsPerMinute;
            enrichedData.uniqueBuysPerMinute = earlySignals.uniqueBuysPerMinute;
            enrichedData.uniqueBuyerGrowthRate = earlySignals.uniqueBuyerGrowthRate;
            enrichedData.avgBuySizeSol = earlySignals.avgBuySizeSol;
            enrichedData.avgBuySizeTrend = earlySignals.avgBuySizeTrend;
            enrichedData.creatorBoughtEarly = earlySignals.creatorBoughtEarly;
            enrichedData.creatorSoldEarly = earlySignals.creatorSoldEarly;
          }
        }
      } catch (err) {
        // Continue without sniper/early analysis
      }
    }
    
    // FAST ENTRY CHECK - For early pump.fun tokens (< 2 min old)
    // Skip AI consensus entirely to avoid latency
    const fastEntryResult = isPumpFun ? this.passesFastEntryFilter(enrichedData, deepAnalysis) : { pass: false };
    
    if (fastEntryResult.pass) {
      // FAST PATH - No AI, just track and trade immediately
      const fastAnalysis = {
        advancedScore: 75, // Default high score for fast entry
        advancedRecommendation: 'BUY',
        confidence: 70,
        fastEntryApproved: true,
        fastEntrySignals: fastEntryResult.signals,
        velocityAnalysis: fastEntryResult.velocityAnalysis,
        flags: ['FAST_ENTRY', 'EARLY_PUMPFUN'],
        flagsObj: { red: [], yellow: [], green: ['FAST_ENTRY'] },
        // No AI consensus for fast entry
        aiConsensus: null,
        aiAgreement: 0,
        aiSignal: 'SKIP',
        aiCount: 0
      };
      
      // Collect data point for learning
      await this.collectDataPoint(tokenData, null, null);
      
      // Track with early signals
      enrichedData.buyersPerMinute = fastEntryResult.signals.buyersPerMinute;
      enrichedData.bondingCurveVelocity = fastEntryResult.signals.bondingCurveVelocity;
      enrichedData.bondingCurveProgress = fastEntryResult.signals.bondingCurveProgress;
      await this.trackToken(enrichedData, fastAnalysis);
      
      // Store for dashboard
      this.recentAnalyses.unshift({
        timestamp: Date.now(),
        symbol: enrichedData.symbol,
        name: enrichedData.name,
        mint: enrichedData.mint,
        marketCap,
        score: 75,
        recommendation: 'FAST_ENTRY',
        shouldTrade: true,
        aiVotes: { buy: 0, sell: 0, hold: 0 },
        aiConsensus: 'SKIP',
        aiAgreement: 0,
        flags: ['FAST_ENTRY', 'EARLY_PUMPFUN'],
        holders: enrichedData.holders || 0,
        liquidity: enrichedData.liquidity || 0,
        priceChange24h: enrichedData.priceChange24h || 0,
        isPumpFun: true,
        source: 'fast_entry'
      });
      if (this.recentAnalyses.length > this.maxRecentAnalyses) {
        this.recentAnalyses = this.recentAnalyses.slice(0, this.maxRecentAnalyses);
      }
      
      console.log(`[FAST-ENTRY] ${enrichedData.symbol} | ${(marketCap/1000).toFixed(0)}k | BC: ${fastEntryResult.signals.bondingCurveProgress.toFixed(0)}% | Vel: ${fastEntryResult.signals.bondingCurveVelocity.toFixed(1)}%/min | TRADE`);
      
      return {
        token: enrichedData,
        analysis: fastAnalysis,
        shouldTrade: true
      };
    }

    // STANDARD PATH - Full analysis with AI consensus
    // Use advanced analytics engine
    const advancedAnalysis = await analytics.analyzeToken(enrichedData, deepAnalysis);
    
    // Get AI analysis (Gemini or rule-based)
    const geminiAnalysis = await gemini.analyzeToken(enrichedData, marketContext, this.state.patterns);
    
    // MULTI-AI CONSENSUS - Get opinions from multiple AI models
    // Only for non-fast-entry tokens (older than 2 min or not pump.fun)
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

    // Build signals for learner (include early signals)
    const tokenSignals = { 
      marketCap: enrichedData.usd_market_cap, 
      liquidity: enrichedData.virtual_sol_reserves, 
      buyPressure: enrichedData.buyPressure || 50, 
      holders: enrichedData.holders, 
      priceChange1h: enrichedData.priceChange1h || 0,
      tokenAge: enrichedData.ageMinutes,
      bondingCurveProgress: enrichedData.bondingCurveProgress || 0,
      bondingCurveVelocity: enrichedData.bondingCurveVelocity || 0,
      buyersPerMinute: enrichedData.buyersPerMinute || 0
    };
    const shouldTrade = this.shouldTradeAdvanced(combinedAnalysis, tokenSignals, enrichedData);
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

  // FAST ENTRY FILTER - For early pump.fun tokens (NO AI LATENCY)
  // Returns { pass: boolean, reason: string, signals: object }
  // LOOSENED: Age < 5min, BC 40-95%, velocity > 0.5, uniqueBuys >= 8
  passesFastEntryFilter(tokenData, deepAnalysis = null) {
    const ageMinutes = tokenData.ageMinutes || 
      ((Date.now() - new Date(tokenData.created_timestamp).getTime()) / 60000);
    
    // LOOSENED: Allow tokens up to 5 minutes old (was 1.5min)
    if (ageMinutes >= 5) {
      return { pass: false, reason: 'too_old', signals: null };
    }
    
    // Get bonding curve data
    const bcProgress = tokenData.bondingCurveProgress || 
      bondingCurve.calculateProgress(tokenData.virtual_sol_reserves || 0);
    
    // LOOSENED: BC 40-95% (was 55-88%)
    // 40% = early momentum, 95% = allow near-graduation
    if (bcProgress < 40 || bcProgress > 95) {
      return { pass: false, reason: `bc_progress_${bcProgress.toFixed(0)}%`, signals: null };
    }
    
    // Get velocity analysis
    const velocityAnalysis = bondingCurve.getVelocityAnalysis(
      tokenData.mint, 
      tokenData.virtual_sol_reserves || 0
    );
    
    // LOOSENED: velocity > 0.5 (was 1.8)
    if (velocityAnalysis.velocity <= 0.5) {
      return { pass: false, reason: `low_velocity_${velocityAnalysis.velocity.toFixed(1)}`, signals: null };
    }
    
    // BUNDLE GUARD: Check sniper/bundle data if available
    // If token is bundled with 20+ snipers, reject for fast entry (too much dump risk)
    if (tokenData.isBundled && tokenData.sniperCount > 20) {
      return { pass: false, reason: `high_sniper_bundle_${tokenData.sniperCount}`, signals: null };
    }
    
    // BUNDLED RISK AUTO-REJECT: If > 25 snipers, auto-reject regardless of other signals
    if (tokenData.sniperCount > 25) {
      return { pass: false, reason: `bundled_risk_${tokenData.sniperCount}_snipers`, signals: null };
    }
    
    // SNIPER COUNT FILTER: If > 15 snipers, reject for fast entry
    // These are "bundled" dev launches that look like high-velocity pumps but dump hard
    if (tokenData.sniperCount > 15) {
      return { pass: false, reason: `too_many_snipers_${tokenData.sniperCount}`, signals: null };
    }
    
    // TEMPORARILY DISABLED: Top holder check (was 15%)
    // Let AI learn which holder concentrations perform best
    // let topHolderPercent = 0;
    // if (deepAnalysis?.holders?.top1Percent) {
    //   topHolderPercent = deepAnalysis.holders.top1Percent;
    // } else if (tokenData.topHolderPercent) {
    //   topHolderPercent = tokenData.topHolderPercent;
    // }
    // if (topHolderPercent > 15) {
    //   return { pass: false, reason: `top_holder_${topHolderPercent.toFixed(0)}%`, signals: null };
    // }
    
    // Calculate early signals
    const earlySignals = this.calculateEarlySignals(tokenData, velocityAnalysis);
    
    // Add sniper data to signals if available
    if (tokenData.sniperCount !== undefined) {
      earlySignals.sniperCount = tokenData.sniperCount;
      earlySignals.isBundled = tokenData.isBundled ? 1 : 0;
    }
    
    // LOOSENED: Check unique buys per minute >= 8 (was 12)
    const uniqueBuysPerMinute = earlySignals.uniqueBuysPerMinute || tokenData.uniqueBuysPerMinute || 0;
    if (uniqueBuysPerMinute < 8 && uniqueBuysPerMinute > 0) {
      return { pass: false, reason: `low_unique_buys_${uniqueBuysPerMinute.toFixed(0)}`, signals: earlySignals };
    }
    
    // TEMPORARILY DISABLED: Avg buy size trend check
    // Let AI learn which trends perform best
    // const avgBuySizeTrend = earlySignals.avgBuySizeTrend || tokenData.avgBuySizeTrend || 'stable';
    // if (avgBuySizeTrend === 'decreasing') {
    //   return { pass: false, reason: 'declining_buy_size', signals: earlySignals };
    // }
    
    // Keep creator sold check - this is a strong red flag
    if (tokenData.creatorSoldEarly || earlySignals.creatorSoldEarly) {
      return { pass: false, reason: 'creator_sold', signals: earlySignals };
    }
    
    // LOOSENED: Min mcap $3k (was $5k)
    const marketCap = tokenData.usd_market_cap || 0;
    if (marketCap < 3000) {
      return { pass: false, reason: 'mcap_too_low', signals: earlySignals };
    }
    
    // PASSED - This is a fast entry candidate
    const bundleInfo = tokenData.isBundled ? ` | Bundled: ${tokenData.sniperCount} snipers` : '';
    const uniqueBuysInfo = uniqueBuysPerMinute > 0 ? ` | UniqBuys: ${uniqueBuysPerMinute.toFixed(0)}/min` : '';
    console.log(`[FAST-ENTRY] ${tokenData.symbol} PASSED | Age: ${ageMinutes.toFixed(1)}min | BC: ${bcProgress.toFixed(0)}% | Vel: ${velocityAnalysis.velocity.toFixed(1)}%/min${bundleInfo}${uniqueBuysInfo}`);
    
    return { 
      pass: true, 
      reason: 'fast_entry_approved',
      signals: earlySignals,
      velocityAnalysis
    };
  }

  // Calculate early pump.fun signals for learning - ENHANCED with high-edge signals
  calculateEarlySignals(tokenData, velocityAnalysis = null) {
    const ageMinutes = tokenData.ageMinutes || 
      ((Date.now() - new Date(tokenData.created_timestamp).getTime()) / 60000);
    
    // Estimate buyers per minute from transaction data
    const txns = tokenData.txns24h || tokenData.txCount || 0;
    const buys = tokenData.buys24h || Math.floor(txns * 0.6); // Estimate 60% are buys
    const buyersPerMinute = ageMinutes > 0 ? buys / Math.max(1, ageMinutes) : 0;
    
    // NEW: Transactions per minute
    const txnsPerMinute = ageMinutes > 0 ? txns / Math.max(1, ageMinutes) : 0;
    
    // Estimate new vs repeat buyers (rough approximation)
    const uniqueWallets = tokenData.uniqueWallets24h || tokenData.uniqueWallets || 0;
    const newBuyers = uniqueWallets;
    const repeatBuyers = Math.max(0, buys - uniqueWallets);
    
    // NEW: Unique buys per minute (strongest early signal)
    const uniqueBuysPerMinute = ageMinutes > 0 ? uniqueWallets / Math.max(1, ageMinutes) : 0;
    
    // NEW: Unique buyer growth rate (holders per minute)
    const holders = tokenData.holder_count || tokenData.holders || 0;
    const uniqueBuyerGrowthRate = ageMinutes > 0 ? holders / Math.max(1, ageMinutes) : 0;
    
    // Average buy size in USD
    const buyVolume = tokenData.buyVolume24h || tokenData.volume24h * 0.6 || 0;
    const avgBuySize = buys > 0 ? buyVolume / buys : 0;
    
    // NEW: Average buy size in SOL (estimate)
    const solPrice = 200; // Rough estimate, will be updated by helius
    const avgBuySizeSol = avgBuySize / solPrice;
    
    // NEW: Avg buy size trend (estimate from buy pressure)
    const buyPressure = tokenData.buyPressure || 50;
    const avgBuySizeTrend = buyPressure > 60 ? 'increasing' : 
                           buyPressure < 40 ? 'decreasing' : 'stable';
    
    // Bonding curve velocity
    const bcVelocity = velocityAnalysis?.velocity || 0;
    
    // NEW: Creator signals (from tokenData if available)
    const creatorBoughtEarly = tokenData.creatorBoughtEarly || false;
    const creatorSoldEarly = tokenData.creatorSoldEarly || false;
    
    return {
      tokenAge: ageMinutes,
      buyersPerMinute,
      txnsPerMinute,
      uniqueBuysPerMinute,
      uniqueBuyerGrowthRate,
      newBuyers,
      repeatBuyers,
      avgBuySize,
      avgBuySizeSol,
      avgBuySizeTrend,
      creatorBoughtEarly,
      creatorSoldEarly,
      bondingCurveProgress: tokenData.bondingCurveProgress || 
        bondingCurve.calculateProgress(tokenData.virtual_sol_reserves || 0),
      bondingCurveVelocity: bcVelocity,
      isNearGraduation: velocityAnalysis?.progress >= 80,
      isGraduationFrenzy: velocityAnalysis?.isGraduationFrenzy || false,
      velocityClass: velocityAnalysis?.velocityClass || 'unknown',
      // Quality flags
      isHighActivity: txnsPerMinute > 10,
      isOrganicGrowth: uniqueBuysPerMinute > 12,
      hasStrongMomentum: bcVelocity > 1.8
    };
  }

  shouldTradeAdvanced(analysis, tokenSignals = null, tokenData = null) {
    if (!analysis) return false;
    
    // BUNDLED RISK AUTO-REJECT: If > 25 snipers, auto-reject regardless of confidence
    // These are heavily coordinated launches with extreme dump risk
    const sniperCount = tokenData?.sniperCount || 0;
    if (sniperCount > 25) {
      console.log(`[BUNDLED-RISK] ${tokenData?.symbol} AUTO-REJECTED: ${sniperCount} snipers > 25 (bundled launch)`);
      return false;
    }
    
    // SNIPER COUNT FILTER: If > 15 snipers, require 90% confidence
    // This protects against "bundled" dev launches that look like high-velocity pumps
    const maxSnipers = 15;
    if (sniperCount > maxSnipers) {
      const requiredConfidence = 90;
      const currentConfidence = analysis.advancedScore || analysis.confidence || 50;
      if (currentConfidence < requiredConfidence) {
        console.log(`[SNIPER-FILTER] ${tokenData?.symbol} rejected: ${sniperCount} snipers > ${maxSnipers}, confidence ${currentConfidence}% < ${requiredConfidence}% required`);
        return false;
      }
      console.log(`[SNIPER-FILTER] ${tokenData?.symbol} HIGH RISK: ${sniperCount} snipers, but confidence ${currentConfidence}% >= ${requiredConfidence}%`);
    }
    
    // FAST ENTRY PATH - For early pump.fun tokens, skip AI entirely
    if (tokenData && analysis.fastEntryApproved) {
      console.log(`[FAST-ENTRY] ${tokenData.symbol} - Trading without AI consensus`);
      return true;
    }
    
    // CRITICAL: Use learner's prediction if we have enough data
    // Now uses learner score after just 10 outcomes (was 20)
    const learnerUseAfter = config.learnerMinSamples || 10;
    if (tokenSignals && learner.performance.totalPredictions >= learnerUseAfter) {
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

  shouldTrade(analysis, tokenSignals = null, tokenData = null) {
    return this.shouldTradeAdvanced(analysis, tokenSignals, tokenData);
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
      // NEW: Track maxUp and maxDown during lifetime
      maxUp: 0,
      maxDown: 0,
      maxUpTime: null,
      maxDownTime: null,
      // Per-window learning flags - EXPANDED with 0.5min and 2min
      learned_0_5min: false,
      learned_1min: false,
      learned_2min: false,
      learned_3min: false,
      learned_5min: false,
      learned_10min: false,
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
        // Early pump.fun signals
        buyersPerMinute: tokenData.buyersPerMinute || 0,
        newBuyers: tokenData.newBuyers || 0,
        repeatBuyers: tokenData.repeatBuyers || 0,
        avgBuySize: tokenData.avgBuySize || 0,
        bondingCurveProgress: tokenData.bondingCurveProgress || 0,
        bondingCurveVelocity: tokenData.bondingCurveVelocity || 0,
        tokenAge: tokenData.ageMinutes || 0,
        // NEW: High-edge early signals
        txnsPerMinute: tokenData.txnsPerMinute || 0,
        uniqueBuysPerMinute: tokenData.uniqueBuysPerMinute || 0,
        uniqueBuyerGrowthRate: tokenData.uniqueBuyerGrowthRate || 0,
        avgBuySizeSol: tokenData.avgBuySizeSol || 0,
        avgBuySizeTrend: tokenData.avgBuySizeTrend || 'stable',
        creatorBoughtEarly: tokenData.creatorBoughtEarly || false,
        creatorSoldEarly: tokenData.creatorSoldEarly || false,
        // Sniper/Bundle data
        sniperCount: tokenData.sniperCount || 0,
        isBundled: tokenData.isBundled || false,
        isHighSniperCount: tokenData.isHighSniperCount || false,
        bundleRisk: tokenData.bundleRisk || 'UNKNOWN',
        sniperConcentration: tokenData.sniperConcentration || 0,
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

  // UPDATE TRACKED PRICES - Called every 5s for maxUp/maxDown tracking
  // Now includes MICRO-LEARNING from positions that are still active
  async updateTrackedPrices() {
    const now = Date.now();
    const batchSize = 15; // Update 15 tokens at a time
    const tokens = [...this.trackedTokens.values()]
      .filter(t => !t.finalOutcomeDecided && (now - (t.lastPriceUpdate || 0)) > 4000)
      .slice(0, batchSize);
    
    if (tokens.length === 0) return;
    
    for (const tracked of tokens) {
      try {
        const priceData = await this.getTokenPrice(tracked.mint);
        if (!priceData?.price || priceData.price <= 0) continue;
        
        const currentPrice = priceData.price;
        const pnlPercent = ((currentPrice - tracked.entryPrice) / tracked.entryPrice) * 100;
        
        // Initialize maxUp/maxDown if not set
        if (tracked.maxUp === undefined) tracked.maxUp = 0;
        if (tracked.maxDown === undefined) tracked.maxDown = 0;
        
        // Update maxUp (highest gain seen)
        if (pnlPercent > tracked.maxUp) {
          tracked.maxUp = pnlPercent;
          tracked.maxUpTime = now;
          tracked.highestPrice = currentPrice;
        }
        
        // Update maxDown (lowest loss seen)
        if (pnlPercent < tracked.maxDown) {
          tracked.maxDown = pnlPercent;
          tracked.maxDownTime = now;
          tracked.lowestPrice = currentPrice;
        }
        
        // MICRO-LEARNING: Learn from significant moves while position is still active
        // This gives us data points BEFORE the final outcome
        const ageMinutes = (now - tracked.entryTime) / 60000;
        if (!tracked.microLearned && ageMinutes >= 0.5) { // After 30 seconds
          const volatility = Math.max(Math.abs(tracked.maxUp), Math.abs(tracked.maxDown));
          
          // If we see a significant move (>4%), learn from it immediately
          if (volatility >= 4 && !tracked.microLearned) {
            tracked.microLearned = true;
            const microOutcome = this.classifyVolatility(tracked.maxUp, tracked.maxDown, tracked.tokenData?.marketCap);
            
            console.log(`[MICRO-LEARN] ${tracked.symbol}: ${microOutcome.bucket} at ${ageMinutes.toFixed(1)}min | maxUp=${tracked.maxUp.toFixed(1)}% maxDown=${tracked.maxDown.toFixed(1)}%`);
            
            // Learn from this early signal
            const flatSignals = learner.flattenSignals(tracked.tokenData || {});
            await learner.learnFromVolatility(
              flatSignals,
              tracked.maxUp,
              tracked.maxDown,
              pnlPercent,
              ageMinutes
            );
          }
        }
        
        // Legacy MFE/MAE for compatibility
        tracked.mfePercent = tracked.maxUp;
        tracked.maePercent = tracked.maxDown;
        
        tracked.lastPriceUpdate = now;
        tracked.currentPrice = currentPrice;
        tracked.currentPnl = pnlPercent;
        
      } catch (err) {
        // Skip this token
      }
    }
  }

  // Check tracked tokens and learn from outcomes - MULTI-WINDOW VOLATILITY BASED
  // Each token generates 3 learning samples (at 3, 5, 10 minutes)
  async checkTrackedOutcomes() {
    const now = Date.now();
    const toRemove = [];
    
    for (const [mint, tracked] of this.trackedTokens) {
      const ageMinutes = (now - tracked.entryTime) / 60000;
      
      // Get current price for this check
      const currentData = await this.getTokenPrice(mint);
      if (currentData?.price && tracked.entryPrice) {
        const pnlPercent = ((currentData.price - tracked.entryPrice) / tracked.entryPrice) * 100;
        
        // Update maxUp/maxDown
        if (pnlPercent > (tracked.maxUp || 0)) {
          tracked.maxUp = pnlPercent;
          tracked.maxUpTime = now;
        }
        if (pnlPercent < (tracked.maxDown || 0)) {
          tracked.maxDown = pnlPercent;
          tracked.maxDownTime = now;
        }
        
        tracked.currentPnl = pnlPercent;
      }
      
      // LEARN AT EACH WINDOW (0.5, 1, 2, 3, 5, 10 minutes) - generates 6 samples per token
      for (const windowMinutes of this.outcomeWindows) {
        // Handle decimal windows (0.5 -> 0_5)
        const windowKey = `learned_${String(windowMinutes).replace('.', '_')}min`;
        if (ageMinutes >= windowMinutes && !tracked[windowKey]) {
          tracked[windowKey] = true;
          
          // Get volatility bucket based on maxUp/maxDown at this window
          const volatilityOutcome = this.classifyVolatility(tracked.maxUp || 0, tracked.maxDown || 0, tracked.tokenData?.marketCap);
          
          console.log(`[LEARN-${windowMinutes}min] ${tracked.symbol}: maxUp=${(tracked.maxUp || 0).toFixed(1)}% maxDown=${(tracked.maxDown || 0).toFixed(1)}% => ${volatilityOutcome.bucket} (${volatilityOutcome.direction})`);
          
          // Build learning data for this window
          const learningData = this.buildLearningData(tracked, windowMinutes, volatilityOutcome);
          
          // Learn from this window
          const flatSignals = learner.flattenSignals(learningData);
          await learner.learnFromVolatility(
            flatSignals, 
            tracked.maxUp || 0, 
            tracked.maxDown || 0, 
            tracked.currentPnl || 0,
            windowMinutes
          );
          
          // TRAINING DATA PERSISTENCE - Save to JSONL for ML model training
          // Save at 10-minute window (final outcome) for XGBoost training
          if (windowMinutes === 10) {
            await learner.saveTrainingData(tracked, windowMinutes, volatilityOutcome);
          }
          
          // Save outcome
          await storage.saveOutcome({ 
            signals: flatSignals, 
            outcome: volatilityOutcome.bucket,
            direction: volatilityOutcome.direction,
            maxUp: tracked.maxUp || 0,
            maxDown: tracked.maxDown || 0,
            finalPnl: tracked.currentPnl || 0,
            windowMinutes,
            volatilityScore: volatilityOutcome.volatilityScore,
            timestamp: Date.now() 
          });
          
          // Update stats based on volatility bucket
          this.updateVolatilityStats(volatilityOutcome);
          
          this.dataBuffer.push(learningData);
        }
      }
      
      // Remove after max track time
      if (now - tracked.entryTime >= this.MAX_TRACK_TIME) {
        tracked.finalOutcomeDecided = true;
        toRemove.push(mint);
        
        const finalOutcome = this.classifyVolatility(tracked.maxUp || 0, tracked.maxDown || 0, tracked.tokenData?.marketCap);
        console.log(`[FINAL] ${tracked.symbol}: ${finalOutcome.bucket} | maxUp=${(tracked.maxUp || 0).toFixed(1)}% maxDown=${(tracked.maxDown || 0).toFixed(1)}% | AI accuracy: ${learner.performance.volatilityAccuracy.toFixed(1)}%`);
      }
    }

    toRemove.forEach(mint => this.trackedTokens.delete(mint));
    
    // Auto-optimize every 30 outcomes
    const totalOutcomes = (this.state.stats.strong_pumps || 0) + (this.state.stats.weak_pumps || 0) + 
                          (this.state.stats.chops || 0) + (this.state.stats.weak_dumps || 0) + 
                          (this.state.stats.strong_dumps || 0);
    if (totalOutcomes > 0 && totalOutcomes % 30 === 0) {
      const recentOutcomes = await storage.loadRecentOutcomes(50);
      await learner.autoOptimize(recentOutcomes);
    }
    
    if (this.dataBuffer.length >= 10) {
      await this.flushDataBuffer();
    }
  }

  // Classify volatility into buckets - MFE-PRIMARY CLASSIFICATION
  // CRITICAL: If maxUp >= threshold at ANY point, it's a pump - even if price crashed back to 0%
  // This ensures the SelfLearner sees every historical peak as a success signal
  // THRESHOLDS SLASHED: 3%/6%/10%/20% to catch real pumps like +300% KALShi
  classifyVolatility(maxUp, maxDown, marketCap = 100000) {
    const volatilityScore = Math.max(Math.abs(maxUp), Math.abs(maxDown));
    
    // ADAPTIVE THRESHOLDS by market cap - SLASHED for detection
    let microThreshold, weakThreshold, strongThreshold, extremeThreshold;
    if (marketCap < 50000) {
      // Small caps (<$50k): tightest thresholds
      microThreshold = 3;
      weakThreshold = 6;
      strongThreshold = 10;
      extremeThreshold = 20;
    } else if (marketCap <= 200000) {
      // Mid caps ($50k-$200k): standard thresholds
      microThreshold = 4;
      weakThreshold = 8;
      strongThreshold = 12;
      extremeThreshold = 25;
    } else {
      // Large caps (>$200k): looser thresholds
      microThreshold = 5;
      weakThreshold = 10;
      strongThreshold = 15;
      extremeThreshold = 30;
    }
    
    let bucket;
    let direction;
    
    // MFE-PRIMARY: Check maxUp FIRST - if it hit the threshold at ANY point, it's a pump
    // This is the key fix: a token that hit +15% then crashed to -5% is still a "strong_pump"
    // because we COULD have taken profit at the peak
    
    // EXTREME PUMP: 20%+ at any point (common in current market - e.g., +300% KALShi)
    if (maxUp >= extremeThreshold) {
      bucket = 'extreme_pump';
      direction = 'up';
    } else if (maxUp >= strongThreshold) {
      bucket = 'strong_pump';
      direction = 'up';
    } else if (maxUp >= weakThreshold) {
      bucket = 'weak_pump';
      direction = 'up';
    } else if (maxDown <= -extremeThreshold) {
      // EXTREME DUMP: Only if it NEVER hit pump threshold
      bucket = 'extreme_dump';
      direction = 'down';
    } else if (maxDown <= -strongThreshold) {
      // Only classify as dump if it NEVER hit the pump threshold
      bucket = 'strong_dump';
      direction = 'down';
    } else if (maxDown <= -weakThreshold) {
      bucket = 'weak_dump';
      direction = 'down';
    } else if (maxUp >= microThreshold) {
      // Micro-pump: hit micro threshold but not weak threshold
      bucket = 'micro_pump';
      direction = 'up';
    } else if (maxDown <= -microThreshold) {
      // Micro-dump: dropped micro threshold but never pumped
      bucket = 'micro_dump';
      direction = 'down';
    } else {
      // True chop: never moved more than micro threshold
      bucket = 'chop';
      direction = maxUp > Math.abs(maxDown) ? 'up' : 'down';
    }
    
    // DEBUG: Log classification for every token
    console.log(`[CLASSIFY] maxUp=${maxUp.toFixed(1)}% maxDown=${maxDown.toFixed(1)}% mcap=${(marketCap/1000).toFixed(0)}k => ${bucket} (thresholds: micro=${microThreshold}% weak=${weakThreshold}% strong=${strongThreshold}% extreme=${extremeThreshold}%)`);
    
    return { 
      bucket, 
      direction, 
      volatilityScore, 
      maxUp, 
      maxDown, 
      marketCap, 
      microThreshold,
      weakThreshold, 
      strongThreshold,
      extremeThreshold,
      // NEW: Flag if this was a "retracement pump" (hit target then crashed)
      wasRetracementPump: maxUp >= weakThreshold && maxDown <= -weakThreshold
    };
  }

  // Update stats based on volatility bucket
  updateVolatilityStats(outcome) {
    if (!this.state.stats.extreme_pumps) this.state.stats.extreme_pumps = 0;
    if (!this.state.stats.strong_pumps) this.state.stats.strong_pumps = 0;
    if (!this.state.stats.weak_pumps) this.state.stats.weak_pumps = 0;
    if (!this.state.stats.micro_pumps) this.state.stats.micro_pumps = 0;
    if (!this.state.stats.micro_dumps) this.state.stats.micro_dumps = 0;
    if (!this.state.stats.chops) this.state.stats.chops = 0;
    if (!this.state.stats.weak_dumps) this.state.stats.weak_dumps = 0;
    if (!this.state.stats.strong_dumps) this.state.stats.strong_dumps = 0;
    if (!this.state.stats.extreme_dumps) this.state.stats.extreme_dumps = 0;
    
    switch (outcome.bucket) {
      case 'extreme_pump': this.state.stats.extreme_pumps++; this.state.stats.pumps++; break;
      case 'strong_pump': this.state.stats.strong_pumps++; this.state.stats.pumps++; break;
      case 'weak_pump': this.state.stats.weak_pumps++; this.state.stats.pumps++; break;
      case 'micro_pump': this.state.stats.micro_pumps++; this.state.stats.pumps++; break;
      case 'micro_dump': this.state.stats.micro_dumps++; this.state.stats.dumps++; break;
      case 'chop': this.state.stats.chops++; this.state.stats.neutral++; break;
      case 'weak_dump': this.state.stats.weak_dumps++; this.state.stats.dumps++; break;
      case 'strong_dump': this.state.stats.strong_dumps++; this.state.stats.dumps++; break;
      case 'extreme_dump': this.state.stats.extreme_dumps++; this.state.stats.dumps++; break;
    }
  }

  // Build learning data for a specific window
  buildLearningData(tracked, windowMinutes, volatilityOutcome) {
    return {
      timestamp: Date.now(),
      token: tracked.tokenData,
      entryPrice: tracked.entryPrice,
      maxUp: tracked.maxUp || 0,
      maxDown: tracked.maxDown || 0,
      finalPnl: tracked.currentPnl || 0,
      volatilityScore: volatilityOutcome.volatilityScore,
      outcome: volatilityOutcome.bucket,
      direction: volatilityOutcome.direction,
      windowMinutes,
      holdTimeMinutes: (Date.now() - tracked.entryTime) / 60000,
      analysis: tracked.analysis,
      // Early pump.fun signals
      earlySignals: {
        buyersPerMinute: tracked.tokenData?.buyersPerMinute || 0,
        newBuyers: tracked.tokenData?.newBuyers || 0,
        repeatBuyers: tracked.tokenData?.repeatBuyers || 0,
        avgBuySize: tracked.tokenData?.avgBuySize || 0,
        bondingCurveVelocity: tracked.tokenData?.bondingCurveVelocity || 0,
        topHolderPercent: tracked.holderAnalysis?.top1Percent || 0
      },
      priceSignals: { 
        priceChange30m: tracked.tokenData?.priceChange30m, 
        priceChange1h: tracked.tokenData?.priceChange1h, 
        priceChange24h: tracked.tokenData?.priceChange24h 
      },
      marketSignals: { 
        marketCap: tracked.tokenData?.marketCap, 
        liquidity: tracked.tokenData?.liquidity 
      },
      volumeSignals: { 
        volume24h: tracked.tokenData?.volume24h, 
        volumeToMcap: tracked.tokenData?.volumeToMcap 
      },
      tradingSignals: { 
        buyPressure: tracked.tokenData?.buyPressure, 
        txns24h: tracked.tokenData?.txns24h 
      },
      holderSignals: { 
        holders: tracked.tokenData?.holders, 
        top10Percent: tracked.holderAnalysis?.top10Percent 
      }
    };
  }
        
  // Get token price from multiple sources - WITH HEAVY DEBUG LOGGING
  async getTokenPrice(mint) {
    const startTime = Date.now();
    
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
          console.log(`[PRICE-DEBUG] ${mint.slice(0,8)} | Birdeye: $${data.data.value.toFixed(10)} | ${Date.now() - startTime}ms`);
          return { price: data.data.value, source: 'birdeye' };
        }
      }
      console.log(`[PRICE-DEBUG] ${mint.slice(0,8)} | Birdeye FAILED: ${res.status}`);
    } catch (err) {
      console.log(`[PRICE-DEBUG] ${mint.slice(0,8)} | Birdeye ERROR: ${err.message}`);
    }
    
    // Fallback to Jupiter
    try {
      const res = await fetch(`https://price.jup.ag/v6/price?ids=${mint}`);
      if (res.ok) {
        const data = await res.json();
        if (data.data?.[mint]?.price && data.data[mint].price > 0) {
          console.log(`[PRICE-DEBUG] ${mint.slice(0,8)} | Jupiter: $${data.data[mint].price.toFixed(10)} | ${Date.now() - startTime}ms`);
          return { price: data.data[mint].price, source: 'jupiter' };
        }
      }
      console.log(`[PRICE-DEBUG] ${mint.slice(0,8)} | Jupiter FAILED: no price data`);
    } catch (err) {
      console.log(`[PRICE-DEBUG] ${mint.slice(0,8)} | Jupiter ERROR: ${err.message}`);
    }
    
    // Fallback to DexScreener
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      if (res.ok) {
        const data = await res.json();
        if (data.pairs?.[0]?.priceUsd) {
          const price = parseFloat(data.pairs[0].priceUsd);
          console.log(`[PRICE-DEBUG] ${mint.slice(0,8)} | DexScreener: $${price.toFixed(10)} | ${Date.now() - startTime}ms`);
          return { price, source: 'dexscreener' };
        }
      }
      console.log(`[PRICE-DEBUG] ${mint.slice(0,8)} | DexScreener FAILED: no pairs`);
    } catch (err) {
      console.log(`[PRICE-DEBUG] ${mint.slice(0,8)} | DexScreener ERROR: ${err.message}`);
    }
    
    console.log(`[PRICE-DEBUG] ${mint.slice(0,8)} | ALL SOURCES FAILED | ${Date.now() - startTime}ms`);
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
