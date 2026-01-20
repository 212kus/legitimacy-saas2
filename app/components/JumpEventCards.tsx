"use client";

type Missing = "REASON" | "COMPARE" | "OBJECTION";

export type JumpEvent = {
  decisionIndex: number;          // 0-based
  decisionText: string;
  missing: Missing[];
  context: { index: number; text: string }[]; // decision直前の発言
};

function label(m: Missing) {
  if (m === "REASON") return "理由";
  if (m === "COMPARE") return "比較";
  return "反論処理";
}

function badgeText(m: Missing) {
  return `欠落: ${label(m)}`;
}

export default function JumpEventCards({ events }: { events: JumpEvent[] }) {
  if (!events.length) {
    return (
      <div style={{ padding: 12, border: "1px solid #e5e5e5", borderRadius: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>飛躍イベント</div>
        <div style={{ opacity: 0.8 }}>検出されませんでした。</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 18 }}>飛躍イベント（検出）</div>

      {events.map((ev, i) => (
        <div
          key={`${ev.decisionIndex}-${i}`}
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 14,
            padding: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 800 }}>
              DECISION（行 {ev.decisionIndex + 1}）
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ev.missing.map((m) => (
                <span
                  key={m}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {badgeText(m)}
                </span>
              ))}
            </div>
          </div>

          <div style={{ padding: 10, borderRadius: 10, border: "1px dashed #ddd" }}>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>起点となった発言</div>
            <div style={{ whiteSpace: "pre-wrap", fontWeight: 700 }}>{ev.decisionText}</div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              直前の文脈（参考：直前の発言）
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {ev.context.length === 0 ? (
                <div style={{ opacity: 0.8 }}>直前の発言がありません。</div>
              ) : (
                ev.context.map((c) => (
                  <div
                    key={c.index}
                    style={{ padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.03)" }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                      行 {c.index + 1}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{c.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ fontSize: 12, opacity: 0.8 }}>
            ※ 実際に行われていないという意味ではありません。記録として「理由 / 比較 / 反論処理」が
            決定と接続されているかをご確認ください。
          </div>
        </div>
      ))}
    </div>
  );
}