const kv = await Deno.openKv();
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
const telegramApiUrl = `https://api.telegram.org/bot${botToken}`
const chatId = "-826488742";

Deno.cron("Scrape Booking", "*/5 * * * *", async () => {
    // increment a count using Deno KV
    // await kv.atomic().sum(["task_runs"], 1n).commit();
    await fetch(telegramApiUrl + '/sendMessage', {
        method: "POST",
        body: JSON.stringify({
            chat_id: chatId,
            text: "cronjob running"
        }),
        headers: {
            "Content-Type": "application/json"
        }
    })
});

Deno.serve(async () => {
    // Get the latest count
    // const count = await kv.get(["task_runs"]);
    return new Response(`Hello friend.`);
});
