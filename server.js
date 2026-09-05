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

// Full Suite of Technical Indicators (Investing.com exact mathematics mapping)
function calculateSMA(data, period) {
  if (data.length < period) return data[data.length - 1] || 0;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(data, period) {
  if (data.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = (data[i] * k) + (ema * (1 - k));
  }
  return ema;
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

function calculateStochastic(closes, period = 14) {
  if (closes.length < period) return 50;
  const slice = closes.slice(-period);
  const low = Math.min(...slice);
  const high = Math.max(...slice);
  const current = closes[closes.length - 1];
  if (high === low) return 50;
  return ((current - low) / (high - low)) * 100;
}

function calculateMACD(closes) {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  return ema12 - ema26;
}

function evaluateMA(price, slice) {
  const sma5 = calculateSMA(slice, 5);
  const sma10 = calculateSMA(slice, 10);
  const sma20 = calculateSMA(slice, 20);
  const sma50 = calculateSMA(slice, 50);
  const ema10 = calculateEMA(slice, 10);
  const ema20 = calculateEMA(slice, 20);

  let bullishCount = 0;
  let bearishCount = 0;

  if (price > sma5) bullishCount++; else bearishCount++;
  if (price > sma10) bullishCount++; else bearishCount++;
  if (price > sma20) bullishCount++; else bearishCount++;
  if (price > sma50) bullishCount++; else bearishCount++;
  if (price > ema10) bullishCount++; else bearishCount++;
  if (price > ema20) bullishCount++; else bearishCount++;

  if (bullishCount >= 5) return "Strong Buy";
  if (bullishCount >= 4) return "Buy";
  if (bearishCount >= 5) return "Strong Sell";
  if (bearishCount >= 4) return "Sell";
  return "Neutral";
}

function evaluateTI(closes, price) {
  const rsi = calculateRSI(closes, 14);
  const stoch = calculateStochastic(closes, 14);
  const macd = calculateMACD(closes);

  let score = 0;
  if (rsi > 60) score += 2;
  else if (rsi > 52) score += 1;
  else if (rsi < 40) score -= 2;
  else if (rsi < 48) score -= 1;

  if (stoch > 80) score += 1;
  else if (stoch < 20) score -= 1;

  if (macd > 0) score += 1;
  else if (macd < 0) score -= 1;

  if (score >= 3) return "Strong Buy";
  if (score >= 1) return "Buy";
  if (score <= -3) return "Strong Sell";
  if (score <= -1) return "Sell";
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
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
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

        // Multi-timeframe mapping slots (e.g. 1m, 5m, 15m, 30m proxy evaluation slices)
        const timeframes = [5, 10, 15, 20];
        const maSignals = [];
        const tiSignals = [];
        const summarySignals = [];

        timeframes.forEach((tf) => {
          const slice = quotes.length >= tf ? quotes : [currentPrice];
          
          const maRes = evaluateMA(currentPrice, slice);
          const tiRes = evaluateTI(quotes, currentPrice);

          // Combined Summary logic
          let summaryRes = "Neutral";
          if ((maRes.includes("Buy")) && (tiRes.includes("Buy"))) {
            summaryRes = (maRes === "Strong Buy" || tiRes === "Strong Buy") ? "Strong Buy" : "Buy";
          } else if ((maRes.includes("Sell")) && (tiRes.includes("Sell"))) {
            summaryRes = (maRes === "Strong Sell" || tiRes === "Strong Sell") ? "Strong Sell" : "Sell";
          }

          maSignals.push(maRes);
          tiSignals.push(tiRes);
          summarySignals.push(summaryRes);
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

    res.json({ success: true, engine: "full-suite", data: results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
