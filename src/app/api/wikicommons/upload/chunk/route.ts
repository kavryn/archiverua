import { auth } from "@/auth";
import { wikicommons } from "@/lib/wikimedia";
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

  let filename: string | null = null;
  let offset = NaN;
  let filekey: string | null = null;

  try {
    const fd = await request.formData();
    const chunk = fd.get("chunk") as Blob | null;
    filename = fd.get("filename") as string | null;
    const fileSize = parseInt(fd.get("fileSize") as string, 10);
    offset = parseInt(fd.get("offset") as string, 10);
    filekey = fd.get("filekey") as string | null;

    if (!chunk || !filename || isNaN(fileSize) || isNaN(offset)) {
      return NextResponse.json({ error: "Відсутні обов'язкові поля" }, { status: 400 });
    }

    const csrfToken = await wikicommons.getCsrfToken(session.accessToken);

    let result;
    if (offset === 0 && !filekey) {
      result = await wikicommons.uploadFirstChunk({
        accessToken: session.accessToken,
        csrfToken,
        filename,
        chunk,
        fileSize,
      });
    } else {
      if (!filekey) {
        return NextResponse.json({ error: "filekey обов'язковий для наступних шматків" }, { status: 400 });
      }
      result = await wikicommons.uploadNextChunk({
        accessToken: session.accessToken,
        csrfToken,
        filekey,
        filename,
        chunk,
        offset,
        fileSize,
      });
    }

    return NextResponse.json({ filekey: result.filekey, offset: result.offset });
  } catch (err) {
    logError("wikicommons/upload/chunk", err, { filename, offset, filekey });
    const message = err instanceof Error ? err.message : "Невідома помилка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
