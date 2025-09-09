import express from "express";
const app = express();
app.get("/", (req, res) => res.send("OK: backend up"));
const PORT = process.env.PORT || 8080; // Render passa PORT in automatico
app.listen(PORT, () => console.log("Listening on", PORT));
