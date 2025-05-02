import express from "express";
import { runCustomSearch } from "./customSearch.js";

const router = express.Router();

router.get("/search/manual", async (req, res) => {
  const name = req.query.name as string;
  const city = req.query.city as string;

  if (!name || !city) {
    return res.status(400).json({ error: "Missing name or city" });
  }

  try {
    const results = await runCustomSearch(name, city);
    res.json(results);
  } catch {
    res.status(500).json({ error: "Failed to search" });
  }
});

export default router;
