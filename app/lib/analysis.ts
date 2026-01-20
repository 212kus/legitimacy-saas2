// app/lib/analysis.ts
// 議論の耐久性チェック（MVP）
// - 入力：議論の文字起こし（行ごと）
// - 出力：発言の役割（自動仮分類）＋ DECISION を起点にした飛躍イベント（接続欠落）
// ※ 正誤評価や改善強制はしない（欠落の可視化のみ）
//
// 企画書の設計思想に沿う（事後分析・機能ベース分類・飛躍イベント）  [oai_citation:1‡ゼミ 最終企画書.docx](sediment://file_0000000046d471fa904132e25b995706)

export type Role = "DECISION" | "COMMIT" | "CONSENSUS" | "NONE";
export type Link = "REASON" | "COMPARE" | "OBJECTION";

export type AnalyzedLine = {
  id: string;       // "L1"
  index: number;    // 0-based
  raw: string;      // 元の1行
  speaker?: string; // "A" 等（任意）
  text: string;     // 発言本文（話者ラベル除去後）
  role: Role;       // 自動仮分類
  links: Link[];    // 理由/比較/反論 の“明示”
};

export type JumpEvent = {
  decisionIndex: number; // DECISION行（0-based）
  decisionId: string;    // "Lx"
  decisionText: string;  // DECISION本文（話者除去後）
  missing: Link[];       // 直前文脈に見えない接続
  context: { id: string; index: number; text: string }[]; // 直前window行
};

// ----------------------
// 1) 文字起こしの軽い整形
// ----------------------

export function normalizeRawInput(input: string): string[] {
  // 改行で分割し、空行を除去
  return input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function parseSpeaker(line: string): { speaker?: string; text: string } {
  // 例: "A: ～～" / "A：～～" / "田中: ～～"
  // コロンが無い場合は speaker なしで本文扱い
  const m = line.match(/^\s*([^:：]{1,12})\s*[:：]\s*(.+)$/);
  if (!m) return { text: line.trim() };
  return { speaker: m[1].trim(), text: m[2].trim() };
}

// ----------------------
// 2) 役割分類（自動仮分類）
//  - 表現一致ではなく機能っぽさを拾う（MVP用の軽量ルール）
//  - 将来ここをAI/モデルに差し替えられる
// ----------------------

export function inferRole(text: string): Role {
  const t = text.trim();

  // DECISION：選択肢を一つに確定し、その後の前提になる言い方
  if (
    /(決める|決定|採用|採択|結論|これでいく|これで行く|でいく|で行く|にする|で進める|で確定)/.test(t)
  ) {
    return "DECISION";
  }

  // COMMIT：確定はしないが、次の検討/行動の方向性を示す
  if (
    /(一旦|次は|検討|持ち帰り|やってみる|試す|確認する|詰める|方向性|進め方|次回|宿題)/.test(t)
  ) {
    return "COMMIT";
  }

  // CONSENSUS：同意・同調（決定確定ではない）
  if (
    /(賛成|OK|了解|同意|異論ない|それでいい|そうだね|いいと思う|たしかに|同感)/.test(t)
  ) {
    return "CONSENSUS";
  }

  return "NONE";
}

// ----------------------
// 3) 接続要素（理由・比較・反論処理）の“明示”検出
//  - 「存在したか」ではなく「文字情報として接続されているか」の材料を拾う
// ----------------------

export function detectLinks(text: string): Link[] {
  const t = text.trim();
  const links: Link[] = [];

  // 理由（Reason）
  if (/(だから|なので|理由|なぜなら|ため|根拠|ゆえに|背景は)/.test(t)) {
    links.push("REASON");
  }

  // 比較（Compare）
  // 短期/長期、メリデメ、AよりB、他案 などの比較的痕跡も拾う
  if (/(一方|他方|比較|より|代わりに|メリット|デメリット|短期|長期|他の案|別案)/.test(t)) {
    links.push("COMPARE");
  }

  // 反論・懸念（Objection / Concern）
  if (/(でも|しかし|懸念|リスク|反対|問題|不安|下がらない|微妙|難しい|デメリットは)/.test(t)) {
    links.push("OBJECTION");
  }

  return links;
}

// ----------------------
// 4) 行を分析単位に変換
// ----------------------

export function analyzeLines(rawLines: string[]): AnalyzedLine[] {
  const cleaned = rawLines
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return cleaned.map((raw, index) => {
    const { speaker, text } = parseSpeaker(raw);
    const role = inferRole(text);
    const links = detectLinks(text);

    return {
      id: `L${index + 1}`,
      index,
      raw,
      speaker,
      text,
      role,
      links,
    };
  });
}

// ----------------------
// 5) 飛躍イベント（A：DECISIONのみを起点）
//  - 直前の文脈window内に、理由/比較/反論の接続が見えないものを「欠落」として可視化
//  - 断言しない（“記録上確認できない”）ための材料を返す
// ----------------------

export function buildJumpEvents(
  analyzed: AnalyzedLine[],
  windowSize = 3
): JumpEvent[] {
  const events: JumpEvent[] = [];

  for (let i = 0; i < analyzed.length; i++) {
    const cur = analyzed[i];
    if (cur.role !== "DECISION") continue; // A案：DECISIONのみ

    const start = Math.max(0, i - windowSize);
    const ctx = analyzed.slice(start, i);

    const ctxLinks = ctx.flatMap((l) => l.links);

    const missing: Link[] = [];
    if (!ctxLinks.includes("REASON")) missing.push("REASON");
    if (!ctxLinks.includes("COMPARE")) missing.push("COMPARE");
    if (!ctxLinks.includes("OBJECTION")) missing.push("OBJECTION");

    if (missing.length > 0) {
      events.push({
        decisionIndex: cur.index,
        decisionId: cur.id,
        decisionText: cur.text,
        missing,
        context: ctx.map((l) => ({ id: l.id, index: l.index, text: l.text })),
      });
    }
  }

  return events;
}

// ----------------------
// 6) 便利関数：一括解析（page.tsxから呼びやすい）
// ----------------------

export function analyzeTranscript(input: string, windowSize = 3): {
  analyzed: AnalyzedLine[];
  events: JumpEvent[];
} {
  const rawLines = normalizeRawInput(input);
  const analyzed = analyzeLines(rawLines);
  const events = buildJumpEvents(analyzed, windowSize);
  return { analyzed, events };
}