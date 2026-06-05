import { describe, expect, it } from "vitest";
import { buildAutoFileName, getStrictFileNameDateLabel } from "@/upload/hooks/usePublicFileName";
import { makeEntry } from "@/upload/types";
import type { FileEntry } from "@/upload/types";
import type { Archive } from "@/lib/archives";

const archive: Archive = {
  name: "Центральний державний історичний архів України, м. Київ",
  abbr: "ЦДІАК",
  category: "Funds of Central State Historical Archives of Ukraine in Kyiv",
};

function makeFileEntry(patch: Partial<FileEntry> = {}): FileEntry {
  const entry = makeEntry(new File(["test"], "scan.pdf"));
  return {
    ...entry,
    archive,
    fond: "Р-123",
    opys: "2",
    sprava: "45",
    spravaName: "Метрична книга",
    ...patch,
  };
}

describe("getStrictFileNameDateLabel", () => {
  it("returns a single year for strict single-date values", () => {
    expect(
      getStrictFileNameDateLabel({ dateMode: "single", dateFrom: "1890", dateTo: "" })
    ).toBe("1890");
  });

  it("returns a normalized range for strict year ranges", () => {
    expect(
      getStrictFileNameDateLabel({ dateMode: "range", dateFrom: "1890", dateTo: "1895" })
    ).toBe("1890-1895");
  });

  it("collapses equal range bounds to one year", () => {
    expect(
      getStrictFileNameDateLabel({ dateMode: "range", dateFrom: "1890", dateTo: "1890" })
    ).toBe("1890");
  });

  it("ignores arbitrary date formats", () => {
    expect(
      getStrictFileNameDateLabel({ dateMode: "other", dateFrom: "кінець XVII ст.", dateTo: "" })
    ).toBeNull();
  });

  it("ignores non-year numeric strings", () => {
    expect(
      getStrictFileNameDateLabel({ dateMode: "single", dateFrom: "18901", dateTo: "" })
    ).toBeNull();
  });
});

describe("buildAutoFileName", () => {
  it("includes the year between archival code and case name for strict single dates", () => {
    const result = buildAutoFileName(makeFileEntry({ dateMode: "single", dateFrom: "1890" }));
    expect(result).toBe("ЦДІАК Р123-2-45. 1890. Метрична книга.pdf");
  });

  it("includes the range between archival code and case name for strict year ranges", () => {
    const result = buildAutoFileName(
      makeFileEntry({ dateMode: "range", dateFrom: "1890", dateTo: "1895" })
    );
    expect(result).toBe("ЦДІАК Р123-2-45. 1890-1895. Метрична книга.pdf");
  });

  it("omits arbitrary dates from the generated file name", () => {
    const result = buildAutoFileName(
      makeFileEntry({ dateMode: "other", dateFrom: "кінець XVII ст." })
    );
    expect(result).toBe("ЦДІАК Р123-2-45. Метрична книга.pdf");
  });
});
