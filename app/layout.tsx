import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '镜中局 · 综艺互动原型', description: '八人身份抽签与魔镜查验，本地讨论原型' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
