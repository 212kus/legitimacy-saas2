"use client";

import React, { useMemo, useState } from "react";
import JumpEventCards from "./components/JumpEventCards";
import {
  analyzeLines,
  buildJumpEvents,
  normalizeRawInput,
  type AnalyzedLine,
  type Role,
} from "./lib/analysis";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "DECISION", label: "DECISION（決定）" },
  { value: "COMMIT", label: "COMMIT（方向づけ）" },
  { value: "CONSENSUS", label: "CONSENSUS（同意）" },
  { value: "NONE", label: "NONE（未分類）" },
];

function roleLabel(role: Role) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

export default function Page() {
  const [rawText, setRawText] = useState<string>(
    `A：この案、正直コスト的にはかなり楽だと思う。
B：でも、その分クオリティ下がらない？
A：最低限は保てると思うけど、期待値は下がるかも。
C：短期的にはアリだけど、長期で見ると微妙だね。
B：今回は短期勝負だから、割り切るのも一つか。
A：じゃあ今回はこの案で進めよう（決める）。`
  );

  // 直前に見る発言数（飛躍判定のウィンドウ）
  const [windowSize, setWindowSize] = useState<number>(3);

  // 手修正（上書き）: key = analyzedLine.id ("L1" etc), value = Role
  const [roleOverrides, setRoleOverrides] = useState<Record<string, Role>>({});

  // 文字起こし → 行配列
  const lines = useMemo(() => normalizeRawInput(rawText), [rawText]);

  // 自動解析（役割・リンク）
  const analyzedAuto = useMemo(() => analyzeLines(lines), [lines]);

  // 上書きを反映した解析結果（表示・飛躍検出に使う）
  const analyzed = useMemo<AnalyzedLine[]>(() => {
    if (!analyzedAuto.length) return analyzedAuto;
    return analyzedAuto.map((l) => {
      const overridden = roleOverrides[l.id];
      if (!overridden) return l;
      return { ...l, role: overridden };
    });
  }, [analyzedAuto, roleOverrides]);

  // 飛躍イベント（A案：DECISIONのみ起点）
  const events = useMemo(() => buildJumpEvents(analyzed, windowSize), [analyzed, windowSize]);

  const onChangeRole = (lineId: string, newRole: Role) => {
    setRoleOverrides((prev) => ({ ...prev, [lineId]: newRole }));
  };

  const clearOverrides = () => setRoleOverrides({});

  const containerStyle: React.CSSProperties = {
    maxWidth: 980,
    margin: "0 auto",
    padding: "24px 16px 80px",
    display: "grid",
    gap: 18,
  };

  const panelStyle: React.CSSProperties = {
    border: "1px solid #e5e5e5",
    borderRadius: 14,
    padding: 14,
    display: "grid",
    gap: 10,
  };

  const h1Style: React.CSSProperties = { fontSize: 22, fontWeight: 900, margin: 0 };
  const subStyle: React.CSSProperties = { opacity: 0.8, margin: 0, lineHeight: 1.6 };

  return (
    <main style={containerStyle}>
      <header style={{ display: "grid", gap: 8 }}>
        <h1 style={h1Style}>議論の耐久性チェック（MVP）</h1>
        <p style={subStyle}>
          文字起こしを貼り付けると、発言を自動で仮分類し、DECISION（決定）直前の文脈に
          「理由／比較／反論処理」が記録上接続されているかを点検します。
          <br />
          ※ 正誤判定はしません。欠落がある“可能性”を可視化し、確認を促すツールです。
        </p>
      </header>

      {/* 入力 */}
      <section style={panelStyle}>
        <div style={{ fontWeight: 800 }}>① 議論の文字起こし</div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={10}
          placeholder={`ここに議論の文字起こしを貼り付けてください。\n例：\nA：この案のメリットは…\nB：ただしリスクが…`}
          style={{
            width: "100%",
            resize: "vertical",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 700 }}>判定ウィンドウ（直前発言数）</span>
            <input
              type="number"
              min={1}
              max={10}
              value={windowSize}
              onChange={(e) => setWindowSize(Math.max(1, Math.min(10, Number(e.target.value) || 3)))}
              style={{
                width: 72,
                padding: "6px 8px",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />
          </label>

          <button
            onClick={clearOverrides}
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "transparent",
              fontWeight: 800,
              cursor: "pointer",
            }}
            title="手修正した分類をすべてリセットします"
          >
            分類の手修正をリセット
          </button>

          <div style={{ opacity: 0.75, fontSize: 12 }}>
            ※ 分類は自動です。必要な場合のみ修正してください。
          </div>
        </div>
      </section>

      {/* 飛躍イベント（カード） */}
      <section style={panelStyle}>
        <JumpEventCards events={events} />
      </section>

      {/* 発言一覧 */}
      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800 }}>② 発言一覧（自動分類・調整可）</div>
            <div style={{ opacity: 0.75, fontSize: 12 }}>
              ※ ここは“入力の後処理”ではなく、分析結果の確認・微調整用です。
            </div>
          </div>

          <div style={{ opacity: 0.8, fontSize: 12 }}>
            行数：<b>{analyzed.length}</b>
          </div>
        </div>

        {analyzed.length === 0 ? (
          <div style={{ opacity: 0.8 }}>まだ入力がありません。</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {analyzed.map((l) => (
              <div
                key={l.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 14,
                  padding: 12,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{l.id}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>行 {l.index + 1}</div>
                    {l.speaker ? (
                      <span
                        style={{
                          border: "1px solid #ddd",
                          borderRadius: 999,
                          padding: "4px 10px",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {l.speaker}
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>分類</span>
                    <select
                      value={l.role}
                      onChange={(e) => onChangeRole(l.id, e.target.value as Role)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 12,
                        border: "1px solid #ddd",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{l.text}</div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>検出リンク：</span>
                  {l.links.length === 0 ? (
                    <span style={{ fontSize: 12, opacity: 0.75 }}>（なし）</span>
                  ) : (
                    l.links.map((k) => (
                      <span
                        key={k}
                        style={{
                          border: "1px solid #ddd",
                          borderRadius: 999,
                          padding: "4px 10px",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {k === "REASON" ? "理由" : k === "COMPARE" ? "比較" : "反論"}
                      </span>
                    ))
                  )}
                </div>

                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  自動分類：{roleLabel(analyzedAuto[l.index]?.role ?? "NONE")}
                  {roleOverrides[l.id] ? "（手修正あり）" : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}