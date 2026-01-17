"use client";

import "./lp.css";
import { useMemo, useState } from "react";

/* ===== utility ===== */
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const sigmoid01 = (x: number) => 1 / (1 + Math.exp(-x));

type Utter = { speaker: string; text: string };

/* ===== transcript parsing ===== */
function parseTranscript(raw: string): Utter[] {
  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return lines.map((line) => {
    // 例: "Mami: こんにちは"
    const m = line.match(/^([^:：]{1,30})\s*[:：]\s*(.+)$/);
    if (m) {
      return { speaker: m[1].trim(), text: m[2].trim() };
    }
    return { speaker: "UNKNOWN", text: line };
  });
}

/* ===== simple counters ===== */
function countKeywordHits(utts: Utter[], keywords: string[]) {
  let n = 0;
  for (const u of utts) {
    for (const k of keywords) {
      if (u.text.includes(k)) n += 1;
    }
  }
  return n;
}

function countUrlLike(utts: Utter[]) {
  const re = /(https?:\/\/\S+|www\.\S+)/i;
  return utts.reduce((acc, u) => acc + (re.test(u.text) ? 1 : 0), 0);
}

function countNumberLike(utts: Utter[]) {
  const re = /(\d+(\.\d+)?\s?%|\b20\d{2}\b|\b\d{1,3}\b)/;
  return utts.reduce((acc, u) => acc + (re.test(u.text) ? 1 : 0), 0);
}

function computeTopShare(utts: Utter[]) {
  const counts: Record<string, number> = {};
  for (const u of utts) {
    counts[u.speaker] = (counts[u.speaker] ?? 0) + 1;
  }
  const speakers = Object.keys(counts).filter((s) => s !== "UNKNOWN");
  const total = utts.length;
  const max = Math.max(...Object.values(counts));
  const topShare = total > 0 ? max / total : 0;
  return { counts, speakersCount: speakers.length, topShare };
}

/* ===== scoring (4 axes) ===== */
function score4({
  participants,
  topSharePct,
  sources,
  options,
  dissent,
  changes,
  reasonLen,
}: {
  participants: number;
  topSharePct: number; // 0-100
  sources: number;
  options: number;
  dissent: number;
  changes: number;
  reasonLen: number;
}) {
  // Participation
  const fairTop = clamp01(1 - (topSharePct - 25) / 50);
  const nOk = sigmoid01((participants - 3) / 2);
  const P = Math.round(100 * (0.85 * fairTop + 0.15 * nOk));

  // Information
  const I = Math.round(100 * sigmoid01((sources - 1) / 1.2));

  // Deliberation
  const opt = sigmoid01((options - 2) / 1.0);
  const dis = sigmoid01((dissent - 0.5) / 1.0);
  const D = Math.round(100 * (0.6 * opt + 0.4 * dis));

  // Transparency
  const chg = sigmoid01((changes - 1) / 1.5);
  const rsn = sigmoid01((reasonLen - 120) / 60);
  const T = Math.round(100 * (0.5 * chg + 0.5 * rsn));

  // Total (equal weight, geometric mean)
  const p = clamp01(P / 100);
  const i = clamp01(I / 100);
  const d = clamp01(D / 100);
  const t = clamp01(T / 100);
  const Total = Math.round(100 * Math.pow(p * i * d * t, 1 / 4));

  return { P, I, D, T, Total };
}

/* ===== page ===== */
export default function Home() {
  const [raw, setRaw] = useState<string>(
    `Mami: A案がいいと思う
Terumasa: 反対。コストが高い
Mami: じゃあB案はどう？
Terumasa: それなら賛成。根拠として去年のデータがある`
  );

  const analysis = useMemo(() => {
    const utts = parseTranscript(raw);

    // Participation
    const { counts, speakersCount, topShare } = computeTopShare(utts);
    const topSharePct = Math.round(topShare * 100);

    // Information
    const infoKeywords = ["根拠", "データ", "統計", "資料", "出典", "論文", "研究", "URL", "参考"];
    const sourcesLike =
      countUrlLike(utts) +
      countKeywordHits(utts, infoKeywords) +
      countNumberLike(utts);

    // Deliberation
    const dissentKeywords = ["反対", "懸念", "リスク", "問題", "難しい", "微妙", "怖い", "無理"];
    const altKeywords = ["代替", "別案", "もう一つ", "他の案", "プランB", "B案", "C案"];
    const dissentLike = countKeywordHits(utts, dissentKeywords);
    const altLike = countKeywordHits(utts, altKeywords);

    // Options (rough estimate)
    const optionPattern = /\b[ABC]案\b/;
    const optionMentions = utts.reduce(
      (acc, u) => acc + (optionPattern.test(u.text) ? 1 : 0),
      0
    );
    const options = Math.max(1, Math.min(5, Math.round((optionMentions + altLike) / 2)));

    // Transparency
    const changeKeywords = ["修正", "訂正", "変更", "やっぱ", "撤回", "更新"];
    const changesLike = countKeywordHits(utts, changeKeywords);

    const reasonKeywords = ["理由", "だから", "なので", "根拠", "結論"];
    const reasonLike = utts
      .filter((u) => reasonKeywords.some((k) => u.text.includes(k)))
      .map((u) => u.text)
      .join(" ");
    const reasonLen = reasonLike.length;

    const participants = speakersCount > 0 ? speakersCount : 1;

    const scores = score4({
      participants,
      topSharePct,
      sources: sourcesLike,
      options,
      dissent: dissentLike,
      changes: changesLike,
      reasonLen,
    });

    const notes: string[] = [];
    if (speakersCount === 0)
      notes.push("話者ラベルがないため、参加の精度が下がります（推奨：名前: 発言）。");
    if (sourcesLike === 0)
      notes.push("根拠らしい記述が検出されませんでした。");
    if (dissentLike === 0)
      notes.push("反対/懸念の記述が少ないため、検討が不足している可能性があります。");

    return {
      uttsCount: utts.length,
      speakersCount,
      topSharePct,
      counts,
      sourcesLike,
      dissentLike,
      options,
      changesLike,
      reasonLen,
      scores,
      notes,
    };
  }, [raw]);

  return (
    <main style={{ padding: 32, maxWidth: 980, margin: "0 auto" }}>
      <h1>Zoom文字起こし → 自動解析（4軸）</h1>
      <p style={{ color: "#666" }}>
        文字起こし（話者付き推奨）を貼ると、合意プロセスの正当性スコアを自動算出します。
      </p>

      <div className="demoCard">
        <h3>文字起こしを貼り付け</h3>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid #ddd",
            padding: 12,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        />
        <p style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
          推奨形式：<code>名前: 発言</code>（1行=1発言）
        </p>
      </div>

      <div className="demoCard" style={{ marginTop: 16 }}>
        <h3>抽出されたメトリクス</h3>
        <ul style={{ color: "#666", lineHeight: 1.9 }}>
          <li>発言数：{analysis.uttsCount}</li>
          <li>話者数：{analysis.speakersCount}</li>
          <li>最多発言者比率：{analysis.topSharePct}%</li>
          <li>根拠らしさ（検出数）：{analysis.sourcesLike}</li>
          <li>反対/懸念（検出数）：{analysis.dissentLike}</li>
          <li>選択肢（推定）：{analysis.options}</li>
          <li>修正/変更（検出数）：{analysis.changesLike}</li>
          <li>理由文の文字数（検出）：{analysis.reasonLen}</li>
        </ul>

        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer" }}>話者ごとの発言数（デバッグ）</summary>
          <pre style={{ marginTop: 10, whiteSpace: "pre-wrap", color: "#666" }}>
            {JSON.stringify(analysis.counts, null, 2)}
          </pre>
        </details>

        {analysis.notes.length > 0 && (
          <div style={{ marginTop: 12, color: "#a35" }}>
            {analysis.notes.map((n, i) => (
              <div key={i}>※ {n}</div>
            ))}
          </div>
        )}
      </div>

      <div className="demoCard" style={{ marginTop: 16 }}>
        <h3>結果（4軸 + 総合）</h3>
        <p style={{ fontSize: 34, fontWeight: 800 }}>
          {analysis.scores.Total}{" "}
          <span style={{ fontSize: 14, color: "#666" }}>/100</span>
        </p>
        <ul style={{ color: "#666", lineHeight: 1.9 }}>
          <li>参加：{analysis.scores.P}</li>
          <li>情報：{analysis.scores.I}</li>
          <li>検討：{analysis.scores.D}</li>
          <li>透明：{analysis.scores.T}</li>
        </ul>
        <p style={{ color: "#666" }}>
          ※4軸は等分（幾何平均）で統合。どれかが低いと総合も下がります。
        </p>
      </div>
    </main>
  );
}