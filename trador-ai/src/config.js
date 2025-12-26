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
  outcomeCheckInterval: 30000,  // 30 seconds - check outcomes more frequently
  
  // FIXED: Multiple outcome check windows (in minutes)
  // Added 1-minute window for faster learning on memecoins
  outcomeWindows: [1, 3, 5, 10],   // Check at 1, 3, 5, and 10 minutes
  pumpThreshold: 8,             // 8% = pump (lowered from 10% - most good pumps are 8-12%)
  microPumpThreshold: 4,        // 4-8% = micro-pump
  dumpThreshold: -8,            // -8% = dump (lowered from -10%)
  
  // MFE/MAE thresholds - LOWERED for faster detection
  mfePumpThreshold: 8,          // 8% MFE at any point = PUMP (was 15%)
  maeDumpThreshold: -8,         // 8% MAE before pump = DUMP (was -10%)
  
  // Token tracking
  maxTrackedTokens: 800,        // Increased from 300 to 800
  maxTrackTimeMinutes: 10,      // Max tracking time
  tokensPerScan: 100,           // Increased from 35 to 100
  
  // FIXED: Lower data requirements to start trading sooner
  minDataPointsForTraining: 20,
  minDataPointsForVirtualTrading: 30,  // Was 100 - way too high
  confidenceDecayRate: 0.001,
  
  // Learner settings
  learnerMinSamples: 10,        // Start adjusting weights after 10 outcomes (was 20)
  learnerUseScoreAfter: 50,     // Use learner score after 50 data points
};
