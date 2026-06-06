import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import WikisourceNameField from "@/upload/components/WikisourceNameField";
import { emptyNameState } from "@/upload/types";

describe("WikisourceNameField", () => {
  it("renders fetched names as a compact line with a wikisource link", () => {
    const html = renderToStaticMarkup(
      <WikisourceNameField
        label="Назва фонду"
        compactLabel="Фонд"
        state={{
          ...emptyNameState,
          exists: true,
          fetched: "Київське губернське правління",
          lastFetchedTitle: "Архів:ЦДІАК/Р-123",
        }}
        enabled={false}
        placeholder="Офіційна назва фонду"
        onChange={() => {}}
      />
    );

    expect(html).toContain("Фонд");
    expect(html).not.toContain("Назва фонду:");
    expect(html).toContain("Київське губернське правління");
    expect(html).not.toContain('type="text"');
    expect(html).toContain("/wiki/%D0%90%D1%80%D1%85%D1%96%D0%B2%3A%D0%A6%D0%94%D0%86%D0%90%D0%9A%2F%D0%A0-123");
  });

  it("renders an input when the name does not exist yet", () => {
    const html = renderToStaticMarkup(
      <WikisourceNameField
        label="Назва опису"
        compactLabel="Опис"
        optional
        state={{
          ...emptyNameState,
          value: "Рукописні книги",
          lastFetchedTitle: "Архів:ЦДІАК/Р-123/1",
        }}
        enabled
        placeholder="Офіційна назва опису"
        onChange={() => {}}
      />
    );

    expect(html).toContain('type="text"');
    expect(html).toContain('value="Рукописні книги"');
    expect(html).toContain("Назва опису");
    expect(html).toContain("(необовʼязково)");
  });

  it("renders nothing before the lookup becomes available", () => {
    const html = renderToStaticMarkup(
      <WikisourceNameField
        label="Назва фонду"
        state={emptyNameState}
        enabled={false}
        placeholder="Офіційна назва фонду"
        onChange={() => {}}
      />
    );

    expect(html).toBe("");
  });

  it("renders a compact loading line before the title is fetched", () => {
    const html = renderToStaticMarkup(
      <WikisourceNameField
        label="Назва опису"
        compactLabel="Опис"
        optional
        state={{
          ...emptyNameState,
          loading: true,
        }}
        enabled={false}
        placeholder="Офіційна назва опису"
        onChange={() => {}}
      />
    );

    expect(html).toContain("Опис");
    expect(html).toContain("Завантаження…");
    expect(html).not.toContain("(необовʼязково)");
    expect(html).not.toContain('type="text"');
  });
});
