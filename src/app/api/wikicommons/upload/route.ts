import { auth } from "@/auth";
import { COMMONS_UPLOAD_COMMENT } from "@/lib/wikicommons-upload";
import { wikicommons, DuplicateFileError } from "@/lib/wikimedia";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

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
  const filename = (fd.get("fileName") as string | null)?.trim();
  const description = (fd.get("description") as string | null) ?? "";

  if (!filename || !description.trim()) {
    return NextResponse.json({ error: "Відсутні обов'язкові поля" }, { status: 400 });
  }
  if (commitOnly ? !filekey : !file) {
    return NextResponse.json({ error: "Відсутні обов'язкові поля" }, { status: 400 });
  }

  try {
    const csrfToken = await wikicommons.getCsrfToken(session.accessToken);
    const url = commitOnly
      ? await wikicommons.commitChunkedUpload({ accessToken: session.accessToken, csrfToken, filekey: filekey!, filename, description, comment: COMMONS_UPLOAD_COMMENT })
      : await wikicommons.uploadFile({ accessToken: session.accessToken, csrfToken, filename, file: file!, description, comment: COMMONS_UPLOAD_COMMENT });

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
