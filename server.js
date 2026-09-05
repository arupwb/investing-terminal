const express = require("express");
const path = require("path");
const cheerio = require("cheerio");

const app = express();

const PORT =
  process.env.PORT || 10000;


/* =========================================================
   ASSETS
   ========================================================= */

const ASSETS = [

  {
    name:"EUR/USD",
    slug:"technical-analysis",
    yahoo:"EURUSD=X"
  },

  {
    name:"GBP/USD",
    slug:"gbp-usd-technical-analysis",
    yahoo:"GBPUSD=X"
  },

  {
    name:"USD/JPY",
    slug:"usd-jpy-technical-analysis",
    yahoo:"JPY=X"
  },

  {
    name:"AUD/USD",
    slug:"aud-usd-technical-analysis",
    yahoo:"AUDUSD=X"
  },

  {
    name:"USD/CAD",
    slug:"usd-cad-technical-analysis",
    yahoo:"CAD=X"
  },

  {
    name:"USD/CHF",
    slug:"usd-chf-technical-analysis",
    yahoo:"CHF=X"
  },

  {
    name:"EUR/JPY",
    slug:"eur-jpy-technical-analysis",
    yahoo:"eurjpy=X"
  },

  {
    name:"GBP/JPY",
    slug:"gbp-jpy-technical-analysis",
    yahoo:"gbpjpy=X"
  }

];


/* =========================================================
   TIMEFRAMES
   ========================================================= */

const TIMEFRAMES = [

  {
    key:"1m",
    label:"1 Min",
    value:"1"
  },

  {
    key:"5m",
    label:"5 Min",
    value:"5"
  },

  {
    key:"15m",
    label:"15 Min",
    value:"15"
  },

  {
    key:"30m",
    label:"30 Min",
    value:"30"
  }

];


/* =========================================================
   HTTP HEADERS
   ========================================================= */

const HEADERS = {

  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",

  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

  "Accept-Language":
    "en-US,en;q=0.9",

  "Cache-Control":
    "no-cache",

  "Pragma":
    "no-cache"

};


/* =========================================================
   EXPRESS
   ========================================================= */

app.disable("x-powered-by");

app.use(express.json());


/* =========================================================
   HOME
   ========================================================= */

app.get("/", (req,res) => {

  res.sendFile(
    path.join(
      process.cwd(),
      "index.html"
    )
  );

});


/* =========================================================
   FETCH TEXT
   ========================================================= */

async function fetchText(url){

  const response =
    await fetch(
      url,
      {
        method:"GET",
        headers:HEADERS,
        redirect:"follow",
        signal:
          AbortSignal.timeout(20000)
      }
    );


  if(!response.ok){

    throw new Error(
      `Investing HTTP ${response.status}`
    );

  }


  return await response.text();

}


/* =========================================================
   PRICE
   ========================================================= */

async function getPrice(symbol){

  try{

    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(symbol) +
      "?range=1d&interval=1m";


    const response =
      await fetch(
        url,
        {
          headers:{
            "User-Agent":
              HEADERS["User-Agent"]
          },
          signal:
            AbortSignal.timeout(10000)
        }
      );


    if(!response.ok)
      throw new Error("Yahoo HTTP error");


    const json =
      await response.json();


    const meta =
      json?.chart?.result?.[0]?.meta;


    if(!meta)
      throw new Error("No price data");


    const price =
      Number(
        meta.regularMarketPrice
      );


    const previous =
      Number(
        meta.chartPreviousClose
      );


    if(!Number.isFinite(price))
      throw new Error("Invalid price");


    let color = "blue";


    if(Number.isFinite(previous)){

      if(price > previous)
        color = "green";

      else if(price < previous)
        color = "red";

    }


    return {

      value:price,

      color

    };


  }catch(error){

    console.error(
      "Price error:",
      symbol,
      error.message
    );


    return {

      value:null,

      color:"blue"

    };

  }

}


/* =========================================================
   NORMALIZE
   ========================================================= */

function normalize(value){

  if(!value)
    return "N/A";


  let v =
    String(value)
      .replace(/\s+/g," ")
      .trim();


  const lower =
    v.toLowerCase();


  if(
    lower.includes("strong buy") ||
    lower.includes("strongbuy")
  )
    return "Strong Buy";


  if(
    lower.includes("strong sell") ||
    lower.includes("strongsell")
  )
    return "Strong Sell";


  if(
    lower === "buy" ||
    lower.startsWith("buy ")
  )
    return "Buy";


  if(
    lower === "sell" ||
    lower.startsWith("sell ")
  )
    return "Sell";


  if(
    lower === "neutral" ||
    lower.startsWith("neutral ")
  )
    return "Neutral";


  return "N/A";

}


/* =========================================================
   EXTRACT FIRST SIGNAL
   ========================================================= */

function findSignal(text){

  if(!text)
    return "N/A";


  const clean =
    text
      .replace(/\s+/g," ")
      .trim();


  const strongSell =
    /strong\s*sell/i.exec(clean);

  if(strongSell)
    return "Strong Sell";


  const strongBuy =
    /strong\s*buy/i.exec(clean);

  if(strongBuy)
    return "Strong Buy";


  const neutral =
    /\bneutral\b/i.exec(clean);

  const buy =
    /\bbuy\b/i.exec(clean);

  const sell =
    /\bsell\b/i.exec(clean);


  /*
   * If both Buy and Sell appear in the row,
   * do not blindly pick one.
   */

  if(buy && sell){

    const buyCount =
      (clean.match(/\bbuy\b/gi) || [])
        .length;

    const sellCount =
      (clean.match(/\bsell\b/gi) || [])
        .length;


    if(buyCount > sellCount)
      return "Buy";


    if(sellCount > buyCount)
      return "Sell";


    if(neutral)
      return "Neutral";


    return "Neutral";
  }


  if(buy)
    return "Buy";


  if(sell)
    return "Sell";


  if(neutral)
    return "Neutral";


  return "N/A";

}


/* =========================================================
   PARSE TECHNICAL PAGE
   ========================================================= */

function parseTechnicalPage(html){

  const $ =
    cheerio.load(html);


  let summary =
    "N/A";

  let ma =
    "N/A";

  let indicators =
    "N/A";


  /*
   * Search visible text blocks.
   */

  const bodyText =
    $("body")
      .text()
      .replace(/\s+/g," ")
      .trim();


  /*
   * Summary
   */

  const summaryMatch =
    bodyText.match(
      /Summary\s*:?\s*(Strong\s+Buy|Strong\s+Sell|Buy|Sell|Neutral)/i
    );


  if(summaryMatch){

    summary =
      normalize(
        summaryMatch[1]
      );

  }


  /*
   * Moving Averages
   */

  const maMatch =
    bodyText.match(
      /Moving\s+Averages\s*:?\s*(Strong\s+Buy|Strong\s+Sell|Buy|Sell|Neutral)/i
    );


  if(maMatch){

    ma =
      normalize(
        maMatch[1]
      );

  }


  /*
   * Technical Indicators
   */

  const tiMatch =
    bodyText.match(
      /Technical\s+Indicators\s*:?\s*(Strong\s+Buy|Strong\s+Sell|Buy|Sell|Neutral)/i
    );


  if(tiMatch){

    indicators =
      normalize(
        tiMatch[1]
      );

  }


  /*
   * Some Investing pages expose:
   *
   * Summary:Sell
   * Moving Averages:Buy (3)Sell (9)
   * Technical Indicators:Buy (3)Sell (5)
   *
   * In that case parse the counts.
   */

  if(ma === "N/A"){

    const match =
      bodyText.match(
        /Moving\s+Averages\s*:\s*(?:Strong\s+)?Buy\s*\((\d+)\)\s*(?:Strong\s+)?Sell\s*\((\d+)\)/i
      );


    if(match){

      const buys =
        Number(match[1]);

      const sells =
        Number(match[2]);


      ma =
        signalFromCounts(
          buys,
          sells
        );

    }

  }


  if(indicators === "N/A"){

    const match =
      bodyText.match(
        /Technical\s+Indicators\s*:\s*(?:Strong\s+)?Buy\s*\((\d+)\)\s*(?:Strong\s+)?Sell\s*\((\d+)\)/i
      );


    if(match){

      const buys =
        Number(match[1]);

      const sells =
        Number(match[2]);


      indicators =
        signalFromCounts(
          buys,
          sells
        );

    }

  }


  return {

    summary,

    ma,

    indicators

  };

}


/* =========================================================
   COUNT → SIGNAL
   ========================================================= */

function signalFromCounts(
  buys,
  sells
){

  const total =
    buys + sells;


  if(total <= 0)
    return "Neutral";


  const buyRatio =
    buys / total;


  const sellRatio =
    sells / total;


  if(
    buyRatio >= 0.75
  )
    return "Strong Buy";


  if(
    sellRatio >= 0.75
  )
    return "Strong Sell";


  if(
    buyRatio > sellRatio
  )
    return "Buy";


  if(
    sellRatio > buyRatio
  )
    return "Sell";


  return "Neutral";

}


/* =========================================================
   BUILD INVESTING URL
   ========================================================= */

function investingURL(
  asset,
  timeframe
){

  /*
   * Investing uses the same technical-analysis
   * page for the instrument. Timeframe switching
   * is handled by the site's technical-analysis
   * page.
   *
   * We append timeframe as a query hint.
   */

  const base =
    "https://www.investing.com/technical/" +
    asset.slug;


  return (
    base +
    "?timeFrame=" +
    encodeURIComponent(
      timeframe.value
    ) +
    "&t=" +
    Date.now()
  );

}


/* =========================================================
   FETCH ONE TIMEFRAME
   ========================================================= */

async function getTimeframe(
  asset,
  timeframe
){

  try{

    const url =
      investingURL(
        asset,
        timeframe
      );


    const html =
      await fetchText(url);


    const parsed =
      parseTechnicalPage(html);


    /*
     * Check whether page actually contains
     * technical information.
     */

    if(
      parsed.summary === "N/A" &&
      parsed.ma === "N/A" &&
      parsed.indicators === "N/A"
    ){

      return {

        ok:false,

        data:{
          ma:"N/A",
          ti:"N/A",
          summary:"N/A"
        }

      };

    }


    return {

      ok:true,

      data:{
        ma:parsed.ma,
        ti:parsed.indicators,
        summary:parsed.summary
      }

    };


  }catch(error){

    console.error(
      `${asset.name} ${timeframe.label}:`,
      error.message
    );


    return {

      ok:false,

      data:{
        ma:"N/A",
        ti:"N/A",
        summary:"N/A"
      }

    };

  }

}


/* =========================================================
   TERMINAL API
   ========================================================= */

app.get(
  "/api/terminal",
  async(req,res) => {

    try{

      const results = [];


      /*
       * Process assets sequentially to reduce
       * the chance of hammering Investing.com.
       */

      for(
        const asset of ASSETS
      ){

        const price =
          await getPrice(
            asset.yahoo
          );


        const timeframeResults = [];


        for(
          const timeframe of TIMEFRAMES
        ){

          const result =
            await getTimeframe(
              asset,
              timeframe
            );


          timeframeResults.push(
            result.data
          );

        }


        results.push({

          name:
            asset.name,

          price:
            Number.isFinite(
              price.value
            )
              ? formatPrice(
                  price.value,
                  asset.name
                )
              : "N/A",

          color:
            price.color,

          ma:
            timeframeResults.map(
              x => x.ma
            ),

          ti:
            timeframeResults.map(
              x => x.ti
            ),

          s:
            timeframeResults.map(
              x => x.summary
            )

        });

      }


      res.json({

        success:true,

        source:"Investing.com",

        timeframes:[
          "1 Min",
          "5 Min",
          "15 Min",
          "30 Min"
        ],

        data:results

      });


    }catch(error){

      console.error(
        "Terminal error:",
        error
      );


      res.status(500).json({

        success:false,

        error:
          error.message ||
          "Terminal failed"

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
      `Server running on port ${PORT}`
    );

  }
);   ========================================================= */

async function fetchJSON(url, options = {}){

  const response =
    await fetch(
      url,
      {
        ...options,

        headers:{
          "Accept":"application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139 Safari/537.36",
          ...(options.headers || {})
        },

        signal:
          AbortSignal.timeout(15000)
      }
    );


  if(!response.ok){

    throw new Error(
      `HTTP ${response.status} from ${new URL(url).hostname}`
    );

  }


  return await response.json();

}


/* =========================================================
   YAHOO PRICE
   ========================================================= */

async function getYahooPrice(symbol){

  try{

    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(symbol) +
      "?range=1d&interval=1m";


    const json =
      await fetchJSON(url);


    const result =
      json?.chart?.result?.[0];


    if(!result){

      throw new Error(
        "Yahoo returned no chart data"
      );

    }


    const meta =
      result.meta || {};


    const price =
      Number(
        meta.regularMarketPrice
      );


    const previous =
      Number(
        meta.chartPreviousClose
      );


    if(!Number.isFinite(price)){

      throw new Error(
        "Invalid Yahoo price"
      );

    }


    let color =
      "blue";


    if(
      Number.isFinite(previous)
    ){

      if(price > previous)
        color = "green";

      else if(price < previous)
        color = "red";

    }


    return {

      price,
      color

    };


  }catch(error){

    console.error(
      `Yahoo price error [${symbol}]:`,
      error.message
    );


    return {

      price:null,
      color:"blue"

    };

  }

}


/* =========================================================
   INVESTING TECHNICAL DATA
   ========================================================= */

/*
 IMPORTANT:

 The old endpoint used in the original code:

 /api/financialdata/technical/ByPairIDs

 is no longer a reliable public endpoint.

 Therefore this function deliberately does NOT
 manufacture technical readings.
*/

async function getInvestingTechnicalData(){

  throw new Error(
    "Investing.com public technical endpoint is unavailable. No fabricated BUY/SELL data is returned."
  );

}


/* =========================================================
   NORMALIZE SIGNAL
   ========================================================= */

function normalizeSignal(value){

  if(
    typeof value !== "string"
  ){

    return "N/A";

  }


  const v =
    value
      .trim()
      .toLowerCase();


  if(v === "strong buy")
    return "Strong Buy";


  if(v === "buy")
    return "Buy";


  if(v === "neutral")
    return "Neutral";


  if(v === "sell")
    return "Sell";


  if(v === "strong sell")
    return "Strong Sell";


  return "N/A";

}


/* =========================================================
   EMPTY TECHNICAL DATA
   ========================================================= */

function emptyTechnical(){

  return {

    ma:[
      "N/A",
      "N/A",
      "N/A",
      "N/A"
    ],

    ti:[
      "N/A",
      "N/A",
      "N/A",
      "N/A"
    ],

    s:[
      "N/A",
      "N/A",
      "N/A",
      "N/A"
    ]

  };

}


/* =========================================================
   TERMINAL API
   ========================================================= */

app.get(
  "/api/terminal",
  async (req, res) => {

    try{

      /*
       * Price data can still be collected
       * independently.
       */

      const prices =
        {};

      await Promise.all(

        MAP.map(
          async asset => {

            prices[asset.id] =
              await getYahooPrice(
                asset.yahoo
              );

          }
        )

      );


      /*
       * Do NOT silently replace Investing
       * technical readings with another source.
       */

      let investingData = null;


      try{

        investingData =
          await getInvestingTechnicalData();

      }catch(error){

        console.error(
          "Investing technical feed:",
          error.message
        );

      }


      const data =
        MAP.map(asset => {

          const price =
            prices[asset.id] || {};


          const technical =
            investingData
              ? getTechnicalForPair(
                  investingData,
                  asset.id
                )
              : emptyTechnical();


          return {

            id:asset.id,

            name:asset.name,

            price:
              Number.isFinite(
                price.price
              )
                ? formatPrice(
                    price.price,
                    asset.name
                  )
                : "N/A",

            color:
              price.color ||
              "blue",

            ma:
              technical.ma,

            ti:
              technical.ti,

            s:
              technical.s

          };

        });


      res.json({

        success:true,

        source:{
          technical:
            investingData
              ? "Investing.com"
              : "unavailable",

          price:
            "Yahoo Finance"
        },

        data

      });


    }catch(error){

      console.error(
        "Terminal error:",
        error
      );


      res.status(500).json({

        success:false,

        error:
          error.message ||
          "Terminal feed failed"

      });

    }

  }
);


/* =========================================================
   TECHNICAL DATA LOOKUP
   ========================================================= */

function getTechnicalForPair(
  apiData,
  pairId
){

  const item =
    Array.isArray(apiData)
      ? apiData.find(
          x =>
            Number(x.pairId) ===
            Number(pairId)
        )
      : null;


  if(!item)
    return emptyTechnical();


  const ma =
    item.movingAverages || {};


  const ti =
    item.technicalIndicators || {};


  const summary =
    item.summary || {};


  return {

    ma:[
      normalizeSignal(ma["60"]),
      normalizeSignal(ma["300"]),
      normalizeSignal(ma["900"]),
      normalizeSignal(ma["1800"])
    ],

    ti:[
      normalizeSignal(ti["60"]),
      normalizeSignal(ti["300"]),
      normalizeSignal(ti["900"]),
      normalizeSignal(ti["1800"])
    ],

    s:[
      normalizeSignal(summary["60"]),
      normalizeSignal(summary["300"]),
      normalizeSignal(summary["900"]),
      normalizeSignal(summary["1800"])
    ]

  };

}


/* =========================================================
   PRICE FORMAT
   ========================================================= */

function formatPrice(
  price,
  name
){

  if(name === "USD/JPY")
    return price.toFixed(3);


  if(name.includes("/"))
    return price.toFixed(5);


  return price.toFixed(4);

}


/* =========================================================
   HEALTH CHECK
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
      `Pro Trading Terminal running on port ${PORT}`
    );

  }
);
