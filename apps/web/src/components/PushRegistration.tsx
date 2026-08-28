"use client";

import { useEffect } from "react";
import { SERVICES } from "@/lib/env";
import { useAuthStore } from "@/stores/auth";

export default function PushRegistration() {
  useEffect(() => {
    const token = useAuthStore.getState().accessToken;
    if (!token || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    void (async () => {
      const registration = await navigator.serviceWorker.register("/sw.js");
      if (Notification.permission === "default") return;
      if (Notification.permission !== "granted") return;
      const vapid = await fetch(`${SERVICES.messaging}/push/vapid-public-key`).then((r) => r.json()) as { publicKey?: string };
      if (!vapid.publicKey) return;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(atob(vapid.publicKey), (char) => char.charCodeAt(0)),
      });
      await fetch(`${SERVICES.messaging}/push/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(subscription.toJSON()),
      });
    })().catch(() => undefined);
  }, []);
  return null;
}
