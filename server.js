const express = require("express");
const multer = require("multer");
const fs = require("fs");

const app = express();
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } }); // max 20MB

// Home
app.get("/", (_req, res) => res.send("OK: backend up"));

// Check collegamento a RunPod (già testato)
app.get("/rp-health", async (_req, res) => {
  try {
    const url = `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}/health`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` } });
    res.json(await r.json());
  } catch {
    res.status(500).json({ error: "RunPod health failed" });
  }
});

// Paginetta di prova: upload + prompt
app.get("/test", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>Test Generate</title></head>
<body style="font-family:system-ui;max-width:720px;margin:40px auto">
  <h1>Test Generate</h1>
  <form id="f">
    <div><input type="file" name="image" required></div>
    <div><input name="prompt" placeholder="prompt positivo" style="width:100%"></div>
    <div><input name="neg" placeholder="prompt negativo" style="width:100%"></div>
    <button>Genera</button>
  </form>
  <p id="msg"></p>
  <img id="out" style="max-width:100%;display:none">
<script>
const f = document.getElementById('f');
f.onsubmit = async (e) => {
  e.preventDefault();
  document.getElementById('msg').textContent = 'In esecuzione...';
  const fd = new FormData(f);
  const r = await fetch('/generate', { method:'POST', body: fd });
  const j = await r.json();
  if (j?.output?.images?.[0]?.data) {
    document.getElementById('out').src = j.output.images[0].data;
    document.getElementById('out').style.display = 'block';
    document.getElementById('msg').textContent = 'Fatto.';
  } else {
    document.getElementById('msg').textContent = 'Errore: ' + (j?.error || 'sconosciuto');
  }
};
</script>
</body></html>`);
});

// GENERA: riceve file+parametri dal form e chiama RunPod /runsync
app.post("/generate", upload.single("image"), async (req, res) => {
  try {
    // 1) Leggi il workflow dal Secret File di Render
    const raw = fs.readFileSync("/etc/secrets/workflow.json", "utf-8"); // Secret File
    const wfObj = JSON.parse(raw);

    // Supporta varianti di formato (dipende da "Save (API format)")
    const w = (wfObj?.input?.workflow) || wfObj?.workflow || wfObj;

    // 2) Trova i nodi (in automatico, così non devi ricordare gli ID)
    const ids = Object.keys(w);

    const loadId = ids.find(id => (w[id]?.class_type || "").toLowerCase().includes("loadimage"));
    // Qwen Image Edit encoder per prompt (ne prende fino a 2: pos/neg)
    const qwenIds = ids.filter(id => w[id]?.class_type === "TextEncodeQwenImageEdit");

    // 3) Imposta i prompt (se presenti nel form)
    if (req.body?.prompt && qwenIds[0] && w[qwenIds[0]]?.inputs) {
      w[qwenIds[0]].inputs.prompt = req.body.prompt;
    }
    if (req.body?.neg && qwenIds[1] && w[qwenIds[1]]?.inputs) {
      w[qwenIds[1]].inputs.prompt = req.body.neg;
    }

    // 4) Prepara l'immagine (nome originale; niente rinomini forzati)
    const images = [];
    if (req.file) {
      const fileName = req.file.originalname || "input.png";
      const mime = req.file.mimetype || "image/png";
      const b64 = req.file.buffer.toString("base64");
      images.push({ name: fileName, image: `data:${mime};base64,${b64}` });

      // Diciamo al nodo LoadImage quale nome usare
      if (loadId && w[loadId]?.inputs) w[loadId].inputs.image = fileName;
    }

    // 5) Chiamata a RunPod /runsync (risposta immediata con output)
    const url = `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}/runsync`;
    const rp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ input: { workflow: w, images } })
    });

    const out = await rp.json();
    if (!rp.ok) return res.status(500).json({ error: "RunPod error", detail: out });

    // By default i worker ComfyUI su RunPod ritornano immagini in base64. :contentReference[oaicite:1]{index=1}
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ error: "Generation failed", detail: e?.message || e });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log("Listening on", PORT));
