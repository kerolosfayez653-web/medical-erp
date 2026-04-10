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

    // 1. HIGH-EFFICIENCY AGGREGATIONS (Period Totals)
    const [salesAgg, purAgg, expAgg, payAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: { type: 'SALES', date: { gte: startDate, lt: endDate } },
        _sum: { netAmount: true, deliveryFee: true, discount: true },
        _count: true
      }),
      prisma.invoice.aggregate({
        where: { type: 'PURCHASES', date: { gte: startDate, lt: endDate } },
        _sum: { netAmount: true },
        _count: true
      }),
      prisma.expense.aggregate({
        where: { date: { gte: startDate, lt: endDate } },
        _sum: { amount: true }
      }),
      prisma.payment.findMany({
        where: { date: { gte: startDate, lt: endDate } }
      })
    ]);

    const totalSales = salesAgg._sum.netAmount || 0;
    const totalPurchases = purAgg._sum.netAmount || 0;
    const totalExpenses = expAgg._sum.amount || 0;
    const totalDeliveryRevenue = salesAgg._sum.deliveryFee || 0;
    const totalDiscount = salesAgg._sum.discount || 0;

    // 2. OPTIMIZED WAC CALCULATION (Database Level)
    // Get all products and their opening balances
    const products = await prisma.product.findMany({
      select: { id: true, name: true, openingQty: true, openingWeightedAvg: true }
    });

    // Get aggregated purchases per product up to endDate
    const purchaseAggItems = await prisma.invoiceItem.groupBy({
      by: ['productId'],
      where: { invoice: { type: 'PURCHASES', date: { lt: endDate } } },
      _sum: { quantity: true, totalNet: true }
    });

    const purMap = new Map(purchaseAggItems.map(i => [i.productId, i]));
    const productWAC = new Map();
    let totalOpeningValue = 0;

    products.forEach(p => {
      const pAgg = purMap.get(p.id);
      const purQty = pAgg?._sum?.quantity || 0;
      const purVal = pAgg?._sum?.totalNet || 0;
      const totalInQty = p.openingQty + purQty;
      const wac = totalInQty > 0 
        ? ((p.openingQty * p.openingWeightedAvg) + purVal) / totalInQty 
        : p.openingWeightedAvg;
      productWAC.set(p.id, wac);
      totalOpeningValue += (p.openingQty * p.openingWeightedAvg);
    });

    // Calculate COGS for Period
    const salesItemsForPeriod = await prisma.invoiceItem.findMany({
      where: { invoice: { type: 'SALES', date: { gte: startDate, lt: endDate } } },
      select: { productId: true, quantity: true }
    });

    let totalCOGS = 0;
    salesItemsForPeriod.forEach(item => {
      totalCOGS += (item.quantity * (productWAC.get(item.productId) || 0));
    });

    // 3. BALANCE SHEET AGGREGATES (Cumulative)
    const [allSalesBefore, allPurBefore, allExpBefore, allPayBefore] = await Promise.all([
      prisma.invoice.aggregate({ where: { type: 'SALES', date: { lt: endDate } }, _sum: { netAmount: true } }),
      prisma.invoice.aggregate({ where: { type: 'PURCHASES', date: { lt: endDate } }, _sum: { netAmount: true } }),
      prisma.expense.aggregate({ where: { date: { lt: endDate } }, _sum: { amount: true } }),
      prisma.payment.groupBy({ by: ['type'], where: { date: { lt: endDate } }, _sum: { amount: true } })
    ]);

    const accCashIn = allPayBefore.find(p => p.type === 'IN')?._sum?.amount || 0;
    const accCashOut = allPayBefore.find(p => p.type === 'OUT')?._sum?.amount || 0;
    const cashOnHand = accCashIn - accCashOut - (allExpBefore._sum.amount || 0);

    // Dynamic Inventory Value at EndDate
    const salesHistoryAgg = await prisma.invoiceItem.groupBy({
      by: ['productId'],
      where: { invoice: { type: 'SALES', date: { lt: endDate } } },
      _sum: { quantity: true }
    });
    const salesMap = new Map(salesHistoryAgg.map(i => [i.productId, i._sum.quantity || 0]));

    let endingInventoryValue = 0;
    products.forEach(p => {
      const pPurchased = purMap.get(p.id)?._sum?.quantity || 0;
      const pSold = salesMap.get(p.id) || 0;
      const curQty = p.openingQty + pPurchased - pSold;
      endingInventoryValue += (curQty * (productWAC.get(p.id) || 0));
    });

    // Debt & Receivables
    const persons = await prisma.person.findMany();
    const initialCustomerDebt = persons.filter(p => p.type === 'CUSTOMER').reduce((s, p) => s + p.initialBalance, 0);
    const initialSupplierCredit = persons.filter(p => p.type === 'SUPPLIER').reduce((s, p) => s + p.initialBalance, 0);

    const personPaymentAgg = await prisma.payment.groupBy({
      by: ['personId', 'type'],
      where: { date: { lt: endDate } },
      _sum: { amount: true }
    });

    const getPersonPaid = (pid: string, type: 'IN' | 'OUT') => {
      return personPaymentAgg.find(a => a.personId === pid && a.type === type)?._sum?.amount || 0;
    };

    const receivables = initialCustomerDebt + (allSalesBefore._sum.netAmount || 0) - 
      persons.filter(p => p.type === 'CUSTOMER').reduce((s, p) => s + getPersonPaid(p.id, 'IN'), 0);
    const payables = initialSupplierCredit + (allPurBefore._sum.netAmount || 0) - 
      persons.filter(p => p.type === 'SUPPLIER').reduce((s, p) => s + getPersonPaid(p.id, 'OUT'), 0);

    const balanceSheet = {
      cashOnHand,
      receivables,
      payables,
      inventoryValue: endingInventoryValue,
      previousProfit: 0, // Simplified for performance, can be derived by calculating profit before startDate
      currentProfit: (totalSales - totalCOGS) - totalExpenses,
      totalAssets: cashOnHand + receivables + endingInventoryValue
    };

    // --- Details for DRILL-DOWN (Paginated/Limited for health) ---
    // Fetching limited details to prevent UI crash
    const invoices = await prisma.invoice.findMany({
      where: { date: { gte: startDate, lt: endDate } },
      include: { person: true },
      take: 200, // Safety limit
      orderBy: { date: 'desc' }
    });

    return NextResponse.json({
      success: true,
      totals: {
        totalSales,
        totalPurchases,
        totalCOGS,
        grossProfit: totalSales - totalCOGS,
        totalExpenses,
        netProfit: (totalSales - totalCOGS) - totalExpenses,
        totalPaymentsIn: payAgg.filter(p => p.type === 'IN').reduce((s, p) => s + p.amount, 0),
        totalPaymentsOut: payAgg.filter(p => p.type === 'OUT').reduce((s, p) => s + p.amount, 0),
        salesCount: salesAgg._count,
        purchasesCount: purAgg._count,
        totalDeliveryRevenue,
        totalDiscount,
        totalOpeningValue,
        openingCashBalance: 0 // Derived from payments
      },
      balanceSheet,
      balanceSheetDetails: {
        customers: [], // Deferred or limited
        suppliers: [], 
        inventory: [],
        cash: payAgg.sort((a,b) => b.date.getTime() - a.date.getTime())
      },
      expenseBreakdown: {},
      invoices,
      expenses: [],
      monthly: []
    });

  } catch (error) {
    console.error('Reports Optimization Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
