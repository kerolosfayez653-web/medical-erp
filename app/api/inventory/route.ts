import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        invoiceItems: {
          include: {
            invoice: { select: { type: true, date: true } }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const salesInvoicesAgg = await prisma.invoice.aggregate({
      where: { type: 'SALES' },
      _sum: { netAmount: true }
    });
    
    const totalInvoicesSales = salesInvoicesAgg._sum.netAmount || 0;

    const data = products.map((p) => {
      const allPurchases = p.invoiceItems.filter(i => i.invoice.type === 'PURCHASES');
      const allSales     = p.invoiceItems.filter(i => i.invoice.type === 'SALES');

      const purchasedQty = allPurchases.reduce((s, i) => s + i.quantity, 0);
      const purchasedValue = allPurchases.reduce((s, i) => s + i.totalNet, 0);
      
      const soldQty = allSales.reduce((s, i) => s + i.quantity, 0);
      const salesRevenue = allSales.reduce((s, i) => s + i.totalNet, 0);

      // Current Qty = Opening + In - Out
      const currentQty = p.openingQty + purchasedQty - soldQty;
      
      // Weighted Average Cost (Simplified for Excel parity)
      // WAC = (OpeningValue + PurchasedValue) / (OpeningQty + PurchasedQty)
      const totalInputQty = p.openingQty + purchasedQty;
      const weightedAvgCost = totalInputQty > 0 
        ? ((p.openingQty * p.openingWeightedAvg) + purchasedValue) / totalInputQty
        : p.openingWeightedAvg;

      const inventoryValue = currentQty * weightedAvgCost;
      const cogs = soldQty * weightedAvgCost;
      const grossProfit = salesRevenue - cogs;
      const avgSellPrice = soldQty > 0 ? salesRevenue / soldQty : 0;

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        classification: p.classification,
        openingQty: p.openingQty,
        openingWeightedAvg: p.openingWeightedAvg,
        purchasedQty,
        purchasedValue,
        soldQty,
        salesRevenue,
        currentQty,
        weightedAvgCost,
        inventoryValue,
        cogs,
        grossProfit,
        avgSellPrice,
        unit: p.unit,
        secondaryUnit: p.secondaryUnit,
        conversionFactor: p.conversionFactor,
        secondaryPrice: p.secondaryPrice,
        lastSellPrice: p.lastSellPrice || (allSales[0]?.price || 0)
      };
    });

    const totals = {
      totalInventoryValue: data.reduce((s, p) => s + p.inventoryValue, 0),
      totalSalesRevenue:   totalInvoicesSales,
      totalCOGS:           data.reduce((s, p) => s + p.cogs, 0),
      totalGrossProfit:    totalInvoicesSales - data.reduce((s, p) => s + p.cogs, 0),
      totalProducts:       data.length,
      inStockCount:        data.filter(p => p.currentQty > 0).length,
      outOfStockCount:     data.filter(p => p.currentQty <= 0).length,
    };

    return NextResponse.json({ success: true, data, totals });
  } catch (error) {
    console.error('Inventory Fetch Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
