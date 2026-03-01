import { auth } from "@/auth";
import { ARCHIVES } from "@/lib/archives";
import { wikicommons, DuplicateFileError } from "@/lib/wikimedia";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

interface DescriptionParams {
  archiveName: string;
  abbr: string;
  category: string;
  fond: string;
  opys: string;
  sprava: string;
  spravaName?: string;
  dateFrom: string;
  dateTo: string;
  isArbitraryDate: boolean;
  license: string;
  author?: string;
}

function buildDateStr(isArbitraryDate: boolean, dateFrom: string, dateTo: string): string {
  if (isArbitraryDate || !dateTo || dateFrom === dateTo) return dateFrom;
  return `${dateFrom}–${dateTo}`;
}

function buildDescription(params: DescriptionParams): string {
  const dateStr = buildDateStr(params.isArbitraryDate, params.dateFrom, params.dateTo);

  return `=={{int:filedesc}}==
{{Information
|description={{uk|1=Фонд ${params.fond}, опис ${params.opys}, справа ${params.sprava}${params.spravaName ? ` – ${params.spravaName}` : ""}}}
|date=${dateStr}
|source=${params.archiveName}
|author=${params.author ? params.author : "{{author|unknown}}"}
}}

=={{int:license-header}}==
${params.license}

[[Category:${params.category}]]
`;
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.error === "RefreshTokenError") {
    return NextResponse.json({ error: "AUTH_ERROR" }, { status: 401 });
  }
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const fd = await request.formData();

  const commitOnly = fd.get("commitOnly") === "true";
  const file = fd.get("file") as File | null;
  const filekey = fd.get("filekey") as string | null;
  const archiveAbbr = fd.get("archiveAbbr") as string;
  const fond = fd.get("fond") as string;
  const opys = fd.get("opys") as string;
  const sprava = fd.get("sprava") as string;
  const dateFrom = fd.get("dateFrom") as string;
  const dateTo = fd.get("dateTo") as string;
  const isArbitraryDate = fd.get("isArbitraryDate") === "true";
  const license = (fd.get("license") as string | null) ?? "";
  const spravaName = (fd.get("spravaName") as string | null) ?? "";
  const author = (fd.get("author") as string | null) ?? "";
  const filename = (fd.get("fileName") as string | null)?.trim();

  if (!archiveAbbr || !fond || !opys || !sprava || !filename) {
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
    category: archive.category,
    fond,
    opys,
    sprava,
    spravaName,
    dateFrom,
    dateTo,
    isArbitraryDate,
    license,
    author,
  });
  const comment = `Завантаження через Вікіархіватор`;

  try {
    const csrfToken = await wikicommons.getCsrfToken(session.accessToken);
    const url = commitOnly
      ? await wikicommons.commitChunkedUpload({ accessToken: session.accessToken, csrfToken, filekey: filekey!, filename, description, comment })
      : await wikicommons.uploadFile({ accessToken: session.accessToken, csrfToken, filename, file: file!, description, comment });

    return NextResponse.json({ success: true, url });
  } catch (err) {
    if (err instanceof DuplicateFileError) {
      return NextResponse.json({ error: err.message, duplicateUrl: err.duplicateUrl }, { status: 409 });
    }
    logError("wikicommons/upload", err, { filename, commitOnly });
    const message = err instanceof Error ? err.message : "Невідома помилка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
