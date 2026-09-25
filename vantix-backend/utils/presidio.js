const axios = require('axios');

async function analyzeText(text) {
  try {
    const res = await axios.post('http://localhost:5002/analyze', {
      text,
      language: 'en'
    }, { timeout: 5000 });

    // Flask jsonify wraps arrays as { value: [...] } on some platforms
    const data = res.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.value)) return data.value;
    return [];
  } catch (e) {
    console.error('[Presidio] Connection error:', e.message);
    return [];
  }
}

module.exports = { analyzeText };
