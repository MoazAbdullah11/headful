import express from "express";
import cors from "cors";
import { fetchMetadata } from "./scraper.js";

const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/metadata", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "URL is required"
    });
  }

  const result = await fetchMetadata(url);
  res.json(result);
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});