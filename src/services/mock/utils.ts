/** Shared deterministic-ish random helpers for the mock service layer. */

export const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1) + min);

export const randomFloat = (min: number, max: number) =>
  Math.random() * (max - min) + min;

export const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)];

export const generateIP = () =>
  `${randomBetween(1, 255)}.${randomBetween(0, 255)}.${randomBetween(0, 255)}.${randomBetween(0, 255)}`;

export const internalIP = () =>
  `10.${randomBetween(0, 40)}.${randomBetween(0, 255)}.${randomBetween(2, 254)}`;

export const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

export const id = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

export const PROTOCOLS = ["TCP", "UDP", "HTTP", "HTTPS", "DNS", "SSH", "SMB"] as const;
