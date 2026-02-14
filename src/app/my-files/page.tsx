import { auth } from "@/auth";
import AppHeader from "@/components/AppHeader";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_WIKI_API_URL ?? "https://commons.wikimedia.org/w/api.php";
const WIKI_BASE = API_URL.replace(/\/w\/api\.php$/, "");

interface UserContrib {
  title: string;
  timestamp: string;
}

async function getUserContribs(username: string): Promise<UserContrib[]> {
  const url =
    `${API_URL}?action=query&list=usercontribs` +
    `&ucuser=${encodeURIComponent(username)}` +
    `&uctag=${encodeURIComponent(`OAuth CID: ${process.env.OAUTH_CID}`)}&uclimit=500&ucnamespace=6` +
    `&ucprop=title|timestamp&format=json`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Wikimedia API error: ${res.status}`);
  }
  const data = await res.json();
  return (data.query?.usercontribs ?? []) as UserContrib[];
}

export default async function MyFilesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const username = session.user.name ?? "";
  const contribs = await getUserContribs(username);

  return (
    <div className="page-shell">
      <AppHeader />
      <main className="page-content py-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Мої файли
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400">
            Завантажено файлів: {contribs.length}
          </p>
        </div>

        {contribs.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            Ви ще не завантажували файлів через Вікіархіватор.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {contribs.map((contrib) => {
              const filename = contrib.title.replace(/^File:/, "");
              const fileUrl = `${WIKI_BASE}/wiki/${contrib.title}`;
              const date = new Date(contrib.timestamp).toLocaleString("uk-UA", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li key={contrib.title} className="flex flex-col gap-0.5">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {filename}
                  </a>
                  <span className="text-sm text-zinc-400 dark:text-zinc-500">{date}</span>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
