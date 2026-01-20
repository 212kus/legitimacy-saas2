"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Role = "NONE" | "DECISION" | "COMMIT" | "CONSENSUS";

type Line = {
  id: string;
  text: string;
  role: Role;
};

type DecisionCheck = {
  decisionLineId: string;
  hasReason: boolean; // 必須
  hasComparison: boolean; // 加点
  hasCounter: boolean; // 加点
  noteReason: string;
  noteComparison: string;
  noteCounter: string;
};

type ChecksMap = Record<string, DecisionCheck>;

const LINES_KEY = "meeting_lines";
const CHECKS_KEY = "meeting_checks_v1";

function getDefaultCheck(decisionLineId: string): DecisionCheck {
  return {
    decisionLineId,
    hasReason: false,
    hasComparison: false,
    hasCounter: false,
    noteReason: "",
    noteComparison: "",
    noteCounter: "",
  };
}

function durabilityLabel(check: DecisionCheck): {
  label: string;
  status: "bad" | "ok" | "good";
} {
  if (!check.hasReason) return { label: "耐久性不足（理由が未接続）", status: "bad" };

  // 加点型（比較は必須にしない）
  if (check.hasCounter && check.hasComparison)
    return { label: "高（理由＋比較＋反論処理）", status: "good" };
  if (check.hasCounter && !check.hasComparison)
    return { label: "中（理由＋反論処理）", status: "ok" };
  if (!check.hasCounter && check.hasComparison)
    return { label: "最低限＋（理由＋比較）", status: "ok" };
  return { label: "最低限（理由のみ）", status: "ok" };
}

export default function DecisionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const decisionId = params?.id ?? "";

  const [lines, setLines] = useState<Line[]>([]);
  const [checks, setChecks] = useState<ChecksMap>({});
  const [loaded, setLoaded] = useState(false);

  // Load lines + checks
  useEffect(() => {
    try {
      const savedLines = localStorage.getItem(LINES_KEY);
      if (savedLines) setLines(JSON.parse(savedLines));
    } catch {
      // ignore
    }

    try {
      const savedChecks = localStorage.getItem(CHECKS_KEY);
      if (savedChecks) setChecks(JSON.parse(savedChecks));
    } catch {
      // ignore
    }

    setLoaded(true);
  }, []);

  // Persist checks
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
    } catch {
      // ignore
    }
  }, [checks, loaded]);

  const decisionIndex = useMemo(() => {
    return lines.findIndex((l) => l.id === decisionId);
  }, [lines, decisionId]);

  const decisionLine = useMemo(() => {
    return lines.find((l) => l.id === decisionId) ?? null;
  }, [lines, decisionId]);

  // 直前5発言
  const contextLines = useMemo(() => {
    if (decisionIndex < 0) return [];
    const start = Math.max(0, decisionIndex - 5);
    return lines.slice(start, decisionIndex);
  }, [lines, decisionIndex]);

  const check = useMemo(() => {
    if (!decisionId) return null;
    return checks[decisionId] ?? getDefaultCheck(decisionId);
  }, [checks, decisionId]);

  const labelInfo = useMemo(() => {
    if (!check) return null;
    return durabilityLabel(check);
  }, [check]);

  const updateCheck = (patch: Partial<DecisionCheck>) => {
    if (!decisionId) return;
    const base = checks[decisionId] ?? getDefaultCheck(decisionId);
    const next: DecisionCheck = { ...base, ...patch, decisionLineId: decisionId };
    setChecks((prev) => ({ ...prev, [decisionId]: next }));
  };

  // Guard: opened non-decision line
  const isDecisionRole = decisionLine?.role === "DECISION";

  // 次のDECISIONへ
  const nextDecisionId = useMemo(() => {
    if (decisionIndex < 0) return null;
    for (let i = decisionIndex + 1; i < lines.length; i++) {
      if (lines[i]?.role === "DECISION") return lines[i].id;
    }
    return null;
  }, [lines, decisionIndex]);

  // おまけ：前のDECISION（戻りも欲しくなりやすいので同梱）
  const prevDecisionId = useMemo(() => {
    if (decisionIndex < 0) return null;
    for (let i = decisionIndex - 1; i >= 0; i--) {
      if (lines[i]?.role === "DECISION") return lines[i].id;
    }
    return null;
  }, [lines, decisionIndex]);

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>DECISION 詳細（耐久性チェック）</h1>

        <button onClick={() => router.push("/")} style={{ padding: "6px 10px" }}>
          ← 一覧へ戻る
        </button>

        <button
          onClick={() => prevDecisionId && router.push(`/decision/${prevDecisionId}`)}
          disabled={!prevDecisionId}
          style={{ padding: "6px 10px" }}
          title={!prevDecisionId ? "前のDECISIONがありません" : ""}
        >
          ← 前のDECISION
        </button>

        <button
          onClick={() => nextDecisionId && router.push(`/decision/${nextDecisionId}`)}
          disabled={!nextDecisionId}
          style={{ padding: "6px 10px" }}
          title={!nextDecisionId ? "次のDECISIONがありません" : ""}
        >
          次のDECISION →
        </button>
      </div>

      {!loaded && <p style={{ color: "#666" }}>読み込み中…</p>}

      {loaded && !decisionLine && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
          <p style={{ margin: 0 }}>
            指定されたIDの発言が見つかりません。先にトップページで行分割とラベル付けをしてください。
          </p>
        </div>
      )}

      {loaded && decisionLine && !isDecisionRole && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #f0c",
            borderRadius: 8,
            background: "#fff5fb",
          }}
        >
          <b>注意：</b>この発言は <code>DECISION</code> としてラベル付けされていません。
          <br />
          一覧ページでこの行を <code>DECISION</code> に変更してから使ってください。
        </div>
      )}

      {loaded && decisionLine && (
        <>
          <section style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
            <div style={{ color: "#666", fontSize: 12 }}>対象DECISION</div>
            <div style={{ fontWeight: 700 }}>
              {decisionLine.id}：{decisionLine.text}
            </div>
          </section>

          <section
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #ddd",
              borderRadius: 10,
              background: "#fafafa",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <b>直前文脈（直前5発言）</b>
              <span style={{ color: "#666", fontSize: 12 }}>
                ※「意味」ではなく、決定に至る接続（理由／比較／反論処理）が記録として残っているかを見る
              </span>
            </div>

            {contextLines.length === 0 ? (
              <p style={{ color: "#666" }}>（直前文脈がありません）</p>
            ) : (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {contextLines.map((l) => (
                  <div
                    key={l.id}
                    style={{ padding: 10, border: "1px solid #eee", borderRadius: 8, background: "white" }}
                  >
                    <div style={{ fontSize: 12, color: "#666" }}>
                      {l.id} / [{l.role}]
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{l.text}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <b>耐久性チェック（加点型）</b>
              {labelInfo && (
                <span
                  style={{
                    fontWeight: 800,
                    color:
                      labelInfo.status === "bad" ? "#c00" : labelInfo.status === "good" ? "#0a7" : "#333",
                  }}
                >
                  {labelInfo.label}
                </span>
              )}
            </div>

            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Reason required */}
              <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="checkbox"
                    checked={!!check?.hasReason}
                    onChange={(e) => updateCheck({ hasReason: e.target.checked })}
                  />
                  <span style={{ fontWeight: 700 }}>理由（必須）</span>
                  {!check?.hasReason && <span style={{ color: "#c00", fontSize: 12 }}>※未接続だと耐久性不足</span>}
                </label>
                <textarea
                  value={check?.noteReason ?? ""}
                  onChange={(e) => updateCheck({ noteReason: e.target.value })}
                  placeholder="補記：理由がどこにある？（発言番号・要約）"
                  style={{ width: "100%", marginTop: 8, minHeight: 70 }}
                />
              </div>

              {/* Comparison bonus */}
              <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="checkbox"
                    checked={!!check?.hasComparison}
                    onChange={(e) => updateCheck({ hasComparison: e.target.checked })}
                  />
                  <span style={{ fontWeight: 700 }}>比較（加点）</span>
                  <span style={{ color: "#666", fontSize: 12 }}>※無い＝ダメではない</span>
                </label>
                <textarea
                  value={check?.noteComparison ?? ""}
                  onChange={(e) => updateCheck({ noteComparison: e.target.value })}
                  placeholder="補記：代替案・比較検討がどこにある？（なければ空でOK）"
                  style={{ width: "100%", marginTop: 8, minHeight: 60 }}
                />
              </div>
              {/* Counter bonus */}
              <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="checkbox"
                    checked={!!check?.hasCounter}
                    onChange={(e) => updateCheck({ hasCounter: e.target.checked })}
                  />
                  <span style={{ fontWeight: 700 }}>反論処理（加点）</span>
                  <span style={{ color: "#666", fontSize: 12 }}>※懸念への扱いが記録されているか</span>
                </label>
                <textarea
                  value={check?.noteCounter ?? ""}
                  onChange={(e) => updateCheck({ noteCounter: e.target.value })}
                  placeholder="補記：異論・懸念がどう扱われた？（なければ空でOK）"
                  style={{ width: "100%", marginTop: 8, minHeight: 60 }}
                />
              </div>

              <div style={{ color: "#666", fontSize: 12 }}>
                ルール：理由は必須。比較・反論処理は加点（比較が無いだけで低評価にしない）。
              </div>
            </div>
          </section>

          <section style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
            <b>実証・データ化のためのメモ</b>
            <ul style={{ margin: "8px 0 0 18px" }}>
              <li>ラベルは「意味」ではなく「その後の作用」で付与する</li>
              <li>迷ったら CONSENSUS に倒す（再現性を優先）</li>
              <li>比較は任意（加点）。単一案深掘り＝即低耐久にはしない</li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}