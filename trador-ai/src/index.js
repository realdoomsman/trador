import config from './config.js';
import brain from './services/brain.js';
import helius from './services/helius.js';
import rateLimiter from './services/rateLimiter.js';
import gpuWorker from './services/gpuWorker.js';
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

// API Endpoints
app.get('/api/status', (req, res) => {
  res.json({
    running: isRunning,
    idle: isIdle,
    gpu: gpuWorker.getStatus(),
    rateLimit: rateLimiter.getUsage(),
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
  res.json(brain.state.patterns || {});
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

    console.log(`Scanning ${tokens.length} tokens...`);
    
    // Use GPU parallel processing if available
    const results = await gpuWorker.processParallel(
      tokens.slice(0, 20),
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
    // Run pattern analysis more frequently when idle
    await brain.analyzePatterns();
    
    // Backtest virtual strategies
    if (brain.state.dataPoints > 1000) {
      await brain.runBacktest();
    }
  } catch (err) {
    console.error('Idle analysis error:', err.message);
  }
}

async function startBot() {
  console.log('Starting TRADOR AI...');
  
  await gpuWorker.initialize();
  await brain.initialize();
  
  isRunning = true;
  
  // Scan every 30s
  scanInterval = setInterval(scanLoop, config.scanInterval);
  scanLoop();
  
  // Update positions every 10s
  positionInterval = setInterval(() => brain.updateVirtualPositions(), config.priceUpdateInterval);
  
  // Pattern analysis every 30min
  patternInterval = setInterval(() => brain.analyzePatterns(), 1800000);
  
  // Idle analysis every 5min when no active trades
  idleInterval = setInterval(() => {
    isIdle = brain.activeVirtualPositions.size === 0;
    if (isIdle) idleAnalysis();
  }, 300000);
  
  console.log(`TRADOR AI started | GPU: ${gpuWorker.getStatus().mode} | Plan: ${config.heliusPlan}`);
}

function stopBot() {
  isRunning = false;
  [scanInterval, positionInterval, patternInterval, idleInterval].forEach(i => clearInterval(i));
  brain.flushDataBuffer();
  brain.saveState();
  console.log('TRADOR AI stopped');
}

process.on('SIGINT', () => { stopBot(); process.exit(0); });

app.listen(config.apiPort, () => console.log(`API on port ${config.apiPort}`));
startBot();
