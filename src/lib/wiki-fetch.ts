export const WIKI_USER_AGENT = "wikiarchiver/1.0";

export function wikiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: { "User-Agent": WIKI_USER_AGENT, ...init?.headers },
  });
}
