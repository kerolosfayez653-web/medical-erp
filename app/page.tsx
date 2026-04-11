import prisma from '../lib/prisma';
import ThemeSwitcher from './ThemeSwitcher';
export const dynamic = 'force-dynamic';

export default async function Home() {
  const salesAgg = await prisma.invoice.aggregate({ _sum: { netAmount: true }, where: { type: 'SALES' } });
  const purAgg = await prisma.invoice.aggregate({ _sum: { netAmount: true }, where: { type: 'PURCHASES' } });
  
  // Safe fetch for expenses
  let totalExpenses = 0;
  try {
    const prismaObj = prisma as any;
    if (prismaObj.expense) {
      const expAgg = await prismaObj.expense.aggregate({ _sum: { amount: true } });
      totalExpenses = expAgg._sum.amount || 0;
    }
  } catch (e) {
    console.warn("Expenses table not ready yet.");
  }

  const allPeople = await prisma.person.findMany({ select: { currentBalance: true } });
  const positiveDebts = allPeople.filter(p => p.currentBalance > 0).reduce((s, p) => s + p.currentBalance, 0);
  const negativeDebts = allPeople.filter(p => p.currentBalance < 0).reduce((s, p) => s + Math.abs(p.currentBalance), 0);
  
  // Refined Inventory/COGS logic
  const products = await prisma.product.findMany({ include: { invoiceItems: { include: { invoice: true } } } });
  let totalInventoryValue = 0;
  let totalCOGS = 0;

  products.forEach(p => {
    const pItems = p.invoiceItems.filter(i => i.invoice.type === 'PURCHASES');
    const sItems = p.invoiceItems.filter(i => i.invoice.type === 'SALES');
    
    const purQty = pItems.reduce((s, i) => s + i.quantity, 0);
    const purVal = pItems.reduce((s, i) => s + i.totalNet, 0);
    const soldQty = sItems.reduce((s, i) => s + i.quantity, 0);
    
    const totalInQty = p.openingQty + purQty;
    const wac = totalInQty > 0 
      ? ((p.openingQty * p.openingWeightedAvg) + purVal) / totalInQty 
      : p.openingWeightedAvg;
    
    const curQty = p.openingQty + purQty - soldQty;
    totalInventoryValue += (curQty * wac);
    totalCOGS += (soldQty * wac);
  });

  const totalSales = salesAgg._sum.netAmount || 0;
  const totalPurchases = purAgg._sum.netAmount || 0;
  const grossProfit = totalSales - totalCOGS;
  const netProfit = grossProfit - totalExpenses;

  return (
    <div>
      <h1 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        📊 نظرة عامة على الميزانية (2026)
      </h1>
      
      <div className="stats-grid">
        <a href="/invoices?type=SALES" className="stat-card clickable-card" style={{ borderTop: '4px solid var(--accent-color)', textDecoration: 'none' }}>
          <span className="stat-title">صافي المبيعات (Sales) ✦</span>
          <span className="stat-value" style={{ color: 'var(--accent-color)' }}>{totalSales.toLocaleString('en-US')} ج.م</span>
          <small style={{ color: 'var(--text-secondary)' }}>إجمالي المبيعات المحققة</small>
        </a>
        <a href="/invoices?type=PURCHASES" className="stat-card clickable-card" style={{ borderTop: '4px solid var(--accent-color)', textDecoration: 'none' }}>
          <span className="stat-title">وارد المخازن (Purchases)</span>
          <span className="stat-value" style={{ color: 'var(--accent-color)' }}>{totalPurchases.toLocaleString('en-US')} ج.م</span>
        </a>
        <a href="/inventory" className="stat-card clickable-card" style={{ borderTop: '4px solid var(--warning-color)', textDecoration: 'none' }}>
          <span className="stat-title">قيمة بضاعة المستودع 📦</span>
          <span className="stat-value" style={{ color: 'var(--warning-color)' }}>{totalInventoryValue.toLocaleString('en-US')} ج.م</span>
          <small style={{ color: 'var(--text-secondary)' }}>حسب المتوسط المرجح</small>
        </a>
        <a href="/expenses" className="stat-card clickable-card" style={{ borderTop: '4px solid var(--danger-color)', textDecoration: 'none' }}>
          <span className="stat-title">إجمالي المصروفات</span>
          <span className="stat-value" style={{ color: 'var(--danger-color)' }}>{totalExpenses.toLocaleString('en-US')} ج.م</span>
        </a>
      </div>
      
      <div className="stats-grid" style={{ marginTop: '1rem' }}>
        <a href="/reports" className="stat-card clickable-card" style={{ borderTop: '6px solid var(--success-color)', background: 'rgba(16, 185, 129, 0.08)', textDecoration: 'none' }}>
          <span className="stat-title" style={{ fontWeight: 'bold' }}>صافي الربح الحقيقي 💰</span>
          <span className="stat-value" style={{ color: 'var(--success-color)' }}>{netProfit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ج.م</span>
        </a>
        <a href="/people?filter=DEBT" className="stat-card clickable-card" style={{ borderTop: '4px solid var(--danger-color)', textDecoration: 'none' }}>
          <span className="stat-title">مستحقات (عند العملاء)</span>
          <span className="stat-value" style={{ color: 'var(--danger-color)' }}>{positiveDebts.toLocaleString('en-US')} ج.م</span>
        </a>
        <a href="/people?filter=CREDIT" className="stat-card clickable-card" style={{ borderTop: '4px solid var(--warning-color)', textDecoration: 'none' }}>
          <span className="stat-title">مطلوبات (للموردين)</span>
          <span className="stat-value" style={{ color: 'var(--warning-color)' }}>{negativeDebts.toLocaleString('en-US')} ج.م</span>
        </a>
      </div>

      <div className="glass-panel" style={{ marginTop: '2rem' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>التنقل السريع</h2>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <a href="/sales" className="btn btn-primary" style={{ flex: '1 1 200px' }}>فاتورة مبيعات جديدة</a>
          <a href="/purchases" className="btn btn-secondary" style={{ flex: '1 1 200px' }}>إدخال مشتريات للمخزن</a>
          <a href="/inventory" className="btn" style={{ flex: '1 1 200px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            استعراض المستودع والجرد
          </a>
        </div>
      </div>
      <ThemeSwitcher />
    </div>
  );
}
