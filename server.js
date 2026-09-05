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
    const assets = [
      { name: "EUR/USD", symbol: "EURUSD=X" },
      { name: "GBP/USD", symbol: "GBPUSD=X" },
      { name: "USD/JPY", symbol: "JPY=X" },
      { name: "AUD/USD", symbol: "AUDUSD=X" },
      { name: "USD/CAD", symbol: "CAD=X" },
      { name: "USD/CHF", symbol: "CHF=X" },
      { name: "EUR/JPY", symbol: "EURJPY=X" },
      { name: "GBP/JPY", symbol: "GBPJPY=X" }
    ];

    const results = await Promise.all(assets.map(async (item) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${item.symbol}?interval=1m&range=1d`, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const json = await response.json();
        const meta = json.chart.result[0].meta;
        const currentPrice = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose;
        
        const changeColor = currentPrice > prevClose ? "green" : currentPrice < prevClose ? "red" : "blue";
        
        // Dynamic Technical Generation based on price action
        const diff = currentPrice - prevClose;
        const trend = diff > 0 ? "Buy" : diff < 0 ? "Sell" : "Neutral";
        const strongTrend = Math.abs(diff) > 0.001 ? (diff > 0 ? "Strong Buy" : "Strong Sell") : trend;

        return {
          name: item.name,
          price: currentPrice.toFixed(5),
          color: changeColor,
          ma: [trend, strongTrend, trend, strongTrend],
          ti: [strongTrend, trend, strongTrend, trend],
          s: [strongTrend, strongTrend, trend, strongTrend]
        };
      } catch (err) {
        return {
          name: item.name,
          price: "0.00000",
          color: "blue",
          ma: ["Neutral", "Neutral", "Neutral", "Neutral"],
          ti: ["Neutral", "Neutral", "Neutral", "Neutral"],
          s: ["Neutral", "Neutral", "Neutral", "Neutral"]
        };
      }
    }));

    res.json({ success: true, data: results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
