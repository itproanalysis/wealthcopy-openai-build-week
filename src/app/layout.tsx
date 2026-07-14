import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WealthCopy | 다음 자산그룹으로 가는 경로",
  description:
    "나와 비슷한 조건의 대표 자산 경로를 비교하고 월간 실행 계획으로 복사하는 교육용 시뮬레이션.",
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
