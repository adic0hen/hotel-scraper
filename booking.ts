import * as cheerio from "npm:cheerio";

export interface Hotel {
  name: string;
  score: number;
  url: string;
  price: string;
}

export async function scrapeBookingData(url: string): Promise<Hotel[]> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    return $('[data-testid="property-card"]')
      .map((_, element): Hotel | null => {
        const $element = $(element);
        const name = $element.find('[data-testid="title"]').text().trim();
        const scoreText = $element.find('[data-testid="review-score"] > div:first-child').text().trim();
        const score = parseScore(scoreText);
        const url = $element.find('a[data-testid="title-link"]').attr('href') ?? "";
        const price = $element.find('[data-testid="price-and-discounted-price"]').text().trim();

        return (name && score && url && price) ? { name, score, url, price } : null;
      })
      .get()
      .filter((hotel): hotel is Hotel => hotel !== null);
  } catch (error) {
    console.error('Error scraping booking data:', error);
    return [];
  }
}

function parseScore(scoreText: string): number | null {
  const scoreMatch = scoreText.match(/[\d.]+/);
  return scoreMatch ? parseFloat(scoreMatch[0]) : null;
}

export async function getHash(url: string): Promise<string> {
  return await hashString(url.split("html")[0]);
}

async function hashString(str: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(str),
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function handler(url: string): Promise<{ statusCode: number; body: string }> {
  try {
    const data = await scrapeBookingData(url);
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to scrape data" }),
    };
  }
}
