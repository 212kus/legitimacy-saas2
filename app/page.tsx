"use client";

import { useEffect, useState } from "react";

type Role = "NONE" | "DECISION" | "COMMIT" | "CONSENSUS";

type Line = {
  id: string;
  text: string;
  role: Role;
};

const ROLE_OPTIONS: Role[] = ["NONE", "DECISION", "COMMIT", "CONSENSUS"];

export default function HomePage() {
  const [rawText, setRawText] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  // ---- load from localStorage ----
  useEffect(() => {
    const saved = localStorage.getItem("meeting_lines");
    if (saved) {
      setLines(JSON.parse(saved));
    }
  }, []);

  // ---- save to localStorage ----
  useEffect(() => {
    localStorage.setItem("meeting_lines", JSON.stringify(lines));
  }, [lines]);

  const splitLines = () => {
    const splitted = rawText
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t, i) => ({
        id: String(i),
        text: t,
        role: "NONE" as Role,
      }));
    setLines(splitted);
  };

  const updateRole = (id: string, role: Role) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, role } : l))
    );
  };

  const getRoleHelp = (role: Role) => {
    switch (role) {
      case "DECISION":
        return "この発言以降、選択肢に戻らず前提が固定された";
      case "COMMIT":
        return "次の行動・検討・作業が指定された";
      case "CONSENSUS":
        return "同意はあるが、前提も行動も更新されていない";
      default:
        return "未分類（迷ったら CONSENSUS）";
    }
  };

  return (
    <main style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      <h1>議論の耐久性チェック（MVP）</h1>

      <section style={{ marginBottom: "24px" }}>
        <h2>① 文字起こし入力（1会議＝1テキスト）</h2>
        <textarea
          style={{ width: "100%", height: "160px" }}
          placeholder="ここに議論の文字起こしを貼り付けてください（1行＝1発言）"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
        <button onClick={splitLines} style={{ marginTop: "8px" }}>
          行に分割
        </button>
      </section>

      <section>
        <h2>② 発言一覧（作用で分類）</h2>

        {lines.length === 0 && <p>まだ発言がありません。</p>}

        {lines.map((line, index) => (
          <div
            key={line.id}
            style={{
              border: "1px solid #ccc",
              padding: "8px",
              marginBottom: "8px",
              borderRadius: "4px",
            }}
          >
            <div style={{ fontSize: "12px", color: "#666" }}>
              発言 {index + 1}
            </div>

            <div style={{ marginBottom: "6px" }}>{line.text}</div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select
                value={line.role}
                onChange={(e) =>
                  updateRole(line.id, e.target.value as Role)
                }
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <span style={{ fontSize: "12px", color: "#555" }}>
                {getRoleHelp(line.role)}
              </span>
            </div>

            {line.role === "DECISION" && (
              <div style={{ marginTop: "6px" }}>
                <a href={`/decision/${line.id}`}>→ 耐久性を確認する</a>
              </div>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}