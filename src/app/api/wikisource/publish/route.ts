import { auth } from "@/auth";
import { wikisource } from "@/lib/wikimedia";
import { logError } from "@/lib/logger";
import { updateOpysPage } from "@/lib/wikisource-opys";
import { updateFondPage } from "@/lib/wikisource-fond";
import { updateArchivePage, getArchivePageTitle } from "@/lib/wikisource-archive";
import { updateSpravaPage } from "@/lib/wikisource-sprava";
import { NextResponse } from "next/server";

type PageResult = { url: string; created?: boolean; error?: string };

export async function POST(request: Request) {
  const session = await auth();
  if (session?.error === "RefreshTokenError") {
    return NextResponse.json({ error: "AUTH_ERROR" }, { status: 401 });
  }
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const body = await request.json();
  const {
    archiveAbbr,
    fond,
    opys,
    sprava,
    spravaName,
    opysName,
    dates,
    fondName,
    archiveName,
    publicFileName,
    updateOpys,
    updateFond,
    updateArchive,
  } = body;

  if (!archiveAbbr || !fond || !opys || !sprava || !publicFileName) {
    return NextResponse.json(
      { error: "Відсутні обов'язкові поля" },
      { status: 400 }
    );
  }

  let csrfToken: string;
  try {
    csrfToken = await wikisource.getCsrfToken(session.accessToken);
  } catch (error) {
    logError("wikisource/publish/csrf", error);
    const message =
      error instanceof Error ? error.message : "Помилка отримання CSRF токена";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const spravaTitle = `Архів:${archiveAbbr}/${fond}/${opys}/${String(sprava)}`;
  const opysTitle = `Архів:${archiveAbbr}/${fond}/${opys}`;
  const fondTitle = `Архів:${archiveAbbr}/${fond}`;
  const archiveTitle = getArchivePageTitle(archiveAbbr, fond);

  let spravaResult: PageResult;
  try {
    spravaResult = await updateSpravaPage({
      accessToken: session.accessToken,
      csrfToken,
      archiveAbbr,
      fond,
      opys,
      sprava: String(sprava),
      spravaName: spravaName ?? "",
      dates: dates ?? "",
      publicFileName,
    });
  } catch (err) {
    logError("wikisource/publish/sprava", err, { spravaTitle });
    spravaResult = {
      url: wikisource.pageUrl(spravaTitle),
      error: err instanceof Error ? err.message : "Помилка оновлення",
    };
  }

  let opysResult: PageResult | undefined;
  if (updateOpys) {
    try {
      opysResult = await updateOpysPage({
        accessToken: session.accessToken,
        csrfToken,
        archiveAbbr,
        fond,
        opys,
        sprava: String(sprava),
        spravaName: spravaName ?? "",
        opysName: opysName ?? "",
        dates: dates ?? "",
      });
    } catch (err) {
      logError("wikisource/publish/opys", err, { opysTitle });
      opysResult = {
        url: wikisource.pageUrl(opysTitle),
        error: err instanceof Error ? err.message : "Помилка оновлення",
      };
    }
  }

  let fondResult: PageResult | undefined;
  if (updateFond) {
    try {
      fondResult = await updateFondPage({
        accessToken: session.accessToken,
        csrfToken,
        archiveAbbr,
        fond,
        opys,
        opysName: opysName ?? "",
        fondName: fondName ?? "",
      });
    } catch (err) {
      logError("wikisource/publish/fond", err, { fondTitle });
      fondResult = {
        url: wikisource.pageUrl(fondTitle),
        error: err instanceof Error ? err.message : "Помилка оновлення",
      };
    }
  }

  let archiveResult: PageResult | undefined;
  if (updateArchive) {
    try {
      archiveResult = await updateArchivePage({
        accessToken: session.accessToken,
        csrfToken,
        archiveAbbr,
        archiveName: archiveName ?? "",
        fond,
        fondName: fondName ?? "",
      });
    } catch (err) {
      logError("wikisource/publish/archive", err, { archiveTitle });
      archiveResult = {
        url: wikisource.pageUrl(archiveTitle),
        error: err instanceof Error ? err.message : "Помилка оновлення",
      };
    }
  }

  return NextResponse.json({
    sprava: spravaResult,
    ...(updateOpys && { opys: opysResult }),
    ...(updateFond && { fond: fondResult }),
    ...(updateArchive && { archive: archiveResult }),
  });
}
