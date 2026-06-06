import { describe, expect, it } from "vitest";
import { buildCommonsDescription } from "@/lib/wikicommons-upload";

describe("buildCommonsDescription", () => {
  it("builds source, date, custom author, license, and sprava name", () => {
    const license = "{{PD-old-70}}";
    const result = buildCommonsDescription({
      archiveAbbr: "ЦДІАК",
      fond: "201",
      opys: "4а",
      sprava: "8022",
      spravaName: "Назва справи",
      dateFrom: "1920",
      dateTo: "1930",
      isArbitraryDate: false,
      author: "Test author",
      license,
    });

    expect(result).toContain("|description={{uk|1=Фонд 201, опис 4а, справа 8022. Назва справи}}");
    expect(result).toContain("|source={{Archive Ukraine|ЦДІАК|201|4а|8022}}");
    expect(result).toContain("|date=1920–1930");
    expect(result).toContain("|author=Test author");
    expect(result).toContain(`=={{int:license-header}}==\n${license}`);
  });

  it("uses the default author when author is omitted", () => {
    const result = buildCommonsDescription({
      archiveAbbr: "ЦДІАК",
      fond: "201",
      opys: "4а",
      sprava: "8022",
      spravaName: "Назва справи",
      dateFrom: "1920",
      dateTo: "1920",
      isArbitraryDate: false,
      license: "{{PD-old-70}}",
    });

    expect(result).toContain("|author={{author|unknown}}");
  });
});
