require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const dns = require("dns");
const urlParser = require("url");

const app = express();
const port = process.env.PORT || 3000;

const uri = process.env.DB_URL;
const client = new MongoClient(uri);

async function connectDB() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db("urlshortner");
    const urls = db.collection("urls");

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use("/public", express.static(`${process.cwd()}/public`));

    app.get("/", (req, res) => {
      res.sendFile(process.cwd() + "/views/index.html");
    });

    // POST /api/shorturl
    app.post("/api/shorturl", async (req, res) => {
      try {
        const originalUrl = req.body.url;
        let hostname;

        // Safely parse URL
        try {
          hostname = new URL(originalUrl).hostname;
        } catch (e) {
          return res.json({ error: "invalid url" });
        }

        // DNS lookup
        dns.lookup(hostname, async (err, address) => {
          if (err || !address) {
            return res.json({ error: "invalid url" });
          }

          // ✅ At this point, the URL is valid
          const db = client.db("fcc-urlshortner");
          const urls = db.collection("urlshortner");

          const count = await urls.countDocuments({});
          const urlDoc = {
            original_url: originalUrl,
            short_url: count + 1,
          };

          await urls.insertOne(urlDoc);

          console.log("✅ Inserted:", urlDoc);

          res.json({
            original_url: originalUrl,
            short_url: urlDoc.short_url,
          });
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
      }
    });

    // GET /api/shorturl/:short_url
    app.get("/api/shorturl/:short_url", async (req, res) => {
      try {
        const shortUrl = parseInt(req.params.short_url);
        if (isNaN(shortUrl)) {
          return res.json({ error: "Wrong format" });
        }

        const db = client.db("fcc-urlshortner");
        const urls = db.collection("urlshortner");

        const urlDoc = await urls.findOne({ short_url: shortUrl });
        if (!urlDoc) {
          return res.json({ error: "No short URL found" });
        }

        res.redirect(urlDoc.original_url);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
      }
    });

    // Start server only after DB connection
    app.listen(port, () => {
      console.log(`🚀 Listening on port ${port}`);
    });
  } catch (err) {
    console.error("❌ Could not connect to MongoDB:", err);
  }
}

connectDB();
