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
  // FREE: 10 RPS, 100k credits/day
  // DEVELOPER: 50 RPS, 500k credits/day  
  // BUSINESS: 200 RPS, 2M credits/day
  // PROFESSIONAL: 500 RPS, 5M credits/day
  heliusApiKey: process.env.HELIUS_API_KEY,
  heliusRpcUrl: process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
  heliusPlan: process.env.HELIUS_PLAN || 'free', // free, developer, business, professional
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
  gpuWorkers: parseInt(process.env.GPU_WORKERS) || 4, // L4 has good parallelism
  
  // AI Confidence Thresholds
  minConfidenceVirtual: parseInt(process.env.MIN_CONFIDENCE_FOR_VIRTUAL) || 60,
  minConfidenceLive: parseInt(process.env.MIN_CONFIDENCE_FOR_LIVE) || 85,
  
  // Risk Profiles
  riskProfiles: {
    low: {
      maxPositionSize: 0.02,    // 2% of portfolio
      stopLoss: 0.05,           // 5% stop loss
      takeProfit: 0.10,         // 10% take profit
      maxDailyTrades: 3,
      minMarketCap: 100000,     // $100k minimum
      maxMarketCap: 5000000,    // $5M maximum
    },
    medium: {
      maxPositionSize: 0.05,    // 5% of portfolio
      stopLoss: 0.10,           // 10% stop loss
      takeProfit: 0.25,         // 25% take profit
      maxDailyTrades: 8,
      minMarketCap: 25000,      // $25k minimum
      maxMarketCap: 2000000,    // $2M maximum
    },
    high: {
      maxPositionSize: 0.10,    // 10% of portfolio
      stopLoss: 0.20,           // 20% stop loss
      takeProfit: 0.50,         // 50% take profit
      maxDailyTrades: 15,
      minMarketCap: 5000,       // $5k minimum
      maxMarketCap: 500000,     // $500k maximum
    }
  },
  
  // Data collection intervals (optimized for Birdeye Standard - 500 req/min)
  scanInterval: 20000,          // 20 seconds - faster scanning with Standard plan
  priceUpdateInterval: 10000,   // 10 seconds
  analysisInterval: 20000,      // 20 seconds
  
  // Learning thresholds (lowered for faster iteration)
  minDataPointsForTraining: 50,
  minDataPointsForVirtualTrading: 100,
  confidenceDecayRate: 0.001,   // Decay per hour without new data
};
