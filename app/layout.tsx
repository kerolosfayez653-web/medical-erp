import type { Metadata } from 'next';
import './globals.css';
import LayoutWrapper from './LayoutWrapper';

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
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </body>
    </html>
  );
}
