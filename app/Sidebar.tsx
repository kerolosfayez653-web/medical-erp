"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname() || '/';

  const menuItems = [
    { path: '/', label: '🏠 لوحة التحكم والملخص' },
    { path: '/invoices', label: '🧾 سجل الفواتير' },
    { path: '/payments', label: '💰 التحصيلات والسندات' },
    { path: '/transfers', label: '🔄 التحويلات الداخلية' },
    { path: '/inventory', label: '📦 المستودع والجرد' },
    { path: '/sales', label: '💚 فاتورة مبيعات جديدة' },
    { path: '/quotations', label: '📝 عرض سعر جديد' },
    { path: '/quotations/list', label: '📋 سجل عروض الأسعار' },
    { path: '/purchases', label: '📥 فاتورة مشتريات جديدة' },
    { path: '/people', label: '👥 دليل العملاء والموردين' },
    { path: '/expenses', label: '💰 المصروفات' },
    { path: '/reports', label: '📊 القوائم المالية والتقارير' },
    { path: '/import', label: '⬆️ استيراد البيانات' },
    { path: '/trash', label: '🗑️ سلة المهملات' },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
        <img src="/logo.png" alt="24Med Logo" style={{ maxWidth: '180px', height: 'auto' }} />
        <button 
          onClick={onClose}
          className="mobile-only"
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-secondary)', 
            fontSize: '1.5rem', 
            cursor: 'pointer' 
          }}
        >
          ✕
        </button>
      </div>
      
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '100px' }}>
        {menuItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          return (
            <Link 
              key={item.path} 
              href={item.path} 
              onClick={onClose}
              className={`btn ${isActive ? 'btn-primary' : ''}`}
              style={{ 
                justifyContent: 'flex-start',
                background: isActive ? 'linear-gradient(135deg, var(--accent-color), #059669)' : 'rgba(255,255,255,0.02)',
                color: isActive ? '#fff' : 'var(--text-primary)',
                border: '1px solid ' + (isActive ? 'transparent' : 'rgba(16, 185, 129, 0.05)'),
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                padding: '14px 20px'
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <style jsx>{`
        @media (min-width: 1025px) {
          .mobile-only { display: none !important; }
        }
      `}</style>
    </aside>
  );
}
