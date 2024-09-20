const kv = await Deno.openKv();
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`
const chatId = "-826488742";

Deno.cron("Increment a counter", "*/5 * * * *", async () => {
    // increment a count using Deno KV
    // await kv.atomic().sum(["task_runs"], 1n).commit();
    await fetch(telegramApiUrl, {
        method: "POST",
        body: JSON.stringify({
            chat_id: chatId,
            text: "cronjob running"
        })
    })
});

Deno.serve(async () => {
    // Get the latest count
    // const count = await kv.get(["task_runs"]);
    return new Response(`Hello friend.`);
});
