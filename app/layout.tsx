import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "냥토리 | 고양이 생활기록과 성장앨범",
  description: "고양이의 하루를 기록하고 소중한 성장 순간을 친구와 공유하세요.",
  icons: {
    icon: "/tori-mascot.png",
    shortcut: "/tori-mascot.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
