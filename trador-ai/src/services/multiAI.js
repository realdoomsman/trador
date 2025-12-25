// MULTI-AI ENGINE - Combines multiple AI models and external tools
import config from '../config.js';

class MultiAIEngine {
  constructor() {
    // API Keys (from config)
    this.geminiKey = config.geminiApiKey;
    this.openaiKey = config.openaiApiKey;
    this.claudeKey = config.claudeApiKey;
    this.groqKey = config.groqApiKey;
    this.perplexityKey = config.perplexityApiKey;
    
    // Track which AIs are available
    this.availableAIs = [];
    this.aiResponses = new Map();
    
    // Consensus tracking
    this.consensusHistory = [];
  }

  async initialize() {
    // Check which AIs are available
    if (this.geminiKey) this.availableAIs.push('gemini');
    if (this.openaiKey) this.availableAIs.push('openai');
    if (this.claudeKey) this.availableAIs.push('claude');
    if (this.groqKey) this.availableAIs.push('groq');
    if (this.perplexityKey) this.availableAIs.push('perplexity');
    
    console.log(`Multi-AI initialized: ${this.availableAIs.length} AIs available (${this.availableAIs.join(', ')})`);
    return this.availableAIs;
  }

  // GEMINI ANALYSIS
  async analyzeWithGemini(tokenData, context) {
    if (!this.geminiKey) return null;
    
    try {
      const prompt = this.buildAnalysisPrompt(tokenData, context);
      
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${this.geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 500
            }
          })
        }
      );
      
      if (!res.ok) return null;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      return this.parseAIResponse(text, 'gemini');
    } catch (err) {
      console.error('Gemini error:', err.message);
      return null;
    }
  }

  // OPENAI GPT-4 ANALYSIS
  async analyzeWithOpenAI(tokenData, context) {
    if (!this.openaiKey) return null;
    
    try {
      const prompt = this.buildAnalysisPrompt(tokenData, context);
      
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'system', content: 'You are a crypto trading analyst. Analyze tokens and provide trading signals. Be concise.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      });
      
      if (!res.ok) return null;
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      
      return this.parseAIResponse(text, 'openai');
    } catch (err) {
      console.error('OpenAI error:', err.message);
      return null;
    }
  }

  // CLAUDE ANALYSIS
  async analyzeWithClaude(tokenData, context) {
    if (!this.claudeKey) return null;
    
    try {
      const prompt = this.buildAnalysisPrompt(tokenData, context);
      
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 500,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });
      
      if (!res.ok) return null;
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      
      return this.parseAIResponse(text, 'claude');
    } catch (err) {
      console.error('Claude error:', err.message);
      return null;
    }
  }

  // GROQ (FAST INFERENCE)
  async analyzeWithGroq(tokenData, context) {
    if (!this.groqKey) return null;
    
    try {
      const prompt = this.buildAnalysisPrompt(tokenData, context);
      
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.groqKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile',
          messages: [
            { role: 'system', content: 'You are a crypto trading analyst. Analyze tokens and provide trading signals. Be concise.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      });
      
      if (!res.ok) return null;
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      
      return this.parseAIResponse(text, 'groq');
    } catch (err) {
      console.error('Groq error:', err.message);
      return null;
    }
  }

  // PERPLEXITY (REAL-TIME WEB SEARCH)
  async searchWithPerplexity(query) {
    if (!this.perplexityKey) return null;
    
    try {
      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.perplexityKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            { role: 'user', content: query }
          ]
        })
      });
      
      if (!res.ok) return null;
      const data = await res.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (err) {
      console.error('Perplexity error:', err.message);
      return null;
    }
  }

  // Build analysis prompt
  buildAnalysisPrompt(tokenData, context) {
    return `Analyze this Solana memecoin for trading potential:

TOKEN: ${tokenData.symbol} (${tokenData.name})
Market Cap: $${(tokenData.marketCap || 0).toLocaleString()}
Liquidity: ${tokenData.liquidity || 0} SOL
Holders: ${tokenData.holders || 0}
24h Volume: $${(tokenData.volume24h || 0).toLocaleString()}
24h Change: ${(tokenData.priceChange24h || 0).toFixed(1)}%
Buy Pressure: ${(tokenData.buyPressure || 50).toFixed(0)}%
Age: ${(tokenData.ageMinutes || 0).toFixed(0)} minutes

${context?.walletRisk ? `Wallet Risk: ${context.walletRisk}/100` : ''}
${context?.hasDevRisk ? 'WARNING: Dev wallet detected' : ''}
${context?.hasClusterRisk ? 'WARNING: Coordinated holding detected' : ''}

Respond in this exact format:
SIGNAL: [BUY/SELL/HOLD]
CONFIDENCE: [0-100]
RISK: [LOW/MEDIUM/HIGH]
REASONING: [one sentence]`;
  }

  // Parse AI response into structured data
  parseAIResponse(text, source) {
    const result = {
      source,
      signal: 'HOLD',
      confidence: 50,
      risk: 'MEDIUM',
      reasoning: '',
      raw: text
    };

    try {
      // Extract signal
      const signalMatch = text.match(/SIGNAL:\s*(BUY|SELL|HOLD)/i);
      if (signalMatch) result.signal = signalMatch[1].toUpperCase();

      // Extract confidence
      const confMatch = text.match(/CONFIDENCE:\s*(\d+)/i);
      if (confMatch) result.confidence = parseInt(confMatch[1]);

      // Extract risk
      const riskMatch = text.match(/RISK:\s*(LOW|MEDIUM|HIGH)/i);
      if (riskMatch) result.risk = riskMatch[1].toUpperCase();

      // Extract reasoning
      const reasonMatch = text.match(/REASONING:\s*(.+)/i);
      if (reasonMatch) result.reasoning = reasonMatch[1].trim();
    } catch (err) {
      // Return defaults on parse error
    }

    return result;
  }

  // GET MULTI-AI CONSENSUS
  async getConsensus(tokenData, context) {
    const analyses = [];
    
    // Run all available AIs in parallel
    const promises = [];
    
    if (this.geminiKey) {
      promises.push(this.analyzeWithGemini(tokenData, context).then(r => r && analyses.push(r)));
    }
    if (this.openaiKey) {
      promises.push(this.analyzeWithOpenAI(tokenData, context).then(r => r && analyses.push(r)));
    }
    if (this.claudeKey) {
      promises.push(this.analyzeWithClaude(tokenData, context).then(r => r && analyses.push(r)));
    }
    if (this.groqKey) {
      promises.push(this.analyzeWithGroq(tokenData, context).then(r => r && analyses.push(r)));
    }
    
    await Promise.allSettled(promises);
    
    if (analyses.length === 0) {
      return { consensus: 'HOLD', confidence: 0, analyses: [], agreement: 0 };
    }

    // Calculate consensus
    const buyVotes = analyses.filter(a => a.signal === 'BUY').length;
    const sellVotes = analyses.filter(a => a.signal === 'SELL').length;
    const holdVotes = analyses.filter(a => a.signal === 'HOLD').length;
    
    let consensus = 'HOLD';
    if (buyVotes > sellVotes && buyVotes > holdVotes) consensus = 'BUY';
    if (sellVotes > buyVotes && sellVotes > holdVotes) consensus = 'SELL';
    
    // Calculate agreement percentage
    const maxVotes = Math.max(buyVotes, sellVotes, holdVotes);
    const agreement = (maxVotes / analyses.length) * 100;
    
    // Average confidence
    const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;
    
    // Weighted confidence (higher if more agreement)
    const weightedConfidence = avgConfidence * (agreement / 100);

    const result = {
      consensus,
      confidence: Math.round(weightedConfidence),
      avgConfidence: Math.round(avgConfidence),
      agreement: Math.round(agreement),
      votes: { buy: buyVotes, sell: sellVotes, hold: holdVotes },
      analyses,
      aiCount: analyses.length
    };

    // Track consensus history
    this.consensusHistory.push({
      token: tokenData.symbol,
      ...result,
      timestamp: Date.now()
    });
    
    // Keep last 100
    if (this.consensusHistory.length > 100) {
      this.consensusHistory = this.consensusHistory.slice(-100);
    }

    return result;
  }

  // SEARCH FOR TOKEN NEWS/ALPHA
  async searchTokenAlpha(symbol, name) {
    if (!this.perplexityKey) return null;
    
    const query = `Latest news and sentiment about ${symbol} ${name} Solana memecoin in the last 24 hours. Is there any hype, FUD, or notable events? Be brief.`;
    
    const result = await this.searchWithPerplexity(query);
    
    if (!result) return null;
    
    // Analyze sentiment from search results
    const sentiment = this.analyzeSentiment(result);
    
    return {
      news: result,
      sentiment,
      hasAlpha: result.toLowerCase().includes('launch') || 
                result.toLowerCase().includes('partnership') ||
                result.toLowerCase().includes('listing') ||
                result.toLowerCase().includes('viral')
    };
  }

  // Simple sentiment analysis
  analyzeSentiment(text) {
    const lower = text.toLowerCase();
    
    const bullishWords = ['moon', 'pump', 'bullish', 'buy', 'launch', 'partnership', 'listing', 'viral', 'trending', 'gem', 'alpha'];
    const bearishWords = ['dump', 'rug', 'scam', 'bearish', 'sell', 'crash', 'dead', 'avoid', 'warning', 'fake'];
    
    let bullScore = 0;
    let bearScore = 0;
    
    for (const word of bullishWords) {
      if (lower.includes(word)) bullScore++;
    }
    for (const word of bearishWords) {
      if (lower.includes(word)) bearScore++;
    }
    
    if (bullScore > bearScore + 1) return 'BULLISH';
    if (bearScore > bullScore + 1) return 'BEARISH';
    return 'NEUTRAL';
  }

  // Get status
  getStatus() {
    return {
      availableAIs: this.availableAIs,
      aiCount: this.availableAIs.length,
      recentConsensus: this.consensusHistory.slice(-10),
      hasGemini: !!this.geminiKey,
      hasOpenAI: !!this.openaiKey,
      hasClaude: !!this.claudeKey,
      hasGroq: !!this.groqKey,
      hasPerplexity: !!this.perplexityKey
    };
  }
}

export default new MultiAIEngine();
