export const WIKI_USER_AGENT = "wikiarchiver/1.0";

export async function wikiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = init?.method ?? "GET";
  console.log(`[wikiFetch] ${method} ${input}`);
  const res = await fetch(input, {
    ...init,
    headers: { "User-Agent": WIKI_USER_AGENT, ...init?.headers },
  });
  console.log(`[wikiFetch] ${method} ${input} -> ${res.status}`);
  return res;
}
