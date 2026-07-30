export function safeHttpUrl(value: string | null | undefined, allowBareDomain = false): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const candidate = allowBareDomain && !/^[a-z][a-z0-9+.-]*:/i.test(raw) ? `https://${raw}` : raw;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}
