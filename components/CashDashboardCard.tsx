"use client";
import React, { useState } from "react";
import * as XLSX from "xlsx";

export default function CashDashboardCard({ cashAccounts, totalAvailableCash }: { cashAccounts: Record<string, number>, totalAvailableCash: number }) {
  const [showModal, setShowModal] = useState(false);

  const exportCash = () => {
    const rows = Object.entries(cashAccounts).map(([method, amount]) => ({
      'الحساب': method,
      'الرصيد المتاح (ج.م)': amount
    }));
    rows.push({ 'الحساب': 'إجمالي النقدية', 'الرصيد المتاح (ج.م)': totalAvailableCash });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, 'الأرصدة النقدية');
    XLSX.writeFile(wb, `الأرصدة_النقدية_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.xlsx`);
  };

  return (
    <>
      <div onClick={() => setShowModal(true)} className="stat-card clickable-card" style={{ borderTop: '4px solid #10b981', cursor: 'pointer', background: 'rgba(16, 185, 129, 0.08)' }}>
        <span className="stat-title" style={{ fontWeight: 'bold' }}>النقدية المتاحة (سيولة) 💵</span>
        <span className="stat-value" style={{ color: '#10b981' }}>{totalAvailableCash.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ج.م</span>
        <small style={{ color: 'var(--text-secondary)' }}>اضغط لعرض تفاصيل الحسابات البنكية والخزينة</small>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowModal(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>💵 تفاصيل الأرصدة النقدية</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={exportCash} className="btn" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981' }}>📥 Excel</button>
                <button onClick={() => setShowModal(false)} className="btn btn-primary" style={{ background: 'var(--danger-color)' }}>إغلاق</button>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <th style={{ padding: '12px', borderBottom: '2px solid var(--border-color)' }}>الحساب / الخزينة</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>الرصيد المتاح (ج.م)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(cashAccounts).sort((a,b) => b[1]-a[1]).map(([method, amount]) => (
                  <tr key={method} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{method}</td>
                    <td style={{ padding: '12px', textAlign: 'left', color: amount < 0 ? 'var(--danger-color)' : 'var(--success-color)' }}>
                      {amount.toLocaleString('en-US')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding: '15px 12px', fontWeight: 'bold', fontSize: '1.2rem', color: '#10b981' }}>إجمالي السيولة</td>
                  <td style={{ padding: '15px 12px', textAlign: 'left', fontWeight: 'bold', fontSize: '1.2rem', color: '#10b981' }}>
                    {totalAvailableCash.toLocaleString('en-US')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
