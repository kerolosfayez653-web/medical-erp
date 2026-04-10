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
      fontFamily: "'Cairo', system-ui, -apple-system, sans-serif",
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      minHeight: '100vh',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      color: '#fff'
    }}>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .premium-card { animation: slideUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .pulse { animation: pulseAnim 2s infinite; }
        @keyframes pulseAnim { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
      `}</style>

      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginTop: '1rem', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '2.5rem', fontWeight: '900' }}>24MED</h1>
        <p style={{ margin: 0, color: '#94a3b8', fontWeight: '600', letterSpacing: '2px', fontSize: '12px' }}>FOR MEDICAL SUPPLIES</p>
      </div>

      {/* Receipt Card */}
      <div className="premium-card" style={{ 
        background: 'rgba(30, 41, 59, 0.7)', 
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        width: '100%', 
        maxWidth: '450px', 
        borderRadius: '32px', 
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        padding: '2rem',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.4rem', fontWeight: '800' }}>مرحباً بك، {invoice.person?.name} 👋</h2>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '8px' }}>ملخص فاتورة رقم: <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{invoice.invoiceNumber}</span></div>
        </div>

        <div style={{ display: 'grid', gap: '16px', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.95rem' }}>تاريخ الفاتورة</span>
            <span style={{ fontWeight: '600', color: '#f8fafc' }}>{new Date(invoice.date).toLocaleDateString('ar-EG')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.95rem' }}>حالة السداد</span>
            <span style={{ 
              background: invoice.paymentStatus === 'CASH' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', 
              color: invoice.paymentStatus === 'CASH' ? '#34d399' : '#f87171',
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              border: `1px solid ${invoice.paymentStatus === 'CASH' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}>
              {invoice.paymentStatus === 'CASH' ? 'مسددة بالكامل ✅' : 'بانتظار التحصيل ⌛'}
            </span>
          </div>
        </div>

        {/* Amount Box */}
        <div style={{ 
          background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.05))', 
          borderRadius: '24px', 
          padding: '2rem', 
          marginBottom: '2rem', 
          textAlign: 'center', 
          border: '1px solid rgba(59, 130, 246, 0.2)' 
        }}>
          <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '8px' }}>إجمالي المبلغ المطلوب</div>
          <div style={{ fontSize: '3rem', fontWeight: '900', color: '#fff', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
            {fmt(invoice.netAmount - (invoice.paidAmount || 0))}
            <span style={{ fontSize: '1rem', color: '#60a5fa' }}>ج.م</span>
          </div>
        </div>

        {/* Action Button */}
        {invoice.netAmount > (invoice.paidAmount || 0) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button 
              className="pulse"
              onClick={() => {
                window.location.href = `https://ipn.eg/S/kerolosfayez555/instapay/912tFv`;
              }}
              style={{ 
                width: '100%', 
                padding: '1.2rem', 
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '20px', 
                fontSize: '1.1rem', 
                fontWeight: 'bold', 
                cursor: 'pointer',
                boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)',
                transition: 'all 0.3s ease'
              }}
            >
              💳 سـداد سريع (InstaPay)
            </button>
            <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
               <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '4px' }}>أو التحويل للمحفظة:</div>
               <div style={{ fontSize: '1.3rem', fontWeight: 'bold', letterSpacing: '1px', color: '#60a5fa' }}>01022096076</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '2rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '24px', border: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✨</div>
            <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#34d399' }}>شكراً لك!</div>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '8px' }}>هذه الفاتورة مسددة بالكامل.</p>
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem', color: '#64748b', fontSize: '0.8rem', textAlign: 'center', maxWidth: '300px', lineHeight: '1.6' }}>
        يرجى التأكد من اسم المستلم <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>24MED</span> قبل التحويل.<br/>
        &copy; 2026 جميع الحقوق محفوظة
      </div>
    </div>
  );
}
