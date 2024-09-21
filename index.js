import { scrapeBookingData } from "./booking.js";

const kv = await Deno.openKv();
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
const telegramApiUrl = `https://api.telegram.org/bot${botToken}`
const chatId = "-826488742";

const searchQueries = [
    // Hakone
    'https://www.booking.com/searchresults.en-gb.html?label=en-il-booking-desktop-sD66O*sLIyR37D38rZhp7wS652796016630%3Apl%3Ata%3Ap1%3Ap2%3Aac%3Aap%3Aneg%3Afi%3Atikwd-65526620%3Alp1008006%3Ali%3Adec%3Adm&sid=57825a18ad110af452ea4c6eee11226e&aid=2311236&ss=Hakone&ssne=Hakone&ssne_untouched=Hakone&highlighted_hotels=317205&efdco=1&lang=en-gb&src=searchresults&dest_id=-228233&dest_type=city&checkin=2024-10-22&checkout=2024-10-24&group_adults=2&no_rooms=1&group_children=0&nflt=review_score%3D80%3Broomfacility%3D38%3Boos%3D1%3Bfc%3D2%3Bprice%3DILS-min-1200-1&selected_currency=ILS'
]

Deno.cron("Scrape Booking", "*/15 * * * *", async () => {
    let alreadySeen = await kv.get(["hotels_seen"])?.value || [];
    for (const query of searchQueries) {
        const hotelList = await scrapeBookingData(query);
        for (const hotel of hotelList) {
            const hotelHash = await hashString(hotel.url);
            if (alreadySeen.includes(hotelHash)) { // Hotel has been seen before
                continue;
            }
            await sendMessage(hotel);
            alreadySeen.push(hotelHash);
        }
    }

    // Set the new hotels to the already seen list, remove the old ones
    await kv.set(["hotels_seen"], alreadySeen);
});

Deno.serve(async () => {
    return new Response(`Please leave.`);
});

async function sendMessage(hotel) {
    console.log(`Sending message for ${hotel.name}`);

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
        headers: {
            "Content-Type": "application/json"
        }
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
