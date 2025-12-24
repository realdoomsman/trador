import { useState, useEffect, useCallback } from 'react';

const API_URL = '/api';

export function useApi(refreshInterval = 3000) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/state`, { 
        signal: AbortSignal.timeout(5000) 
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      setState(data);
      setError(null);
      setLastUpdate(Date.now());
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchState, refreshInterval]);

  return { state, loading, error, lastUpdate, refresh: fetchState };
}
