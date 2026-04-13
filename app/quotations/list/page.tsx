"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import ExportBtn from "@/components/ExportBtn";

function fmt(n: number) {
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuotationsListPage() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/quotations").then(r => r.json()).then(d => {
      if (d.success) setQuotations(d.data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>📋 سجل عروض الأسعار</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <ExportBtn type="quotations" label="📊 تصدير إكسيل" />
          <Link href="/quotations" className="btn btn-primary">➕ عرض سعر جديد</Link>
        </div>
      </div>

      <div className="glass-panel">
        {loading ? (
          <p>⏳ جاري التحميل...</p>
        ) : quotations.length === 0 ? (
          <p>لا توجد عروض أسعار مسجلة حتى الآن.</p>
        ) : (
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                  <th style={{ padding: '12px' }}>رقم العرض</th>
                  <th style={{ padding: '12px' }}>العميل</th>
                  <th style={{ padding: '12px' }}>التاريخ</th>
                  <th style={{ padding: '12px' }}>الصافي</th>
                  <th style={{ padding: '12px' }}>الحالة</th>
                  <th style={{ padding: '12px' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map(q => (
                  <tr key={q.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                    <td style={{ padding: '12px' }}>{q.quotationNumber}</td>
                    <td style={{ padding: '12px' }}>{q.person?.name || "عميل عام"}</td>
                    <td style={{ padding: '12px' }}>{new Date(q.date).toLocaleDateString("ar-EG")}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{fmt(q.netAmount)} ج.م</td>
                    <td style={{ padding: '12px' }}>
                      <span className={`status-badge ${q.status.toLowerCase()}`}>
                        {q.status === 'PENDING' ? 'قيد الانتظار' : q.status}
                      </span>
                    </td>
                      <td style={{ padding: '12px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                         <button className="btn btn-sm" onClick={() => window.open(`/quotations/${q.id}/print`, '_blank')}>🖨️ طباعة</button>
                         <button className="btn btn-sm btn-convert" onClick={() => window.location.href = `/sales?fromQuotation=${q.id}`}>🔄 تحويل لفاتورة</button>
                      </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .status-badge {
          padding: 4px 10px; border-radius: 20px; font-size: 0.8rem;
        }
        .status-badge.pending { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
        .table-responsive { overflow-x: auto; }
        .btn-sm { padding: 4px 8px; font-size: 0.8rem; background: rgba(255,255,255,0.05); }
        .btn-convert { background: rgba(16, 185, 129, 0.2); color: #10b981; }
        .btn-convert:hover { background: #10b981; color: #fff; }

      `}</style>
    </div>
  );
}
