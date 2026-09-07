import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const port = process.env.PORT || 7000;
const baseUrl = `http://localhost:${port}/api/translate`;

async function testSingle() {
  try {
    const res = await axios.post(baseUrl, {
      text: 'Hello, welcome to our store!',
      targetLang: 'hi',
      sourceLang: 'en'
    });
    console.log('Single text translation response:', res.data);
  } catch (error) {
    console.error('Single text translation failed:', error.response?.data || error.message);
  }
}

async function testBatch() {
  try {
    const res = await axios.post(`${baseUrl}/batch`, {
      texts: ['Apples', 'Oranges', 'Vegetables', 'Checkout', 'Fresh Jain Paneer'],
      targetLang: 'hi',
      sourceLang: 'en'
    });
    console.log('Batch translation response:', res.data);
  } catch (error) {
    console.error('Batch translation failed:', error.response?.data || error.message);
  }
}

async function run() {
  console.log('Starting translation API tests...');
  await testSingle();
  console.log('---');
  await testBatch();
}

run();
