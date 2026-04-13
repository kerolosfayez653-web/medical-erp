"use client";
import { useState, useEffect } from 'react';

interface TrashItem {
  id: number;
  trashType: 'INVOICE' | 'PAYMENT';
  type?: string; 
  amount?: number;
  totalAmount?: number;
  invoiceNumber?: string;
  person?: { name: string };
  deletedAt: string;
  date: string;
}

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrash = () => {
    setLoading(true);
    fetch('/api/trash')
      .then(r => r.json())
      .then(d => { if (d.success) setItems(d.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTrash(); }, []);

  const handleRestore = async (id: number, type: string) => {
    if (!confirm('هل أنت متأكد من استعادة هذا العنصر؟ سيتم إعادة تطبيق تأثيره المالي والمخزني.')) return;
    const res = await fetch('/api/trash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type })
    });
    if (res.ok) fetchTrash();
    else alert('فشل الاستعادة');
  };

  const handlePurge = async (id: number, type: string) => {
    if (!confirm('⚠️ تحذير: سيتم حذف هذا العنصر نهائياً من قاعدة البيانات ولن يمكنك استعادته مرة أخرى. هل أنت متأكد؟')) return;
    const res = await fetch('/api/trash', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type })
    });
    if (res.ok) fetchTrash();
    else alert('فشل الحذف النهائي');
  };

  return (
    <div>
      <h1 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        🗑️ سلة المهملات
      </h1>

      <div className="glass-panel">
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          هنا تجد الفواتير والتحصيلات التي تم حذفها مؤقتاً. يمكنك استعادتها لتعود للنظام أو حذفها نهائياً.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
             المجلد فارغ حالياً
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>
                <th style={{ padding: '12px' }}>النوع</th>
                <th style={{ padding: '12px' }}>البيان</th>
                <th style={{ padding: '12px' }}>الجهة</th>
                <th style={{ padding: '12px' }}>المبلغ</th>
                <th style={{ padding: '12px' }}>تاريخ الحذف</th>
                <th style={{ padding: '12px' }}>خيارات</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={`${item.trashType}-${item.id}`} style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <td style={{ padding: '12px' }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem',
                      background: item.trashType === 'INVOICE' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: item.trashType === 'INVOICE' ? '#60a5fa' : '#34d399'
                    }}>
                      {item.trashType === 'INVOICE' ? 'فاتورة' : 'سند نقدية'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {item.trashType === 'INVOICE' ? (item.invoiceNumber || `#${item.id}`) : (item.amount + ' ج.م')}
                  </td>
                  <td style={{ padding: '12px' }}>{item.person?.name || '---'}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>
                    {item.trashType === 'INVOICE' ? (item.totalAmount || 0) : (item.amount || 0)} ج.م
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {new Date(item.deletedAt).toLocaleString('ar-EG')}
                  </td>
                  <td style={{ padding: '12px', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button 
                      onClick={() => handleRestore(item.id, item.trashType)}
                      className="btn" 
                      style={{ background: 'var(--success-color)', fontSize: '0.8rem', padding: '6px 12px' }}
                    >استرجاع</button>
                    <button 
                      onClick={() => handlePurge(item.id, item.trashType)}
                      className="btn" 
                      style={{ background: 'var(--danger-color)', fontSize: '0.8rem', padding: '6px 12px' }}
                    >حذف نهائي</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
