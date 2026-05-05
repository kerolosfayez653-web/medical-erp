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
    const [salesAgg, purAgg, salesRetAgg, purRetAgg, expAgg, payAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: { type: 'SALES', date: { gte: startDate, lt: endDate }, isDeleted: false },
        _sum: { netAmount: true, deliveryFee: true, discount: true },
        _count: true
      }),
      prisma.invoice.aggregate({
        where: { type: 'PURCHASES', date: { gte: startDate, lt: endDate }, isDeleted: false },
        _sum: { netAmount: true },
        _count: true
      }),
      prisma.invoice.aggregate({
        where: { type: 'SALES_RETURN', date: { gte: startDate, lt: endDate }, isDeleted: false },
        _sum: { netAmount: true, discount: true },
        _count: true
      }),
      prisma.invoice.aggregate({
        where: { type: 'PURCHASES_RETURN', date: { gte: startDate, lt: endDate }, isDeleted: false },
        _sum: { netAmount: true },
        _count: true
      }),
      prisma.expense.aggregate({
        where: { date: { gte: startDate, lt: endDate } },
        _sum: { amount: true }
      }),
      prisma.payment.findMany({
        where: { date: { gte: startDate, lt: endDate }, isDeleted: false },
        include: { person: true }
      })
    ]);

    const totalSales = (salesAgg._sum.netAmount || 0) - (salesRetAgg._sum.netAmount || 0);
    const totalPurchases = (purAgg._sum.netAmount || 0) - (purRetAgg._sum.netAmount || 0);
    const totalExpenses = expAgg._sum.amount || 0;
    const totalDeliveryRevenue = salesAgg._sum.deliveryFee || 0;
    const totalDiscount = (salesAgg._sum.discount || 0) - (salesRetAgg._sum.discount || 0);

    // 2. OPTIMIZED WAC CALCULATION (Database Level)
    const products = await prisma.product.findMany({
      select: { id: true, name: true, openingQty: true, openingWeightedAvg: true, conversionFactor: true }
    });

    const [purchaseAggItems, purRetAggItems] = await Promise.all([
      prisma.invoiceItem.groupBy({
        by: ['productId'],
        where: { invoice: { type: 'PURCHASES', date: { lt: endDate }, isDeleted: false } },
        _sum: { quantity: true, totalNet: true }
      }),
      prisma.invoiceItem.groupBy({
        by: ['productId'],
        where: { invoice: { type: 'PURCHASES_RETURN', date: { lt: endDate }, isDeleted: false } },
        _sum: { quantity: true, totalNet: true }
      })
    ]);

    const purMap = new Map(purchaseAggItems.map(i => [i.productId, i]));
    const purRetMap = new Map(purRetAggItems.map(i => [i.productId, i]));
    
    const productWAC = new Map();
    let totalOpeningValue = 0;

    products.forEach(p => {
      const pAgg = purMap.get(p.id);
      const purQty = pAgg?._sum?.quantity || 0;
      const purVal = pAgg?._sum?.totalNet || 0;
      
      const pRetAgg = purRetMap.get(p.id);
      const purRetQty = pRetAgg?._sum?.quantity || 0;
      const purRetVal = pRetAgg?._sum?.totalNet || 0;

      const factor = p.conversionFactor || 1;
      const openingPieces = p.openingQty * factor;
      const openingValue = p.openingQty * p.openingWeightedAvg; // Box * Price_Per_Box = correct EGP value

      const totalInQtyPieces = openingPieces + purQty - purRetQty;
      const totalInValue = openingValue + purVal - purRetVal;

      const wac = totalInQtyPieces > 0 
        ? totalInValue / totalInQtyPieces 
        : (p.openingWeightedAvg / factor);

      productWAC.set(p.id, wac);
      totalOpeningValue += openingValue;
    });

    // Calculate COGS for Period
    const salesItemsForPeriod = await prisma.invoiceItem.findMany({
      where: { invoice: { type: { in: ['SALES', 'SALES_RETURN'] }, date: { gte: startDate, lt: endDate }, isDeleted: false } },
      select: { productId: true, quantity: true, invoice: { select: { type: true } } }
    });

    let totalCOGS = 0;
    salesItemsForPeriod.forEach(item => {
      // SALES_RETURN quantity is subtracted from COGS because it returned to stock
      const q = item.invoice.type === 'SALES' ? item.quantity : -item.quantity;
      totalCOGS += (q * (productWAC.get(item.productId) || 0));
    });

    // 3. BALANCE SHEET AGGREGATES (Cumulative)
    const [allSalesBefore, allPurBefore, allSalesRetBefore, allPurRetBefore, allExpBefore, allPayBefore] = await Promise.all([
      prisma.invoice.aggregate({ where: { type: 'SALES', date: { lt: endDate }, isDeleted: false }, _sum: { netAmount: true } }),
      prisma.invoice.aggregate({ where: { type: 'PURCHASES', date: { lt: endDate }, isDeleted: false }, _sum: { netAmount: true } }),
      prisma.invoice.aggregate({ where: { type: 'SALES_RETURN', date: { lt: endDate }, isDeleted: false }, _sum: { netAmount: true } }),
      prisma.invoice.aggregate({ where: { type: 'PURCHASES_RETURN', date: { lt: endDate }, isDeleted: false }, _sum: { netAmount: true } }),
      prisma.expense.aggregate({ where: { date: { lt: endDate } }, _sum: { amount: true } }),
      prisma.payment.groupBy({ by: ['type'], where: { date: { lt: endDate }, isDeleted: false }, _sum: { amount: true } })
    ]);

    const accCashIn = allPayBefore.find(p => p.type === 'IN')?._sum?.amount || 0;
    const accCashOut = allPayBefore.find(p => p.type === 'OUT')?._sum?.amount || 0;
    const cashOnHand = accCashIn - accCashOut - (allExpBefore._sum.amount || 0);

    // Period specific Opening Balances
    const [allExpBeforeStart, allPayBeforeStart] = await Promise.all([
      prisma.expense.aggregate({ where: { date: { lt: startDate } }, _sum: { amount: true } }),
      prisma.payment.groupBy({ by: ['type'], where: { date: { lt: startDate }, isDeleted: false }, _sum: { amount: true } })
    ]);
    const cashInBeforeStart = allPayBeforeStart.find(p => p.type === 'IN')?._sum?.amount || 0;
    const cashOutBeforeStart = allPayBeforeStart.find(p => p.type === 'OUT')?._sum?.amount || 0;
    const openingCashBalanceForPeriod = 10278 + cashInBeforeStart - cashOutBeforeStart - (allExpBeforeStart._sum.amount || 0);

    const [salesStart, salesRetStart, purStart, purRetStart] = await Promise.all([
      prisma.invoiceItem.groupBy({ by: ['productId'], where: { invoice: { type: 'SALES', date: { lt: startDate }, isDeleted: false } }, _sum: { quantity: true } }),
      prisma.invoiceItem.groupBy({ by: ['productId'], where: { invoice: { type: 'SALES_RETURN', date: { lt: startDate }, isDeleted: false } }, _sum: { quantity: true } }),
      prisma.invoiceItem.groupBy({ by: ['productId'], where: { invoice: { type: 'PURCHASES', date: { lt: startDate }, isDeleted: false } }, _sum: { quantity: true } }),
      prisma.invoiceItem.groupBy({ by: ['productId'], where: { invoice: { type: 'PURCHASES_RETURN', date: { lt: startDate }, isDeleted: false } }, _sum: { quantity: true } })
    ]);

    let totalOpeningValueForPeriod = 0;
    products.forEach(p => {
      const factor = p.conversionFactor || 1;
      const openingPieces = p.openingQty * factor;
      const purchased = (purStart.find(x => x.productId === p.id)?._sum?.quantity || 0) - (purRetStart.find(x => x.productId === p.id)?._sum?.quantity || 0);
      const sold = (salesStart.find(x => x.productId === p.id)?._sum?.quantity || 0) - (salesRetStart.find(x => x.productId === p.id)?._sum?.quantity || 0);
      const curQtyAtStart = openingPieces + purchased - sold;
      if (curQtyAtStart > 0) {
        totalOpeningValueForPeriod += curQtyAtStart * (productWAC.get(p.id) || 0);
      }
    });

    // Dynamic Inventory Value at EndDate
    const [salesHistoryAgg, salesRetHistoryAgg] = await Promise.all([
      prisma.invoiceItem.groupBy({
        by: ['productId'],
        where: { invoice: { type: 'SALES', date: { lt: endDate }, isDeleted: false } },
        _sum: { quantity: true }
      }),
      prisma.invoiceItem.groupBy({
        by: ['productId'],
        where: { invoice: { type: 'SALES_RETURN', date: { lt: endDate }, isDeleted: false } },
        _sum: { quantity: true }
      })
    ]);

    const salesMap = new Map(salesHistoryAgg.map(i => [i.productId, i._sum.quantity || 0]));
    const salesRetMap = new Map(salesRetHistoryAgg.map(i => [i.productId, i._sum.quantity || 0]));

    let endingInventoryValue = 0;
    const inventoryDetails: any[] = [];

    products.forEach(p => {
      const factor = p.conversionFactor || 1;
      const openingPieces = p.openingQty * factor;
      
      const pPurchased = (purMap.get(p.id)?._sum?.quantity || 0) - (purRetMap.get(p.id)?._sum?.quantity || 0);
      const pSold = (salesMap.get(p.id) || 0) - (salesRetMap.get(p.id) || 0);
      
      const curQty = openingPieces + pPurchased - pSold;
      const wac = productWAC.get(p.id) || 0;
      const value = curQty * wac;
      
      endingInventoryValue += value;
      
      if (curQty !== 0) {
         inventoryDetails.push({ id: p.id, name: p.name, qty: curQty, wac, value });
      }
    });

    inventoryDetails.sort((a,b) => b.value - a.value);

    // Debt & Receivables
    const persons = await prisma.person.findMany();
    const initialCustomerDebt = persons.filter(p => p.type === 'CUSTOMER').reduce((s, p) => s + p.initialBalance, 0);
    const initialSupplierCredit = persons.filter(p => p.type === 'SUPPLIER').reduce((s, p) => s + p.initialBalance, 0);

    const personPaymentAgg = await prisma.payment.groupBy({
      by: ['personId', 'type'],
      where: { date: { lt: endDate }, isDeleted: false },
      _sum: { amount: true }
    });

    const getPersonPaid = (pid: string, type: 'IN' | 'OUT') => {
      return personPaymentAgg.find(a => a.personId === Number(pid) && a.type === type)?._sum?.amount || 0;
    };
    
    const [personSalesAgg, personSalesRetAgg, personPurAgg, personPurRetAgg] = await Promise.all([
      prisma.invoice.groupBy({ by: ['personId'], where: { type: 'SALES', date: { lt: endDate }, isDeleted: false }, _sum: { netAmount: true } }),
      prisma.invoice.groupBy({ by: ['personId'], where: { type: 'SALES_RETURN', date: { lt: endDate }, isDeleted: false }, _sum: { netAmount: true } }),
      prisma.invoice.groupBy({ by: ['personId'], where: { type: 'PURCHASES', date: { lt: endDate }, isDeleted: false }, _sum: { netAmount: true } }),
      prisma.invoice.groupBy({ by: ['personId'], where: { type: 'PURCHASES_RETURN', date: { lt: endDate }, isDeleted: false }, _sum: { netAmount: true } })
    ]);

    const getAgg = (arr: any[], id: string) => Number(arr.find(a => a.personId === Number(id))?._sum?.netAmount) || 0;

    const customerDetails = persons.filter(p => p.type === 'CUSTOMER').map(p => {
      const sales = getAgg(personSalesAgg, String(p.id)) - getAgg(personSalesRetAgg, String(p.id));
      const paid = getPersonPaid(String(p.id), 'IN') - getPersonPaid(String(p.id), 'OUT'); // Out meaning refunds
      const bal = p.initialBalance + sales - paid;
      return { name: p.name, phone: p.phone, address: p.address, initial: p.initialBalance, sales, paid, balance: bal };
    }).filter(p => Math.abs(p.balance) > 0.1);

    const supplierDetails = persons.filter(p => p.type === 'SUPPLIER').map(p => {
      const purchases = getAgg(personPurAgg, String(p.id)) - getAgg(personPurRetAgg, String(p.id));
      const paid = getPersonPaid(String(p.id), 'OUT') - getPersonPaid(String(p.id), 'IN');
      const bal = p.initialBalance + purchases - paid;
      return { name: p.name, phone: p.phone, address: p.address, initial: p.initialBalance, purchases, paid, balance: bal };
    }).filter(p => Math.abs(p.balance) > 0.1);

    const receivables = initialCustomerDebt + ((allSalesBefore._sum.netAmount || 0) - (allSalesRetBefore._sum.netAmount || 0)) - 
      persons.filter(p => p.type === 'CUSTOMER').reduce((s, p) => s + (getPersonPaid(String(p.id), 'IN') - getPersonPaid(String(p.id), 'OUT')), 0);
      
    const payables = initialSupplierCredit + ((allPurBefore._sum.netAmount || 0) - (allPurRetBefore._sum.netAmount || 0)) - 
      persons.filter(p => p.type === 'SUPPLIER').reduce((s, p) => s + (getPersonPaid(String(p.id), 'OUT') - getPersonPaid(String(p.id), 'IN')), 0);

    const openingCashBalance = 10278;

    const balanceSheet = {
      cashOnHand: cashOnHand + openingCashBalance,
      receivables,
      payables,
      inventoryValue: endingInventoryValue,
      previousProfit: 0, 
      currentProfit: (totalSales - totalCOGS) - totalExpenses,
      totalAssets: (cashOnHand + openingCashBalance) + receivables + endingInventoryValue
    };

    const invoices = await prisma.invoice.findMany({
      where: { date: { gte: startDate, lt: endDate }, isDeleted: false },
      include: { person: true },
      take: 200, 
      orderBy: { date: 'desc' }
    });

    const expenseBreakdown: Record<string, number> = {};
    const allExpenses = await prisma.expense.findMany({ where: { date: { gte: startDate, lt: endDate } } });
    allExpenses.forEach(e => {
      expenseBreakdown[e.category] = (expenseBreakdown[e.category] || 0) + e.amount;
    });

    const totalPaymentsIn = payAgg.filter(p => p.type === 'IN').reduce((s, p) => s + p.amount, 0);
    const totalPaymentsOut = payAgg.filter(p => p.type === 'OUT').reduce((s, p) => s + p.amount, 0);

    return NextResponse.json({
      success: true,
      totals: {
        totalSales,
        totalPurchases,
        totalCOGS,
        grossProfit: totalSales - totalCOGS,
        totalExpenses,
        netProfit: (totalSales - totalCOGS) - totalExpenses,
        totalPaymentsIn,
        totalPaymentsOut,
        salesCount: (salesAgg._count || 0) + (salesRetAgg._count || 0),
        purchasesCount: (purAgg._count || 0) + (purRetAgg._count || 0),
        totalDeliveryRevenue,
        totalDiscount,
        totalOpeningValue: totalOpeningValueForPeriod,
        openingCashBalance: openingCashBalanceForPeriod 
      },
      balanceSheet,
      balanceSheetDetails: {
        customers: customerDetails,
        suppliers: supplierDetails, 
        inventory: inventoryDetails.slice(0, 100),
        cash: payAgg.sort((a,b) => b.date.getTime() - a.date.getTime())
      },
      expenseBreakdown,
      invoices,
      expenses: allExpenses,
      monthly: []
    });

  } catch (error) {
    console.error('Reports Optimization Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
