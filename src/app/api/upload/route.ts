import { auth } from "@/auth";
import { ARCHIVES } from "@/lib/archives";
import { getCsrfToken, uploadFile, commitChunkedUpload, buildDescription, DuplicateFileError, getWikisourceCsrfToken, buildWikisourceDateStr, buildWikisourcePageContent, createWikisourcePage } from "@/lib/wikimedia";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const fd = await request.formData();

  const commitOnly = fd.get("commitOnly") === "true";
  const file = fd.get("file") as File | null;
  const filekey = fd.get("filekey") as string | null;
  const archiveAbbr = fd.get("archiveAbbr") as string;
  const fond = fd.get("fond") as string;
  const opis = fd.get("opis") as string;
  const sprava = fd.get("sprava") as string;
  const dateFrom = fd.get("dateFrom") as string;
  const dateTo = fd.get("dateTo") as string;
  const isArbitraryDate = fd.get("isArbitraryDate") === "true";
  const license = (fd.get("license") as string | null) ?? "";
  const spravaName = (fd.get("spravaName") as string | null) ?? "";
  const author = (fd.get("author") as string | null) ?? "";
  const filename = (fd.get("fileName") as string | null)?.trim();

  if (!archiveAbbr || !fond || !opis || !sprava || !filename) {
    return NextResponse.json({ error: "Відсутні обов'язкові поля" }, { status: 400 });
  }
  if (commitOnly ? !filekey : !file) {
    return NextResponse.json({ error: "Відсутні обов'язкові поля" }, { status: 400 });
  }

  if (!license.trim()) {
    return NextResponse.json({ error: "Оберіть ліцензію" }, { status: 400 });
  }

  const archive = ARCHIVES.find((a) => a.abbr === archiveAbbr);
  if (!archive) {
    return NextResponse.json({ error: "Архів не знайдено" }, { status: 400 });
  }

  const description = buildDescription({
    archiveName: archive.name,
    abbr: archiveAbbr,
    fond,
    opis,
    sprava,
    dateFrom,
    dateTo,
    isArbitraryDate,
    license,
    author,
  });
  const comment = `Завантаження через Вікіархіватор: ${archive.name}, Ф. ${fond}, Оп. ${opis}, Спр. ${sprava}`;

  try {
    const csrfToken = await getCsrfToken(session.accessToken);
    const url = commitOnly
      ? await commitChunkedUpload({ accessToken: session.accessToken, csrfToken, filekey: filekey!, filename, description, comment })
      : await uploadFile({ accessToken: session.accessToken, csrfToken, filename, file: file!, description, comment });

    let wikisourceUrl: string | null = null;
    if (spravaName) {
      try {
        const wsCsrfToken = await getWikisourceCsrfToken(session.accessToken);
        const pageTitle = `Архів:${archiveAbbr}/${fond}/${opis}/${sprava}`;
        const dateStr = buildWikisourceDateStr(dateFrom, dateTo, isArbitraryDate);
        const content = buildWikisourcePageContent(spravaName, dateStr, filename);
        wikisourceUrl = await createWikisourcePage({
          accessToken: session.accessToken,
          csrfToken: wsCsrfToken,
          title: pageTitle,
          content,
          summary: `Сторінку створено через Вікіархіватор`,
        });
      } catch {
        // best-effort, don't fail the upload
      }
    }

    return NextResponse.json({ success: true, url, wikisourceUrl });
  } catch (err) {
    if (err instanceof DuplicateFileError) {
      return NextResponse.json({ error: err.message, duplicateUrl: err.duplicateUrl }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "Невідома помилка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
