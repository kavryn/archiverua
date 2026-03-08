import { auth } from "@/auth";
import AppHeader from "@/components/AppHeader";
import { wikicommons } from "@/lib/wikimedia";
import { redirect } from "next/navigation";

export default async function MyFilesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const username = session.user.name ?? "";
  const contribs = await wikicommons.getUserContribs(username, process.env.OAUTH_CID ?? "");

  return (
    <div className="page-shell">
      <AppHeader />
      <main className="page-content py-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-black">
            Мої файли
          </h1>
          <p className="text-base text-zinc-500">
            Завантажено файлів: {contribs.length}
          </p>
        </div>

        {contribs.length === 0 ? (
          <p className="text-zinc-600">
            Ви ще не завантажували файлів через Вікіархіватор.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {contribs.map((contrib) => {
              const filename = contrib.title.replace(/^File:/, "");
              const fileUrl = wikicommons.pageUrl(contrib.title);
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
                    className="text-base text-blue-600 hover:underline"
                  >
                    {filename}
                  </a>
                  <span className="text-sm text-zinc-400">{date}</span>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
