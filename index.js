import { Hono } from "https://deno.land/x/hono@v3.4.1/mod.ts";
import TelegramNotifier from "./telegram.js";
import { getHash, scrapeBookingData } from "./booking.js";

const ADMIN_CHAT_ID = "281418284";
const NOTIFICATION_CHAT_ID = "-1002395888989";
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SECRET_HEADER = Deno.env.get("TELEGRAM_SECRET_HEADER");
const telegramNotifier = new TelegramNotifier(BOT_TOKEN);
const app = new Hono();
const kv = await Deno.openKv();

app.get("/", (c) => c.text("Please leave."));

app.post("/telegram", async (c) => {
    // Verify the X-Telegram-Bot-Api-Secret-Token header
    const headerToken = c.req.header("X-Telegram-Bot-Api-Secret-Token");
    if (headerToken !== SECRET_HEADER) {
        return c.text("Unauthorized", 401);
    }

    const { message } = await c.req.json();
    const { text, chat } = message;
    const chatId = chat.id;

    console.log(
        `Received message from telegram: chatId = ${chatId} message = ${text}`,
    );

    if (chatId != ADMIN_CHAT_ID) {
        // Drop message
        return c.text("no.");
    }

    const respond = async (msg) =>
        await telegramNotifier.sendMessage(msg, chatId);

    const searchQueries = (await kv.get(["search_queries"]))?.value || [];
    const alreadySeen = (await kv.get(["hotels_seen"]))?.value || [];

    const command = text.split(" ")[0].toLowerCase();
    const argument = text.split(" ").slice(1).join(" ");

    switch (command) {
        case "/start":
            await respond(
                "Please use /monitor %BOOKING_URL% to monitor hotels.",
            );
            break;

        case "/monitor":
            if (!argument) {
                await respond(
                    "Please use /monitor %BOOKING_URL% to monitor hotels.",
                );
                break;
            }
            if (!isValidUrl(argument)) {
                await respond("Please provide a valid URL for monitoring.");
                break;
            }
            searchQueries.push(argument);
            await kv.set(["search_queries"], searchQueries);
            await respond(
                `Search monitored! Use /list to see all monitored searches.`,
            );
            break;

        case "/list":
            await respond(
                `Here are your currently monitored searches:\n${
                    searchQueries.map((query, index) => {
                        const { name, checkin, checkout } = parseQuery(query);
                        return `${
                            index + 1
                        }. <b>${name}</b> ${checkin} - ${checkout}`;
                    }).join("\n")
                }`,
            );
            break;

        case "/unmonitor": {
            if (!argument) {
                await respond(
                    "Please use /unmonitor %SEARCH_NUMBER% to delete monitor.",
                );
                break;
            }
            if (isNaN(argument)) {
                await respond(
                    "Please provide a valid search number to unmonitor.",
                );
                break;
            }
            const index = parseInt(argument) - 1;
            if (index < 0 || index >= searchQueries.length) {
                await respond(
                    "Invalid search number. Please use /list to see available searches.",
                );
                break;
            }
            const removedQuery = searchQueries.splice(index, 1)[0];
            await kv.set(["search_queries"], searchQueries);
            await respond(`Removed search: ${parseQuery(removedQuery).name}`);
            break;
        }
        case "/clear":
            if (!argument) {
                break;
            }
            if (argument == "all") { // Clear all cache
                await kv.delete(["hotels_seen"]);
                await respond("Seen hotels cache has been completely cleared.");
            } else {
                alreadySeen.filter((hash) => hash == getHash(argument));
                await kv.set(["hotels_seen"], alreadySeen);
                await respond(
                    "Hotel was cleared from cache. It will be monitored once again!",
                );
            }
            break;

        default:
            await respond(
                "I didn't understand that command. Please use /start, /monitor, /list, or /clear.",
            );
    }

    return c.text("OK");
});

function parseQuery(url) {
    const params = new URLSearchParams(url);
    return {
        name: params.get("ss"),
        checkin: params.get("checkin"),
        checkout: params.get("checkout"),
    };
}

// const searchQueries = [
//     {
//         name: "Tokyo (start of trip)",
//         url: "https://www.booking.com/searchresults.en-gb.html?label=en-il-booking-desktop-sD66O*sLIyR37D38rZhp7wS652796016630%3Apl%3Ata%3Ap1%3Ap2%3Aac%3Aap%3Aneg%3Afi%3Atikwd-65526620%3Alp1008006%3Ali%3Adec%3Adm&sid=57825a18ad110af452ea4c6eee11226e&aid=2311236&ss=Shinjuku+Area%2C+Tokyo%2C+Tokyo-to%2C+Japan&ssne=Hakone&ssne_untouched=Hakone&highlighted_hotels=317205&efdco=1&lang=en-gb&src=searchresults&dest_id=3054&dest_type=district&ac_position=0&ac_click_type=b&ac_langcode=en&ac_suggestion_list_length=5&search_selected=true&search_pageview_id=013a5924bd560362&checkin=2024-10-17&checkout=2024-10-22&group_adults=2&no_rooms=1&group_children=0&nflt=price%3DILS-min-600-1%3Bfc%3D2%3Breview_score%3D80&selected_currency=ILS",
//         nights: 5,
//     },
//     {
//         name: "Hakone",
//         url: "https://www.booking.com/searchresults.en-gb.html?label=en-il-booking-desktop-sD66O*sLIyR37D38rZhp7wS652796016630%3Apl%3Ata%3Ap1%3Ap2%3Aac%3Aap%3Aneg%3Afi%3Atikwd-65526620%3Alp1008006%3Ali%3Adec%3Adm&sid=57825a18ad110af452ea4c6eee11226e&aid=2311236&ss=Hakone&ssne=Hakone&ssne_untouched=Hakone&highlighted_hotels=317205&efdco=1&lang=en-gb&src=searchresults&dest_id=-228233&dest_type=city&checkin=2024-10-22&checkout=2024-10-24&group_adults=2&no_rooms=1&group_children=0&nflt=review_score%3D80%3Broomfacility%3D38%3Boos%3D1%3Bfc%3D2%3Bprice%3DILS-min-1200-1&selected_currency=ILS",
//         nights: 2,
//     },
//     {
//         name: "Kurokawa Onsen",
//         url: "https://www.booking.com/searchresults.en-gb.html?label=gen173nr-1BCAEoggI46AdIM1gEaGqIAQGYAQm4ARfIAQzYAQHoAQGIAgGoAgO4AojnvLcGwAIB0gIkMjIwYjc0YTQtNThjMC00MzYzLWE1NTQtNTMwNjk0MGU5NGFl2AIF4AIB&sid=8a9e3908c14e4f5341bb7e7d2f31a3c0&aid=304142&ss=Kurokawa+Onsen%2C+Minamioguni%2C+Kumamoto%2C+Japan&ssne=Beppu&ssne_untouched=Beppu&highlighted_hotels=585298&efdco=1&lang=en-gb&src=hotel&dest_id=7021&dest_type=district&ac_position=0&ac_click_type=b&ac_langcode=en&ac_suggestion_list_length=5&search_selected=true&search_pageview_id=5cb793a53c520284&checkin=2024-10-31&checkout=2024-11-01&group_adults=2&no_rooms=1&group_children=0&nflt=review_score%3D80%3Broomfacility%3D38%3Bht_id%3D209%3Boos%3D1%3Bfc%3D2%3Bprice%3DILS-min-1500-1&selected_currency=ILS",
//         nights: 1,
//     },
// ];

const MAX_NUMBER_OF_HOTELS = 10;

Deno.cron("Scrape Booking", "*/10 * * * *", async () => {
    const searchQueries = (await kv.get(["search_queries"]))?.value || [];
    const alreadySeen = (await kv.get(["hotels_seen"]))?.value || [];
    for (const query of searchQueries) {
        const hotelList = await scrapeBookingData(query);

        for (const hotel of hotelList.slice(0, MAX_NUMBER_OF_HOTELS)) {
            const hotelHash = await getHash(hotel.url);
            if (alreadySeen.includes(hotelHash)) { // Hotel has been seen before
                continue;
            }
            await sendHotelMessage(hotel, ...parseQuery(query));
            alreadySeen.push(hotelHash);
        }
    }

    await kv.set(["hotels_seen"], alreadySeen);
});

Deno.serve(app.fetch);

async function sendHotelMessage(hotel, name, checkin, checkout) {
    console.log(`Sending message for ${hotel.name}`);

    const message = `
    <b>${name}:</b> ${checkin} - ${checkout}
    Review score: ${hotel.score}
    Total price: ${hotel.price} (${
        getPricePerNight(hotel.price, calculateNights(checkin, checkout))
    } per night)
    <a href="${hotel.url}">See on Booking</a>`;

    await telegramNotifier.sendMessage(message, NOTIFICATION_CHAT_ID);
}

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (_error) {
        return false;
    }
}

function calculateNights(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDifference = end - start;
    const nights = timeDifference / (1000 * 60 * 60 * 24);
    return nights;
}

function getPricePerNight(priceString, nights) {
    // Remove the currency symbol and any non-numeric characters
    const cleanedString = priceString.replace(/[^\d]/g, "");

    // Convert the cleaned string to a number
    const price = parseFloat(cleanedString);

    // Divide by 5 to get the price per night
    const pricePerNight = price / nights;

    return pricePerNight;
}
