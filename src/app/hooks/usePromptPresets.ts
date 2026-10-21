"use client";

import { usePresetCollection } from "@/app/hooks/usePresetCollection";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "@/app/lib/translation/config";
import {
  BUILTIN_PROMPT_PRESETS,
  findBuiltinPromptPreset,
  isReadOnlyPromptPresetId,
  mergeRemoveChars,
  type PromptPreset,
} from "@/app/lib/translation/builtinPromptPresets";

export type { PromptPreset };

// Sentinel id for the always-present "default prompt" entry in the picker. User
// presets use String(Date.now()) (numeric), so this never collides. It's a way
// back to the factory prompts after the user has saved/edited their own presets.
export const DEFAULT_PROMPT_PRESET_ID = "default";

type Deps = {
  effectiveSystemPrompt: string;
  effectiveUserPrompt: string;
  setSystemPrompt: (value: string) => void;
  setUserPrompt: (value: string) => void;
  /**
   * Removal list setter. A built-in preset may require characters to be stripped
   * (the Vietnamese preset deletes SDH cues by emitting ♪, and the pipeline only
   * honours that if ♪ is in removeChars). Loading such a preset merges its
   * characters in rather than replacing the user's own — see mergeRemoveChars.
   */
  setRemoveChars?: (updater: (prev: string) => string) => void;
};

/**
 * CRUD for named prompt presets (systemPrompt + userPrompt). Independent of
 * `useLlmPresets` (which manages API config). Decouples prompt switching
 * from API config switching so users can mix-and-match.
 *
 * Two kinds live side by side: built-ins shipped in the bundle (see
 * lib/translation/builtinPromptPresets) and the user's own rows in localStorage.
 * Neither list can overwrite the other; built-ins are read-only like "default".
 */
export const usePromptPresets = ({ effectiveSystemPrompt, effectiveUserPrompt, setSystemPrompt, setUserPrompt, setRemoveChars }: Deps) => {
  const {
    items: promptPresets,
    setItems: setPromptPresets,
    activeId: activePromptPresetId,
    setActiveId: setActivePromptPresetId,
    add,
    remove: deletePromptPreset,
    rename: renamePromptPreset,
    update,
  } = usePresetCollection<PromptPreset>("translation-promptPresets", "translation-activePromptPresetId");

  const savePromptPreset = (name: string) => {
    const preset: PromptPreset = {
      id: String(Date.now()),
      name,
      systemPrompt: effectiveSystemPrompt,
      userPrompt: effectiveUserPrompt,
    };
    add(preset);
    return preset;
  };

  const isReadOnly = (id: string) => isReadOnlyPromptPresetId(id, DEFAULT_PROMPT_PRESET_ID);

  const loadPromptPreset = (id: string) => {
    if (!id) {
      setActivePromptPresetId("");
      return;
    }
    if (id === DEFAULT_PROMPT_PRESET_ID) {
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
      setUserPrompt(DEFAULT_USER_PROMPT);
      setActivePromptPresetId(DEFAULT_PROMPT_PRESET_ID);
      return;
    }
    const builtin = findBuiltinPromptPreset(id);
    if (builtin) {
      setSystemPrompt(builtin.systemPrompt);
      setUserPrompt(builtin.userPrompt);
      // Merge, never replace: a user who already strips their own characters
      // keeps them, and re-selecting the preset stays a no-op.
      if (builtin.removeChars && setRemoveChars) {
        const required = builtin.removeChars;
        setRemoveChars((prev) => mergeRemoveChars(prev, required));
      }
      setActivePromptPresetId(id);
      return;
    }
    const preset = promptPresets.find((p) => p.id === id);
    if (!preset) return;
    setSystemPrompt(preset.systemPrompt);
    setUserPrompt(preset.userPrompt);
    setActivePromptPresetId(id);
  };

  // Read-only entries (default + built-ins) can't be overwritten or deleted —
  // the picker disables those buttons too; these guards are the safety net.
  const updatePromptPreset = (id: string) => {
    if (isReadOnly(id)) return;
    update(id, { systemPrompt: effectiveSystemPrompt, userPrompt: effectiveUserPrompt });
  };

  const removePromptPreset = (id: string) => {
    if (isReadOnly(id)) return;
    deletePromptPreset(id);
  };

  return {
    promptPresets,
    builtinPromptPresets: BUILTIN_PROMPT_PRESETS,
    setPromptPresets,
    activePromptPresetId,
    setActivePromptPresetId,
    isReadOnlyPromptPreset: isReadOnly,
    savePromptPreset,
    loadPromptPreset,
    deletePromptPreset: removePromptPreset,
    renamePromptPreset,
    updatePromptPreset,
  };
};
