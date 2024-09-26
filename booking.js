import * as cheerio from "npm:cheerio";

/**
 * @typedef {Object} Hotel
 * @property {string} name
 * @property {number} score
 * @property {string} url
 * @property {string} price
 */
// class Hotel {
//   constructor(name, score, url, price) {
//     this.name = name;
//     this.score = score;
//     this.url = url;
//     this.price = price;
//   }
// }

export async function scrapeBookingData(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    return $('[data-testid="property-card"]')
      .map((_, element) => {
        const $element = $(element);
        const name = $element.find('[data-testid="title"]').text().trim();
        const scoreText = $element.find('[data-testid="review-score"] > div:first-child').text().trim();
        const score = parseScore(scoreText);
        const url = $element.find('a[data-testid="title-link"]').attr('href');
        const price = $element.find('[data-testid="price-and-discounted-price"]').text().trim();

        // Return the hotel data object if all required fields are present, otherwise return null
        return (name && score && url && price) ? { name, score, url, price } : null;
      })
      .get() // Convert the jQuery object to a regular JavaScript array
      .filter(Boolean); // Remove any null entries from the array
  } catch (error) {
    console.error('Error scraping booking data:', error);
    return []; // Return an empty array if an error occurs
  }
}

// Helper function to parse the score from the scoreText
function parseScore(scoreText) {
  // Extract the first occurrence of a number (including decimal points) from the scoreText
  const scoreMatch = scoreText.match(/[\d.]+/);
  // If a match is found, convert it to a float; otherwise, return null
  return scoreMatch ? parseFloat(scoreMatch[0]) : null;
}

export async function getHash(url) {
  return await hashString(url.split("html")[0]);
}

async function hashString(str) {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(str),
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return hashHex;
}

export async function handler(url) {
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

// const url = 'https://www.booking.com/searchresults.html?label=gen173nr-1FCAEoggI46AdIM1gEaGqIAQGYATG4ARfIAQzYAQHoAQH4AQKIAgGoAgO4AsLWtbcGwAIB0gIkZjg4Mzg4MjctOGU0YS00YzcyLWE3ODUtMDQ4MGFjNjU1YWYy2AIF4AIB&aid=304142&ss=Hakone%2C+Kanagawa%2C+Japan&efdco=1&lang=en-us&src=index&dest_id=-228233&dest_type=city&ac_position=0&ac_click_type=b&ac_langcode=en&ac_suggestion_list_length=5&search_selected=true&search_pageview_id=88ec5821e87501eb&checkin=2024-10-22&checkout=2024-10-24&group_adults=2&no_rooms=1&group_children=0&nflt=price%3DILS-min-1000-1%3Breview_score%3D80';
// const res = await handler(url);
// console.log(res.body);
