import 'dotenv/config';

export const config = {
  rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
  privateKey: process.env.PRIVATE_KEY || '',
  tradorMint: process.env.TRADOR_MINT || '',
  
  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  
  // Dashboard API
  dashboardPort: parseInt(process.env.DASHBOARD_PORT) || 3001,
  
  // Wallet reserves - AGGRESSIVE
  minSolReserve: parseFloat(process.env.MIN_SOL_RESERVE) || 0.5,
  riskBudgetPercent: 0.95, // Use 95% of available
  
  // Buyback settings - ALL PROFITS GO TO BUYBACK
  buybackThreshold: 0.1, // Buyback at just 0.1 SOL profit
  buybackPercent: 1.0, // 100% of profits
  buybackCooldownMs: 60 * 1000, // 1 minute cooldown
  
  // Scan settings
  scanIntervalMs: parseInt(process.env.SCAN_INTERVAL) || 5000,
  tradeCooldownMs: 10 * 1000, // 10 seconds between trades
  
  // AGGRESSIVE Tier definitions - HIGH RISK HIGH REWARD
  tiers: {
    A: {
      name: 'DEGEN MICRO',
      mcapMax: 25000,
      minAge: 3 * 60 * 1000, // 3 minutes - catch em early
      minLiquidity: 5, // Lower liquidity ok
      minVolume1m: 2,
      minVolume5m: 15,
      minTrades5m: 30,
      maxSlippage: 0.12, // Accept 12% slippage
      maxPriceMove1m: 2.0, // Allow 200% pumps
      positionSizePercent: 0.15, // 15% of wallet
      positionMaxSol: 5,
      takeProfit: 1.0, // 100% TP - MOON OR NOTHING
      stopLoss: -0.35, // 35% SL - give it room
      maxHoldMs: 30 * 60 * 1000, // 30 min max
      trailingTrigger: 0.50, // Trail after 50%
      trailingStop: 0.20
    },
    B: {
      name: 'MOMENTUM PLAY',
      mcapMin: 25000,
      mcapMax: 150000,
      minAge: 10 * 60 * 1000,
      minLiquidity: 20,
      minVolume5m: 80,
      maxSlippage: 0.08,
      maxPriceMove15m: 3.0,
      positionSizePercent: 0.25, // 25% of wallet
      positionMaxSol: 10,
      takeProfit: 0.60, // 60% TP
      stopLoss: -0.25,
      maxHoldMs: 45 * 60 * 1000,
      trailingTrigger: 0.30,
      trailingStop: 0.15
    },
    C: {
      name: 'SAFER SWING',
      mcapMin: 150000,
      minAge: 30 * 60 * 1000,
      minLiquidity: 80,
      minVolume15m: 300,
      maxSlippage: 0.04,
      positionSizePercent: 0.40, // 40% of wallet
      positionMaxSol: 20,
      takeProfit: 0.35,
      stopLoss: -0.15,
      maxHoldMs: 2 * 60 * 60 * 1000,
      trailingTrigger: 0.18,
      trailingStop: 0.08
    }
  },
  
  // Scoring weights - favor VOLUME and MOMENTUM
  scoring: {
    A: { volumeAccel: 0.35, tradeCount: 0.15, momentum: 0.40, liquidity: 0.10 },
    B: { volumeAccel: 0.40, momentum: 0.35, liquidity: 0.25 },
    C: { volumeAccel: 0.45, liquidity: 0.35, age: 0.20 }
  }
};
