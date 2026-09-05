const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  const htmlPath = path.join(process.cwd(), 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send("index.html file not found in root directory!");
  }
});

app.get('/api/terminal', async (req, res) => {
  try {
    const map = [
      { id: 1, name: "EUR/USD", yahoo: "EURUSD=X" },
      { id: 2, name: "GBP/USD", yahoo: "GBPUSD=X" },
      { id: 4, name: "USD/JPY", yahoo: "JPY=X" },
      { id: 5, name: "AUD/USD", yahoo: "AUDUSD=X" },
      { id: 6, name: "USD/CAD", yahoo: "CAD=X" },
      { id: 9, name: "USD/CHF", yahoo: "CHF=X" },
      { id: 18, name: "EUR/JPY", yahoo: "EURJPY=X" },
      { id: 72, name: "GBP/JPY", yahoo: "GBPJPY=X" }
    ];

    // 100% Original Investing API via Proxy to bypass 403
    const investingUrl = 'https://api.investing.com/api/financialdata/technical/ByPairIDs?pairIDs=1,2,4,5,6,9,18,72&timeFrames=60,300,900,1800';
    const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(investingUrl)}`);
    const proxyJson = await proxyRes.json();
    const investingData = JSON.parse(proxyJson.contents); // Eta 100% Investing er original data

    // Price only from Yahoo
    const prices = {};
    await Promise.all(map.map(async m => {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${m.yahoo}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const j = await r.json();
        const meta = j.chart.result[0].meta;
        prices[m.id] = { p: meta.regularMarketPrice.toFixed(5), c: meta.regularMarketPrice > meta.chartPreviousClose? 'green' : 'red' };
      } catch { prices[m.id] = { p: '...', c: 'blue' }; }
    }));

    const results = map.map(m => {
      const it = investingData.find(x => x.pairId == m.id);
      return {
        name: m.name,
        price: prices[m.id].p,
        color: prices[m.id].c,
        ma: [it.movingAverages['60'], it.movingAverages['300'], it.movingAverages['900'], it.movingAverages['1800']],
        ti: [it.technicalIndicators['60'], it.technicalIndicators['300'], it.technicalIndicators['900'], it.technicalIndicators['1800']],
        s: [it.summary['60'], it.summary['300'], it.summary['900'], it.summary['1800']]
      };
    });

    res.json({ success: true, data: results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
