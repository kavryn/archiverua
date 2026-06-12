import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import WikisourceNameField from "@/upload/components/WikisourceNameField";
import { emptyNameState } from "@/upload/types";

describe("WikisourceNameField", () => {
  it("renders fetched names as a compact line with a wikisource link", () => {
    const html = renderToStaticMarkup(
      <WikisourceNameField
        label="Фонд"
        state={{
          ...emptyNameState,
          exists: true,
          fetched: "Київське губернське правління",
          lastFetchedTitle: "Архів:ЦДІАК/Р-123",
        }}
      />
    );

    expect(html).toContain("Фонд");
    expect(html).toContain("Київське губернське правління");
    expect(html).not.toContain('type="text"');
    expect(html).toContain("/wiki/%D0%90%D1%80%D1%85%D1%96%D0%B2%3A%D0%A6%D0%94%D0%86%D0%90%D0%9A%2F%D0%A0-123");
  });

  it("shows 'not found' when the lookup completed without a match", () => {
    const html = renderToStaticMarkup(
      <WikisourceNameField
        label="Опис"
        state={{
          ...emptyNameState,
          lastFetchedTitle: "Архів:ЦДІАК/Р-123/1",
        }}
      />
    );

    expect(html).toContain("Опис");
    expect(html).toContain("назву не знайдено");
    expect(html).not.toContain('type="text"');
  });

  it("renders nothing before the lookup becomes available", () => {
    const html = renderToStaticMarkup(
      <WikisourceNameField label="Фонд" state={emptyNameState} />
    );

    expect(html).toBe("");
  });

  it("renders a compact loading line before the title is fetched", () => {
    const html = renderToStaticMarkup(
      <WikisourceNameField
        label="Опис"
        state={{
          ...emptyNameState,
          loading: true,
        }}
      />
    );

    expect(html).toContain("Опис");
    expect(html).toContain("Завантаження…");
    expect(html).not.toContain('type="text"');
  });
});
