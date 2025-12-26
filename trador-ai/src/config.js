import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of this file and load .env from there
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

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
  
  // FIXED: Lower confidence thresholds to break the loop
  minConfidenceVirtual: 30,  // Was 60 - too high, nothing could trade
  minConfidenceLive: 70,     // Was 85
  
  // Risk Profiles
  riskProfiles: {
    low: {
      maxPositionSize: 0.02,
      stopLoss: 0.05,
      takeProfit: 0.10,
      maxDailyTrades: 5,
      minMarketCap: 50000,
      maxMarketCap: 5000000,
    },
    medium: {
      maxPositionSize: 0.05,
      stopLoss: 0.10,
      takeProfit: 0.25,
      maxDailyTrades: 15,
      minMarketCap: 10000,
      maxMarketCap: 2000000,
    },
    high: {
      maxPositionSize: 0.10,
      stopLoss: 0.20,
      takeProfit: 0.50,
      maxDailyTrades: 30,
      minMarketCap: 5000,
      maxMarketCap: 1000000,
    }
  },
  
  // FIXED: Faster scanning to catch moves
  scanInterval: 15000,          // 15 seconds - main scan loop
  fastPollInterval: 3000,       // 3 seconds - fast poll for new pump.fun tokens
  priceUpdateInterval: 5000,    // 5 seconds - track positions faster
  analysisInterval: 15000,
  outcomeCheckInterval: 15000,  // 15 seconds - check outcomes MUCH more frequently (was 30s)
  
  // FIXED: Multiple outcome check windows (in minutes)
  // EXPANDED: Added 0.5min (30s) and 2min for faster learning
  outcomeWindows: [0.5, 1, 2, 3, 5, 10, 15],   // Check at 30s, 1, 2, 3, 5, 10, 15 minutes
  
  // SLASHED THRESHOLDS - Force detection of real pumps
  pumpThreshold: 6,             // 6% = pump (was 8% - too high, missing +300% moves)
  microPumpThreshold: 3,        // 3-6% = micro-pump (was 4%)
  dumpThreshold: -6,            // -6% = dump (was -8%)
  
  // MFE/MAE thresholds - SLASHED for detection
  mfePumpThreshold: 6,          // 6% MFE at any point = PUMP (was 8%)
  maeDumpThreshold: -6,         // 6% MAE before pump = DUMP (was -8%)
  
  // EXTREME MOVE thresholds (new)
  extremePumpThreshold: 20,     // 20%+ = extreme pump (common in current market)
  extremeDumpThreshold: -20,    // -20% = extreme dump
  
  // Token tracking - MASSIVELY INCREASED
  maxTrackedTokens: 2500,       // Increased from 800 to 2500
  maxTrackTimeMinutes: 20,      // Extended from 10 to 20 min for longer pumps
  tokensPerScan: 200,           // Increased from 150 to 200 for better coverage
  
  // FIXED: Lower data requirements to start trading sooner
  minDataPointsForTraining: 20,
  minDataPointsForVirtualTrading: 30,  // Was 100 - way too high
  confidenceDecayRate: 0.001,
  
  // Learner settings
  learnerMinSamples: 10,        // Start adjusting weights after 10 outcomes (was 20)
  learnerUseScoreAfter: 50,     // Use learner score after 50 data points
};
