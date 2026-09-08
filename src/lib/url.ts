/**
 * Sicurezza dei link esterni: ogni URL che esce dall'app deve essere assoluto
 * (altrimenti il router interno lo interpreta come rotta e restituisce 404).
 */
export const ensureAbsoluteUrl = (url?: string | null): string => {
  if (!url) return "#";
  const value = String(url).trim();
  if (!value) return "#";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return `https://${value.replace(/^\/+/, "")}`;
};

/** Apertura sicura di un link esterno da script. */
export function openExternal(url?: string | null): void {
  window.open(ensureAbsoluteUrl(url), "_blank", "noopener,noreferrer");
}
