import { Hono } from "https://deno.land/x/hono@v3.4.1/mod.ts";
import TelegramNotifier from "./telegram.ts";
import { getHash, scrapeBookingData, Hotel } from "./booking.ts";

const ADMIN_CHAT_ID = "8009221299";
const NOTIFICATION_CHAT_ID = "-4651888363";
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SECRET_HEADER = Deno.env.get("TELEGRAM_SECRET_HEADER") ?? "";

const telegramNotifier = new TelegramNotifier(BOT_TOKEN);
const app = new Hono();
const kv = await Deno.openKv();

interface SearchQuery {
	name: string;
	checkin: string;
	checkout: string;
}

app.get("/", (c) => c.text("Please leave Adi."));

app.post("/telegram", async (c) => {
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
		return c.text("no.");
	}

	const respond = async (msg: string) =>
		await telegramNotifier.sendMessage(msg, chatId);

	const searchQueries = (await kv.get<string[]>(["search_queries"]))?.value ?? [];
	const alreadySeen = (await kv.get<string[]>(["hotels_seen"]))?.value ?? [];

	const [command, ...args] = text.split(" ");
	const argument = args.join(" ");

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
				`Here are your currently monitored searches:\n\n${
					searchQueries.map((query, idx) => {
						const { name, checkin, checkout } = parseQuery(query);
						return `<b>${idx + 1}. ${name}</b>
								   ${checkin} - ${checkout}`;
					}).join("\n\n")
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
			const index = parseInt(argument) - 1;
			if (isNaN(index) || index < 0 || index >= searchQueries.length) {
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
			if (argument == "all") {
				await kv.delete(["hotels_seen"]);
				await respond("Seen hotels cache has been completely cleared.");
			} else {
				const hashToClear = await getHash(argument);
				await kv.set(
					["hotels_seen"],
					alreadySeen.filter((hash) => hash != hashToClear),
				);
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

function parseQuery(url: string): SearchQuery {
	const params = new URLSearchParams(url);
	return {
		name: params.get("ss") ?? "",
		checkin: params.get("checkin") ?? "",
		checkout: params.get("checkout") ?? "",
	};
}

const MAX_NUMBER_OF_HOTELS = 10;

Deno.cron("Scrape Booking", "*/10 * * * *", async () => {
	const searchQueries = (await kv.get<string[]>(["search_queries"]))?.value ?? [];
	const alreadySeen = (await kv.get<string[]>(["hotels_seen"]))?.value ?? [];
	for (const query of searchQueries) {
		const hotelList = await scrapeBookingData(query);

		for (const hotel of hotelList.slice(0, MAX_NUMBER_OF_HOTELS)) {
			const hotelHash = await getHash(hotel.url);
			if (alreadySeen.includes(hotelHash)) {
				continue;
			}
			const { name, checkin, checkout } = parseQuery(query);
			await sendHotelMessage(hotel, name, checkin, checkout);
			alreadySeen.push(hotelHash);
		}
	}

	await kv.set(["hotels_seen"], alreadySeen);
});

Deno.serve(app.fetch);

async function sendHotelMessage(hotel: Hotel, name: string, checkin: string, checkout: string) {
	console.log(`Sending message for ${hotel.name}`);

	const message = `
	<b>${name}</b> 
	${checkin} - ${checkout}
	Review score: ${hotel.score}
	Total price: ${hotel.price} (${
		getPricePerNight(hotel.price, calculateNights(checkin, checkout))
	} per night)
	<a href="${hotel.url}">See on Booking</a>`;

	await telegramNotifier.sendMessage(message, NOTIFICATION_CHAT_ID);
}

function isValidUrl(url: string): boolean {
	try {
		new URL(url);
		return true;
	} catch (_error) {
		return false;
	}
}

function calculateNights(startDate: string, endDate: string): number {
	const start = new Date(startDate);
	const end = new Date(endDate);
	const timeDifference = end.getTime() - start.getTime();
	return timeDifference / (1000 * 60 * 60 * 24);
}

function getPricePerNight(priceString: string, nights: number): number {
	const cleanedString = priceString.replace(/[^\d]/g, "");
	const price = parseFloat(cleanedString);
	const pricePerNight = price / nights;
	return Math.round(pricePerNight);
}
