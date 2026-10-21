import { describe, expect, it } from "vitest";
import { buildCastPromptBlock, extractSpeakerTags, lookupCast, parseSubtitleIdentity, type CastMember } from "./cast";

describe("extractSpeakerTags", () => {
  it("collects bracketed speaker tags and folds case variants", () => {
    const lines = ["- [Joe] Previously on Condor...", "- [Vasili] I'm under suspicion.", "- [joe] Again.", "(gunfire)"];
    expect(extractSpeakerTags(lines)).toEqual([
      { name: "Joe", count: 2 },
      { name: "Vasili", count: 1 },
    ]);
  });

  it("ignores sound-effect tags that SRT authors bracket", () => {
    const lines = ["[suspenseful music]", "[gunfire]", "[sirens]", "[door opens]"];
    expect(extractSpeakerTags(lines)).toEqual([]);
  });

  it("never treats numbers as speakers", () => {
    expect(extractSpeakerTags(["[12]", "[Guard 1] Up!"])).toEqual([{ name: "Guard 1", count: 1 }]);
  });
});

describe("parseSubtitleIdentity", () => {
  it("derives title/season/episode from a release-style name", () => {
    const file = "Condor.S02E02.If.It.Serves.a.Greater.Good.1080p.10bit.AMZN.WEB-DL.DDP5.1.HEVC-Vyndros.srt";
    expect(parseSubtitleIdentity(file)).toEqual({ title: "Condor", season: 2, episode: 2, year: undefined });
  });

  it("treats a trailing year as the release year", () => {
    expect(parseSubtitleIdentity("Blade.Runner.2049.2017.1080p.BluRay.x265.mkv")).toEqual({
      title: "Blade Runner 2049",
      season: undefined,
      episode: undefined,
      year: 2017,
    });
  });

  it("falls back to the whole name when no metadata is present", () => {
    expect(parseSubtitleIdentity("My Custom Subtitle.srt").title).toBe("My Custom Subtitle");
  });
});

describe("buildCastPromptBlock", () => {
  const identity = { title: "Condor", season: 2, episode: 2 };
  const speakers = [{ name: "Joe", count: 8 }];
  const cast: CastMember[] = [{ character: "Joe Turner", actor: "Max Thieriot", gender: "male", age: 36 }];

  it("maps a speaker tag onto its character with gender and age", () => {
    const block = buildCastPromptBlock({ identity, speakers, cast, targetLanguage: "zh" });
    expect(block).toContain("- [Joe] — Joe Turner, played by Max Thieriot, male, about 36 years old (8 lines)");
    expect(block).toContain("Condor S02E02");
    expect(block).not.toContain("Xưng hô tiếng Việt");
  });

  it("adds Vietnamese pronoun rules only for vi", () => {
    const block = buildCastPromptBlock({ identity, speakers, cast, targetLanguage: "vi" });
    expect(block).toContain("Xưng hô tiếng Việt");
    expect(block).toContain("chú/cô");
  });

  it("marks speakers the sheet does not cover instead of inventing one", () => {
    const block = buildCastPromptBlock({ identity, speakers: [{ name: "Guard 1", count: 1 }], cast, targetLanguage: "en" });
    expect(block).toContain("[Guard 1] — unidentified speaker (1 lines)");
  });
});

describe("lookupCast", () => {
  const json = (body: unknown) =>
    Promise.resolve({ ok: true, status: 200, statusText: "OK", json: () => Promise.resolve(body) } as Response);

  it("resolves a season's credits and ages them against the release year", async () => {
    const calls: string[] = [];
    const fetcher = ((input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/search/tv")) return json({ results: [{ id: 1, name: "Condor", first_air_date: "2018-06-06" }] });
      if (url.includes("/season/2/credits"))
        return json({ cast: [{ id: 10, name: "Max Thieriot", character: "Joe Turner", gender: 2 }] });
      if (url.includes("/person/10")) return json({ id: 10, name: "Max Thieriot", gender: 2, birthday: "1988-10-14" });
      throw new Error(`unexpected url ${url}`);
    }) as typeof fetch;

    const result = await lookupCast({ apiKey: "k", title: "Condor", season: 2, fetcher });
    expect(result.title).toBe("Condor");
    expect(result.cast[0]).toMatchObject({ character: "Joe Turner", actor: "Max Thieriot", gender: "male", age: 30 });
    expect(calls.some((u) => u.includes("/season/2/credits"))).toBe(true);
  });

  it("rejects without an API key", async () => {
    await expect(lookupCast({ apiKey: " ", title: "Condor" })).rejects.toThrow(/API key/);
  });
});
