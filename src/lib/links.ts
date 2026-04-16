/**
 * Extract markdown links; optionally filter by URL predicate.
 */
export function extractMarkdownLinks(
  markdown: string,
  filter?: (url: string) => boolean
): { title: string; url: string }[] {
  const re = /\[([^\]]*)\]\((https?:[^)\s]+)\)/g;
  const out: { title: string; url: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const title = m[1].trim() || m[2];
    const url = m[2].trim();
    if (filter && !filter(url)) continue;
    out.push({ title, url });
  }
  return dedupeByUrl(out);
}

function dedupeByUrl(items: { title: string; url: string }[]): { title: string; url: string }[] {
  const seen = new Set<string>();
  const result: { title: string; url: string }[] = [];
  for (const it of items) {
    const key = normalizeUrl(it.url);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(it);
  }
  return result;
}

export function toAbsoluteUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}
