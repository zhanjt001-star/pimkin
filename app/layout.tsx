import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "节点生图工作台",
  description: "节点式图像生成工作流与手机生图界面",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
