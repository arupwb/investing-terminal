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

// Real Technical Indicator Calculations (SMA & RSI)
function calculateSMA(data, period) {
  if (data.length < period) return data[data.length - 1] || 0;
  const slice = data.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
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

function getSignalFromValues(price, sma20, rsi) {
  if (price > sma20 && rsi > 58) return "Strong Buy";
  if (price > sma20 && rsi >= 50) return "Buy";
  if (price < sma20 && rsi < 42) return "Strong Sell";
  if (price < sma20 && rsi <= 50) return "Sell";
  return "Neutral";
}

app.get('/api/terminal', async (req, res) => {
  try {
    const assets = [
      { name: "EUR/USD", symbol: "EURUSD=X" },
      { name: "GBP/USD", symbol: "GBPUSD=X" },
      { name: "USD/JPY", symbol: "JPY=X" },
      { name: "AUD/USD", symbol: "AUDUSD=X" },
      { name: "USD/CAD", symbol: "CAD=X" },
      { name: "USD/CHF", symbol: "USDCHF=X" },
      { name: "EUR/JPY", symbol: "EURJPY=X" },
      { name: "GBP/JPY", symbol: "GBPJPY=X" }
    ];

    const results = await Promise.all(assets.map(async (item) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        
        const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${item.symbol}?interval=1m&range=1d`, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const json = await response.json();
        const resultObj = json.chart.result[0];
        const meta = resultObj.meta;
        const quotes = resultObj.indicators.quote[0].close.filter(v => v !== null);
        
        const currentPrice = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose;
        const changeColor = currentPrice > prevClose ? "green" : currentPrice < prevClose ? "red" : "blue";

        // Generate multi-timeframe signals using actual mathematical slices of chart data
        const timeframes = [5, 10, 15, 20]; // representing 1m, 5m, 15m, 30m proxy slices
        const maSignals = [];
        const tiSignals = [];
        const summarySignals = [];

        timeframes.forEach((period, idx) => {
          const sliceData = quotes.length >= period ? quotes : [currentPrice];
          const sma = calculateSMA(sliceData, Math.min(period, sliceData.length));
          const rsi = calculateRSI(quotes, 14);

          // Moving Average specific evaluation
          let maSig = "Neutral";
          if (currentPrice > sma) maSig = (currentPrice - sma) > 0.0005 ? "Strong Buy" : "Buy";
          else if (currentPrice < sma) maSig = (sma - currentPrice) > 0.0005 ? "Strong Sell" : "Sell";

          // Technical Indicator (Oscillator/RSI) evaluation
          let tiSig = "Neutral";
          if (rsi > 65) tiSig = "Strong Buy";
          else if (rsi > 52) tiSig = "Buy";
          else if (rsi < 35) tiSig = "Strong Sell";
          else if (rsi < 48) tiSig = "Sell";

          // Overall Summary based on combined metrics
          const overall = getSignalFromValues(currentPrice, sma, rsi);

          maSignals.push(maSig);
          tiSignals.push(tiSig);
          summarySignals.push(overall);
        });

        return {
          name: item.name,
          price: currentPrice.toFixed(5),
          color: changeColor,
          ma: maSignals,
          ti: tiSignals,
          s: summarySignals
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
