"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function PaymentSummaryPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetch(`/api/invoices/${id}`)
        .then(r => r.json())
        .then(res => {
          if (res.success) setInvoice(res.data);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return (
    <div style={{ padding: '5rem', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <p style={{ marginTop: '1.5rem', color: '#64748b' }}>جاري جلب ملخص الفاتورة...</p>
    </div>
  );

  if (!invoice) return (
    <div style={{ padding: '2rem', textAlign: 'center', minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
      <h2 style={{ color: '#1e293b' }}>عذراً، لم يتم العثور على الفاتورة.</h2>
      <p style={{ color: '#64748b' }}>يرجى التأكد من الرابط أو التواصل مع الدعم الفني لشركة 24MED.</p>
    </div>
  );

  const fmt = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2 });

  return (
    <div style={{ 
      direction: 'rtl', 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 100%)',
      minHeight: '100vh',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginTop: '1rem', marginBottom: '1.5rem' }}>
        <img src="/logo.png" alt="24Med Logo" style={{ width: '150px', marginBottom: '0.5rem' }} />
      </div>

      {/* Receipt Card */}
      <div style={{ 
        background: '#fff', 
        width: '100%', 
        maxWidth: '400px', 
        borderRadius: '24px', 
        boxShadow: '0 20px 25px -5px rgba(124, 58, 237, 0.1), 0 8px 10px -6px rgba(124, 58, 237, 0.1)',
        padding: '1.5rem',
        position: 'relative',
        border: '1px solid #ede9fe'
      }}>
        {/* Decorative Circles */}
        <div style={{ position: 'absolute', top: '-10px', left: '20px', width: '20px', height: '20px', background: 'inherit', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', top: '-10px', right: '20px', width: '20px', height: '20px', background: 'inherit', borderRadius: '50%' }}></div>

        <div style={{ borderBottom: '2px dashed #ede9fe', paddingBottom: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem', fontWeight: '700' }}>ملخص الفاتورة</h2>
          <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>فاتورة رقم: {invoice.invoiceNumber}</div>
        </div>

        <div style={{ display: 'grid', gap: '12px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>العميل</span>
            <span style={{ fontWeight: '600', color: '#1e293b' }}>{invoice.person?.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>التاريخ</span>
            <span style={{ fontWeight: '600', color: '#1e293b' }}>{new Date(invoice.date).toLocaleDateString('ar-EG')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>الحالة</span>
            <span style={{ 
              background: invoice.paymentStatus === 'CASH' ? '#dcfce7' : '#fee2e2', 
              color: invoice.paymentStatus === 'CASH' ? '#166534' : '#991b1b',
              padding: '2px 10px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 'bold'
            }}>
              {invoice.paymentStatus === 'CASH' ? 'خالص ✅' : 'آجل ⌛'}
            </span>
          </div>
        </div>

        {/* Amount Box */}
        <div style={{ background: '#f5f3ff', borderRadius: '16px', padding: '1.2rem', marginBottom: '1.5rem', textAlign: 'center', border: '1px solid #ddd6fe' }}>
          <div style={{ fontSize: '0.8rem', color: '#6d28d9', marginBottom: '8px', fontWeight: 'bold' }}>إجمالي المديونية المستحق سدادها</div>
          <div style={{ fontSize: '2.4rem', fontWeight: '900', color: '#7c3aed', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px' }}>
            {fmt(invoice.person?.currentBalance || 0)}
            <span style={{ fontSize: '1rem' }}>ج.م</span>
          </div>
          <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid rgba(124, 58, 237, 0.1)', paddingTop: '8px' }}>
             قيمة هذه الفاتورة: <b>{fmt(invoice.netAmount - (invoice.paidAmount || 0))} ج.م</b>
          </div>
        </div>

        {/* Action Button */}
        {(invoice.person?.currentBalance || 0) > 0.1 ? (
          <button 
            onClick={() => {
              window.location.href = `https://ipn.eg/S/kerolosfayez555/instapay/912tFv`;
            }}
            style={{ 
              width: '100%', 
              padding: '1.2rem', 
              background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '20px', 
              fontSize: '1.1rem', 
              fontWeight: 'bold', 
              cursor: 'pointer',
              boxShadow: '0 10px 20px -5px rgba(124, 58, 237, 0.4)',
              transition: 'transform 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            💳 سداد المديونية عبر إنستا باي
          </button>
        ) : (
          <div style={{ padding: '1.5rem', background: '#ecfdf5', borderRadius: '16px', border: '1px solid #10b981', textAlign: 'center', color: '#065f46' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>الحساب مسدد بالكامل</div>
            <p style={{ fontSize: '0.85rem', marginTop: '5px' }}>شكراً لتعاملكم مع 24MED</p>
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', maxWidth: '300px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
          🌐 <a href="https://24-med.com" target="_blank" dir="ltr" style={{ color: '#7c3aed', textDecoration: 'underline' }}>24-med.com</a>
        </div>
        <div style={{ fontSize: '0.7rem', color: '#db2777', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>visit our website</div>
        يرجى التأكد من اسم المستلم (kerolos) عند التحويل.<br/>
        جميع الحقوق محفوظة لنظام 24MED لإدارة المستلزمات الطبية © 2026
      </div>
    </div>
  );
}
