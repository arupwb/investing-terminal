const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'index.html'));
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

    const investingUrl = 'https://api.investing.com/api/financialdata/technical/ByPairIDs?pairIDs=1,2,4,5,6,9,18,72&timeFrames=60,300,900,1800';
    let investingData = null;

    // Try Proxy 1
    try {
      const r1 = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(investingUrl)}`);
      const j1 = await r1.json();
      if (j1.contents && j1.contents.trim().startsWith('[')) {
        investingData = JSON.parse(j1.contents);
      } else {
        throw new Error('Proxy 1 returned HTML');
      }
    } catch (e) {
      console.log('Proxy1 failed, trying Proxy2', e.message);
      // Try Proxy 2
      const r2 = await fetch(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(investingUrl)}`);
      investingData = await r2.json();
    }

    // Price fetch
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
    console.log('API Error', e.message);
    res.json({ success: false, error: 'Market feed busy, retrying... ' + e.message });
  }
});

app.listen(PORT, () => console.log('Running on ' + PORT));
