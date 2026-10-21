"use client";

// Cast context panel — prepared *before* translating.
//
// The subtitle tool never tells the model who is speaking, which is exactly the
// information Vietnamese pronouns need. This panel closes that gap in three
// steps the user can see and edit:
//   1. detect the bracketed speaker tags that SRT files already carry,
//   2. resolve the show/film from the file name and pull the credited cast
//      (character, actor, gender, age) from TMDB,
//   3. render a character sheet into the run's dynamic prompt block.
//
// Step 2 needs a TMDB API key (free, stored locally only). Without a key the
// table stays editable, so a hand-typed sheet works the same way.
//
// Copy is deliberately literal English + Vietnamese instead of next-intl keys:
// adding ~20 keys would mean touching all 19 locale files for a tool aimed at
// Vietnamese output, and a missing key renders as a raw path in production.

import { useEffect, useMemo, useState } from "react";
import { Alert, App, Button, Card, Empty, Input, InputNumber, Select, Space, Switch, Tag, Typography } from "antd";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import {
  buildCastPromptBlock,
  extractSpeakerTags,
  lookupCast,
  parseSubtitleIdentity,
  type CastMember,
} from "@/app/lib/translation/cast";

const { Text, Paragraph } = Typography;

const GENDER_OPTIONS = [
  { value: "male", label: "Nam / male" },
  { value: "female", label: "Nữ / female" },
  { value: "unknown", label: "Không rõ / unknown" },
];

type Props = {
  /** Raw source text of the file currently in the editor. */
  sourceText: string;
  /** Uploaded file name — the only place the show/film title comes from. */
  fileName: string;
};

const CastContextPanel = ({ sourceText, fileName }: Props) => {
  const { message } = App.useApp();
  const [enabled, setEnabled] = useLocalStorage<boolean>("translation-castEnabled", false);
  const [apiKey, setApiKey] = useLocalStorage<string>("translation-castTmdbKey", "");
  const [rows, setRows] = useLocalStorage<CastMember[]>("translation-castRows", []);
  const [resolvedTitle, setResolvedTitle] = useLocalStorage<string>("translation-castTitle", "");
  const [castBlock, setCastBlock] = useLocalStorage<string>("translation-castBlock", "");
  const [targetLanguage] = useLocalStorage<string>("translation-targetLanguage", "zh");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speakers = useMemo(() => extractSpeakerTags(sourceText.split(/\r?\n/)), [sourceText]);
  const identity = useMemo(() => parseSubtitleIdentity(fileName || "subtitle.srt"), [fileName]);

  // Keep the prompt block in sync with what the panel shows. Runs on every input
  // that can change the sheet so a stale block can never ride along with a new
  // file — the block is what actually reaches the model.
  useEffect(() => {
    if (!enabled || speakers.length === 0 || rows.length === 0) {
      if (castBlock) setCastBlock("");
      return;
    }
    const next = buildCastPromptBlock({ identity: { ...identity, title: resolvedTitle || identity.title }, speakers, cast: rows, targetLanguage });
    if (next !== castBlock) setCastBlock(next);
  }, [enabled, speakers, rows, identity, resolvedTitle, targetLanguage, castBlock, setCastBlock]);

  const runLookup = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await lookupCast({ apiKey, title: identity.title, season: identity.season, year: identity.year });
      setRows(result.cast);
      setResolvedTitle(result.title);
      message.success(`Tìm thấy ${result.cast.length} nhân vật / found ${result.cast.length} characters`);
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setError(text);
      message.error(text);
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (index: number, patch: Partial<CastMember>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, { character: "", actor: "", gender: "unknown" }]);

  // Unidentified speakers are the ones the sheet does not cover yet — surfacing
  // them is the point of the panel: the user sees which lines will guess.
  const unmatched = useMemo(() => {
    return speakers.filter((s) => {
      const needle = s.name.toLowerCase().split(/\s+/)[0];
      return !rows.some((r) => {
        const c = r.character.toLowerCase();
        return c === s.name.toLowerCase() || c.includes(needle) || r.actor.toLowerCase().includes(needle);
      });
    });
  }, [speakers, rows]);

  return (
    <Card
      size="small"
      title={
        <Space wrap>
          <span>Nhân vật / Cast context</span>
          {speakers.length > 0 && <Tag color="blue">{`${speakers.length} tag`}</Tag>}
          {rows.length > 0 && <Tag color="green">{`${rows.length} nhân vật`}</Tag>}
        </Space>
      }
      extra={<Switch checked={enabled} onChange={setEnabled} checkedChildren="ON" unCheckedChildren="OFF" />}
      style={{ marginBottom: 16 }}
    >
      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        Kiểm tra tên nhân vật trong subtitle trước khi dịch, để AI xưng hô đúng (anh/chị/em/chú/bác…).
        Tên phim lấy từ tên file: <Text code>{identity.title || "?"}</Text>
        {identity.season !== undefined && <Text code>{` S${String(identity.season).padStart(2, "0")}${identity.episode !== undefined ? `E${String(identity.episode).padStart(2, "0")}` : ""}`}</Text>}
      </Paragraph>

      {speakers.length === 0 ? (
        <Alert type="info" showIcon message="Subtitle này không có tag tên nhân vật dạng [Tên]. Không cần bật tính năng này." />
      ) : (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Space wrap size={4}>
            {speakers.map((s) => (
              <Tag key={s.name} color={unmatched.some((u) => u.name === s.name) ? "orange" : "default"}>
                {`[${s.name}] ${s.count}`}
              </Tag>
            ))}
          </Space>

          <Space wrap>
            <Input.Password
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="TMDB API key (themoviedb.org → Settings → API)"
              style={{ width: 320 }}
            />
            <Button type="primary" loading={loading} disabled={!apiKey.trim() || !identity.title} onClick={runLookup}>
              Tìm thông tin phim
            </Button>
            <Button onClick={addRow}>+ Thêm nhân vật</Button>
          </Space>

          {error && <Alert type="warning" showIcon message={error} />}

          {rows.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có bảng nhân vật — tìm bằng TMDB hoặc thêm tay." />
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {rows.map((row, index) => (
                <Space key={`${row.character}-${index}`} wrap align="center">
                  <Input
                    value={row.character}
                    onChange={(e) => updateRow(index, { character: e.target.value })}
                    placeholder="Nhân vật"
                    style={{ width: 200 }}
                  />
                  <Input
                    value={row.actor}
                    onChange={(e) => updateRow(index, { actor: e.target.value })}
                    placeholder="Diễn viên"
                    style={{ width: 200 }}
                  />
                  <Select
                    value={row.gender}
                    onChange={(v) => updateRow(index, { gender: v })}
                    options={GENDER_OPTIONS}
                    style={{ width: 170 }}
                  />
                  <InputNumber
                    value={row.age}
                    onChange={(v) => updateRow(index, { age: typeof v === "number" ? v : undefined })}
                    placeholder="Tuổi"
                    min={0}
                    max={120}
                    style={{ width: 90 }}
                  />
                  <Button danger size="small" onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}>
                    Xoá
                  </Button>
                </Space>
              ))}
            </div>
          )}

          {unmatched.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`Chưa xác định: ${unmatched.map((u) => `[${u.name}]`).join(", ")}`}
              description="Các tag này sẽ không có thông tin giới tính/tuổi — AI có thể đoán sai cách xưng hô."
            />
          )}

          {enabled && castBlock && (
            <details>
              <summary style={{ cursor: "pointer" }}>Xem block sẽ gửi kèm prompt</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>{castBlock}</pre>
            </details>
          )}
        </Space>
      )}
    </Card>
  );
};

export default CastContextPanel;
