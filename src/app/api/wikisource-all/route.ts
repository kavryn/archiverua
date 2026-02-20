import { auth } from "@/auth";
import { getWikisourceCsrfToken } from "@/lib/wikimedia";
import { updateOpysPage } from "@/lib/wikisource-opys";
import { updateFondPage } from "@/lib/wikisource-fond";
import { updateArchivePage } from "@/lib/wikisource-archive";
import { updateSpravaPage } from "@/lib/wikisource-sprava";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const body = await request.json();
  const {
    archiveAbbr,
    fond,
    opis,
    sprava,
    spravaName,
    opisName,
    dates,
    fondName,
    archiveName,
    publicFileName,
    updateOpys,
    updateFond,
    updateArchive,
  } = body;

  if (!archiveAbbr || !fond || !opis || !sprava || !publicFileName) {
    return NextResponse.json(
      { error: "Відсутні обов'язкові поля" },
      { status: 400 }
    );
  }

  try {
    const csrfToken = await getWikisourceCsrfToken(session.accessToken);

    const spravaResult = await updateSpravaPage({
      accessToken: session.accessToken,
      csrfToken,
      archiveAbbr,
      fond,
      opis,
      sprava: String(sprava),
      spravaName: spravaName ?? "",
      dates: dates ?? "",
      publicFileName,
    });

    let opysResult: { url: string; created: boolean } | undefined;
    if (updateOpys) {
      opysResult = await updateOpysPage({
        accessToken: session.accessToken,
        csrfToken,
        archiveAbbr,
        fond,
        opis,
        sprava: String(sprava),
        spravaName: spravaName ?? "",
        opisName: opisName ?? "",
        dates: dates ?? "",
      });
    }

    let fondResult: { url: string; created: boolean } | undefined;
    if (updateFond) {
      fondResult = await updateFondPage({
        accessToken: session.accessToken,
        csrfToken,
        archiveAbbr,
        fond,
        opis,
        opisName: opisName ?? "",
        fondName: fondName ?? "",
      });
    }

    let archiveResult: { url: string; created: boolean } | undefined;
    if (updateArchive) {
      archiveResult = await updateArchivePage({
        accessToken: session.accessToken,
        csrfToken,
        archiveAbbr,
        archiveName: archiveName ?? "",
        fond,
        fondName: fondName ?? "",
      });
    }

    return NextResponse.json({
      success: true,
      sprava: spravaResult,
      ...(opysResult && { opys: opysResult }),
      ...(fondResult && { fond: fondResult }),
      ...(archiveResult && { archive: archiveResult }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Помилка оновлення сторінок";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
