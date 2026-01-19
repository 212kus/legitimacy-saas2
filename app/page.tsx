"use client";

import { useMemo, useState } from "react";

type Utter = { speaker: string; text: string };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const sig = (x: number) => 1 / (1 + Math.exp(-x));

const RE_URL = /(https?:\/\/\S+|www\.\S+)/i;
const RE_NUM = /(\d+(\.\d+)?\s?%|\b20\d{2}\b|\b\d{1,3}\b)/;

const KW_INFO = ["根拠", "データ", "統計", "資料", "出典", "論文", "研究", "URL", "参考"];
const KW_DISSENT = ["反対", "懸念", "リスク", "問題", "難しい", "微妙", "怖い", "無理"];
const KW_ALT = ["代替", "別案", "もう一つ", "他の案", "プランB", "B案", "C案"];
const KW_CHANGE = ["修正", "訂正", "変更", "やっぱ", "撤回", "更新"];
const KW_REASON = ["理由", "だから", "なので", "根拠", "結論", "データ"];

function parseTranscript(raw: string): Utter[] {
  return raw
    .replaceAll("：", ":")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([^:]{1,30})\s*:\s*(.+)$/);
      return m ? { speaker: m[1].trim(), text: m[2].trim() } : { speaker: "UNKNOWN", text: line };
    });
}

function stats(utts: Utter[]) {
  const counts: Record<string, number> = {};
  for (const u of utts) counts[u.speaker] = (counts[u.speaker] ?? 0) + 1;

  const speakers = Object.keys(counts).filter((s) => s !== "UNKNOWN");
  const totalUtter = utts.length || 1;

  const autoFac =
    Object.entries(counts)
      .filter(([s]) => s !== "UNKNOWN")
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { counts, speakers, speakersCount: speakers.length, totalUtter, autoFac };
}

function countLike(utts: Utter[], kws: string[]) {
  let n = 0;
  for (const u of utts) for (const k of kws) if (u.text.includes(k)) n++;
  return n;
}

function participationExclFac(counts: Record<string, number>, totalUtter: number, fac: string | null) {
  const all = Object.keys(counts).filter((s) => s !== "UNKNOWN");
  const facCount = fac ? (counts[fac] ?? 0) : 0;
  const nonFacTotal = Math.max(1, totalUtter - facCount);

  const nonFacCounts = all.filter((s) => s !== fac).map((s) => counts[s] ?? 0);
  const nonFacMax = nonFacCounts.length ? Math.max(...nonFacCounts) : 0;

  const nonFacSpeakers = fac ? Math.max(0, all.length - 1) : all.length;
  const nonFacWithVoice = all.filter((s) => s !== fac && (counts[s] ?? 0) > 0).length;

  return {
    nonFacTopSharePct: Math.round((nonFacMax / nonFacTotal) * 100),
    voiceRate: nonFacSpeakers > 0 ? nonFacWithVoice / nonFacSpeakers : 0,
  };
}

function scoreConsistency4(args: {
  participants: number;
  nonFacTopSharePct: number;
  voiceRate: number;
  sources: number;
  options: number;
  dissent: number;
  changes: number;
  reasonLen: number;
}) {
  const { participants, nonFacTopSharePct, voiceRate, sources, options, dissent, changes, reasonLen } = args;

  const P = Math.round(
    100 *
      (0.55 * clamp01(1 - (nonFacTopSharePct - 45) / 40) +
        0.3 * clamp01((voiceRate - 0.5) / 0.5) +
        0.15 * sig((participants - 3) / 2))
  );
  const I = Math.round(100 * sig((sources - 1) / 1.2));
  const D = Math.round(100 * (0.6 * sig((options - 2) / 1) + 0.4 * sig((dissent - 0.5) / 1)));
  const T = Math.round(100 * (0.5 * sig((changes - 1) / 1.5) + 0.5 * sig((reasonLen - 60) / 60)));

  return { P, I, D, T, Total: Math.round((P + I + D + T) / 4) };
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="demoCard" style={{ marginTop: 16 }}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

const SAMPLE_PLANNING = `参加者A: 今日は企画の方向性と役割分担を決めたいです
参加者B: ターゲットの利用シーンをもう少し具体化したいです
参加者C: KPIなど数値目標を仮置きして動きやすくしたいです
参加者D: デザインはシンプル案と遊び案で2案出せます
参加者A: じゃあ次回までに各自案を持ち寄って、そこで決定しましょう`;

export default function Page() {
  const [raw, setRaw] = useState(SAMPLE_PLANNING);
  const [facSel, setFacSel] = useState<string>("AUTO");

  const a = useMemo(() => {
    const utts = parseTranscript(raw);
    const { counts, speakers, speakersCount, totalUtter, autoFac } = stats(utts);

    const facilitator = facSel === "NONE" ? null : facSel === "AUTO" ? autoFac : facSel;

    const sourcesLike =
      countLike(utts, KW_INFO) +
      utts.filter((u) => RE_URL.test(u.text)).length +
      utts.filter((u) => RE_NUM.test(u.text)).length;

    const dissentLike = countLike(utts, KW_DISSENT);
    const altLike = countLike(utts, KW_ALT);
    const optionMentions = utts.reduce((acc, u) => acc + (/\b[ABC]案\b/.test(u.text) ? 1 : 0), 0);
    const options = Math.max(0, Math.min(5, Math.round((optionMentions + altLike) / 2)));

    const changesLike = countLike(utts, KW_CHANGE);

    const reasonText = utts
      .filter((u) => KW_REASON.some((k) => u.text.includes(k)))
      .map((u) => u.text)
      .join(" ");
    const tailN = Math.max(1, Math.floor(utts.length * 0.3));
    const reasonLen = (reasonText + " " + utts.slice(-tailN).map((u) => u.text).join(" ")).trim().length;

    const part = participationExclFac(counts, totalUtter, facilitator);

    const norm = scoreConsistency4({
      participants: speakersCount || 1,
      nonFacTopSharePct: part.nonFacTopSharePct,
      voiceRate: part.voiceRate,
      sources: sourcesLike,
      options,
      dissent: dissentLike,
      changes: changesLike,
      reasonLen,
    });

    return { speakers, speakersCount, totalUtter, autoFac, norm, part };
  }, [raw, facSel]);

  const radarStyle = {
    ["--p" as any]: a.norm.P / 100,
    ["--i" as any]: a.norm.I / 100,
    ["--d" as any]: a.norm.D / 100,
    ["--t" as any]: a.norm.T / 100,
  } as React.CSSProperties;

  return (
    <main style={{ padding: 28, maxWidth: 1020, margin: "0 auto" }}>
      <h1>議論の正当性スコア</h1>

      <div className="demoCard" style={{ marginTop: 16 }}>
        <h3>文字起こし</h3>
        <textarea
          rows={10}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          style={{ marginTop: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
        />
      </div>

      <Card title="司会（ファシリ）">
        <select value={facSel} onChange={(e) => setFacSel(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}>
          <option value="AUTO">自動（発言数最大を司会）</option>
          <option value="NONE">司会なし</option>
          {a.speakers.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Card>

      <Card title="整合性モデル（4軸）">
        <div className="radarWrap" style={radarStyle}>
          <div className="radar">
            <div className="radarFill" />
            <div className="radarOutline" />
            <div className="radarLabel top">P</div>
            <div className="radarLabel right">I</div>
            <div className="radarLabel bottom">T</div>
            <div className="radarLabel left">D</div>
          </div>

          <div className="radarLegend">
            <div className="legendItem">
              <div className="k"><span>P：発言バランス</span><span className="uiMuted">/100</span></div>
              <div className="v">{a.norm.P}</div>
              <div className="s">非司会トップ占有 {a.part.nonFacTopSharePct}% / 参加率 {Math.round(a.part.voiceRate * 100)}%</div>
            </div>
            <div className="legendItem">
              <div className="k"><span>I：情報根拠</span><span className="uiMuted">/100</span></div>
              <div className="v">{a.norm.I}</div>
              <div className="s">根拠・URL・数値など（推定）</div>
            </div>
            <div className="legendItem">
              <div className="k"><span>D：検討の幅</span><span className="uiMuted">/100</span></div>
              <div className="v">{a.norm.D}</div>
              <div className="s">別案・異論の存在（推定）</div>
            </div>
            <div className="legendItem">
              <div className="k"><span>T：透明性</span><span className="uiMuted">/100</span></div>
              <div className="v">{a.norm.T}</div>
              <div className="s">理由・変更の痕跡（推定）</div>
            </div>
          </div>
        </div>
      </Card>
    </main>
  );
}