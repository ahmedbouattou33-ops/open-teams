const raw = {
  auth: process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:4001",
  messaging: process.env.NEXT_PUBLIC_MESSAGING_URL ?? "http://localhost:4002",
  mediaRtc: process.env.NEXT_PUBLIC_MEDIA_RTC_URL ?? "http://localhost:4003",
  storage: process.env.NEXT_PUBLIC_STORAGE_URL ?? "http://localhost:4004",
  minio: process.env.NEXT_PUBLIC_MINIO_URL ?? "http://localhost:9000",
};

export const SERVICES = raw;

export function httpToWs(url: string): string {
  return url.replace(/^http/, "ws");
}
