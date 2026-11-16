import type { Metadata } from 'next';
import './globals.css';export const metadata: Metadata = { title: '今夜不太平', description: '八人身份抽签与魔镜查验' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
