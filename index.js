import { scrapeBookingData } from "./booking.js";

const kv = await Deno.openKv();
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
const telegramApiUrl = `https://api.telegram.org/bot${botToken}`
const chatId = "-1002395888989";

const searchQueries = [
    {
        name: "Tokyo (start of trip)",
        url: 'https://www.booking.com/searchresults.en-gb.html?label=en-il-booking-desktop-sD66O*sLIyR37D38rZhp7wS652796016630%3Apl%3Ata%3Ap1%3Ap2%3Aac%3Aap%3Aneg%3Afi%3Atikwd-65526620%3Alp1008006%3Ali%3Adec%3Adm&sid=57825a18ad110af452ea4c6eee11226e&aid=2311236&ss=Shinjuku+Area%2C+Tokyo%2C+Tokyo-to%2C+Japan&ssne=Hakone&ssne_untouched=Hakone&highlighted_hotels=317205&efdco=1&lang=en-gb&src=searchresults&dest_id=3054&dest_type=district&ac_position=0&ac_click_type=b&ac_langcode=en&ac_suggestion_list_length=5&search_selected=true&search_pageview_id=013a5924bd560362&checkin=2024-10-17&checkout=2024-10-22&group_adults=2&no_rooms=1&group_children=0&nflt=price%3DILS-min-700-1%3Bfc%3D2%3Breview_score%3D80&selected_currency=ILS',
        nights: 5
    },
    {
        name: "Hakone",
        url: 'https://www.booking.com/searchresults.en-gb.html?label=en-il-booking-desktop-sD66O*sLIyR37D38rZhp7wS652796016630%3Apl%3Ata%3Ap1%3Ap2%3Aac%3Aap%3Aneg%3Afi%3Atikwd-65526620%3Alp1008006%3Ali%3Adec%3Adm&sid=57825a18ad110af452ea4c6eee11226e&aid=2311236&ss=Hakone&ssne=Hakone&ssne_untouched=Hakone&highlighted_hotels=317205&efdco=1&lang=en-gb&src=searchresults&dest_id=-228233&dest_type=city&checkin=2024-10-22&checkout=2024-10-24&group_adults=2&no_rooms=1&group_children=0&nflt=review_score%3D80%3Broomfacility%3D38%3Boos%3D1%3Bfc%3D2%3Bprice%3DILS-min-1200-1&selected_currency=ILS',
        nights: 2
    }
]

Deno.cron("Scrape Booking", "*/15 * * * *", async () => {
    let alreadySeen = (await kv.get(["hotels_seen"]))?.value || [];
    for (const query of searchQueries) {
        const { name, url, nights } = query;
        const hotelList = await scrapeBookingData(url);
        for (const hotel of hotelList) {
            const hotelHash = await hashString(hotel.url.split('html')[0]);
            if (alreadySeen.includes(hotelHash)) { // Hotel has been seen before
                continue;
            }
            await sendMessage(hotel, name, nights);
            alreadySeen.push(hotelHash);
        }
    }

    await kv.set(["hotels_seen"], alreadySeen);
});

Deno.serve(async () => {
    return new Response(`Please leave.`);
});

async function sendMessage(hotel, name, nights) {
    console.log(`Sending message for ${hotel.name}`);

    const message = `

    <b>${name}:</b> ${hotel.name}
    Review score: ${hotel.score}
    Total price: ${hotel.price} (${getPricePerNight(hotel.price, nights)} per night)
    <a href="${hotel.url}">See on Booking</a>`;

    const response = await fetch(telegramApiUrl + '/sendMessage', {
        method: "POST",
        body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: "HTML"
        }),
        headers: {
            "Content-Type": "application/json"
        }
    })

    if (!response.ok) {
        console.error("Error sending message to Telegram:", response.status);
    }
}

function getPricePerNight(priceString, nights) {
    // Remove the currency symbol and any non-numeric characters
    const cleanedString = priceString.replace(/[^\d]/g, '');

    // Convert the cleaned string to a number
    const price = parseFloat(cleanedString);

    // Divide by 5 to get the price per night
    const pricePerNight = price / nights;

    return pricePerNight;
}

async function hashString(str) {
    const hashBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}
