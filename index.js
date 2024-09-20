import { scrapeBookingData } from "./booking.js";

const kv = await Deno.openKv();
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
const telegramApiUrl = `https://api.telegram.org/bot${botToken}`
const chatId = "-826488742";

const searchQueries = [
    // Hakone
    'https://www.booking.com/searchresults.html?label=gen173nr-1FCAEoggI46AdIM1gEaGqIAQGYATG4ARfIAQzYAQHoAQH4AQKIAgGoAgO4AsLWtbcGwAIB0gIkZjg4Mzg4MjctOGU0YS00YzcyLWE3ODUtMDQ4MGFjNjU1YWYy2AIF4AIB&aid=304142&ss=Hakone%2C+Kanagawa%2C+Japan&efdco=1&lang=en-us&src=index&dest_id=-228233&dest_type=city&ac_position=0&ac_click_type=b&ac_langcode=en&ac_suggestion_list_length=5&search_selected=true&search_pageview_id=88ec5821e87501eb&checkin=2024-10-22&checkout=2024-10-24&group_adults=2&no_rooms=1&group_children=0&nflt=price%3DILS-min-1000-1%3Breview_score%3D80'
]

async function sendMessage(hotel) {
    const message = `
    ${hotel.name}
    Review score: ${hotel.score}
    Price: ${hotel.price} per night
    ${hotel.url}`;

    const response = await fetch(telegramApiUrl + '/sendMessage', {
        method: "POST",
        body: JSON.stringify({
            chat_id: chatId,
            text: message
        }),
    })

    if (!response.ok) {
        console.error("Error sending message to Telegram:", response.status);
    }
}

async function hashString(str) {
    const hashBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

Deno.cron("Scrape Booking", "*/10 * * * *", async () => {
    const alreadySeen = await kv.get(["hotels_seen"]) || [];
    let newHotels = [];
    searchQueries.forEach(async (query) => {
        const hotelList = await scrapeBookingData(query);
        hotelList.forEach(async (hotel) => {
            const hotelHash = await hashString(hotel.url);
            newHotels.push(hotelHash);
            if (hotelHash in alreadySeen) { // Hotel has been seen before
                return;
            }
            await sendMessage(hotel);
        });
    });

    // Set the new hotels to the already seen list, remove the old ones
    await kv.set(["hotels_seen"], newHotels);
});

Deno.serve(async () => {
    return new Response(`Please leave.`);
});


