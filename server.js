const express = require("express");
const path = require("path");
const cheerio = require("cheerio");

const app = express();

const PORT =
  process.env.PORT || 10000;


/* =========================================================
   EXPRESS
   ========================================================= */

app.disable("x-powered-by");


/* =========================================================
   ASSETS
   ========================================================= */

const ASSETS = [

  {
    name: "EUR/USD",
    url: "https://www.investing.com/currencies/eur-usd-technical"
  },

  {
    name: "GBP/USD",
    url: "https://www.investing.com/currencies/gbp-usd-technical"
  },

  {
    name: "USD/JPY",
    url: "https://www.investing.com/currencies/usd-jpy-technical"
  },

  {
    name: "AUD/USD",
    url: "https://www.investing.com/currencies/aud-usd-technical"
  },

  {
    name: "USD/CAD",
    url: "https://www.investing.com/currencies/usd-cad-technical"
  },

  {
    name: "USD/CHF",
    url: "https://www.investing.com/currencies/usd-chf-technical"
  },

  {
    name: "EUR/JPY",
    url: "https://www.investing.com/currencies/eur-jpy-technical"
  },

  {
    name: "GBP/JPY",
    url: "https://www.investing.com/currencies/gbp-jpy-technical"
  }

];


/* =========================================================
   TIMEFRAMES
   ========================================================= */

const TIMEFRAMES = [

  {
    key: "1m",
    label: "1 Min",
    value: "1"
  },

  {
    key: "5m",
    label: "5 Min",
    value: "5"
  },

  {
    key: "15m",
    label: "15 Min",
    value: "15"
  },

  {
    key: "30m",
    label: "30 Min",
    value: "30"
  }

];


/* =========================================================
   HEADERS
   ========================================================= */

const REQUEST_HEADERS = {

  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139.0.0.0 Safari/537.36",

  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

  "Accept-Language":
    "en-US,en;q=0.9",

  "Cache-Control":
    "no-cache",

  "Pragma":
    "no-cache"

};


/* =========================================================
   HOME
   ========================================================= */

app.get("/", (req, res) => {

  res.sendFile(
    path.join(
      process.cwd(),
      "index.html"
    )
  );

});


/* =========================================================
   FETCH INVESTING PAGE
   ========================================================= */

async function fetchInvesting(url){

  const response =
    await fetch(
      url,
      {
        method: "GET",
        headers: REQUEST_HEADERS,
        redirect: "follow",
        signal:
          AbortSignal.timeout(20000)
      }
    );


  if(!response.ok){

    throw new Error(
      "Investing HTTP " +
      response.status
    );

  }


  return await response.text();

}


/* =========================================================
   NORMALIZE SIGNAL
   ========================================================= */

function normalizeSignal(value){

  if(!value)
    return "N/A";


  const text =
    String(value)
      .replace(/\s+/g," ")
      .trim()
      .toLowerCase();


  if(
    text.includes("strong buy")
  ){

    return "Strong Buy";

  }


  if(
    text.includes("strong sell")
  ){

    return "Strong Sell";

  }


  if(
    text === "buy" ||
    text.startsWith("buy ")
  ){

    return "Buy";

  }


  if(
    text === "sell" ||
    text.startsWith("sell ")
  ){

    return "Sell";

  }


  if(
    text === "neutral" ||
    text.startsWith("neutral ")
  ){

    return "Neutral";

  }


  return "N/A";

}


/* =========================================================
   SIGNAL FROM COUNTS
   ========================================================= */

function signalFromCounts(
  buy,
  sell,
  neutral
){

  const b =
    Number(buy) || 0;

  const s =
    Number(sell) || 0;

  const n =
    Number(neutral) || 0;


  const total =
    b + s + n;


  if(total === 0)
    return "N/A";


  if(
    b >= s * 2 &&
    b >= n
  ){

    return "Strong Buy";

  }


  if(
    s >= b * 2 &&
    s >= n
  ){

    return "Strong Sell";

  }


  if(b > s)
    return "Buy";


  if(s > b)
    return "Sell";


  return "Neutral";

}


/* =========================================================
   FIND SUMMARY IN TEXT
   ========================================================= */

function extractSummary(text){

  const match =
    text.match(
      /Summary\s*:\s*(Strong\s+Buy|Strong\s+Sell|Buy|Sell|Neutral)/i
    );


  if(match){

    return normalizeSignal(
      match[1]
    );

  }


  return "N/A";

}


/* =========================================================
   FIND MOVING AVERAGES
   ========================================================= */

function extractMovingAverage(text){

  const direct =
    text.match(
      /Moving\s+Averages\s*:\s*(Strong\s+Buy|Strong\s+Sell|Buy|Sell|Neutral)/i
    );


  if(direct){

    return normalizeSignal(
      direct[1]
    );

  }


  const counts =
    text.match(
      /Moving\s+Averages\s*:\s*Buy\s*\((\d+)\)\s*Sell\s*\((\d+)\)/i
    );


  if(counts){

    return signalFromCounts(
      counts[1],
      counts[2],
      0
    );

  }


  return "N/A";

}


/* =========================================================
   FIND TECHNICAL INDICATORS
   ========================================================= */

function extractIndicators(text){

  const direct =
    text.match(
      /Technical\s+Indicators\s*:\s*(Strong\s+Buy|Strong\s+Sell|Buy|Sell|Neutral)/i
    );


  if(direct){

    return normalizeSignal(
      direct[1]
    );

  }


  const counts =
    text.match(
      /Technical\s+Indicators\s*:\s*Buy\s*\((\d+)\)\s*Sell\s*\((\d+)\)/i
    );


  if(counts){

    return signalFromCounts(
      counts[1],
      counts[2],
      0
    );

  }


  return "N/A";

}


/* =========================================================
   PARSE INVESTING PAGE
   ========================================================= */

function parseInvestingPage(html){

  const $ =
    cheerio.load(html);


  const text =
    $("body")
      .text()
      .replace(/\s+/g," ")
      .trim();


  return {

    summary:
      extractSummary(text),

    ma:
      extractMovingAverage(text),

    ti:
      extractIndicators(text)

  };

}


/* =========================================================
   TIMEFRAME URL
   ========================================================= */

function buildTimeframeURL(
  asset,
  timeframe
){

  return (
    asset.url +
    "?timeFrame=" +
    encodeURIComponent(
      timeframe.value
    ) +
    "&_=" +
    Date.now()
  );

}


/* =========================================================
   GET ONE TIMEFRAME
   ========================================================= */

async function getTimeframe(
  asset,
  timeframe
){

  try{

    const url =
      buildTimeframeURL(
        asset,
        timeframe
      );


    const html =
      await fetchInvesting(
        url
      );


    const parsed =
      parseInvestingPage(
        html
      );


    return parsed;


  }catch(error){

    console.error(
      asset.name +
      " " +
      timeframe.label +
      ": " +
      error.message
    );


    return {

      summary: "N/A",
      ma: "N/A",
      ti: "N/A"

    };

  }

}


/* =========================================================
   GET PRICE FROM INVESTING PAGE
   ========================================================= */

function extractPrice(html){

  const $ =
    cheerio.load(html);


  const body =
    $("body")
      .text()
      .replace(/\s+/g," ")
      .trim();


  const match =
    body.match(
      /\b\d+\.\d{3,6}\b/
    );


  if(!match)
    return null;


  const value =
    Number(match[0]);


  if(!Number.isFinite(value))
    return null;


  return value;

}


/* =========================================================
   TERMINAL API
   ========================================================= */

app.get(
  "/api/terminal",
  async (req,res) => {

    try{

      const output = [];


      for(
        const asset of ASSETS
      ){

        const values = [];


        /*
         * Same Investing page is requested
         * for each required timeframe.
         */

        for(
          const timeframe of TIMEFRAMES
        ){

          const result =
            await getTimeframe(
              asset,
              timeframe
            );


          values.push(result);

        }


        let price =
          "N/A";


        /*
         * Use first successfully returned
         * Investing page for displayed price.
         */

        try{

          const html =
            await fetchInvesting(
              asset.url +
              "?_=" +
              Date.now()
            );


          const p =
            extractPrice(html);


          if(
            Number.isFinite(p)
          ){

            price =
              formatPrice(
                p,
                asset.name
              );

          }

        }catch(error){

          console.error(
            "Price " +
            asset.name +
            ": " +
            error.message
          );

        }


        output.push({

          name:
            asset.name,

          price:
            price,

          color:
            "blue",

          ma:
            values.map(
              item => item.ma
            ),

          ti:
            values.map(
              item => item.ti
            ),

          s:
            values.map(
              item => item.summary
            )

        });

      }


      res.json({

        success: true,

        source:
          "Investing.com",

        timeframes:[
          "1 Min",
          "5 Min",
          "15 Min",
          "30 Min"
        ],

        data:
          output

      });


    }catch(error){

      console.error(
        "Terminal:",
        error
      );


      res.status(500).json({

        success:false,

        error:
          error.message ||
          "Terminal error"

      });

    }

  }
);


/* =========================================================
   PRICE FORMAT
   ========================================================= */

function formatPrice(
  value,
  name
){

  if(
    name === "USD/JPY" ||
    name === "EUR/JPY" ||
    name === "GBP/JPY"
  ){

    return value.toFixed(3);

  }


  return value.toFixed(5);

}


/* =========================================================
   HEALTH
   ========================================================= */

app.get(
  "/health",
  (req,res) => {

    res.json({

      ok:true,

      service:
        "Pro Trading Terminal",

      time:
        new Date().toISOString()

    });

  }
);


/* =========================================================
   START
   ========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "Server running on port " +
      PORT
    );

  }
);
