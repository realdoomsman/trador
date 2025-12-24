import config from '../config.js';

class RateLimiter {
  constructor() {
    const plan = config.heliusPlan || 'free';
    const limits = config.heliusRateLimits[plan];
    this.maxRps = limits.rps;
    this.dailyCredits = limits.dailyCredits;
    this.usedCredits = 0;
    this.requestTimes = [];
    this.lastReset = Date.now();
  }

  async throttle() {
    // Reset daily credits at midnight
    if (Date.now() - this.lastReset > 86400000) {
      this.usedCredits = 0;
      this.lastReset = Date.now();
    }

    // Check daily limit
    if (this.usedCredits >= this.dailyCredits * 0.95) {
      console.log('Approaching daily credit limit, slowing down...');
      await this.sleep(1000);
    }

    // RPS limiting
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(t => now - t < 1000);
    
    if (this.requestTimes.length >= this.maxRps) {
      const waitTime = 1000 - (now - this.requestTimes[0]);
      if (waitTime > 0) await this.sleep(waitTime);
    }
    
    this.requestTimes.push(Date.now());
    this.usedCredits++;
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  getUsage() {
    return {
      usedCredits: this.usedCredits,
      dailyCredits: this.dailyCredits,
      percentUsed: ((this.usedCredits / this.dailyCredits) * 100).toFixed(2)
    };
  }
}

export default new RateLimiter();
