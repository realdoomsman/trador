import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

export default {
  // API Keys
  gcsBucket: process.env.GOOGLE_CLOUD_BUCKET || 'trador-ai-data',
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  claudeApiKey: process.env.CLAUDE_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  perplexityApiKey: process.env.PERPLEXITY_API_KEY,
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
  privateKey: process.env.PRIVATE_KEY,
  
  // Ports
  dashboardPort: parseInt(process.env.DASHBOARD_PORT) || 3002,
  apiPort: parseInt(process.env.API_PORT) || 3003,
  
  // ============================================================================
  // SCANNING - How often to look for tokens
  // ============================================================================
  scanInterval: 10000,          // 10 seconds
  fastPollInterval: 2000,       // 2 seconds for new launches
  priceUpdateInterval: 5000,    // 5 seconds
  outcomeCheckInterval: 10000,  // 10 seconds
  
  // ============================================================================
  // TRACKING - What to track and for how long
  // ============================================================================
  maxTrackedTokens: 5000,       // Track lots of tokens
  maxTrackTimeMinutes: 60,      // Track for 1 hour - let AI learn optimal hold time
  tokensPerScan: 300,           // Scan many tokens
  
  // Outcome windows - AI learns which windows matter
  outcomeWindows: [1, 2, 5, 10, 15, 30, 45, 60],
  
  // ============================================================================
  // THRESHOLDS - Real pump.fun tokens move 50-500%+
  // ============================================================================
  // Memecoins move HARD - 5% is noise, 50%+ is a real pump
  initialPumpThreshold: 50,     // 50% = pump (real movement)
  initialDumpThreshold: -30,    // -30% = dump
  strongPumpThreshold: 100,     // 100% = 2x = strong pump
  strongDumpThreshold: -50,     // -50% = strong dump
  massivePumpThreshold: 200,    // 200% = 3x = massive pump
  moonshotThreshold: 500,       // 500% = 6x = MOONSHOT 🚀
  
  // ============================================================================
  // POSITION SIZING - AI learns optimal sizing
  // ============================================================================
  defaultPositionSize: 0.03,    // 3% default, AI can adjust
  maxPositionSize: 0.10,        // Never more than 10%
  minPositionSize: 0.01,        // Never less than 1%
  
  // ============================================================================
  // FILTERS - Minimal hardcoded filters, AI learns the rest
  // ============================================================================
  // Only filter out obvious garbage
  absoluteMinMarketCap: 1000,   // $1k minimum (not dead)
  absoluteMaxMarketCap: 10000000, // $10M max (still tradeable)
  maxTokenAge: 60,              // Max 60 min old
  maxSniperCount: 25,           // Bundle protection
  
  // ============================================================================
  // LEARNING - How fast the AI adapts
  // ============================================================================
  learnerMinSamples: 5,         // Start learning after 5 outcomes
  learnerLearningRate: 0.1,     // How fast to adjust weights
  learnerDecayRate: 0.001,      // Confidence decay
  
  // Confidence thresholds
  minConfidenceVirtual: 20,     // Low bar to take shots
  minConfidenceLive: 60,        // Higher bar for real money
};
