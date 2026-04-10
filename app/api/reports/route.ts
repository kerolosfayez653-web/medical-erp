import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    const startParam = searchParams.get('startDate');
    const endParam = searchParams.get('endDate');

    let startDate: Date, endDate: Date;
    let year = new Date().getFullYear();

    if (startParam && startParam !== 'null' && endParam && endParam !== 'null') {
      startDate = new Date(startParam);
      endDate = new Date(endParam);
      year = startDate.getFullYear();
    } else if (yearParam) {
      year = parseInt(yearParam);
      if (monthParam && monthParam !== 'ALL') {
        startDate = new Date(`${year}-${monthParam}-01`);
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        startDate = new Date(`${year}-01-01`);
        endDate = new Date(`${year + 1}-01-01`);
      }
    } else {
      startDate = new Date(`${year}-01-01`);
      endDate = new Date(`${year + 1}-01-01`);
    }

    // 1. Fetch Sales and Purchases
    const invoices = await prisma.invoice.findMany({
      where: { date: { gte: startDate, lt: endDate } },
      include: {
        items: { include: { product: true } }
      }
    });

    const expenses = await prisma.expense.findMany({
      where: { date: { gte: startDate, lt: endDate } }
    });

    const payments = await prisma.payment.findMany({
      where: { date: { gte: startDate, lt: endDate } }
    });

    // 2 & 3. Calculate Totals and Monthly Breakdown
    let totalSales = 0;
    let totalPurchases = 0;
    let totalCOGS = 0;
    let totalDeliveryRevenue = 0;
    let totalDiscount = 0;
    let salesCount = 0;
    let purchasesCount = 0;
    const monthlyMap = new Map();

    // Group items by product for WAC calculation
    const [products, persons] = await Promise.all([
      prisma.product.findMany({ include: { invoiceItems: { include: { invoice: true } } } }),
      prisma.person.findMany()
    ]);

    const totalOpeningValue = products.reduce((s, p) => s + (p.openingQty * p.openingWeightedAvg), 0);

    const productWAC = new Map();
    products.forEach(p => {
      const pItems = p.invoiceItems.filter(i => i.invoice.type === 'PURCHASES');
      const purQty = pItems.reduce((s, i) => s + i.quantity, 0);
      const purVal = pItems.reduce((s, i) => s + i.totalNet, 0);
      const totalInQty = p.openingQty + purQty;
      const wac = totalInQty > 0 
        ? ((p.openingQty * p.openingWeightedAvg) + purVal) / totalInQty 
        : p.openingWeightedAvg;
      productWAC.set(p.id, wac);
    });

    for (const inv of invoices) {
      const monthKey = `${inv.date.getFullYear()}-${String(inv.date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { month: monthKey, sales: 0, purchases: 0, cogs: 0, expenses: 0 });
      }
      const cur = monthlyMap.get(monthKey);

      if (inv.type === 'SALES') {
        totalSales += inv.netAmount;
        totalDeliveryRevenue += inv.deliveryFee || 0;
        totalDiscount += inv.discount || 0;
        salesCount++;
        cur.sales += inv.netAmount;
        for (const item of inv.items) {
          const wac = productWAC.get(item.productId) || 0;
          const lineCOGS = item.quantity * wac;
          totalCOGS += lineCOGS;
          cur.cogs += lineCOGS;
        }
      } else if (inv.type === 'PURCHASES') {
        totalPurchases += inv.netAmount;
        purchasesCount++;
        cur.purchases += inv.netAmount;
      }
    }

    let totalExpenses = 0;
    for (const e of expenses) {
      const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap.has(key)) monthlyMap.set(key, { month: key, sales: 0, purchases: 0, cogs: 0, expenses: 0 });
      monthlyMap.get(key).expenses += e.amount;
      totalExpenses += e.amount;
    }

    const openingCashPayment = payments.find(p => p.notes?.includes('افتتاحي') || p.notes?.includes('أول المدة'));
    const openingCashBalance = openingCashPayment?.amount || 0;

    const totalPaymentsIn = payments
      .filter(p => p.type === 'IN' && p.id !== openingCashPayment?.id)
      .reduce((s, p) => s + p.amount, 0);
    const totalPaymentsOut = payments
      .filter(p => p.type === 'OUT')
      .reduce((s, p) => s + p.amount, 0);

    const grossProfit = totalSales - totalCOGS;
    const netProfit = grossProfit - totalExpenses;

    // --- CUMULATIVE DATA FOR BALANCE SHEET (Snapshot at EndDate) ---
    const allInvoicesBefore = await prisma.invoice.findMany({
      where: { date: { lte: endDate } }
    });
    const allPaymentsBefore = await prisma.payment.findMany({
      where: { date: { lte: endDate } },
      include: { person: true }
    });
    const allExpensesBefore = await prisma.expense.findMany({
      where: { date: { lte: endDate } }
    });

    // 1. Accumulated Cash
    const accCashInTotal = allPaymentsBefore.filter(p => p.type === 'IN').reduce((s, p) => s + p.amount, 0);
    const accCashOutTotal = allPaymentsBefore.filter(p => p.type === 'OUT').reduce((s, p) => s + p.amount, 0);
    const accExpensesTotal = allExpensesBefore.reduce((s, e) => s + e.amount, 0);
    const cashOnHand = accCashInTotal - accCashOutTotal - accExpensesTotal;

    // 2. Profit Split (Current Period vs. Previous Periods)
    // Periodic Profit (Net Profit already calculated above)
    // Previous Periods Profit (Before startDate)
    const prevInvoices = allInvoicesBefore.filter(i => i.date < startDate);
    const prevExpenses = allExpensesBefore.filter(e => e.date < startDate);
    const prevSales = prevInvoices.filter(i => i.type === 'SALES').reduce((s, i) => s + i.netAmount, 0);
    const prevCOGS = prevInvoices.filter(i => i.type === 'SALES').reduce((s, i) => s + (i.cogs || 0), 0);
    const prevExpensesAmt = prevExpenses.reduce((s, e) => s + e.amount, 0);
    const previousProfit = (prevSales - prevCOGS) - prevExpensesAmt;

    // 3. Receivables & Payables (Correctly Categorized)
    const initialCustomerDebt = persons.filter(p => p.type === 'CUSTOMER').reduce((s, p) => s + p.initialBalance, 0);
    const initialSupplierCredit = persons.filter(p => p.type === 'SUPPLIER').reduce((s, p) => s + p.initialBalance, 0);

    const accSalesAll = allInvoicesBefore.filter(i => i.type === 'SALES').reduce((s, i) => s + i.netAmount, 0);
    const accPurchasesAll = allInvoicesBefore.filter(i => i.type === 'PURCHASES').reduce((s, i) => s + i.netAmount, 0);
    
    // Payments from Customers vs to Suppliers
    const customerPayments = allPaymentsBefore.filter(p => p.person?.type === 'CUSTOMER' && p.type === 'IN').reduce((s, p) => s + p.amount, 0);
    const supplierPayments = allPaymentsBefore.filter(p => p.person?.type === 'SUPPLIER' && p.type === 'OUT').reduce((s, p) => s + p.amount, 0);

    const receivables = initialCustomerDebt + accSalesAll - customerPayments;
    const payables = initialSupplierCredit + accPurchasesAll - supplierPayments;
    
    // 4. Cumulative Inventory & Dynamic COGS
    // For absolute parity, we must calculate the COGS for ALL sales up to endDate 
    // using the Final WAC calculated above (which reflects current stock value).
    const allSalesItemsBefore = await prisma.invoiceItem.findMany({
      where: { invoice: { date: { lte: endDate }, type: 'SALES' } }
    });
    
    // Total COGS for Balance Sheet (Uses WAC for all items)
    const accCOGSAll = allSalesItemsBefore.reduce((s, item) => {
      const wac = productWAC.get(item.productId) || 0;
      return s + (item.quantity * wac);
    }, 0);

    const endingInventoryValue = totalOpeningValue + accPurchasesAll - accCOGSAll;

    const balanceSheet = {
      cashOnHand,
      receivables,
      payables,
      inventoryValue: endingInventoryValue,
      previousProfit,
      currentProfit: netProfit,
      totalAssets: cashOnHand + receivables + endingInventoryValue
    };

    // --- DETAILS FOR DRILL-DOWN ---
    const customerDetails = persons.filter(p => p.type === 'CUSTOMER').map(p => {
      const pSales = allInvoicesBefore.filter(i => i.type === 'SALES' && i.personId === p.id).reduce((s, i) => s + i.netAmount, 0);
      const pPaid = allPaymentsBefore.filter(pay => pay.personId === p.id && pay.type === 'IN').reduce((s, pay) => s + pay.amount, 0);
      return {
        name: p.name,
        initial: p.initialBalance,
        sales: pSales,
        paid: pPaid,
        balance: p.initialBalance + pSales - pPaid
      };
    }).filter(c => Math.abs(c.balance) > 0.1);

    const supplierDetails = persons.filter(p => p.type === 'SUPPLIER').map(p => {
      const pPurchases = allInvoicesBefore.filter(i => i.type === 'PURCHASES' && i.personId === p.id).reduce((s, i) => s + i.netAmount, 0);
      const pPaid = allPaymentsBefore.filter(pay => pay.personId === p.id && pay.type === 'OUT').reduce((s, pay) => s + pay.amount, 0);
      return {
        name: p.name,
        initial: p.initialBalance,
        purchases: pPurchases,
        paid: pPaid,
        balance: p.initialBalance + pPurchases - pPaid
      };
    }).filter(s => Math.abs(s.balance) > 0.1);

    const inventoryDetails = products.map(p => {
      const pPurchases = p.invoiceItems.filter(i => i.invoice.type === 'PURCHASES' && i.invoice.date <= endDate).reduce((s, i) => s + i.quantity, 0);
      const pSales = allSalesItemsBefore.filter(i => i.productId === p.id).reduce((s, i) => s + i.quantity, 0);
      const currentQty = p.openingQty + pPurchases - pSales;
      const wac = productWAC.get(p.id) || 0;
      return {
        name: p.name,
        qty: currentQty,
        wac: wac,
        value: currentQty * wac
      };
    }).filter(i => Math.abs(i.qty) > 0.01);

    const expenseBreakdown = expenses.reduce((acc: any, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      totals: {
        totalSales,
        totalPurchases,
        totalCOGS,
        grossProfit,
        totalExpenses,
        netProfit,
        totalPaymentsIn,
        totalPaymentsOut,
        salesCount,
        purchasesCount,
        totalDeliveryRevenue,
        totalDiscount,
        totalOpeningValue,
        openingCashBalance
      },
      balanceSheet,
      balanceSheetDetails: {
        customers: customerDetails,
        suppliers: supplierDetails,
        inventory: inventoryDetails,
        cash: allPaymentsBefore.sort((a,b) => b.date.getTime() - a.date.getTime())
      },
      expenseBreakdown,
      invoices,
      expenses,
      monthly: Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month))
    });

  } catch (error) {
    console.error('Reports Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
