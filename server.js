const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("OK: backend up"));

const axios = require("axios");

app.get("/rp-health", async (req, res) => {
  try {
    const url = `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}/health`;
    const r = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` }
    });
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: "RunPod health failed" });
  }
});


const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log("Listening on", PORT));
