/**
 * Discord forwarding via a channel webhook (no bot host required).
 *
 * The user creates a webhook in their Discord channel settings and pastes the
 * URL. We POST messages to it — robust, no token management, no gateway.
 */

export async function postToDiscordWebhook(webhookUrl: string, content: string): Promise<boolean> {
  if (!webhookUrl || !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(webhookUrl)) {
    return false;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 1900) }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
