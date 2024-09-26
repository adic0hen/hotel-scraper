class TelegramNotifier {
    private apiUrl: string;

    constructor(botToken: string) {
        this.apiUrl = `https://api.telegram.org/bot${botToken}`;
    }

    async sendMessage(message: string, chatId: string): Promise<void> {
        const response = await fetch(this.apiUrl + "/sendMessage", {
            method: "POST",
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: "HTML",
            }),
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            console.error("Error sending message to Telegram:", response);
        }
    }
}

export default TelegramNotifier;
