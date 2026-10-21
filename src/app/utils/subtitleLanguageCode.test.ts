import { describe, expect, it } from "vitest";
import { toSubtitleLanguageCode } from "./subtitleLanguageCode";

describe("toSubtitleLanguageCode", () => {
  it("maps common languages to the three-letter export code", () => {
    expect(toSubtitleLanguageCode("vi")).toBe("vie");
    expect(toSubtitleLanguageCode("en")).toBe("eng");
    expect(toSubtitleLanguageCode("ja")).toBe("jpn");
  });

  it("keeps shipped variants distinguishable", () => {
    expect(toSubtitleLanguageCode("zh")).toBe("zho");
    expect(toSubtitleLanguageCode("zh-hant")).toBe("zho-hant");
    expect(toSubtitleLanguageCode("pt-br")).toBe("por-br");
    expect(toSubtitleLanguageCode("pt-pt")).toBe("por-pt");
  });

  it("normalises case and surrounding whitespace", () => {
    expect(toSubtitleLanguageCode(" VI ")).toBe("vie");
    expect(toSubtitleLanguageCode("PT-BR")).toBe("por-br");
  });

  it("falls through for unknown values instead of inventing a code", () => {
    expect(toSubtitleLanguageCode("xx")).toBe("xx");
    expect(toSubtitleLanguageCode("auto")).toBe("auto");
    expect(toSubtitleLanguageCode("")).toBe("");
  });
});
