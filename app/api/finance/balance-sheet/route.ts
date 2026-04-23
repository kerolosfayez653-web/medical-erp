import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const year = 2026;
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year + 1}-01-01`);

    // 1. Core Data
    const [products, persons, allPayments, allExpenses, allInvoices] = await Promise.all([
      prisma.product.findMany({ include: { invoiceItems: { include: { invoice: true } } } }),
      prisma.person.findMany(),
      prisma.payment.findMany({ where: { isDeleted: false }, include: { person: true } }),
      prisma.expense.findMany(),
      prisma.invoice.findMany({ where: { isDeleted: false }, include: { items: true } })
    ]);

    // 2. WAC Calculation (Consolidated)
    const productWAC = new Map();
    products.forEach(p => {
      const isPurchase = (i: any) => i.invoice.type === 'PURCHASES' && !i.invoice.isDeleted;
      const isPurchaseRet = (i: any) => i.invoice.type === 'PURCHASES_RETURN' && !i.invoice.isDeleted;
      
      const pPurItems = p.invoiceItems.filter(isPurchase);
      const pPurRetItems = p.invoiceItems.filter(isPurchaseRet);

      const purQty = pPurItems.reduce((s, i) => s + i.quantity, 0);
      const purVal = pPurItems.reduce((s, i) => s + i.totalNet, 0);

      const purRetQty = pPurRetItems.reduce((s, i) => s + i.quantity, 0);
      const purRetVal = pPurRetItems.reduce((s, i) => s + i.totalNet, 0);

      const factor = p.conversionFactor || 1;
      const openingPieces = p.openingQty * factor;
      const openingValue = p.openingQty * p.openingWeightedAvg;

      const totalInQtyPieces = openingPieces + purQty - purRetQty;
      const totalInValue = openingValue + purVal - purRetVal;

      const wac = totalInQtyPieces > 0 
        ? totalInValue / totalInQtyPieces 
        : (p.openingWeightedAvg / factor);

      productWAC.set(p.id, wac);
    });

    // 3. Static 2025 Data (Opening Snapshot)
    const inventory2025 = products.reduce((s, p) => s + (p.openingQty * p.openingWeightedAvg), 0);
    const customerDebts2025 = persons.filter(p => p.type === 'CUSTOMER').reduce((s, p) => s + p.initialBalance, 0);
    const supplierDebts2025 = persons.filter(p => p.type === 'SUPPLIER').reduce((s, p) => s + p.initialBalance, 0);
    const cash2025 = 10278; // Hardcoded start balance as per user request
    const totalAssets2025 = inventory2025 + customerDebts2025 + cash2025;
    const openingCapital = totalAssets2025 - supplierDebts2025;

    // 4. Dynamic 2026 Details
    // Assets: Cash
    const accCashIn = allPayments.filter(p => p.type === 'IN').reduce((s, p) => s + p.amount, 0);
    const accCashOut = allPayments.filter(p => p.type === 'OUT').reduce((s, p) => s + p.amount, 0);
    const accExpenses = allExpenses.reduce((s, e) => s + e.amount, 0);
    const currentCash = accCashIn - accCashOut - accExpenses;

    // Assets: Receivables
    const customerTransactions = persons.filter(p => p.type === 'CUSTOMER').map(p => {
      return { name: p.name, balance: p.currentBalance };
    }).filter(c => Math.abs(c.balance) > 0.1);
    const currentReceivables = customerTransactions.reduce((s, c) => s + c.balance, 0);

    // Assets: Inventory
    const inventoryItems = products.map(p => {
      const factor = p.conversionFactor || 1;
      const openingPieces = p.openingQty * factor;

      const purQty = p.invoiceItems.filter(i => i.invoice.type === 'PURCHASES' && !i.invoice.isDeleted).reduce((s, i) => s + i.quantity, 0);
      const purRetQty = p.invoiceItems.filter(i => i.invoice.type === 'PURCHASES_RETURN' && !i.invoice.isDeleted).reduce((s, i) => s + i.quantity, 0);
      const saleQty = allInvoices.filter(i => i.type === 'SALES').flatMap(i => i.items).filter(item => item.productId === p.id).reduce((s, i) => s + i.quantity, 0);
      const saleRetQty = allInvoices.filter(i => i.type === 'SALES_RETURN').flatMap(i => i.items).filter(item => item.productId === p.id).reduce((s, i) => s + i.quantity, 0);
      
      const currentQty = openingPieces + (purQty - purRetQty) - (saleQty - saleRetQty);
      const wac = productWAC.get(p.id) || 0;
      return { name: p.name, qty: currentQty, value: currentQty * wac, unit: p.unit || 'وحدة' };
    }).filter(i => Math.abs(i.qty) > 0.01);
    const currentInventoryValue = inventoryItems.reduce((s, i) => s + i.value, 0);

    // Liabilities: Payables
    const supplierTransactions = persons.filter(p => p.type === 'SUPPLIER').map(p => {
      return { name: p.name, balance: p.currentBalance };
    }).filter(s => Math.abs(s.balance) > 0.1);
    const currentPayables = supplierTransactions.reduce((s, c) => s + c.balance, 0);

    // Equity: Profit & Drawings
    const totalSales = allInvoices.filter(i => i.type === 'SALES').reduce((s, i) => s + i.netAmount, 0) - allInvoices.filter(i => i.type === 'SALES_RETURN').reduce((s, i) => s + i.netAmount, 0);
    
    let totalCOGS = 0;
    allInvoices.filter(i => i.type === 'SALES' || i.type === 'SALES_RETURN').forEach(inv => {
       inv.items.forEach(item => {
         const q = inv.type === 'SALES' ? item.quantity : -item.quantity;
         totalCOGS += (q * (productWAC.get(item.productId) || 0));
       });
    });

    const totalActualExpenses = allExpenses.filter(e => e.category !== 'مسحوبات شخصية').reduce((s, e) => s + e.amount, 0);
    const totalDrawings = allExpenses.filter(e => e.category === 'مسحوبات شخصية').reduce((s, e) => s + e.amount, 0);
    const netProfit2026 = totalSales - totalCOGS - totalActualExpenses;

    const totalAssets2026 = currentCash + currentReceivables + currentInventoryValue;

    return NextResponse.json({
      success: true,
      data: {
        year2025: {
          assets: { inventory: inventory2025, accountsReceivable: customerDebts2025, cash: cash2025, total: totalAssets2025 },
          liabilities: { accountsPayable: supplierDebts2025, otherLiabilities: 0, totalLiabilities: supplierDebts2025 },
          equity: { openingCapital, retainedEarnings: 0, total: totalAssets2025 }
        },
        year2026: {
          assets: { 
            inventory: currentInventoryValue, 
            accountsReceivable: currentReceivables, 
            cash: currentCash, 
            total: totalAssets2026,
            details: {
              inventory: inventoryItems.sort((a,b) => b.value - a.value),
              receivables: customerTransactions.sort((a,b) => b.balance - a.balance),
              cashSummary: {
                opening: cash2025,
                inflows: accCashIn - cash2025,
                outflows: accCashOut + accExpenses,
                distribution: [] // Optional: Can be filled if needed
              }
            }
          },
          liabilities: { accountsPayable: currentPayables, otherLiabilities: 0 },
          equity: { 
            openingCapital, 
            netProfit: netProfit2026,
            drawings: totalDrawings,
            retainedEarnings: (openingCapital + netProfit2026 - totalDrawings - currentPayables), 
            total: totalAssets2026 
          }
        }
      }
    });
  } catch (error) {
    console.error('Balance Sheet Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
