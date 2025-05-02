import axios from 'axios';
import * as cheerio from 'cheerio';

const BLOCKED_DOMAINS = [
  'facebook.com', 'yelp.com', 'linkedin.com',
  'bbb.org', 'yellowpages.com', 'mapquest.com',
  'angi.com', 'houzz.com'
];

function isValidLink(url: string, businessName: string) {
  const lower = url.toLowerCase();
  const namePart = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return !BLOCKED_DOMAINS.some(domain => lower.includes(domain)) &&
         lower.includes(namePart);
}

function scoreLink(url: string, businessName: string) {
  let score = 0;
  const lower = url.toLowerCase();
  const namePart = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (lower.includes(namePart)) score += 10;
  if (lower.includes('contact') || lower.includes('about')) score += 3;
  if (lower.endsWith('.com') || lower.endsWith('.net')) score += 5;
  return score;
}

export async function searchGoogleRaw(businessName: string, city: string): Promise<{ url: string, score: number }[]> {
  const query = `${businessName} ${city} site:.com`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`;

  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    }
  });

  const $ = cheerio.load(data);
  const links: { url: string; score: number }[] = [];

  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || !href.startsWith('/url?q=')) return;

    const cleaned = decodeURIComponent(href.split('/url?q=')[1].split('&')[0]);
    if (isValidLink(cleaned, businessName)) {
      links.push({ url: cleaned, score: scoreLink(cleaned, businessName) });
    }
  });

  return links.sort((a, b) => b.score - a.score);
}


export async function fetchGoogleRating(googleUrl: string): Promise<{ rating: string, reviewCount: string } | null> {
  try {
    const { data } = await axios.get(googleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(data);
    const ratingText = $('span').filter((_, el) => $(el).text().match(/\d\.\d/)).first().text();
    const reviewText = $('span').filter((_, el) => $(el).text().match(/\d+ reviews?/)).first().text();

    return {
      rating: ratingText || "N/A",
      reviewCount: reviewText || "0"
    };
  } catch (err) {
    return null;
  }
}
