const express = require("express");
const path = require("path");

const app = express();

const PORT =
  process.env.PORT || 10000;


/* =========================================================
   EXPRESS
   ========================================================= */

app.disable("x-powered-by");

app.use(express.json());


/* =========================================================
   INVESTING PAIR MAP
   ========================================================= */

const MAP = [

  {
    id: 1,
    name: "EUR/USD",
    yahoo: "EURUSD=X"
  },

  {
    id: 2,
    name: "GBP/USD",
    yahoo: "GBPUSD=X"
  },

  {
    id: 4,
    name: "USD/JPY",
    yahoo: "JPY=X"
  },

  {
    id: 5,
    name: "AUD/USD",
    yahoo: "AUDUSD=X"
  },

  {
    id: 6,
    name: "USD/CAD",
    yahoo: "CAD=X"
  },

  {
    id: 9,
    name: "USD/CHF",
    yahoo: "CHF=X"
  },

  {
    id: 18,
    name: "EUR/JPY",
    yahoo: "EURJPY=X"
  },

  {
    id: 72,
    name: "GBP/JPY",
    yahoo: "GBPJPY=X"
  }

];


/* =========================================================
   TIMEFRAMES
   ========================================================= */

const TIMEFRAMES = [
  60,
  300,
  900,
  1800
];


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
   JSON FETCH HELPER
   ========================================================= */

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
