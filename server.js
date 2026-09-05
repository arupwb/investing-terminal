const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/investing', async (req, res) => {
  try {
    const pairs = [
      { id: "EURUSD", y: "EURUSD=X" },
      { id: "GBPUSD", y: "GBPUSD=X" },
      { id: "USDJPY", y: "JPY=X" },
      { id: "AUDUSD", y: "AUDUSD=X" },
      { id: "USDCAD", y: "CAD=X" },
      { id: "USDCHF", y: "CHF=X" },
      { id: "EURJPY", y: "EURJPY=X" },
      { id: "GBPJPY", y: "GBPJPY=X" },
    ];

    const prices = {};
    await Promise.all(pairs.map(async (p) => {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${p.y}`, {
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        const j = await r.json();
        const price = j.chart.result[0].meta.regularMarketPrice;
        const prev = j.chart.result[0].meta.chartPreviousClose;
        prices[p.id] = {
          p: price.toFixed(5),
          c: price > prev ? "green" : price < prev ? "red" : "blue"
        };
      } catch {
        prices[p.id] = { p: "0.00000", c: "blue" };
      }
    }));

    const response = await fetch("https://api.investing.com/api/financialdata/technical/summary/v1?pairIds=1,2,4,5,6,9,18,72&timeFrames=60,300,900,1800", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Domain-Id": "www"
      }
    });

    if (response.ok) {
      const apiData = await response.json();
      const parsedData = apiData.data.map(item => ({
        n: item.pairName,
        p: prices[item.pairId]?.p || item.lastPrice || "0.00000",
        c: prices[item.pairId]?.c || "blue",
        ma: item.movingAverages || ["Neutral","Neutral","Neutral","Neutral"],
        ti: item.technicalIndicators || ["Neutral","Neutral","Neutral","Neutral"],
        s: item.summary || ["Neutral","Neutral","Neutral","Neutral"]
      }));
      return res.json({ live: true, data: parsedData });
    }

    throw new Error("Investing API blocked");

  } catch (e) {
    res.status(500).json({ live: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
