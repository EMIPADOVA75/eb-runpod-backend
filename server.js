const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("OK: backend up"));

app.get("/rp-health", async (req, res) => {
  try {
    const endpointId = process.env.RUNPOD_ENDPOINT_ID;
    const apiKey = process.env.RUNPOD_API_KEY;
    const url = `https://api.runpod.ai/v2/${endpointId}/health`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    const data = await r.json();
    res.json(data);
  } catch {
    res.status(500).json({ error: "RunPod health failed" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log("Listening on", PORT));
