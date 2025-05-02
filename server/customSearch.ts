import axios from "axios";
import cheerio from "cheerio";

export async function runCustomSearch(name: string, city: string) {
  const query = encodeURIComponent(`${name} ${city}`);
  const url = `https://www.google.com/search?q=${query}`;

  const res = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  const $ = cheerio.load(res.data);
  const results: any[] = [];

  $("a").each((_, el) => {
    const link = $(el).attr("href");
    if (link && link.startsWith("/url?q=")) {
      const clean = link.split("/url?q=")[1].split("&")[0];
      if (
        !clean.includes("google.") &&
        !clean.includes("facebook.") &&
        !clean.includes("yelp.") &&
        !clean.includes("map.") &&
        !clean.includes("linkedin.") &&
        !clean.includes("tripadvisor.")
      ) {
        results.push({ website: clean });
      }
    }
  });

  return results;
}
