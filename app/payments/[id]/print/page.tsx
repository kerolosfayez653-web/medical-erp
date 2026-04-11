"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function PrintPaymentPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetch(`/api/payments?id=${id}`)
        .then(r => r.json())
        .then(res => {
          if (res.success) {
            setPayment(res.data);
            document.title = `سند-${res.data.type === 'IN' ? 'قبض' : 'صرف'}-${res.data.id}`;
          }
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>جاري تجهيز السند...</div>;
  if (!payment) return <div style={{ padding: '2rem', textAlign: 'center' }}>لم يتم العثور على السند.</div>;

  return (
    <div className="print-container" style={{ 
      direction: 'rtl', 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '10px',
      maxWidth: '100%',
      margin: '0 auto',
      background: '#fff',
      color: '#000',
      position: 'relative',
    }}>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0 !important;
        }
        @media print {
          body { 
            background: white !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          .print-container { 
            padding: 0 !important; 
            margin: 0 !important; 
            width: 210mm !important; 
            height: 148.5mm !important;
            overflow: hidden !important;
            border: none !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .voucher-box {
            width: 200mm !important;
            height: 138mm !important;
            margin: 0 !important;
            border: 1px solid #7c3aed !important;
          }
        }
        .voucher-box {
          border: 2px solid #7c3aed;
          border-radius: 16px;
          padding: 30px;
          position: relative;
          background: #fff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #f3f4f6;
          padding-bottom: 15px;
        }
        .branding h1 { margin: 0; color: #7c3aed; font-size: 24px; font-weight: 800; }
        .branding p { margin: 0; color: #db2777; font-size: 13px; font-weight: 600; }
        
        .voucher-title {
          background: #7c3aed;
          color: #fff;
          padding: 8px 25px;
          border-radius: 10px;
          font-size: 20px;
          font-weight: bold;
        }
        
        .row { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 16px; }
        .field-label { color: #666; min-width: 120px; }
        .field-value { font-weight: bold; border-bottom: 1px dotted #ccc; flex: 1; padding-right: 10px; }
        
        .amount-container {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 15px 0;
        }
        .amount-box {
          background: #fdf2f8;
          border: 1px solid #fbcfe8;
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 20px;
          font-weight: 900;
          color: #be185d;
        }
        
        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
          padding: 0 20px;
        }
        .sig-box { text-align: center; }
        .sig-line { margin-top: 10px; border-top: 1px solid #333; width: 150px; }
        
        .stamp-circle {
          width: 100px;
          height: 100px;
          border: 2px dashed #e5e7eb;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ccc;
          font-size: 12px;
          transform: rotate(-15deg);
        }
      `}</style>

      <div className="no-print" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
         <button onClick={() => window.print()} style={{ padding: '12px 24px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ طباعة السند</button>
         <button onClick={() => window.close()} style={{ padding: '12px 24px', background: '#fff', color: '#333', border: '1px solid #d1d5db', borderRadius: '12px', cursor: 'pointer' }}>إغلاق</button>
      </div>

      <div className="voucher-box" style={{ border: '1px solid #7c3aed', padding: '15px' }}>
        <div className="header" style={{ marginBottom: '15px', paddingBottom: '10px' }}>
          <div className="branding">
            <h1>24MED</h1>
            <p>FOR MEDICAL SUPPLIES</p>
          </div>
          <div className="voucher-title">
            سند {payment.type === 'IN' ? 'قبض نقدية' : 'صرف نقدية'}
          </div>
          <div style={{ textAlign: 'left', fontSize: '14px' }}>
            <div>التاريخ: <strong>{new Date(payment.date).toLocaleDateString('ar-EG')}</strong></div>
            <div>رقم السند: <strong>VOU-{payment.id}</strong></div>
          </div>
        </div>

        <div className="row">
          <span className="field-label">{payment.type === 'IN' ? 'استلمنا من السيد/ة:' : 'صرفنا للسيد/ة:'}</span>
          <span className="field-value" style={{ fontSize: '18px' }}>{payment.person?.name}</span>
        </div>

        <div className="amount-container">
          <span className="field-label">مبلغ وقدره:</span>
          <div className="amount-box">{payment.amount.toLocaleString()} ج.م</div>
          <span style={{ fontSize: '14px', color: '#666' }}>فقط لا غير.</span>
        </div>

        <div className="row">
          <span className="field-label">وذلك مقابل:</span>
          <span className="field-value">{payment.notes || (payment.invoice ? `سداد فاتورة رقم ${payment.invoice.invoiceNumber}` : '---')}</span>
        </div>

        {payment.invoice && (
          <div style={{ fontSize: '13px', color: '#7c3aed', marginTop: '-10px', marginBottom: '10px' }}>
            مرتبط بالفاتورة رقم: {payment.invoice.invoiceNumber}
          </div>
        )}

        <div className="row">
          <span className="field-label">طريقة الدفع:</span>
          <span className="field-value">{payment.method}</span>
        </div>

        <div className="signatures">
          <div className="sig-box">
            <div>توقيع المستلم</div>
            <div className="sig-line"></div>
          </div>
          
          <div className="stamp-circle">ختم الشركة</div>

          <div className="sig-box">
            <div>توقيع المحاسب</div>
            <div className="sig-line"></div>
          </div>
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '10px', color: '#999', borderTop: '1px solid #f3f4f6', paddingTop: '10px' }}>
          نظام 24MED لإدارة التوزيع المستلزمات الطبية | تم استخراج السند بتاريخ {new Date().toLocaleString('ar-EG')}
        </div>
      </div>
    </div>
  );
}
