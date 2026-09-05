const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

const TWELVE_API_KEY = "61f7d23d17c446d0a4a858efeb83815e";

app.get('/', (req, res) => {
  const htmlPath = path.join(process.cwd(), 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send("index.html not found");
  }
});

function calculateSMA(data, period) {
  if (data.length < period) return data[data.length - 1] || 0;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

app.get('/api/terminal', async (req, res) => {
  const symbol = req.query.symbol || "EUR/USD";
  try {
    const response = await fetch(`https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1min&outputsize=30&apikey=${TWELVE_API_KEY}`);
    const json = await response.json();

    if (json.status === "error" || !json.values) {
      throw new Error(json.message || "API limit or invalid symbol");
    }

    const values = json.values.reverse();
    const closes = values.map(v => parseFloat(v.close));
    const currentPrice = closes[closes.length - 1];
    const prevPrice = closes[closes.length - 2] || currentPrice;
    const color = currentPrice > prevPrice ? "green" : currentPrice < prevPrice ? "red" : "blue";

    const timeframes = [5, 10, 15, 20];
    const maSignals = [];
    const tiSignals = [];
    const summarySignals = [];

    timeframes.forEach((tf) => {
      const sma = calculateSMA(closes, tf);
      const rsi = calculateRSI(closes, 14);

      let ma = currentPrice > sma ? "Buy" : "Sell";
      let ti = rsi > 55 ? "Buy" : rsi < 45 ? "Sell" : "Neutral";
      if (rsi > 65) ti = "Strong Buy";
      if (rsi < 35) ti = "Strong Sell";

      let summary = "Neutral";
      if (ma === "Buy" && (ti.includes("Buy"))) summary = rsi > 62 ? "Strong Buy" : "Buy";
      if (ma === "Sell" && (ti.includes("Sell"))) summary = rsi < 38 ? "Strong Sell" : "Sell";

      maSignals.push(ma);
      tiSignals.push(ti);
      summarySignals.push(summary);
    });

    res.json({
      success: true,
      data: {
        name: symbol,
        price: currentPrice.toFixed(5),
        color: color,
        ma: maSignals,
        ti: tiSignals,
        s: summarySignals
      }
    });

  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
