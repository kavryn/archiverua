import { describe, it, expect } from "vitest";
import {
  buildNewSpravaPage,
  addLinkCommonsToContent,
  buildOrUpdateSpravaContent,
} from "@/lib/wikisource-sprava";

const baseParams = {
  archiveAbbr: "ЦДІАК",
  fond: "201",
  opys: "4а",
  sprava: "8022",
  spravaName: "Назва справи",
  dates: "1920-1930",
  publicFileName: "ЦДІАК_201_4а_8022_001.pdf",
};

describe("buildNewSpravaPage", () => {
  it("contains the template name", () => {
    const result = buildNewSpravaPage(baseParams);
    expect(result).toContain("{{Архіви/справа");
  });

  it("includes spravaName in назва field", () => {
    const result = buildNewSpravaPage(baseParams);
    expect(result).toContain("| назва = Назва справи");
  });

  it("includes dates in рік field", () => {
    const result = buildNewSpravaPage(baseParams);
    expect(result).toContain("| рік = 1920-1930");
  });

  it("includes publicFileName in link_commons field", () => {
    const result = buildNewSpravaPage(baseParams);
    expect(result).toContain("| link_commons = File:ЦДІАК_201_4а_8022_001.pdf");
  });

  it("includes empty примітки field", () => {
    const result = buildNewSpravaPage(baseParams);
    expect(result).toContain("| примітки =");
  });

  it("closes with }}", () => {
    const result = buildNewSpravaPage(baseParams);
    expect(result.trimEnd()).toMatch(/\}\}$/);
  });
});

describe("addLinkCommonsToContent", () => {
  const makeTemplate = (fields: Record<string, string>) => {
    const lines = Object.entries(fields)
      .map(([k, v]) => ` | ${k} = ${v}`)
      .join("\n");
    return `{{Архіви/справа\n${lines}\n}}`;
  };

  it("fills empty link_commons", () => {
    const content = makeTemplate({ link_commons: "" });
    const result = addLinkCommonsToContent(content, "Test.pdf");
    expect(result).toContain("| link_commons = File:Test.pdf");
  });

  it("skips non-empty link_commons and fills link_commons2", () => {
    const content = makeTemplate({
      link_commons: "File:Other.pdf",
      link_commons2: "",
    });
    const result = addLinkCommonsToContent(content, "Test.pdf");
    expect(result).toContain("| link_commons = File:Other.pdf");
    expect(result).toContain("| link_commons2 = File:Test.pdf");
  });

  it("fills link_commons3 when 1 and 2 are taken", () => {
    const content = makeTemplate({
      link_commons: "File:A.pdf",
      link_commons2: "File:B.pdf",
      link_commons3: "",
    });
    const result = addLinkCommonsToContent(content, "Test.pdf");
    expect(result).toContain("| link_commons3 = File:Test.pdf");
  });

  it("returns content unchanged when file already set in link_commons", () => {
    const content = makeTemplate({ link_commons: "File:Test.pdf" });
    const result = addLinkCommonsToContent(content, "Test.pdf");
    expect(result).toBe(content);
  });

  it("returns content unchanged when file already set in link_commons2", () => {
    const content = makeTemplate({
      link_commons: "File:Other.pdf",
      link_commons2: "File:Test.pdf",
    });
    const result = addLinkCommonsToContent(content, "Test.pdf");
    expect(result).toBe(content);
  });

  it("returns content unchanged when all 5 fields are filled with different values", () => {
    const content = makeTemplate({
      link_commons: "File:A.pdf",
      link_commons2: "File:B.pdf",
      link_commons3: "File:C.pdf",
      link_commons4: "File:D.pdf",
      link_commons5: "File:E.pdf",
    });
    const result = addLinkCommonsToContent(content, "New.pdf");
    expect(result).toBe(content);
  });

  it("adds link_commons field when missing", () => {
    const content = `{{Архіви/справа\n | назва = Test\n}}`;
    const result = addLinkCommonsToContent(content, "Test.pdf");
    expect(result).toContain("link_commons = File:Test.pdf");
  });
});

describe("buildOrUpdateSpravaContent", () => {
  it("creates new page when content is null", () => {
    const result = buildOrUpdateSpravaContent(null, baseParams);
    expect(result).toContain("{{Архіви/справа");
    expect(result).toContain("| link_commons = File:ЦДІАК_201_4а_8022_001.pdf");
  });

  it("updates existing page by adding link", () => {
    const existing = `{{Архіви/справа
 | назва = Назва справи
 | рік = 1920-1930
 | link_commons =
 | примітки =
}}`;
    const result = buildOrUpdateSpravaContent(existing, baseParams);
    expect(result).toContain("| link_commons = File:ЦДІАК_201_4а_8022_001.pdf");
  });
});
