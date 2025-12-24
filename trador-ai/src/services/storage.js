import { Storage } from '@google-cloud/storage';
import config from '../config.js';
import fs from 'fs';
import path from 'path';

class CloudStorage {
  constructor() {
    this.storage = new Storage();
    this.bucket = this.storage.bucket(config.gcsBucket);
    this.localCache = './data/cache';
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
    
    try {
      await this.bucket.file(filename).save(content, {
        contentType: 'application/json',
        metadata: { category, timestamp: timestamp.toString() }
      });
      return true;
    } catch (err) {
      console.error('Failed to save to GCS:', err.message);
      // Fallback to local storage
      const localPath = path.join(this.localCache, filename);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, content);
      return true;
    }
  }

  // Save batch of data points
  async saveBatch(category, dataPoints) {
    const timestamp = Date.now();
    const filename = `training/${category}/batch_${timestamp}.json`;
    const content = JSON.stringify({ dataPoints, timestamp, count: dataPoints.length });
    
    try {
      await this.bucket.file(filename).save(content, {
        contentType: 'application/json',
        gzip: true
      });
      return true;
    } catch (err) {
      console.error('Failed to save batch to GCS:', err.message);
      return false;
    }
  }

  // Get total data size
  async getDataSize() {
    try {
      const [files] = await this.bucket.getFiles({ prefix: 'training/' });
      let totalBytes = 0;
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        totalBytes += parseInt(metadata.size) || 0;
      }
      return totalBytes;
    } catch (err) {
      console.error('Failed to get data size:', err.message);
      return this.getLocalDataSize();
    }
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
    try {
      const [files] = await this.bucket.getFiles({ prefix: 'training/' });
      return files.length;
    } catch (err) {
      return 0;
    }
  }

  // Load training data for analysis
  async loadTrainingData(category, limit = 1000) {
    try {
      const [files] = await this.bucket.getFiles({ 
        prefix: `training/${category}/`,
        maxResults: limit 
      });
      
      const data = [];
      for (const file of files.slice(-limit)) {
        const [content] = await file.download();
        data.push(JSON.parse(content.toString()));
      }
      return data;
    } catch (err) {
      console.error('Failed to load training data:', err.message);
      return [];
    }
  }

  // Save model state
  async saveModelState(state) {
    const filename = 'model/state.json';
    const content = JSON.stringify(state);
    
    try {
      await this.bucket.file(filename).save(content, {
        contentType: 'application/json'
      });
    } catch (err) {
      fs.writeFileSync(path.join(this.localCache, 'model_state.json'), content);
    }
  }

  // Load model state
  async loadModelState() {
    try {
      const [content] = await this.bucket.file('model/state.json').download();
      return JSON.parse(content.toString());
    } catch (err) {
      const localPath = path.join(this.localCache, 'model_state.json');
      if (fs.existsSync(localPath)) {
        return JSON.parse(fs.readFileSync(localPath, 'utf8'));
      }
      return null;
    }
  }

  // Save virtual trade
  async saveVirtualTrade(trade) {
    const filename = `virtual_trades/${trade.id}.json`;
    await this.bucket.file(filename).save(JSON.stringify(trade), {
      contentType: 'application/json'
    });
  }

  // Load virtual trades
  async loadVirtualTrades(days = 30) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    try {
      const [files] = await this.bucket.getFiles({ prefix: 'virtual_trades/' });
      const trades = [];
      for (const file of files) {
        const [content] = await file.download();
        const trade = JSON.parse(content.toString());
        if (trade.timestamp >= cutoff) {
          trades.push(trade);
        }
      }
      return trades;
    } catch (err) {
      return [];
    }
  }
}

export default new CloudStorage();
