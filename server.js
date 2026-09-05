const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));

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
    let lastErr = '';

    const proxies = [
      investingUrl, // direct try
      `https://api.allorigins.win/raw?url=${encodeURIComponent(investingUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(investingUrl)}`,
      `https://thingproxy.freeboard.name/fetch/${investingUrl}`
    ];

    for (let url of proxies) {
      try {
        const r = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.investing.com/',
            'Origin': 'https://www.investing.com',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        const text = await r.text();
        if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
          const parsed = JSON.parse(text);
          // allorigins raw returns array directly, get returns {contents}
          investingData = Array.isArray(parsed)? parsed : JSON.parse(parsed.contents || '[]');
          if (investingData.length > 0) break;
        }
      } catch (e) { lastErr = e.message; }
    }

    if (!investingData || investingData.length === 0) throw new Error('All proxies blocked: ' + lastErr);

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
        name: m.name, price: prices[m.id].p, color: prices[m.id].c,
        ma: [it.movingAverages['60'], it.movingAverages['300'], it.movingAverages['900'], it.movingAverages['1800']],
        ti: [it.technicalIndicators['60'], it.technicalIndicators['300'], it.technicalIndicators['900'], it.technicalIndicators['1800']],
        s: [it.summary['60'], it.summary['300'], it.summary['900'], it.summary['1800']]
      };
    });

    res.json({ success: true, data: results });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => console.log('Running'));
