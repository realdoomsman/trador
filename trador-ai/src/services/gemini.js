import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config.js';

class GeminiAnalyzer {
  constructor() {
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    // Use gemini-1.5-flash (gemini-pro is deprecated)
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    this.analysisCache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
    this.geminiEnabled = !!config.geminiApiKey;
  }

  // Analyze a token for trading potential
  async analyzeToken(tokenData, marketContext, historicalPatterns) {
    const cacheKey = `${tokenData.mint}_${Math.floor(Date.now() / this.cacheTimeout)}`;
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    // Use rule-based analysis as fallback when Gemini fails or is disabled
    if (this.geminiEnabled) {
      try {
        const analysis = await this.geminiAnalyze(tokenData, marketContext, historicalPatterns);
        if (analysis && analysis.confidence > 0) {
          this.analysisCache.set(cacheKey, analysis);
          return analysis;
        }
      } catch (err) {
        // Gemini failed, use rule-based silently
      }
    }

    // Rule-based analysis fallback
    const analysis = this.ruleBasedAnalysis(tokenData);
    this.analysisCache.set(cacheKey, analysis);
    return analysis;
  }

  ruleBasedAnalysis(tokenData) {
    let score = 50;
    const redFlags = [];
    const greenFlags = [];

    // Market cap scoring
    const mcap = tokenData.usd_market_cap || 0;
    if (mcap >= 10000 && mcap <= 100000) { score += 15; greenFlags.push('Good market cap range'); }
    else if (mcap > 100000 && mcap <= 500000) { score += 10; greenFlags.push('Mid market cap'); }
    else if (mcap < 5000) { score -= 20; redFlags.push('Market cap too low'); }
    else if (mcap > 1000000) { score -= 10; redFlags.push('Market cap too high'); }

    // Liquidity scoring
    const liq = tokenData.virtual_sol_reserves || 0;
    if (liq >= 10) { score += 10; greenFlags.push('Good liquidity'); }
    else if (liq < 2) { score -= 15; redFlags.push('Low liquidity'); }

    // Holder scoring
    const holders = tokenData.holder_count || 0;
    if (holders >= 50) { score += 10; greenFlags.push('Good holder count'); }
    else if (holders < 10) { score -= 10; redFlags.push('Few holders'); }

    // Volume scoring
    const vol = tokenData.volume24h || 0;
    if (vol > 10000) { score += 10; greenFlags.push('High volume'); }

    // Price change scoring
    const change = tokenData.priceChange24h || 0;
    if (change > 10 && change < 100) { score += 5; greenFlags.push('Positive momentum'); }
    else if (change > 200) { score -= 10; redFlags.push('Possibly overextended'); }
    else if (change < -30) { score -= 10; redFlags.push('Downtrend'); }

    const confidence = Math.max(0, Math.min(100, score));
    
    return {
      recommendation: confidence >= 65 ? 'BUY' : confidence >= 45 ? 'HOLD' : 'AVOID',
      confidence,
      reasoning: `Rule-based analysis: ${greenFlags.length} positive, ${redFlags.length} negative signals`,
      riskLevel: confidence >= 70 ? 'low' : confidence >= 50 ? 'medium' : 'high',
      suggestedEntry: tokenData.price,
      suggestedStopLoss: tokenData.price * 0.85,
      suggestedTakeProfit: tokenData.price * 1.5,
      timeHorizon: 'hours',
      redFlags,
      greenFlags
    };
  }

  async geminiAnalyze(tokenData, marketContext, historicalPatterns) {

    const prompt = `You are a crypto trading AI analyzing Pump.fun memecoins on Solana. Analyze this token and provide a trading recommendation.

TOKEN DATA:
- Name: ${tokenData.name}
- Symbol: ${tokenData.symbol}
- Mint: ${tokenData.mint}
- Market Cap: $${tokenData.marketCap?.toLocaleString() || 'Unknown'}
- Liquidity: ${tokenData.liquidity || 'Unknown'} SOL
- Holders: ${tokenData.holders || 'Unknown'}
- Age: ${tokenData.ageMinutes || 'Unknown'} minutes
- 24h Volume: $${tokenData.volume24h?.toLocaleString() || 'Unknown'}
- Price Change 1h: ${tokenData.priceChange1h || 'Unknown'}%
- Transaction Count (24h): ${tokenData.txCount || 'Unknown'}

MARKET CONTEXT:
- SOL Price: $${marketContext.solPrice}
- Market Sentiment: ${marketContext.sentiment}
- Recent Pump.fun Activity: ${marketContext.pumpfunActivity}

HISTORICAL PATTERNS FROM TRAINING DATA:
${historicalPatterns ? JSON.stringify(historicalPatterns, null, 2) : 'No historical data yet'}

Respond in JSON format only:
{
  "recommendation": "BUY" | "SELL" | "HOLD" | "AVOID",
  "confidence": 0-100,
  "reasoning": "brief explanation",
  "riskLevel": "low" | "medium" | "high",
  "suggestedEntry": number or null,
  "suggestedStopLoss": number or null,
  "suggestedTakeProfit": number or null,
  "timeHorizon": "minutes" | "hours" | "days",
  "redFlags": ["list of concerns"],
  "greenFlags": ["list of positives"]
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON in response');
      }
      
      const analysis = JSON.parse(jsonMatch[0]);
      return analysis;
    } catch (err) {
      console.error('Gemini analysis failed:', err.message);
      return null;
    }
  }

  // Analyze market patterns from historical data
  async analyzePatterns(trainingData) {
    if (!trainingData || trainingData.length < 100) {
      return null;
    }

    const prompt = `Analyze these historical Pump.fun token trading patterns and identify what makes a successful trade.

TRAINING DATA (${trainingData.length} samples):
${JSON.stringify(trainingData.slice(-50), null, 2)}

Identify:
1. Common characteristics of tokens that pumped 2x+
2. Common characteristics of tokens that dumped
3. Optimal entry timing patterns
4. Red flags to avoid
5. Market cap sweet spots

Respond in JSON:
{
  "successPatterns": ["list"],
  "failurePatterns": ["list"],
  "optimalEntryConditions": {},
  "redFlags": ["list"],
  "marketCapSweetSpot": { "min": number, "max": number },
  "avgHoldTime": "string",
  "confidenceInPatterns": 0-100
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (err) {
      console.error('Pattern analysis failed:', err.message);
      return null;
    }
  }

  // Get market sentiment
  async getMarketSentiment(recentTokens) {
    const prompt = `Based on these recent Pump.fun token launches, what's the current market sentiment?

Recent tokens (last hour):
${JSON.stringify(recentTokens.slice(0, 20).map(t => ({
  name: t.name,
  marketCap: t.usd_market_cap,
  created: t.created_timestamp
})), null, 2)}

Respond in JSON:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": 0-100,
  "reasoning": "brief",
  "tradingAdvice": "string"
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { sentiment: 'neutral', confidence: 50 };
    } catch (err) {
      return { sentiment: 'neutral', confidence: 50, reasoning: 'Analysis unavailable' };
    }
  }

  // Evaluate a completed trade for learning
  async evaluateTrade(tradeData) {
    const prompt = `Evaluate this completed trade for learning purposes.

TRADE DATA:
- Token: ${tradeData.symbol}
- Entry Price: ${tradeData.entryPrice}
- Exit Price: ${tradeData.exitPrice}
- PnL: ${tradeData.pnlPercent}%
- Hold Time: ${tradeData.holdTimeMinutes} minutes
- Entry Market Cap: $${tradeData.entryMarketCap}
- Exit Market Cap: $${tradeData.exitMarketCap}
- Entry Reasoning: ${tradeData.entryReasoning}

What can we learn from this trade? Respond in JSON:
{
  "wasGoodEntry": boolean,
  "wasGoodExit": boolean,
  "lessonsLearned": ["list"],
  "shouldHaveAvoided": boolean,
  "improvementSuggestions": ["list"]
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (err) {
      return null;
    }
  }
}

export default new GeminiAnalyzer();
