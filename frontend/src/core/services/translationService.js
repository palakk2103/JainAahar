import axiosInstance from '../api/axios';
import { getCachedTranslation, setCachedTranslation } from '../utils/translationCache';

const queue = [];
let batchTimeout = null;
const BATCH_WAIT_MS = 50;
const MAX_BATCH_SIZE = 50;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 50;

const processQueue = async () => {
  if (queue.length === 0) {
    batchTimeout = null;
    return;
  }

  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
    batchTimeout = setTimeout(processQueue, MIN_REQUEST_INTERVAL_MS - timeSinceLast);
    return;
  }

  lastRequestTime = Date.now();

  const chunk = queue.splice(0, MAX_BATCH_SIZE);
  if (chunk.length === 0) {
    batchTimeout = null;
    return;
  }

  const groups = {};
  chunk.forEach(req => {
    const key = `${req.sourceLang}_${req.targetLang}`;
    if (!groups[key]) {
      groups[key] = {
        sourceLang: req.sourceLang,
        targetLang: req.targetLang,
        requests: []
      };
    }
    groups[key].requests.push(req);
  });

  for (const groupKey of Object.keys(groups)) {
    const { sourceLang, targetLang, requests } = groups[groupKey];
    const texts = requests.map(r => r.text);

    try {
      const res = await axiosInstance.post('/translate/batch', {
        texts,
        targetLang,
        sourceLang
      });

      const translations = res.data?.data?.translations || [];
      requests.forEach((req, idx) => {
        const translated = translations[idx] || req.text;
        setCachedTranslation(req.text, req.sourceLang, req.targetLang, translated);
        req.resolve(translated);
      });
    } catch (err) {
      console.error('Batch translation API failed, resolving to original:', err);
      requests.forEach(req => req.resolve(req.text));
    }
  }

  if (queue.length > 0) {
    batchTimeout = setTimeout(processQueue, MIN_REQUEST_INTERVAL_MS);
  } else {
    batchTimeout = null;
  }
};

const enqueueRequest = (text, targetLang, sourceLang) => {
  return new Promise((resolve) => {
    queue.push({ text, targetLang, sourceLang, resolve });
    if (!batchTimeout) {
      batchTimeout = setTimeout(processQueue, BATCH_WAIT_MS);
    }
  });
};

export const translateText = async (text, targetLang, sourceLang = 'en') => {
  if (!text || typeof text !== 'string' || !text.trim()) return text;
  if (sourceLang === targetLang) return text;

  const cached = await getCachedTranslation(text, sourceLang, targetLang);
  if (cached) return cached;

  return enqueueRequest(text, targetLang, sourceLang);
};

export const translateBatch = async (texts, targetLang, sourceLang = 'en') => {
  if (!Array.isArray(texts)) return [];
  return Promise.all(texts.map(text => translateText(text, targetLang, sourceLang)));
};

export const translateObject = async (obj, targetLang, sourceLang = 'en', keysToTranslate = []) => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return Promise.all(obj.map(item => translateObject(item, targetLang, sourceLang, keysToTranslate)));
  }

  const cloned = { ...obj };
  const promises = [];
  const keys = [];

  for (const key of keysToTranslate) {
    if (cloned[key] && typeof cloned[key] === 'string') {
      keys.push(key);
      promises.push(translateText(cloned[key], targetLang, sourceLang));
    }
  }

  if (promises.length === 0) return cloned;

  const translated = await Promise.all(promises);
  keys.forEach((key, idx) => {
    cloned[key] = translated[idx];
  });

  return cloned;
};
