import { describe, expect, it } from "vitest";
import { BUILTIN_PROMPT_PRESETS, findBuiltinPromptPreset, isReadOnlyPromptPresetId, mergeRemoveChars } from "./builtinPromptPresets";

describe("BUILTIN_PROMPT_PRESETS", () => {
  it("ships the Vietnamese preset with both prompts filled in", () => {
    const preset = findBuiltinPromptPreset("builtin-vi");
    expect(preset).toBeDefined();
    expect(preset!.name).toContain("Vietnamese");
    expect(preset!.systemPrompt.length).toBeGreaterThan(200);
    expect(preset!.userPrompt).toContain("tiếng Việt");
  });

  it("keeps the ${content} placeholder that the pipeline substitutes", () => {
    for (const preset of BUILTIN_PROMPT_PRESETS) {
      expect(preset.userPrompt).toContain("${content}");
    }
  });

  it("declares the characters its policy depends on", () => {
    // The Vietnamese preset deletes SDH cues by emitting ♪; without the removal
    // the marker would ship in the file as a lone music note.
    expect(findBuiltinPromptPreset("builtin-vi")!.removeChars).toBe("♪");
  });

  it("uses ids that cannot collide with Date.now() user presets", () => {
    const ids = BUILTIN_PROMPT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith("builtin-")).toBe(true);
  });
});

describe("isReadOnlyPromptPresetId", () => {
  it("treats default and built-ins as read-only", () => {
    expect(isReadOnlyPromptPresetId("default", "default")).toBe(true);
    expect(isReadOnlyPromptPresetId("builtin-vi", "default")).toBe(true);
  });

  it("leaves user presets editable", () => {
    expect(isReadOnlyPromptPresetId("1730000000000", "default")).toBe(false);
  });
});

describe("mergeRemoveChars", () => {
  it("adds the required character without touching the user's own", () => {
    expect(mergeRemoveChars("~|", "♪")).toBe("~| ♪");
  });

  it("is idempotent", () => {
    expect(mergeRemoveChars("♪", "♪")).toBe("♪");
    expect(mergeRemoveChars("~ ♪", "♪")).toBe("~ ♪");
  });

  it("is a no-op when the preset requires nothing", () => {
    expect(mergeRemoveChars("~", undefined)).toBe("~");
    expect(mergeRemoveChars("~", "  ")).toBe("~");
  });
});
