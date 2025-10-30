// server/compiler.js
require('dotenv').config();
const axios = require('axios');

const compileCode = async (language, code) => {
  const languageMap = {
    python: { id: 71, versionIndex: 3 }, // Python 3.10
    java:   { id: 62, versionIndex: 3 }, // Java 15
    cpp:    { id: 54, versionIndex: 0 }  // C++ 10.2
  };

  const lang = languageMap[language];
  if (!lang) return 'Error: Unsupported language';

  try {
    const payload = {
      script: code,
      language: language,
      versionIndex: lang.versionIndex,
      clientId: process.env.JDOODLE_CLIENT_ID,
      clientSecret: process.env.JDOODLE_CLIENT_SECRET
    };

    const { data } = await axios.post(
      'https://api.jdoodle.com/v1/execute',
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );

    // JDoodle returns: { output, error, statusCode, memory, cpuTime }
    if (data.error) return `Error: ${data.error}`;
    return data.output || 'No output';
  } catch (err) {
    const msg = err.response?.data?.error || err.message;
    return `Request failed: ${msg}`;
  }
};

module.exports = { compileCode };