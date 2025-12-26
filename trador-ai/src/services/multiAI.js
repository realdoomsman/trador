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
    // Debug: Log which keys are present
    console.log('Multi-AI Key Check:', {
      gemini: this.geminiKey ? `${this.geminiKey.slice(0, 10)}...` : 'NOT SET',
      openai: this.openaiKey ? `${this.openaiKey.slice(0, 10)}...` : 'NOT SET',
      claude: this.claudeKey ? `${this.claudeKey.slice(0, 10)}...` : 'NOT SET',
      groq: this.groqKey ? `${this.groqKey.slice(0, 10)}...` : 'NOT SET',
      perplexity: this.perplexityKey ? `${this.perplexityKey.slice(0, 10)}...` : 'NOT SET'
    });
    
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

  // GET MULTI-AI CONSENSUS - WITH RACE/THRESHOLD LOGIC
  // OPTIMIZED: Only call slow AIs when fast ones disagree or have low confidence
  // NEW: For tokens < 2min old, use FAST-AI ONLY path with 600ms timeout
  async getConsensus(tokenData, context) {
    const analyses = [];
    const startTime = Date.now();
    const tokenAge = tokenData.ageMinutes || tokenData.tokenAge || 60;
    
    // FAST-AI ONLY PATH: For tokens < 2 minutes old, skip slow AIs entirely
    // Speed is more important than "deep" reasoning for the initial Pump.fun burst
    const isEarlyToken = tokenAge < 2;
    const fastTimeout = isEarlyToken ? 600 : 1000; // 600ms for early tokens, 1s otherwise
    
    // FAST AIs first (Groq ~200ms, Gemini ~500ms)
    // SLOW AIs second (Claude ~1-2s, OpenAI ~1-2s)
    const fastAIs = [];
    const slowAIs = [];
    
    if (this.groqKey) fastAIs.push(() => this.analyzeWithGroq(tokenData, context));
    if (this.geminiKey) fastAIs.push(() => this.analyzeWithGemini(tokenData, context));
    if (this.claudeKey) slowAIs.push(() => this.analyzeWithClaude(tokenData, context));
    if (this.openaiKey) slowAIs.push(() => this.analyzeWithOpenAI(tokenData, context));
    
    // PHASE 1: Race fast AIs with timeout
    if (fastAIs.length > 0) {
      const fastPromises = fastAIs.map(fn => 
        Promise.race([
          fn(),
          new Promise(resolve => setTimeout(() => resolve(null), fastTimeout))
        ])
      );
      
      const fastResults = await Promise.allSettled(fastPromises);
      for (const result of fastResults) {
        if (result.status === 'fulfilled' && result.value) {
          analyses.push(result.value);
        }
      }
      
      // EARLY EXIT for early tokens: If fast AIs timed out, skip the trade
      if (isEarlyToken && analyses.length === 0) {
        console.log(`[AI-RACE] Early token ${tokenData.symbol} - fast AIs timed out (${Date.now() - startTime}ms), skipping`);
        return { 
          consensus: 'SKIP', 
          confidence: 0, 
          analyses: [], 
          agreement: 0, 
          wasEarlyExit: true,
          reason: 'fast_ai_timeout'
        };
      }
      
      // EARLY EXIT: If 2+ fast AIs agree with high confidence, skip slow AIs
      if (analyses.length >= 2) {
        const earlyConsensus = this.checkEarlyConsensus(analyses);
        if (earlyConsensus) {
          console.log(`[AI-RACE] Early consensus: ${earlyConsensus.consensus} (${Date.now() - startTime}ms)`);
          return this.buildConsensusResult(analyses, tokenData, true);
        }
      }
      
      // EARLY EXIT: If 1 fast AI has very high confidence (90%+), trust it
      if (analyses.length >= 1) {
        const strongSignal = analyses.find(a => a.confidence >= 90);
        if (strongSignal) {
          console.log(`[AI-RACE] Strong signal from ${strongSignal.source}: ${strongSignal.signal} (${Date.now() - startTime}ms)`);
          return this.buildConsensusResult(analyses, tokenData, true);
        }
      }
    }
    
    // PHASE 2: SKIP SLOW AIs for early tokens (< 2 min old)
    // Waiting 2 seconds for Claude/OpenAI on a 45-second-old token makes us buy the "local top"
    if (isEarlyToken) {
      console.log(`[AI-RACE] Early token ${tokenData.symbol} - fast-only path (${Date.now() - startTime}ms)`);
      return this.buildConsensusResult(analyses, tokenData, true);
    }
    
    // PHASE 2: Only run slow AIs for older tokens if fast ones disagree or have low confidence
    // Use shorter 2s timeout (reduced from 3s)
    const needSlowAIs = analyses.length < 2 || 
      analyses.some(a => a.confidence < 60) ||
      (analyses[0]?.signal !== analyses[1]?.signal);
    
    if (slowAIs.length > 0 && needSlowAIs) {
      const slowPromises = slowAIs.map(fn =>
        Promise.race([
          fn(),
          new Promise(resolve => setTimeout(() => resolve(null), 2000))
        ])
      );
      
      const slowResults = await Promise.allSettled(slowPromises);
      for (const result of slowResults) {
        if (result.status === 'fulfilled' && result.value) {
          analyses.push(result.value);
        }
      }
    }
    
    console.log(`[AI-RACE] ${needSlowAIs ? 'Full' : 'Fast-only'} consensus: ${analyses.length} AIs (${Date.now() - startTime}ms)`);
    return this.buildConsensusResult(analyses, tokenData, !needSlowAIs);
  }

  // Check if fast AIs have strong agreement (for early exit)
  checkEarlyConsensus(analyses) {
    if (analyses.length < 2) return null;
    
    const buyVotes = analyses.filter(a => a.signal === 'BUY');
    const sellVotes = analyses.filter(a => a.signal === 'SELL');
    
    // Both fast AIs say BUY with 80%+ confidence
    if (buyVotes.length >= 2) {
      const avgConf = buyVotes.reduce((s, a) => s + a.confidence, 0) / buyVotes.length;
      if (avgConf >= 80) return { consensus: 'BUY', confidence: avgConf };
    }
    
    // Both fast AIs say SELL with 80%+ confidence
    if (sellVotes.length >= 2) {
      const avgConf = sellVotes.reduce((s, a) => s + a.confidence, 0) / sellVotes.length;
      if (avgConf >= 80) return { consensus: 'SELL', confidence: avgConf };
    }
    
    // One says STRONG BUY (90%+ confidence)
    const strongBuy = analyses.find(a => a.signal === 'BUY' && a.confidence >= 90);
    if (strongBuy) return { consensus: 'BUY', confidence: strongBuy.confidence };
    
    return null;
  }

  // Build final consensus result
  buildConsensusResult(analyses, tokenData, wasEarlyExit) {
    if (analyses.length === 0) {
      return { consensus: 'HOLD', confidence: 0, analyses: [], agreement: 0, wasEarlyExit: false };
    }

    const buyVotes = analyses.filter(a => a.signal === 'BUY').length;
    const sellVotes = analyses.filter(a => a.signal === 'SELL').length;
    const holdVotes = analyses.filter(a => a.signal === 'HOLD').length;
    
    let consensus = 'HOLD';
    if (buyVotes > sellVotes && buyVotes > holdVotes) consensus = 'BUY';
    if (sellVotes > buyVotes && sellVotes > holdVotes) consensus = 'SELL';
    
    const maxVotes = Math.max(buyVotes, sellVotes, holdVotes);
    const agreement = (maxVotes / analyses.length) * 100;
    const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;
    const weightedConfidence = avgConfidence * (agreement / 100);

    const result = {
      consensus,
      confidence: Math.round(weightedConfidence),
      avgConfidence: Math.round(avgConfidence),
      agreement: Math.round(agreement),
      votes: { buy: buyVotes, sell: sellVotes, hold: holdVotes },
      analyses,
      aiCount: analyses.length,
      wasEarlyExit
    };

    // Track history
    this.consensusHistory.push({
      token: tokenData.symbol,
      ...result,
      timestamp: Date.now()
    });
    
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
