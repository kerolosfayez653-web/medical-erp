"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const isPublicPage = pathname.startsWith('/pay') || pathname.endsWith('/print');

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <div className="app-container">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Area */}
      <main>
        <header className="glass-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Mobile Menu Toggle */}
            <button 
              className="no-print"
              onClick={() => setIsSidebarOpen(true)}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'var(--text-primary)', 
                fontSize: '1.5rem', 
                cursor: 'pointer',
                display: 'block', // Overridden by media query
              }}
            >
              ☰
            </button>
            <h3 className="gradient-text" style={{ margin: 0 }}>24MED</h3>
          </div>
          
          <div style={{ display: 'none' }} className="desktop-only text-secondary">
             اليوم: {new Date().toLocaleDateString('ar-EG')}
          </div>
        </header>
        
        <div className="main-content">
          {children}
        </div>
      </main>

      <style jsx>{`
        @media (min-width: 769px) {
          button { display: none !important; }
          .desktop-only { display: block !important; }
        }
      `}</style>
    </div>
  );
}
