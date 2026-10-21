// Cast / character context for subtitle translation.
//
// Why this exists: the engine sends only cue text upstream, so the model has no
// idea who is speaking. Pronoun-sensitive target languages (Vietnamese above
// all: anh/chị/em/chú/bác/ông/bà/cô/cháu) then guess, and the guess drifts line
// to line. This module prepares a character sheet *before* translation and hands
// it to the model as a dynamic prompt block (same channel as the glossary).
//
// Everything here runs in the browser: the app is a static export, so lookups go
// straight to TMDB (CORS-enabled) with a user-supplied key. No key => no lookup,
// and the panel still lets the user type the sheet by hand.

export type SpeakerStat = {
  /** Speaker tag as it appears in the source, e.g. "Joe" or "Guard 1". */
  name: string;
  /** How many cues carry this tag. */
  count: number;
};

export type CastGender = "male" | "female" | "unknown";

export type CastMember = {
  /** Character name as credited (may differ from the speaker tag). */
  character: string;
  /** Performer name, empty when the sheet was typed by hand. */
  actor: string;
  gender: CastGender;
  /** Age when the season/film was released — the age the character plays. */
  age?: number;
  /** What the age was measured against ("born 1975 · season aired 2019"). */
  ageBasis?: string;
};

export type SubtitleIdentity = {
  title: string;
  season?: number;
  episode?: number;
  year?: number;
};

/**
 * Bracketed words that are sound effects or production notes, not speakers.
 * SRT authors routinely write [gunfire], [suspenseful music], [door opens];
 * treating those as characters would both waste lookup requests and hand the
 * model nonsense ("[music] is a 34-year-old male").
 */
const NON_SPEAKER_TAGS = new Set([
  "music", "suspenseful music", "upbeat music", "somber music", "dramatic music",
  "orchestra music", "electronic music", "theme music", "string music",
  "gunfire", "gunshot", "gunshots", "explosion", "siren", "sirens", "siren blares",
  "door opens", "door closes", "door unlocks", "keypad beeps", "phone rings",
  "mobile phone rings", "birds cawing", "dog barks", "indistinct chatter",
  "indistinct conversation", "indistinct voices", "distorted voices", "chatter",
  "fighting exertions", "shuffling noise", "liquid pouring", "train breaks squeal",
  "tires squeal", "traffic noise", "laughter", "laughs", "chuckles", "sighs",
  "groans", "gasps", "coughs", "breathing heavily", "breathing", "exhales",
  "sobbing", "shredder shreds", "lion roaring", "ambulance engine starts up",
]);

const TAG_RE = /\[([^[\]\n]{1,40})\]/g;
const HAS_LETTER_RE = /[A-Za-z]/;

const normalizeTag = (raw: string): string => raw.replace(/\s+/g, " ").trim();

/**
 * Collect speaker tags from subtitle content lines.
 *
 * Deliberately narrow: only bracketed tags ([Joe], "- [Guard 1] ...") count.
 * "NAME:" prefixes were considered and rejected — English dialogue legitimately
 * starts with a capitalised word followed by a colon ("Listen: we have to go"),
 * so treating them as speakers would invent characters. Anything the heuristic
 * misses, the panel's manual add covers.
 */
export const extractSpeakerTags = (lines: readonly string[]): SpeakerStat[] => {
  const counts = new Map<string, number>();
  for (const line of lines) {
    TAG_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TAG_RE.exec(line)) !== null) {
      const name = normalizeTag(match[1]);
      if (!name || !HAS_LETTER_RE.test(name)) continue;
      if (/^\d+$/.test(name)) continue;
      if (NON_SPEAKER_TAGS.has(name.toLowerCase())) continue;
      // Keep the original casing but fold case-variants into one bucket.
      const key = [...counts.keys()].find((k) => k.toLowerCase() === name.toLowerCase()) ?? name;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const RELEASE_TOKEN_RE = /^(?:\d{3,4}p|4k|uhd|web-?dl|webrip|web|bluray|blu-ray|brrip|bdrip|hdtv|dvdrip|amzn|nf|dsnp|hmax|atvp|hulu|ddp?\d(?:[.\s]\d)?|dd\d(?:[.\s]\d)?|aac\d?|ac3|eac3|dts|truehd|atmos|x264|x265|h[.\s]?264|h[.\s]?265|hevc|av1|10bit|8bit|hi10p|proper|repack|remux|extended|unrated)$/i;

/**
 * Derive the show/film identity from a release-style file name:
 * "Condor.S02E02.If.It.Serves.a.Greater.Good.1080p.10bit.AMZN.WEB-DL...srt"
 * -> { title: "Condor", season: 2, episode: 2 }.
 *
 * Title stops at the first token that is unmistakably release metadata: a
 * season/episode marker, a year, or a resolution/source/codec/audio tag.
 */
export const parseSubtitleIdentity = (fileName: string): SubtitleIdentity => {
  const base = fileName.replace(/\.[a-z0-9]{2,4}$/i, "");
  const parts = base.split(/[._\s]+/).filter(Boolean);
  const titleParts: string[] = [];
  let season: number | undefined;
  let episode: number | undefined;
  let year: number | undefined;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const se = /^[Ss](\d{1,2})[Ee](\d{1,3})$/.exec(part);
    if (se) {
      season = Number(se[1]);
      episode = Number(se[2]);
      break;
    }
    if (/^(?:19|20)\d{2}$/.test(part)) {
      // A year belongs to the title when the release tags come later and the
      // token reads like a title word ("Blade Runner 2049").
      const next = parts[i + 1];
      const nextIsRelease = next === undefined || RELEASE_TOKEN_RE.test(next) || /^[Ss]\d{1,2}[Ee]\d{1,3}$/.test(next);
      if (titleParts.length > 0 && nextIsRelease) {
        year = Number(part);
        break;
      }
    }
    if (RELEASE_TOKEN_RE.test(part)) break;
    titleParts.push(part);
  }

  return {
    title: titleParts.join(" ").trim(),
    season,
    episode,
    year,
  };
};

const TMDB_BASE = "https://api.themoviedb.org/3";

type TmdbPerson = { id: number; name: string; gender?: number; birthday?: string | null };

type TmdbCastRow = {
  character?: string;
  roles?: Array<{ character?: string }>;
  name?: string;
  gender?: number;
  id: number;
};

const genderOf = (code?: number): CastGender => (code === 1 ? "female" : code === 2 ? "male" : "unknown");

const yearOf = (date?: string | null): number | undefined => {
  if (!date) return undefined;
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) ? y : undefined;
};

export type CastLookupOptions = {
  apiKey: string;
  title: string;
  season?: number;
  year?: number;
  language?: string;
  signal?: AbortSignal;
  /** Swap-in for tests. */
  fetcher?: typeof fetch;
};

export type CastLookupResult = {
  /** Resolved TMDB title — the release name can be an abbreviation. */
  title: string;
  year?: number;
  cast: CastMember[];
};

const rowsToCast = (rows: TmdbCastRow[], airYear?: number): CastMember[] => {
  const seen = new Set<string>();
  const out: CastMember[] = [];
  for (const row of rows) {
    const character = (row.character ?? row.roles?.[0]?.character ?? "").trim();
    const actor = (row.name ?? "").trim();
    if (!character && !actor) continue;
    const dedupe = `${character.toLowerCase()}|${actor.toLowerCase()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ character: character || actor, actor, gender: genderOf(row.gender), ageBasis: airYear ? `released ${airYear}` : undefined });
  }
  return out;
};

/**
 * Look up a title's cast on TMDB and return one row per character with gender
 * and the age the character plays (birth year vs. the season/film air year).
 *
 * Person details cost one request each and the prompt block only mentions
 * detected speakers, so the enrichment pass is bounded by the sheet size.
 */
export const lookupCast = async (opts: CastLookupOptions): Promise<CastLookupResult> => {
  const fetcher = opts.fetcher ?? fetch;
  const key = opts.apiKey.trim();
  if (!key) throw new Error("A TMDB API key is required for the cast lookup.");
  const title = opts.title.trim();
  if (!title) throw new Error("Could not derive a title from the file name.");

  const call = async <T,>(path: string): Promise<T> => {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${TMDB_BASE}${path}${sep}api_key=${encodeURIComponent(key)}&language=${encodeURIComponent(opts.language ?? "en-US")}`;
    const res = await fetcher(url, { signal: opts.signal });
    if (!res.ok) throw new Error(`TMDB request failed (${res.status} ${res.statusText})`);
    return (await res.json()) as T;
  };

  const isSeries = opts.season !== undefined;
  let tmdbId: number | undefined;
  let resolvedTitle = title;
  let resolvedYear = opts.year;

  if (isSeries) {
    const search = await call<{ results?: Array<{ id: number; name?: string; first_air_date?: string }> }>(
      `/search/tv?query=${encodeURIComponent(title)}`,
    );
    const hit = search.results?.[0];
    if (!hit) throw new Error(`No TV series matched "${title}".`);
    tmdbId = hit.id;
    resolvedTitle = hit.name ?? title;
    resolvedYear = yearOf(hit.first_air_date) ?? resolvedYear;
  } else {
    const search = await call<{
      results?: Array<{ id: number; media_type?: string; name?: string; title?: string; first_air_date?: string; release_date?: string }>;
    }>(`/search/multi?query=${encodeURIComponent(title)}`);
    const hit = search.results?.find((r) => r.media_type === "movie" || r.media_type === "tv");
    if (!hit?.id) throw new Error(`No title matched "${title}".`);
    tmdbId = hit.id;
    resolvedTitle = hit.title ?? hit.name ?? title;
    resolvedYear = yearOf(hit.release_date ?? hit.first_air_date) ?? resolvedYear;
    if (hit.media_type === "tv") {
      const agg = await call<{ cast?: TmdbCastRow[] }>(`/tv/${hit.id}/aggregate_credits`);
      return { title: resolvedTitle, year: resolvedYear, cast: rowsToCast(agg.cast ?? [], resolvedYear) };
    }
  }

  const airYear = resolvedYear;

  const raw: TmdbCastRow[] =
    isSeries && opts.season !== undefined
      ? (await call<{ cast?: TmdbCastRow[] }>(`/tv/${tmdbId}/season/${opts.season}/credits`)).cast ?? []
      : (await call<{ cast?: TmdbCastRow[] }>(`/movie/${tmdbId}/credits`)).cast ?? [];

  const cast = rowsToCast(raw, airYear);

  // Enrichment is best-effort: a failed person lookup must not sink the whole
  // sheet, the row still carries character + actor + gender from the credits.
  for (const member of cast) {
    if (!member.actor || member.age !== undefined) continue;
    const row = raw.find((r) => (r.name ?? "").toLowerCase() === member.actor.toLowerCase());
    if (!row) continue;
    try {
      const person = await call<TmdbPerson>(`/person/${row.id}`);
      const birthYear = yearOf(person.birthday);
      if (birthYear !== undefined && airYear !== undefined) {
        member.age = Math.max(0, airYear - birthYear);
        member.ageBasis = `born ${birthYear} · released ${airYear}`;
      } else if (birthYear !== undefined) {
        member.ageBasis = `born ${birthYear}`;
      }
      if (member.gender === "unknown") member.gender = genderOf(person.gender);
    } catch {
      // Keep the unenriched row.
    }
  }

  return { title: resolvedTitle, year: resolvedYear, cast };
};

export type CastBlockOptions = {
  identity: SubtitleIdentity;
  speakers: readonly SpeakerStat[];
  cast: readonly CastMember[];
  targetLanguage: string;
};

/**
 * Render the character sheet as a prompt block.
 *
 * Written in English on purpose: every model in the registry follows English
 * instructions well, and one canonical wording means the block does not have to
 * be re-translated per UI locale. The Vietnamese pronoun rules are the one
 * exception — they are the reason the feature exists, and stating them in
 * Vietnamese is more precise than an English paraphrase of them.
 */
export const buildCastPromptBlock = ({ identity, speakers, cast, targetLanguage }: CastBlockOptions): string => {
  const rows: string[] = [];
  for (const speaker of speakers) {
    const needle = speaker.name.toLowerCase().split(/\s+/)[0];
    const match =
      cast.find((c) => c.character.toLowerCase() === speaker.name.toLowerCase()) ??
      cast.find((c) => c.character.toLowerCase().includes(needle)) ??
      cast.find((c) => c.actor.toLowerCase().includes(needle));
    if (!match) {
      rows.push(`- [${speaker.name}] — unidentified speaker (${speaker.count} lines)`);
      continue;
    }
    const bits: string[] = [];
    bits.push(match.character);
    if (match.actor && match.actor.toLowerCase() !== match.character.toLowerCase()) bits.push(`played by ${match.actor}`);
    bits.push(`${match.gender === "unknown" ? "gender unknown" : match.gender}`);
    if (match.age !== undefined) bits.push(`about ${match.age} years old${match.ageBasis ? ` (${match.ageBasis})` : ""}`);
    rows.push(`- [${speaker.name}] — ${bits.join(", ")} (${speaker.count} lines)`);
  }

  const source = [
    identity.title || "unknown title",
    identity.season !== undefined
      ? `S${String(identity.season).padStart(2, "0")}${identity.episode !== undefined ? `E${String(identity.episode).padStart(2, "0")}` : ""}`
      : undefined,
    identity.year,
  ]
    .filter(Boolean)
    .join(" ");

  const lines = [
    "CHARACTER CONTEXT — do not translate or copy this block into your output. Use it only to keep forms of address consistent.",
    `Source: ${source}`,
    "Speakers detected in the source (the bracketed tag in each line identifies who is talking):",
    ...rows,
    "Rules:",
    "1. Keep every speaker's form of address consistent across the entire file — never switch pronouns for the same pair of speakers between lines.",
    "2. Let age, gender and relative status decide the register, not the speaker's mood in a single line.",
    "3. Never invent a name for an unidentified speaker; keep the tag's meaning (e.g. [Guard 1] stays a guard).",
  ];

  if (targetLanguage === "vi") {
    lines.push(
      "4. Xưng hô tiếng Việt: chọn cặp đại từ theo tuổi + giới tính + quan hệ giữa hai người đang nói, không theo ngôi kể.",
      "   - Người nói lớn tuổi hơn rõ rệt: anh/chị (cùng thế hệ nhưng hơn tuổi), chú/cô (hơn một thế hệ), bác/ông/bà (hơn hẳn một thế hệ).",
      "   - Người nói ít tuổi hơn: em (với người hơn tuổi), cháu (với người hơn một thế hệ).",
      "   - Ngang hàng, cùng tuổi: tôi – anh/chị hoặc tớ – cậu khi thân mật; bạn bè thân dùng tớ – cậu/mày – tao đúng sắc thái, nhưng phải giữ nguyên suốt file.",
      "   - Cấp trên/cấp dưới trong công việc: tôi – anh/chị hoặc tôi – ông/bà khi lạnh nhạt, căng thẳng; không dùng em với cấp trên trừ khi quan hệ thân mật.",
      "   - Vợ chồng/người yêu: anh – em; khi cãi vã vẫn giữ cặp đại từ đã chọn, chỉ đổi sắc thái từ ngữ.",
      "   - Tuyệt đối không đổi cách xưng hô giữa hai nhân vật giữa chừng nếu không có lý do trong truyện (thay đổi quan hệ, cố ý sỉ nhục).",
    );
  }

  return lines.join("\n");
};
