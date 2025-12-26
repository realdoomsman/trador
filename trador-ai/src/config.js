import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of this file and load .env from there
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

// ============================================================================
// 🚀 MOONSHOT MODE - Hunting 10x-100x, not 10-20% gains
// ============================================================================
// Strategy: Small positions (3%), many shots, let winners RUN
// Expected: 70% lose 20-50%, 20% hit 2-5x, 8% hit 5-20x, 2% hit 20-100x+
// The 2% moonshots pay for everything
// ============================================================================

export default {
  // Google Cloud
  gcsBucket: process.env.GOOGLE_CLOUD_BUCKET || 'trador-ai-data',
  
  // Gemini
  geminiApiKey: process.env.GEMINI_API_KEY,
  
  // Multi-AI Keys
  openaiApiKey: process.env.OPENAI_API_KEY,
  claudeApiKey: process.env.CLAUDE_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  perplexityApiKey: process.env.PERPLEXITY_API_KEY,
  
  // Birdeye API (best for Pump.fun tokens)
  birdeyeApiKey: process.env.BIRDEYE_API_KEY,
  
  // Helius - Rate Limits based on plan
  heliusApiKey: process.env.HELIUS_API_KEY,
  heliusRpcUrl: process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
  heliusPlan: process.env.HELIUS_PLAN || 'free',
  heliusRateLimits: {
    free: { rps: 10, dailyCredits: 100000 },
    developer: { rps: 50, dailyCredits: 500000 },
    business: { rps: 200, dailyCredits: 2000000 },
    professional: { rps: 500, dailyCredits: 5000000 }
  },
  
  // Wallet
  privateKey: process.env.PRIVATE_KEY,
  
  // Ports
  dashboardPort: parseInt(process.env.DASHBOARD_PORT) || 3002,
  apiPort: parseInt(process.env.API_PORT) || 3003,
  
  // GPU Settings
  useGpu: process.env.USE_GPU === 'true',
  gpuWorkers: parseInt(process.env.GPU_WORKERS) || 4,
  
  // Confidence thresholds - AGGRESSIVE
  minConfidenceVirtual: 20,     // Very low - take more shots
  minConfidenceLive: 50,        // Lower for live too
  
  // ============================================================================
  // 🎯 MOONSHOT RISK PROFILES
  // ============================================================================
  riskProfiles: {
    // Conservative moonshot - still aggressive by normal standards
    low: {
      maxPositionSize: 0.02,    // 2% per trade
      stopLoss: 0.30,           // 30% stop (wide)
      takeProfit: 3.0,          // 3x take profit (300%)
      trailingStop: 0.25,       // 25% trailing after 2x
      maxDailyTrades: 20,
      minMarketCap: 3000,       // $3k minimum
      maxMarketCap: 100000,     // $100k max - micro caps only
    },
    // Standard moonshot hunting
    medium: {
      maxPositionSize: 0.03,    // 3% per trade - lottery ticket size
      stopLoss: 0.50,           // 50% stop - let it breathe
      takeProfit: 5.0,          // 5x take profit (500%)
      trailingStop: 0.30,       // 30% trailing after 3x
      maxDailyTrades: 50,
      minMarketCap: 2000,       // $2k minimum
      maxMarketCap: 50000,      // $50k max - ultra micro caps
    },
    // YOLO moonshot - maximum aggression
    high: {
      maxPositionSize: 0.03,    // Still 3% - more trades, not bigger
      stopLoss: 0.70,           // 70% stop - almost no stop
      takeProfit: 10.0,         // 10x take profit (1000%)
      trailingStop: 0.35,       // 35% trailing after 5x
      maxDailyTrades: 100,
      minMarketCap: 1000,       // $1k minimum - absolute degen
      maxMarketCap: 30000,      // $30k max - only the tiniest
    }
  },
  
  // ============================================================================
  // 🎰 MOONSHOT SCALE-OUT STRATEGY
  // ============================================================================
  // Instead of taking all profit at once, scale out:
  scaleOutTargets: [
    { multiplier: 2, sellPercent: 0.15 },   // Sell 15% at 2x (recover some cost)
    { multiplier: 3, sellPercent: 0.20 },   // Sell 20% at 3x
    { multiplier: 5, sellPercent: 0.20 },   // Sell 20% at 5x
    { multiplier: 10, sellPercent: 0.20 },  // Sell 20% at 10x
    { multiplier: 20, sellPercent: 0.15 },  // Sell 15% at 20x
    // Final 10% rides to moon or zero
  ],
  
  // ============================================================================
  // ⏱️ TIMING - Hold longer for moonshots
  // ============================================================================
  scanInterval: 10000,          // 10 seconds - faster scanning
  fastPollInterval: 2000,       // 2 seconds - catch new launches FAST
  priceUpdateInterval: 5000,    // 5 seconds
  analysisInterval: 10000,
  outcomeCheckInterval: 10000,  // 10 seconds - frequent checks
  
  // EXTENDED outcome windows - moonshots take time
  outcomeWindows: [1, 2, 5, 10, 15, 30, 45, 60],  // Up to 1 HOUR tracking
  
  // ============================================================================
  // 📊 MOONSHOT CLASSIFICATION THRESHOLDS
  // ============================================================================
  // Old thresholds were for 10-20% gains - useless for moonshots
  
  // Pump classification (MFE-based)
  microPumpThreshold: 20,       // 20% = micro pump (was 3%)
  pumpThreshold: 50,            // 50% = pump (was 6%)
  strongPumpThreshold: 100,     // 100% = strong pump (2x)
  megaPumpThreshold: 200,       // 200% = mega pump (3x)
  moonshotThreshold: 500,       // 500% = MOONSHOT (6x)
  
  // Dump classification
  microDumpThreshold: -15,      // -15% = micro dump
  dumpThreshold: -30,           // -30% = dump
  strongDumpThreshold: -50,     // -50% = strong dump
  
  // MFE/MAE for learning
  mfePumpThreshold: 50,         // 50% MFE = success
  maeDumpThreshold: -30,        // -30% MAE = failure
  
  // ============================================================================
  // 🔍 TOKEN TRACKING - MASSIVE SCALE
  // ============================================================================
  maxTrackedTokens: 5000,       // Track 5000 tokens
  maxTrackTimeMinutes: 60,      // Track for 1 HOUR
  tokensPerScan: 300,           // Scan 300 tokens per cycle
  
  // ============================================================================
  // 🎯 MICRO-CAP FOCUS
  // ============================================================================
  // Only hunt in the smallest, newest tokens
  moonshotFilters: {
    maxAge: 10,                 // Max 10 minutes old
    maxMarketCap: 50000,        // Max $50k market cap
    minMarketCap: 1000,         // Min $1k (not completely dead)
    minLiquidity: 500,          // Min $500 liquidity
    maxTopHolder: 30,           // Max 30% top holder (allow some concentration)
    minBondingCurve: 20,        // Min 20% BC progress
    maxBondingCurve: 95,        // Max 95% BC (before graduation)
  },
  
  // ============================================================================
  // 🧠 LEARNING - Optimized for moonshot detection
  // ============================================================================
  minDataPointsForTraining: 10,
  minDataPointsForVirtualTrading: 20,
  confidenceDecayRate: 0.0005,  // Slower decay
  
  learnerMinSamples: 5,         // Start learning faster
  learnerUseScoreAfter: 30,     // Use learner score sooner
  
  // ============================================================================
  // 🚨 MOONSHOT SIGNALS - What we're looking for
  // ============================================================================
  moonshotSignals: {
    // Strong buy signals
    velocityMin: 2.0,           // BC velocity > 2%/min
    uniqueBuyersMin: 15,        // 15+ unique buyers/min
    buyRatioMin: 70,            // 70%+ buy ratio
    holderGrowthMin: 10,        // 10+ new holders/min
    
    // Bonus signals
    whaleEntryBonus: 20,        // +20 score if whale buys
    viralBonus: 30,             // +30 score if viral on social
    narrativeBonus: 15,         // +15 score if hot narrative
  }
};
