require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require("body-parser");
const dns = require('dns');
const mongoose = require('mongoose');

// Basic Configuration
const port = process.env.PORT || 3000;
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use('/public', express.static(`${process.cwd()}/public`));

// START: Database
const MONGO_URI = process.env['MONGO_URI'];
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const UrlSchema = mongoose.Schema({
  id_short_url: Number,
  original_url: String
});

const UrlModel = mongoose.model('Url', UrlSchema, 'url_shortener');
// END: Database

// GET: Homepage
app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Check url is valid by string regx
const isValidUrlRegx = (url) => {
  const urlRegx =
    url.match(/(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi);
  return (urlRegx !== null);
}

// Middleware: Check url is valid by string regx and dns
const isValidUrlMiddleware = (req, res, next) => {
  const { url } = req.body;
  if (!isValidUrlRegx(url)) return res.json({ error: "Invalid URL" });

  const urlObject = new URL(url);
  dns.lookup(urlObject.hostname, (err, address, family) => {
    if (err != null) return res.json({ error: "Invalid URL" });
    next();
  });
}

// POST : Create Shorturl
app.post('/api/shorturl', isValidUrlMiddleware, async (req, res) => {
  const { url } = req.body;
  let idUrlShort, idIsExists;

  const urlIsExists = await UrlModel.exists({ original_url: url });
  if (urlIsExists) {
    const urlData = await UrlModel.findOne({ original_url: url });
    res.json({ original_url: urlData.original_url, short_url: urlData.id_short_url });
  } else {
    do {
      idUrlShort = Math.floor((Math.random() * 100000) + 1);
      idIsExists = await UrlModel.exists({ id_short_url: idUrlShort });
      console.log('do generate id:', idUrlShort);
    } while (idIsExists);

    const urlData = new UrlModel({
      id_short_url: idUrlShort,
      original_url: url
    });

    urlData.save(function(err, data) {
      if (err) return res.json({ error: "Failed to save in database" });
      const { id_short_url, original_url } = data;
      res.json({ original_url: original_url, short_url: id_short_url });
    });
  }
});

// GET : Redirect Process
app.get("/api/shorturl/:urlIdShort", async (req, res) => {
  const { urlIdShort } = req.params;
  const idIsExists = await UrlModel.exists({ id_short_url: urlIdShort });
  if (idIsExists) {
    const urlData = await UrlModel.findOne({ id_short_url: urlIdShort });
    res.redirect(urlData.original_url);
  } else {
    res.json({ error: "No short URL found for the given input" });
  }
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
