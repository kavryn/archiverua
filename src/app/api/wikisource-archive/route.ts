import { auth } from "@/auth";
import {
  getWikisourceCsrfToken,
  getWikisourcePageContent,
  editWikisourcePage,
} from "@/lib/wikimedia";
import {
  getArchivePageTitle,
  buildOrUpdateArchiveContent,
} from "@/lib/wikisource-archive";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const body = await request.json();
  const { archiveAbbr, archiveName, fond, fondName } = body;

  if (!archiveAbbr || !fond) {
    return NextResponse.json(
      { error: "Відсутні обов'язкові поля" },
      { status: 400 }
    );
  }

  const title = getArchivePageTitle(archiveAbbr, fond);

  try {
    const existingContent = await getWikisourcePageContent(
      session.accessToken,
      title
    );

    const content = buildOrUpdateArchiveContent(existingContent, {
      archiveAbbr,
      archiveName: archiveName ?? "",
      fond,
      fondName: fondName ?? "",
    });

    const csrfToken = await getWikisourceCsrfToken(session.accessToken);

    const url = await editWikisourcePage({
      accessToken: session.accessToken,
      csrfToken,
      title,
      content,
      summary: `Додано фонд ${fond}`,
    });

    return NextResponse.json({
      success: true,
      url,
      created: existingContent === null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Помилка оновлення сторінки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
