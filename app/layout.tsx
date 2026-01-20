// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "議論の耐久性チェック（MVP）",
  description: "議論の文字起こしから、決定直前の接続欠落（理由・比較・反論処理）を可視化する試作ツール",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}