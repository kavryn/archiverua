export async function fetchWikisourceName(
  pageTitle: string
): Promise<{ name: string | null; exists: boolean }> {
  const res = await fetch(`/api/wikisource-name?title=${encodeURIComponent(pageTitle)}`);
  return res.json();
}