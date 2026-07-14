import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WealthCopy | 분석보다 행동",
  description:
    "다음 자산 단계와 이번 달에 완료할 세 가지 행동만 보여주는 교육용 자산관리 실행 서비스.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
