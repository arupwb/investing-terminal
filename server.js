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
    // Yahoo Finance for live real-time prices
    const pairs = [
      { id: "EURUSD", y: "EURUSD=X", invId: "1" },
      { id: "GBPUSD", y: "GBPUSD=X", invId: "2" },
      { id: "USDJPY", y: "JPY=X", invId: "3" },
      { id: "AUDUSD", y: "AUDUSD=X", invId: "5" },
      { id: "USDCAD", y: "CAD=X", invId: "7" },
      { id: "USDCHF", y: "CHF=X", invId: "4" },
      { id: "EURJPY", y: "EURJPY=X", invId: "9" },
      { id: "GBPJPY", y: "GBPJPY=X", invId: "18" },
    ];

    const prices = {};
    await Promise.all(pairs.map(async (p) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${p.y}`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const j = await r.json();
        const price = j.chart.result[0].meta.regularMarketPrice;
        const prev = j.chart.result[0].meta.chartPreviousClose;
        prices[p.invId] = {
          p: price.toFixed(5),
          c: price > prev ? "green" : price < prev ? "red" : "blue"
        };
      } catch {
        prices[p.invId] = { p: "0.00000", c: "blue" };
      }
    }));

    // Investing.com Official Technical Summary API with proper headers
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch("https://api.investing.com/api/financialdata/technical/summary/v1?pairIds=1,2,3,4,5,7,9,18&timeFrames=60,300,900,1800", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Domain-Id": "www",
        "Referer": "https://www.investing.com/"
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const apiData = await response.json();
      const rawData = apiData.data || [];
      const parsedData = Array.isArray(rawData) ? rawData : [rawData];
      
      const mapped = parsedData.map(item => ({
        name: item.pairName,
        price: prices[item.pairId]?.p || item.lastPrice || "0.00000",
        color: prices[item.pairId]?.c || "blue",
        ma: item.movingAverages || ["Neutral", "Neutral", "Neutral", "Neutral"],
        ti: item.technicalIndicators || ["Neutral", "Neutral", "Neutral", "Neutral"],
        s: item.summary || ["Neutral", "Neutral", "Neutral", "Neutral"]
      }));

      return res.json({ success: true, data: mapped });
    }

    throw new Error("Investing API response not ok");

  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
