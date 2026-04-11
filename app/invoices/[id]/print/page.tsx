"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function PrintInvoicePage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetch(`/api/invoices/${id}`)
        .then(r => r.json())
        .then(res => {
          if (res.success) {
            setInvoice(res.data);
            // Set document title for professional PDF filename: [Invoice Number]-[Customer Name]
            document.title = `${res.data.invoiceNumber || 'INV'}-${res.data.person?.name || 'فاتورة'}`;
          }
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>جاري تجهيز الفاتورة...</div>;
  if (!invoice) return <div style={{ padding: '2rem', textAlign: 'center' }}>لم يتم العثور على الفاتورة.</div>;

  const fmt = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2 });

  return (
    <div className="print-container" style={{ 
      direction: 'rtl', 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px',
      maxWidth: '100%',
      margin: '0 auto',
      background: '#fff',
      color: '#000',
      minHeight: 'auto',
      position: 'relative'
    }}>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0 !important;
        }
        @media print {
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print, .glass-header, .mobile-overlay, .sidebar-container { display: none !important; }
          .only-print { display: block !important; }
          .print-container { 
            padding: 5mm !important; 
            width: 100% !important; 
            min-height: auto !important; 
            max-width: none !important; 
            margin: 0 !important; 
            border: none !important;
          }
        }
        .only-print { display: none; }
        .invoice-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .branding h1 { margin: 0; color: #7c3aed; font-size: 26px; font-weight: 800; }
        .branding p { margin: 0; color: #db2777; font-size: 14px; font-weight: 600; }
        .logo-img { width: 100px; height: auto; object-fit: contain; }
        
        .invoice-meta { text-align: left; background: #fdf2f8; padding: 10px; border-radius: 12px; border: 1px solid #fbcfe8; }
        .invoice-meta h2 { margin: 0; font-size: 18px; color: #9d174d; }
        
        .details-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; margin-bottom: 15px; }
        .info-section h4 { border-bottom: 3px solid #7c3aed; display: inline-block; margin-bottom: 5px; padding-bottom: 2px; color: #7c3aed; font-size: 14px; }
        .info-content { background: #f9fafb; padding: 10px; border-radius: 12px; border: 1px solid #e5e7eb; min-height: 60px; font-size: 13px; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; table-layout: fixed; }
        th { background: #7c3aed; color: #fff; padding: 10px; text-align: right; font-size: 13px; }
        td { padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px; word-wrap: break-word; }
        
        .totals-section { display: flex; justify-content: flex-end; margin-top: 10px; margin-bottom: 20px; }
        .totals-table { width: 250px; }
        .total-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
        .total-final { font-size: 16px; font-weight: bold; color: #7c3aed; border-bottom: 3px double #7c3aed !important; margin-top: 3px; padding-top: 5px !important; }
        
        .print-footer { border-top: 2px solid #f3f4f6; padding-top: 10px; margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: #666; text-align: center; width: 100%; }
        
        @media (max-width: 600px) {
          .print-container { padding: 15px !important; }
          .details-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
          .invoice-header { flex-direction: column; text-align: center; gap: 15px; }
          .invoice-meta { width: 100%; }
        }
      `}</style>

      <div className="no-print" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
         <button onClick={() => window.print()} style={{ padding: '12px 24px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>🖨️ طباعة الفاتورة (A4)</button>
         <button onClick={() => window.close()} style={{ padding: '12px 24px', background: '#fff', color: '#333', border: '1px solid #d1d5db', borderRadius: '12px', cursor: 'pointer' }}>إغلاق</button>
      </div>

      <div className="invoice-header">
        <div className="branding">
          <img src="/logo.png" alt="24Med Logo" style={{ height: '32px', width: 'auto', marginBottom: '8px' }} onError={(e) => e.currentTarget.style.display='none'} />
          <div style={{ marginTop: '0', fontSize: '13px', color: '#4b5563' }}>
            <div style={{ marginBottom: '4px' }}>📞 الهاتف: 01022096076</div>
            <div style={{ marginBottom: '4px' }}>📧 البريد الإلكتروني: info@24med.com</div>
            <div style={{ fontWeight: 'bold' }}>
              🌐 <a href="https://24-med.com" target="_blank" dir="ltr" style={{ color: '#7c3aed', textDecoration: 'underline' }}>24-med.com</a>
            </div>
            <div style={{ fontSize: '10px', color: '#db2777' }}>visit our website</div>
          </div>
        </div>

        <div className="invoice-meta">
          <h2>{invoice.type === 'SALES' ? 'فاتورة مبيعات' : 'فاتورة مشتريات'}</h2>
          <div style={{ marginTop: '8px', fontSize: '14px' }}>
            <div>الرقم: <strong style={{ color: '#000' }}>{invoice.invoiceNumber}</strong></div>
            <div>التاريخ: <strong style={{ color: '#000' }}>{new Date(invoice.date).toLocaleDateString('ar-EG')}</strong></div>
          </div>
        </div>
      </div>

      <div className="details-grid">
        <div className="info-section">
          <h4>العميل / المستلم:</h4>
          <div className="info-content">
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>{invoice.person?.name || '---'}</div>
            <div>📱 {invoice.person?.phone || '---'}</div>
            <div>📍 {invoice.person?.address || '---'}</div>
          </div>
        </div>
        <div className="info-section">
          <h4>حالة المديونية والتحصيل:</h4>
          <div className="info-content">
            {(invoice.netAmount - (invoice.paidAmount || 0)) <= 0.1 ? (
              <div style={{ color: '#059669', fontWeight: 'bold', fontSize: '16px', marginTop: '10px' }}>تم السداد نقداً (خالص) ✅</div>
            ) : (
              <div>
                <div style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '15px' }}>
                  {invoice.paidAmount > 0 ? 'سداد جزئي (فاتورة مفتوحة)' : 'فاتورة آجلة'}
                </div>
                <div style={{ marginTop: '4px', fontSize: '11px', opacity: 0.8 }}>
                  المحصل: {fmt(invoice.paidAmount)} ج.م
                </div>
                <div style={{ marginTop: '2px' }}>
                  المتبقي: <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '14px' }}>{fmt(invoice.netAmount - invoice.paidAmount)} ج.م</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ borderRadius: '0 8px 0 0' }}>الصنف</th>
            <th style={{ textAlign: 'center' }}>الكمية</th>
            <th style={{ textAlign: 'center' }}>السعر</th>
            <th style={{ textAlign: 'center', borderRadius: '8px 0 0 0' }}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item: any, idx: number) => (
            <tr key={idx}>
              <td>{item.product?.name}</td>
              <td style={{ textAlign: 'center' }}>
                 {item.unitType === 'SECONDARY' ? item.quantity : (item.quantity / (item.product?.conversionFactor || 1))} 
                 {" "}
                 {item.unitType === 'SECONDARY' ? (item.product?.secondaryUnit || 'وحدة') : (item.product?.unit || 'وحدة')}
              </td>
              <td style={{ textAlign: 'center' }}>{fmt(item.price)}</td>
              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{fmt(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="totals-section" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '50px' }}>
          {(invoice.netAmount - (invoice.paidAmount || 0) > 0.1) && (
            <div style={{ textAlign: 'center' }}>
              <div 
                className="no-print"
                onClick={() => {
                   const origin = (typeof window !== 'undefined' ? window.location.origin : '') || 'https://medical-erp-sable.vercel.app';
                   window.location.href = `${origin}/pay/${invoice.id}`;
                }}
                style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://medical-erp-sable.vercel.app/pay/${invoice.id}`)}`} 
                  alt="Payment QR" 
                  style={{ width: '100px', height: '100px', border: '1px solid #7c3aed', padding: '5px', borderRadius: '8px', background: '#fff' }}
                />
              </div>
              {/* Only for actual print, static image */}
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://medical-erp-sable.vercel.app/pay/${invoice.id}`)}`} 
                alt="Payment QR" 
                style={{ width: '100px', height: '100px', border: '1px solid #7c3aed', padding: '5px', borderRadius: '8px', background: '#fff' }}
                className="only-print"
              />
              <div style={{ fontSize: '10px', marginTop: '5px', color: '#7c3aed', fontWeight: 'bold' }}>مسح للملخص والدفع 📱</div>
            </div>
          )}
        </div>
        
        <div className="totals-table">
          <div className="total-row">
            <span>إجمالي الفاتورة:</span>
            <span>{fmt(invoice.totalAmount)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="total-row" style={{ color: '#dc2626' }}>
              <span>الخصم الممنوح:</span>
              <span>- {fmt(invoice.discount)}</span>
            </div>
          )}
          {invoice.deliveryFee > 0 && (
            <div className="total-row" style={{ color: '#059669' }}>
              <span>مصاريف الشحن:</span>
              <span>+ {fmt(invoice.deliveryFee)}</span>
            </div>
          )}
          <div className="total-row total-final">
            <span>الصافي المطلوب:</span>
            <span>{fmt(invoice.netAmount)} ج.م</span>
          </div>
        </div>
      </div>

      <div className="print-footer">
        <div>نظام 24MED لإدارة المستلزمات الطبية | <a href="https://24-med.com" target="_blank" dir="ltr" style={{ color: 'inherit', textDecoration: 'none' }}>24-med.com</a></div>
        <div style={{ fontSize: '10px' }}>تاريخ الطباعة: {new Date().toLocaleString('ar-EG')}</div>
        <div style={{ fontWeight: 'bold' }}>البضاعة المباعة لا ترد ولا تستبدل بعد 14 يوماً</div>
        <div style={{ marginTop: '5px' }}>
          Visit our website: <a href="https://24-med.com" target="_blank" dir="ltr" style={{ color: '#7c3aed', fontWeight: 'bold' }}>24-med.com</a>
        </div>
      </div>
    </div>
  );
}
