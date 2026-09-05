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
      { name: "EUR/USD", id: 1, yahoo: "EURUSD=X" },
      { name: "GBP/USD", id: 2, yahoo: "GBPUSD=X" },
      { name: "USD/JPY", id: 4, yahoo: "JPY=X" },
      { name: "AUD/USD", id: 5, yahoo: "AUDUSD=X" },
      { name: "USD/CAD", id: 6, yahoo: "CAD=X" },
      { name: "USD/CHF", id: 9, yahoo: "CHF=X" },
      { name: "EUR/JPY", id: 18, yahoo: "EURJPY=X" },
      { name: "GBP/JPY", id: 72, yahoo: "GBPJPY=X" }
    ];

    const prices = {};
    await Promise.all(map.map(async m => {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${m.yahoo}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const j = await r.json();
        const meta = j.chart.result[0].meta;
        prices[m.id] = { price: meta.regularMarketPrice.toFixed(5), color: meta.regularMarketPrice > meta.chartPreviousClose ? 'green' : 'red' };
      } catch { prices[m.id] = { price: '0.0000', color: 'blue' }; }
    }));

    const r = await fetch('https://api.investing.com/api/financialdata/technical/ByPairIDs?pairIDs=1,2,4,5,6,9,18,72&timeFrames=60,300,900,1800', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.investing.com/',
        'Domain-Id': 'www'
      }
    });

    if (!r.ok) throw new Error('Investing blocked: ' + r.status);
    const apiData = await r.json();

    const results = map.map(m => {
      const item = apiData.find(x => x.pairId == m.id);
      return {
        name: m.name,
        price: prices[m.id].price,
        color: prices[m.id].color,
        ma: [item.movingAverages['60'], item.movingAverages['300'], item.movingAverages['900'], item.movingAverages['1800']],
        ti: [item.technicalIndicators['60'], item.technicalIndicators['300'], item.technicalIndicators['900'], item.technicalIndicators['1800']],
        s: [item.summary['60'], item.summary['300'], item.summary['900'], item.summary['1800']]
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
