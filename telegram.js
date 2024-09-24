class TelegramNotifier {
    constructor(botToken) {
        this.apiUrl = `https://api.telegram.org/bot${botToken}`;
    }

    async sendMessage(message, chatId) {
        const response = await fetch(this.apiUrl + '/sendMessage', {
            method: "POST",
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: "HTML"
            }),
            headers: {
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            console.error("Error sending message to Telegram:", response.status);
        }
    }
}


export default TelegramNotifier;
