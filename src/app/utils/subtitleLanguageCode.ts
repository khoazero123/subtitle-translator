// Language codes for exported file names.
//
// Subtitle users need to tell the source apart from the translation when both
// sit in the same folder, and a bare 2-letter code is ambiguous for the variants
// this app ships ("zh" vs "zh-hant", "pt-br" vs "pt-pt"). Exports therefore use
// ISO 639-2/B — the bibliographic three-letter form players and release groups
// already use (vie, eng, jpn) — with the regional/script variant kept as a
// suffix (por-br, zho-hant).
//
// Deliberately a plain table: Intl offers no 639-2 lookup, and deriving the code
// from display names would break the moment a language gets renamed.

const ISO_639_2B: Record<string, string> = {
  en: "eng", zh: "zho", "zh-hant": "zho-hant", es: "spa", fr: "fra", de: "deu",
  ja: "jpn", ko: "kor", hi: "hin", ar: "ara", ru: "rus", "pt-br": "por-br",
  id: "ind", vi: "vie", it: "ita", yue: "yue", pl: "pol", uk: "ukr", nl: "nld",
  ro: "ron", el: "ell", hu: "hun", sv: "swe", cs: "ces", "pt-pt": "por-pt",
  ca: "cat", sr: "srp", bg: "bul", hy: "hye", da: "dan", sq: "sqi", fi: "fin",
  nb: "nob", sk: "slk", hr: "hrv", be: "bel", scn: "scn", ka: "kat", lmo: "lmo",
  lt: "lit", gl: "glg", bs: "bos", sl: "slv", mk: "mkd", lv: "lav", et: "est",
  is: "isl", mt: "mlt", cy: "cym", ga: "gle", br: "bre", eu: "eus", yi: "yid",
  lb: "ltz", oc: "oci", an: "arg", la: "lat", eo: "epo", tr: "tur", he: "heb",
  fa: "fas", ur: "urd", ps: "pus", prs: "prs", ckb: "ckb", kmr: "kmr", uz: "uzb",
  kk: "kaz", ky: "kir", tk: "tuk", az: "aze", tg: "tgk", mn: "mon", ba: "bak",
  tt: "tat", ug: "uig", bn: "ben", mr: "mar", te: "tel", ta: "tam", gu: "guj",
  kn: "kan", pa: "pan", ml: "mal", bho: "bho", mai: "mai", ne: "nep", si: "sin",
  as: "asm", gom: "kok", sa: "san", th: "tha", lo: "lao", my: "mya", km: "khm",
  ms: "msa", fil: "fil", jv: "jav", su: "sun", ace: "ace", pag: "pag", pam: "pam",
  ceb: "ceb", sw: "swa", ha: "hau", am: "amh", ig: "ibo", wo: "wol", xh: "xho",
  zu: "zul", af: "afr", om: "orm", st: "sot", tn: "tsn", ts: "tso", mg: "mlg",
  ln: "lin", ht: "hat", qu: "que", ay: "aym", gn: "grn", mi: "mri",
};

/**
 * Three-letter export code for an app language value ("vi" → "vie").
 *
 * Unknown values fall through unchanged, so a language added to the picker keeps
 * producing a usable (if shorter) suffix instead of a wrong one.
 */
export const toSubtitleLanguageCode = (language: string): string => {
  const key = language.trim().toLowerCase();
  if (!key || key === "auto") return key;
  return ISO_639_2B[key] ?? key;
};
