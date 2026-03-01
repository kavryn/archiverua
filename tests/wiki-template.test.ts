import { describe, it, expect } from "vitest";
import { getTemplateParam, setTemplateParam } from "@/lib/wikitemplate";

const sampleTemplate = `{{Архіви/справа
 | назва = Моя справа
 | рік = 1920-1930
 | link_commons = File:Example.pdf
 | link_commons2 =
 | примітки =
}}`;

describe("getTemplateParam", () => {
  it("returns value for existing param", () => {
    expect(getTemplateParam(sampleTemplate, "назва")).toBe("Моя справа");
  });

  it("returns value for param with file link", () => {
    expect(getTemplateParam(sampleTemplate, "link_commons")).toBe("File:Example.pdf");
  });

  it("returns empty string for existing param with no value", () => {
    expect(getTemplateParam(sampleTemplate, "примітки")).toBe("");
  });

  it("returns empty string for existing param with only whitespace value", () => {
    expect(getTemplateParam(sampleTemplate, "link_commons2")).toBe("");
  });

  it("returns null for missing param", () => {
    expect(getTemplateParam(sampleTemplate, "link_commons3")).toBeNull();
  });
});

describe("setTemplateParam", () => {
  it("replaces value of existing param", () => {
    const result = setTemplateParam(sampleTemplate, "назва", "Нова назва");
    expect(result).toContain("| назва = Нова назва");
    expect(result).not.toContain("| назва = Моя справа");
  });

  it("fills empty existing param", () => {
    const result = setTemplateParam(sampleTemplate, "примітки", "Деякі примітки");
    expect(result).toContain("| примітки = Деякі примітки");
  });

  it("adds new param before closing }}", () => {
    const result = setTemplateParam(sampleTemplate, "link_commons3", "File:New.pdf");
    expect(result).toContain("| link_commons3 = File:New.pdf");
    expect(result).toContain("}}");
    const idx = result.indexOf("| link_commons3 = File:New.pdf");
    const idxClose = result.indexOf("}}");
    expect(idx).toBeLessThan(idxClose);
  });

  it("preserves content around the modified param", () => {
    const result = setTemplateParam(sampleTemplate, "рік", "2000");
    expect(result).toContain("| назва = Моя справа");
    expect(result).toContain("| рік = 2000");
    expect(result).toContain("| link_commons = File:Example.pdf");
  });
});
