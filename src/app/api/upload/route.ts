import { auth } from "@/auth";
import { ARCHIVES } from "@/lib/archives";
import { getCsrfToken, uploadFile, commitChunkedUpload, buildFilename, buildDescription } from "@/lib/wikimedia";
import { NextResponse } from "next/server";

const CURRENT_YEAR = new Date().getFullYear();
const THRESHOLD_75 = CURRENT_YEAR - 75;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const fd = await request.formData();
  const commitOnly = fd.get("commitOnly") as string | null;

  if (commitOnly === "true") {
    const filekey = fd.get("filekey") as string | null;
    const ext = fd.get("ext") as string | null;
    const archiveAbbr = fd.get("archiveAbbr") as string;
    const fond = fd.get("fond") as string;
    const opis = fd.get("opis") as string;
    const sprava = fd.get("sprava") as string;
    const dateFrom = fd.get("dateFrom") as string;
    const dateTo = fd.get("dateTo") as string;
    const isArbitraryDate = fd.get("isArbitraryDate") === "true";
    const isOver75Years = fd.get("isOver75Years") === "true";
    const isRussianEmpire = fd.get("isRussianEmpire") === "true";

    if (!filekey || !ext || !archiveAbbr || !fond || !opis || !sprava) {
      return NextResponse.json({ error: "Відсутні обов'язкові поля" }, { status: 400 });
    }

    if (!isArbitraryDate) {
      const match = dateTo.match(/\d{4}/);
      if (match) {
        const endYear = parseInt(match[0], 10);
        if (endYear > THRESHOLD_75) {
          return NextResponse.json(
            { error: `Документи молодші за ${THRESHOLD_75} р. не можна публікувати на Commons` },
            { status: 400 }
          );
        }
      }
    } else if (!isOver75Years) {
      return NextResponse.json(
        { error: "Підтвердіть, що справі більше 75 років" },
        { status: 400 }
      );
    }

    const archive = ARCHIVES.find((a) => a.abbr === archiveAbbr);
    if (!archive) {
      return NextResponse.json({ error: "Архів не знайдено" }, { status: 400 });
    }

    const filename = buildFilename(archiveAbbr, fond, opis, sprava, ext);
    const description = buildDescription({
      archiveName: archive.name,
      abbr: archiveAbbr,
      fond,
      opis,
      sprava,
      dateFrom,
      dateTo,
      isArbitraryDate,
      isRussianEmpire,
    });

    try {
      const csrfToken = await getCsrfToken(session.accessToken);
      const url = await commitChunkedUpload({
        accessToken: session.accessToken,
        csrfToken,
        filekey,
        filename,
        description,
        comment: `Завантаження через Вікіархіватор: ${archive.name}, Ф. ${fond}, Оп. ${opis}, Спр. ${sprava}`,
      });
      return NextResponse.json({ success: true, url });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Невідома помилка";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const file = fd.get("file") as File | null;
  const archiveAbbr = fd.get("archiveAbbr") as string;
  const fond = fd.get("fond") as string;
  const opis = fd.get("opis") as string;
  const sprava = fd.get("sprava") as string;
  const dateFrom = fd.get("dateFrom") as string;
  const dateTo = fd.get("dateTo") as string;
  const isArbitraryDate = fd.get("isArbitraryDate") === "true";
  const isOver75Years = fd.get("isOver75Years") === "true";
  const isRussianEmpire = fd.get("isRussianEmpire") === "true";

  if (!file || !archiveAbbr || !fond || !opis || !sprava) {
    return NextResponse.json({ error: "Відсутні обов'язкові поля" }, { status: 400 });
  }

  // Server-side 75-year check
  if (!isArbitraryDate) {
    const match = dateTo.match(/\d{4}/);
    if (match) {
      const endYear = parseInt(match[0], 10);
      if (endYear > THRESHOLD_75) {
        return NextResponse.json(
          { error: `Документи молодші за ${THRESHOLD_75} р. не можна публікувати на Commons` },
          { status: 400 }
        );
      }
    }
  } else if (!isOver75Years) {
    return NextResponse.json(
      { error: "Підтвердіть, що справі більше 75 років" },
      { status: 400 }
    );
  }

  const archive = ARCHIVES.find((a) => a.abbr === archiveAbbr);
  if (!archive) {
    return NextResponse.json({ error: "Архів не знайдено" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = buildFilename(archiveAbbr, fond, opis, sprava, ext);

  const description = buildDescription({
    archiveName: archive.name,
    abbr: archiveAbbr,
    fond,
    opis,
    sprava,
    dateFrom,
    dateTo,
    isArbitraryDate,
    isRussianEmpire,
  });

  try {
    const whoami = await fetch("https://commons.wikimedia.org/w/api.php?action=query&meta=userinfo&uiprop=groups%7Crights&format=json", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const whoamiData = await whoami.json();
    console.log("[upload debug] userinfo:", JSON.stringify(whoamiData.query?.userinfo));

    const csrfToken = await getCsrfToken(session.accessToken);
    const url = await uploadFile({
      accessToken: session.accessToken,
      csrfToken,
      filename,
      file,
      description,
      comment: `Завантаження через Вікіархіватор: ${archive.name}, Ф. ${fond}, Оп. ${opis}, Спр. ${sprava}`,
    });
    return NextResponse.json({ success: true, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Невідома помилка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
