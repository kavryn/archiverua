import { auth } from "@/auth";
import {
  getWikisourceCsrfToken,
  getWikisourcePageContent,
  editWikisourcePage,
} from "@/lib/wikimedia";
import { buildOrUpdateOpysContent } from "@/lib/wikisource-opys";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const body = await request.json();
  const { archiveAbbr, fond, opis, sprava, spravaName, opisName, dates } = body;

  if (!archiveAbbr || !fond || !opis || !sprava) {
    return NextResponse.json(
      { error: "Відсутні обов'язкові поля" },
      { status: 400 }
    );
  }

  const spravaNum = parseInt(sprava, 10);
  if (isNaN(spravaNum)) {
    return NextResponse.json(
      { error: "Невірний номер справи" },
      { status: 400 }
    );
  }

  const title = `Архів:${archiveAbbr}/${fond}/${opis}`;

  try {
    const existingContent = await getWikisourcePageContent(
      session.accessToken,
      title
    );

    const content = buildOrUpdateOpysContent(existingContent, {
      archiveAbbr,
      fond,
      opis,
      sprava: spravaNum,
      spravaName: spravaName ?? "",
      opisName: opisName ?? "",
      dates: dates ?? "",
    });

    const csrfToken = await getWikisourceCsrfToken(session.accessToken);

    const url = await editWikisourcePage({
      accessToken: session.accessToken,
      csrfToken,
      title,
      content,
      summary: `Додано справу ${sprava}`,
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
