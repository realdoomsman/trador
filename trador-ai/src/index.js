import config from './config.js';
import brain from './services/brain.js';
import helius from './services/helius.js';
import rateLimiter from './services/rateLimiter.js';
import gpuWorker from './services/gpuWorker.js';
import alpha from './services/alpha.js';
import pumpfunWS from './services/pumpfunWS.js';
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
let wsConnected = false;

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
    wsConnected: pumpfunWS.isConnected,
    wsStats: pumpfunWS.getStats(),
    ...brain.getStatus()
  });
});

app.post('/api/start', async (req, res) => {
  if (isRunning) return res.json({ success: false, message: 'Already running' });
  await startBot();
  res.json({ success: true });
});

app.post('/api/stop', (req, res) => {
  stopBot();
  res.json({ success: true });
});

app.post('/api/risk-profile', (req, res) => {
  const { profile } = req.body;
  if (!['low', 'medium', 'high'].includes(profile)) {
    return res.status(400).json({ error: 'Invalid profile' });
  }
  brain.setRiskProfile(profile);
  res.json({ success: true, profile });
});

app.get('/api/positions', (req, res) => {
  res.json(Array.from(brain.activeVirtualPositions.values()));
});

app.get('/api/trades', (req, res) => {
  res.json(brain.state.virtualTrades.filter(t => t.status === 'closed').slice(-50).reverse());
});

app.get('/api/patterns', (req, res) => {
  res.json(brain.state.learnedPatterns || brain.state.patterns || {});
});

app.get('/api/backtest', (req, res) => {
  res.json(brain.state.backtestResults || { error: 'No backtest run yet' });
});

app.post('/api/run-analysis', async (req, res) => {
  try {
    const patterns = await brain.runPatternAnalysis();
    res.json({ success: true, patterns });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.get('/api/alpha', (req, res) => {
  const status = brain.getStatus();
  res.json({
    marketRegime: status.marketRegime,
    regimeRecommendation: status.regimeRecommendation,
    portfolioHeat: status.portfolioHeat,
    smartMoneyTracked: status.smartMoneyTracked,
    isOptimalTime: status.isOptimalTime,
    bestTradingTimes: status.bestTradingTimes
  });
});

app.get('/api/wallet-intel', (req, res) => {
  const status = brain.getStatus();
  res.json({
    walletIntel: status.walletIntel,
    knownWallets: status.knownWallets,
    trackedClusters: status.trackedClusters,
    ruggerWallets: status.ruggerWallets,
    profitableWalletsTracked: status.profitableWalletsTracked
  });
});

app.get('/api/multi-ai', (req, res) => {
  const status = brain.getStatus();
  res.json({
    multiAI: status.multiAI,
    availableAIs: status.availableAIs,
    aiModelsCount: status.aiModelsCount
  });
});

app.get('/api/social', (req, res) => {
  const status = brain.getStatus();
  res.json({
    socialIntel: status.socialIntel,
    hotNarratives: status.hotNarratives,
    viralTokens: status.viralTokens
  });
});

// WebSocket stats for real-time token detection
app.get('/api/websocket', (req, res) => {
  res.json({
    connected: pumpfunWS.isConnected,
    stats: pumpfunWS.getStats(),
    recentTokens: pumpfunWS.getRecentTokens(60000) // Last 1 minute
  });
});

// Recent token analyses for live feed
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
    if (regime.regime !== 'neutral') {
      console.log(`Market regime: ${regime.regime.toUpperCase()} - ${regime.recommendation.message}`);
    }
    
    // Use GPU parallel processing if available
    const results = await gpuWorker.processParallel(
      tokens.slice(0, 35), // Scan 35 tokens per batch with Birdeye Starter
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

// Idle mode - deeper analysis when not actively trading
async function idleAnalysis() {
  if (!isIdle) return;
  
  console.log('Idle mode: Running deep analysis...');
  
  try {
    // Run advanced pattern analysis
    await brain.runPatternAnalysis();
  } catch (err) {
    console.error('Idle analysis error:', err.message);
  }
}

async function startBot() {
  console.log('Starting TRADOR AI...');
  
  await gpuWorker.initialize();
  await brain.initialize();
  
  // Connect WebSocket for real-time token detection
  try {
    wsConnected = await pumpfunWS.connectHelius();
    if (wsConnected) {
      console.log('[WS] Real-time token detection enabled');
      
      // Handle new tokens from WebSocket
      pumpfunWS.onNewToken = async (mint, signature) => {
        console.log(`[WS-NEW] Detected new token: ${mint}`);
        try {
          // Fetch token data and analyze immediately
          const tokenData = await helius.getPumpFunToken(mint);
          if (tokenData) {
            const result = await brain.analyzeToken({
              ...tokenData,
              source: 'websocket',
              isPumpFun: true,
              isNewLaunch: true
            });
            
            if (result?.shouldTrade && brain.state.canVirtualTrade) {
              console.log(`[WS-TRADE] New token ${tokenData.symbol} triggered trade signal!`);
              await brain.executeVirtualTrade(result.token, result.analysis);
            }
          }
        } catch (err) {
          console.error('[WS] Error processing new token:', err.message);
        }
      };
    }
  } catch (err) {
    console.log('[WS] WebSocket connection failed, using polling only:', err.message);
  }
  
  isRunning = true;
  
  // CRITICAL: Update tracked token prices every 5 seconds for MFE/MAE tracking
  const priceTrackInterval = setInterval(() => brain.updateTrackedPrices(), 5000);
  
  // Scan every 15s for faster reaction (fallback/supplement to WebSocket)
  scanInterval = setInterval(scanLoop, config.scanInterval);
  scanLoop();
  
  // Update positions every 5s
  positionInterval = setInterval(() => brain.updateVirtualPositions(), config.priceUpdateInterval);
  
  // Check tracked token outcomes every 10 seconds (MFE/MAE based)
  outcomeInterval = setInterval(() => brain.checkTrackedOutcomes(), 10000);
  
  // Pattern analysis every 15min
  patternInterval = setInterval(() => brain.analyzePatterns(), 900000);
  
  // Idle analysis every 5min when no active trades
  idleInterval = setInterval(() => {
    isIdle = brain.activeVirtualPositions.size === 0;
    if (isIdle) idleAnalysis();
  }, 300000);
  
  const wsStatus = wsConnected ? 'REAL-TIME' : 'POLLING';
  console.log(`TRADOR AI started | GPU: ${gpuWorker.getStatus().mode} | Mode: ${wsStatus} | Plan: ${config.heliusPlan}`);
}

function stopBot() {
  isRunning = false;
  [scanInterval, positionInterval, patternInterval, idleInterval, outcomeInterval].forEach(i => clearInterval(i));
  pumpfunWS.disconnect();
  brain.flushDataBuffer();
  brain.saveState();
  console.log('TRADOR AI stopped');
}

process.on('SIGINT', () => { stopBot(); process.exit(0); });

app.listen(config.apiPort, () => console.log(`API on port ${config.apiPort}`));
startBot();
