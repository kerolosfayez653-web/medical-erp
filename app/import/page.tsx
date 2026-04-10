"use client";
import { useState } from 'react';
import * as XLSX from 'xlsx';

export default function ImportPage() {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const addLog = (msg: string) => setProgressLog(prev => [...prev, msg]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target?.result, { type: 'binary' });
          setWorkbook(wb);
          addLog('✔️ تم قراءة الملف بنجاح! جاهز لتطبيق التهيئة الشاملة.');
        } catch {
          addLog('❌ فشل قراءة الملف، تأكد من الصيغة.');
        }
        setLoading(false);
      };
      reader.readAsBinaryString(file);
    }
  };

  const getSheetData = (wb: XLSX.WorkBook, name: string, rangeOptions?: number | XLSX.Range) => {
    if (!wb.SheetNames.includes(name)) return [];
    return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', range: rangeOptions || 0 });
  };

  const startFullMigration = async () => {
    if (!workbook) return;
    
    if (!confirm('تنبيه: سيتم مسح مسودة المخزون والحسابات الحالية، وإعادة بناء النظام بالكامل من 1/1/2026. هل تريد الاستمرار؟')) return;

    setLoading(true);
    setProgressLog(['بدء عملية المزامنة الكبرى... الرجاء الانتظار.']);

    try {
      // 1. Reset
      addLog('🗑️ جاري تنظيف السجلات القديمة...');
      await fetch('/api/import/wizard', { method: 'POST', body: JSON.stringify({ step: 'RESET' }) });

      // 2. Initial Balances
      addLog('📦 جاري استيراد أرصدة المستودع (أول المدة)...');
      let items = getSheetData(workbook, 'المخزون');
      await fetch('/api/import/wizard', { method: 'POST', body: JSON.stringify({ step: 'INITIAL', items }) });

      // 2.5 Initial Debts
      addLog('📓 جاري استيراد الديون الافتتاحية للعملاء من (مديونيات)...');
      items = getSheetData(workbook, 'مديونيات', 7); // Row 8 is index 7
      if (items.length > 0) {
         await fetch('/api/import/wizard', { method: 'POST', body: JSON.stringify({ step: 'DEBTS', items }) });
      }

      // 3. Purchase Invoices
      addLog('📥 جاري استيراد وتكويد فواتير المشتريات التأريخية...');
      items = getSheetData(workbook, 'pur');
      await fetch('/api/import/wizard', { method: 'POST', body: JSON.stringify({ step: 'PURCHASES', items }) });

      // 4. Sales Invoices
      addLog('📤 جاري تسجيل حركة المبيعات وخصم الأرصدة...');
      items = getSheetData(workbook, 'sales');
      await fetch('/api/import/wizard', { method: 'POST', body: JSON.stringify({ step: 'SALES', items }) });

      // 5. Payments
      addLog('💸 جاري تسجيل التحصيلات والمدفوعات لتسوية ديون العملاء...');
      items = getSheetData(workbook, 'تحصيلات').concat(getSheetData(workbook, 'مدفوعات مشتريات'));
      await fetch('/api/import/wizard', { method: 'POST', body: JSON.stringify({ step: 'PAYMENTS', items }) });

      addLog('✅ اكتملت المهمة! النظام مُحدّث تماماً بجميع الحسابات.');
      setDone(true);
      setWorkbook(null);
    } catch {
      addLog('❌ انقطع الاتصال، حدث خطأ غير متوقع!');
    }
    setLoading(false);
  };

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>استيراد النظام الذكي (تأسيس المخزن وتاريخ الفواتير)</h1>
      
      <div className="glass-panel" style={{ maxWidth: '700px' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>معالج الهجرة الشاملة</h3>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
          سيقوم النظام بقراءة كل صفحات ملفك (المخزون، sales، pur، تحصيلات، ومدفوعات) ليقوم بمحاكاة جميع الشهور الماضية وحساب الديون والمخزون الحالي بدقة.
        </p>
        
        <div className="input-group">
          <label>اختر ملفك المخزن لديك (.xlsx):</label>
          <input type="file" accept=".xlsx, .xls" className="input-field" onChange={handleFileUpload} disabled={loading} />
        </div>

        {progressLog.length > 0 && (
          <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', lineHeight: '2' }}>
            {progressLog.map((log, i) => (
              <div key={i} style={{ color: log.includes('✅') ? 'var(--success-color)' : log.includes('❌') ? 'var(--danger-color)' : 'var(--text-primary)' }}>
                {log}
              </div>
            ))}
          </div>
        )}

        {workbook && !done && (
          <button className="btn btn-primary" onClick={startFullMigration} disabled={loading} style={{ width: '100%', marginTop: '1.5rem', fontSize: '1.1rem', padding: '16px', background: 'var(--danger-color)' }}>
            {loading ? 'العمليات قيد التنفيذ المعالج يعمل الآن...' : '🚀 ابدأ محاكاة الحسابات وسحب الدفاتر'}
          </button>
        )}
        
        {done && (
          <a href="/inventory" className="btn btn-primary" style={{ display: 'block', textAlign:'center', width: '100%', marginTop: '1.5rem', textDecoration: 'none' }}>
            الذهاب لمعاينة المخزون الجاهز!
          </a>
        )}
      </div>
    </div>
  );
}
