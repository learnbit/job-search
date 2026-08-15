export interface TelegramConfig {
  readonly botToken: string;
  readonly chatId: string;
}

export function parseTelegramConfig(
  environment: Readonly<Record<string, string | undefined>>,
): TelegramConfig {
  const botToken = environment.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = environment.TELEGRAM_CHAT_ID?.trim();

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required.");
  }

  if (!chatId) {
    throw new Error("TELEGRAM_CHAT_ID is required.");
  }

  return { botToken, chatId };
}
