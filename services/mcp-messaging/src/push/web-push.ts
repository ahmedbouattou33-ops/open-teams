import webpush, { type PushSubscription } from "web-push";

const subscriptions = new Map<string, PushSubscription>();
let configured = false;

function ensureConfigured(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:security@openteams.local";
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

export function saveSubscription(userId: string, subscription: PushSubscription): void {
  subscriptions.set(userId, subscription);
}

export async function sendCriticalPush(userId: string, payload: Record<string, unknown>): Promise<boolean> {
  if (!ensureConfigured()) return false;
  const subscription = subscriptions.get(userId);
  if (!subscription) return false;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) subscriptions.delete(userId);
    return false;
  }
}

export function pushConfigStatus(): { configured: boolean; subscriptions: number } {
  return { configured: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY), subscriptions: subscriptions.size };
}
