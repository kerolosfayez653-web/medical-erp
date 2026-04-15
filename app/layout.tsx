import type { Metadata } from 'next';
import './globals.css';
import LayoutWrapper from './LayoutWrapper';
import { Providers } from './Providers';

export const metadata: Metadata = {
  title: '24MED - نظام إدارة المستلزمات الطبية',
  description: 'نظام متكامل لإدارة المخازن والمبيعات للشركات الطبية',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <Providers>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}
