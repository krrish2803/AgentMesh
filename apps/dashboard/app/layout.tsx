import './globals.css';
import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'AgentMesh SpendGuard | Monad Metropolis',
  description: 'Passkey-secured spending envelope and micropayment settlement for AI agents',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#090a0f] text-slate-100 min-h-screen antialiased selection:bg-monad-500 selection:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
