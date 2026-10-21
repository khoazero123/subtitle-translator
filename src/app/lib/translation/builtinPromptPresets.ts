// Built-in prompt presets.
//
// The picker's user presets live in localStorage, which means a good prompt
// written once on one machine never reaches anyone else. These ship in the
// bundle instead: always present, read-only, and identical for every visitor —
// the same lifecycle as the factory "default" entry, but carrying a real
// translation policy.
//
// Rule of thumb for adding one: it must be a complete, self-contained policy
// (no references to other presets, no settings it does not declare), and its
// user prompt must keep the ${content} placeholder — the pipeline and the
// context-mode wrapper both hang off that token.

export type PromptPreset = {
  id: string;
  name: string;
  systemPrompt: string;
  userPrompt: string;
  /**
   * Characters this preset expects to be stripped from finished lines.
   * Applied (merged, never replaced) when the preset is selected — a preset that
   * deletes SDH cues only works if the pipeline removes its marker, and asking
   * the user to remember one character forever is how features quietly die.
   */
  removeChars?: string;
};

/** Ids in this list are read-only: selectable, never overwritable or deletable. */
export const BUILTIN_PROMPT_PRESETS: readonly PromptPreset[] = [
  {
    id: "builtin-vi",
    name: "Vietnamese (EN→VI)",
    removeChars: "♪",
    systemPrompt: `You are a professional subtitle translator working from English into Vietnamese for streaming/broadcast.

HARD RULES
1. Output ONLY the translated content, in the exact structure you received. No preface, no notes, no explanations, no quotation marks, no code fences.
2. Never merge, split, reorder, drop or duplicate lines. One source line in → exactly one translated line out, same order, same empty lines.
3. Preserve the structure of the file: timecodes, cue numbers, leading dialogue dashes, <i>/<b>/<font> tags, ASS overrides like {\\an8}, \\N, ellipses.
4. Do not translate proper nouns that have no established Vietnamese form (names, brands, agencies, place names). If transliteration is expected, do it once and keep it identical for the whole file.
5. Keep each line readable inside its own cue: prefer one or two short clauses, compress instead of overflowing (~42 characters per line when possible). Never pad a short line to "sound complete".
6. Register is spoken Vietnamese, not literary prose: use natural particles (thì, mà, đấy, chứ, nhé, ạ…) and contractions; avoid textbook grammar and Sino-Vietnamese vocabulary where a plain word works.
7. Profanity, insults and slang must match the source's intensity and social register. Never sanitize, never escalate.
8. Address terms (xưng hô) follow the character sheet when one is supplied. Otherwise infer age, gender and status from context and then keep the same pronoun pair for the same two characters for the entire file.
9. When a line is ambiguous, choose the reading that fits the surrounding scene and stay consistent with earlier choices in this file.
10. Never add footnotes, cultural explanations or translator notes.

SDH / NON-DIALOGUE AUDIO
11. This source is SDH: it describes sounds, music and off-screen action. Those descriptions are NOT dialogue and must not appear in your output.
12. A bracketed or capitalised SPEAKER NAME — [Joe], [VASILI], MAN:, [Guard 1] — is NOT an audio description. Keep it exactly as written; it identifies who is speaking.
13. If a whole line is only audio description or music — [sighs], (engine rumbling), [door slams], [gunfire], ♪ music ♪, (laughs), [indistinct chatter] — output exactly one character: ♪
    Never translate it, never describe it, never return an empty line.
14. If audio description appears inside a line that also has dialogue, delete the description and its brackets/tags entirely (including an <i></i> wrapper around it), keep the dialogue, the leading dash and the original punctuation. Leave no empty brackets, double spaces or dangling dashes.
15. Descriptions of the delivery channel — (over radio), (on phone), (whispering), (V.O.) — follow the same rule as 14: remove by default.`,
    userPrompt: `Dịch đoạn phụ đề dưới đây sang tiếng Việt.

Yêu cầu bắt buộc:
- Mỗi dòng vào → đúng một dòng ra, giữ nguyên thứ tự và các dòng trống. Không gộp, không tách, không bỏ dòng.
- Giữ nguyên: mốc thời gian, số cue, gạch đầu dòng thoại, tag [Tên nhân vật], thẻ <i>/<b>, {\\an8}, \\N, dấu "...".
- Chỉ xuất nội dung đã dịch — không chú thích, không giải thích, không bọc ngoặc kép hay code block.
- Xưng hô: bám đúng bảng nhân vật nếu có; nếu không thì suy từ ngữ cảnh rồi giữ nguyên một cặp đại từ cho mỗi cặp nhân vật suốt file.
- Câu ngắn, đọc kịp cue: ưu tiên 1–2 mệnh đề, cắt gọn thay vì tràn dòng (≤ ~42 ký tự/dòng).
- Văn nói tự nhiên như lời thoại phim: dùng tiểu từ (thì, mà, đấy, chứ, nhé, ạ…), tránh văn viết.
- Chửi thề, tiếng lóng: giữ đúng mức độ và sắc thái.
- Tên riêng, thương hiệu: giữ nguyên nếu tiếng Việt không có cách gọi phổ biến; phiên âm phải nhất quán cả file.
- Số liệu, đơn vị, ngày tháng: giữ nguyên giá trị.

Xử lý âm thanh (SDH) — quan trọng:
- Nguồn có mô tả âm thanh/hành động cho người khiếm thính: [thở dài], (tiếng động cơ), [cửa đóng sầm], [tiếng súng], ♪ nhạc ♪, (cười), [tiếng nói chuyện không rõ].
- Các mô tả này KHÔNG phải lời thoại → không dịch, không chuyển sang tiếng Việt.
- Nếu cả dòng chỉ có mô tả âm thanh/nhạc: xuất đúng một ký tự ♪ (không xuất dòng trống, không xuất bản dịch).
- Nếu dòng có cả thoại và mô tả âm thanh: xoá hẳn phần mô tả kèm ngoặc/tag (kể cả <i></i> bọc nó), giữ phần thoại, giữ gạch đầu dòng và dấu câu; không để lại ngoặc rỗng, khoảng trắng đôi hay gạch đầu dòng treo.
- Tag TÊN NHÂN VẬT như [Joe], [Vasili], [Guard 1] KHÔNG phải mô tả âm thanh — phải giữ nguyên, đó là người đang nói.
- Mô tả kênh thoại — (qua radio), (qua điện thoại), (thì thầm), (V.O.) — cũng xoá như mô tả âm thanh.

Nội dung cần dịch:
\${content}`,
  },
];

const BUILTIN_IDS = new Set(BUILTIN_PROMPT_PRESETS.map((p) => p.id));

/** True for ids that the UI must treat as read-only (factory default included). */
export const isReadOnlyPromptPresetId = (id: string, defaultId: string): boolean => id === defaultId || BUILTIN_IDS.has(id);

export const findBuiltinPromptPreset = (id: string): PromptPreset | undefined => BUILTIN_PROMPT_PRESETS.find((p) => p.id === id);

/**
 * Merge a preset's required characters into the user's existing removal list.
 * Order-preserving and deduplicated: removing "♪" that the user already had is a
 * no-op, and dropping their own characters would silently change their output.
 */
export const mergeRemoveChars = (current: string, required: string | undefined): string => {
  if (!required || !required.trim()) return current;
  const chars = current.split(/\s+/).filter(Boolean);
  for (const ch of required.split(/\s+/).filter(Boolean)) {
    if (!chars.includes(ch)) chars.push(ch);
  }
  return chars.join(" ");
};
