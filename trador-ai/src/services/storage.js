import fs from 'fs';
import path from 'path';

class CloudStorage {
  constructor() {
    this.localCache = './data/cache';
    this.useCloud = false; // Disabled for now - using local storage
    this.ensureLocalCache();
  }

  ensureLocalCache() {
    if (!fs.existsSync(this.localCache)) {
      fs.mkdirSync(this.localCache, { recursive: true });
    }
  }

  // Save training data point
  async saveDataPoint(category, data) {
    const timestamp = Date.now();
    const filename = `training/${category}/${timestamp}.json`;
    const content = JSON.stringify({ ...data, timestamp });
    
    const localPath = path.join(this.localCache, filename);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, content);
    return true;
  }

  // Save batch of data points
  async saveBatch(category, dataPoints) {
    const timestamp = Date.now();
    const filename = `training/${category}/batch_${timestamp}.json`;
    const content = JSON.stringify({ dataPoints, timestamp, count: dataPoints.length });
    
    const localPath = path.join(this.localCache, filename);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, content);
    return true;
  }

  // Get total data size
  async getDataSize() {
    return this.getLocalDataSize();
  }

  getLocalDataSize() {
    const getSize = (dir) => {
      if (!fs.existsSync(dir)) return 0;
      let size = 0;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          size += getSize(filePath);
        } else {
          size += stat.size;
        }
      }
      return size;
    };
    return getSize(this.localCache);
  }

  // Get data point count
  async getDataPointCount() {
    const countFiles = (dir) => {
      if (!fs.existsSync(dir)) return 0;
      let count = 0;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          count += countFiles(filePath);
        } else {
          count++;
        }
      }
      return count;
    };
    return countFiles(this.localCache);
  }

  // Load training data for analysis
  async loadTrainingData(category, limit = 1000) {
    const dir = path.join(this.localCache, 'training', category);
    if (!fs.existsSync(dir)) return [];
    
    const files = fs.readdirSync(dir).slice(-limit);
    const data = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        data.push(JSON.parse(content));
      } catch (err) {}
    }
    return data;
  }

  // Save model state
  async saveModelState(state) {
    const localPath = path.join(this.localCache, 'model_state.json');
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, JSON.stringify(state));
  }

  // Load model state
  async loadModelState() {
    const localPath = path.join(this.localCache, 'model_state.json');
    if (fs.existsSync(localPath)) {
      return JSON.parse(fs.readFileSync(localPath, 'utf8'));
    }
    return null;
  }

  // Save virtual trade
  async saveVirtualTrade(trade) {
    const dir = path.join(this.localCache, 'virtual_trades');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${trade.id}.json`), JSON.stringify(trade));
  }

  // Load virtual trades
  async loadVirtualTrades(days = 30) {
    const dir = path.join(this.localCache, 'virtual_trades');
    if (!fs.existsSync(dir)) return [];
    
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const trades = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        const trade = JSON.parse(content);
        if (trade.timestamp >= cutoff || trade.entryTime >= cutoff) {
          trades.push(trade);
        }
      } catch (err) {}
    }
    return trades;
  }

  // Save learner state (self-learning AI)
  async saveLearnerState(state) {
    const localPath = path.join(this.localCache, 'learner_state.json');
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, JSON.stringify(state, null, 2));
  }

  // Load learner state
  async loadLearnerState() {
    const localPath = path.join(this.localCache, 'learner_state.json');
    if (fs.existsSync(localPath)) {
      return JSON.parse(fs.readFileSync(localPath, 'utf8'));
    }
    return null;
  }

  // Save outcome for learning
  async saveOutcome(outcome) {
    const dir = path.join(this.localCache, 'outcomes');
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${Date.now()}_${outcome.outcome}.json`;
    fs.writeFileSync(path.join(dir, filename), JSON.stringify(outcome));
  }

  // Load recent outcomes for optimization
  async loadRecentOutcomes(limit = 100) {
    const dir = path.join(this.localCache, 'outcomes');
    if (!fs.existsSync(dir)) return [];
    
    const files = fs.readdirSync(dir).sort().slice(-limit);
    const outcomes = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        outcomes.push(JSON.parse(content));
      } catch (err) {}
    }
    return outcomes;
  }

  // Save alpha engine state
  async saveAlphaState(state) {
    const localPath = path.join(this.localCache, 'alpha_state.json');
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, JSON.stringify(state, null, 2));
  }

  // Load alpha engine state
  async loadAlphaState() {
    const localPath = path.join(this.localCache, 'alpha_state.json');
    if (fs.existsSync(localPath)) {
      return JSON.parse(fs.readFileSync(localPath, 'utf8'));
    }
    return null;
  }

  // Save wallet intelligence data
  async saveWalletIntel(data) {
    const localPath = path.join(this.localCache, 'wallet_intel.json');
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, JSON.stringify(data, null, 2));
  }

  // Load wallet intelligence data
  async loadWalletIntel() {
    const localPath = path.join(this.localCache, 'wallet_intel.json');
    if (fs.existsSync(localPath)) {
      return JSON.parse(fs.readFileSync(localPath, 'utf8'));
    }
    return null;
  }
}

export default new CloudStorage();
