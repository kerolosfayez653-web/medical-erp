import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const productId = searchParams.get('productId');
    const personId = searchParams.get('personId');

    const dateFilter: any = {};
    if (startDate && startDate !== 'null') {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) dateFilter.gte = d;
    }
    if (endDate && endDate !== 'null') {
      const d = new Date(endDate);
      if (!isNaN(d.getTime())) dateFilter.lte = d;
    }

    const invoiceWhere: any = {
      isDeleted: false,
    };
    if (Object.keys(dateFilter).length > 0) {
      invoiceWhere.date = dateFilter;
    }
    if (personId && personId !== 'ALL') {
      invoiceWhere.personId = parseInt(personId);
    }

    const itemWhere: any = {
      invoice: invoiceWhere,
    };
    if (productId && productId !== 'ALL') {
      itemWhere.productId = parseInt(productId);
    }

    // Fetch ALL invoice items with full details
    const items = await prisma.invoiceItem.findMany({
      where: itemWhere,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            unit: true,
            secondaryUnit: true,
            conversionFactor: true,
            category: true,
          }
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            type: true,
            date: true,
            totalAmount: true,
            netAmount: true,
            discount: true,
            deliveryFee: true,
            paymentStatus: true,
            paidAmount: true,
            person: {
              select: {
                id: true,
                name: true,
                type: true,
              }
            }
          }
        }
      },
      orderBy: [
        { invoice: { date: 'desc' } },
        { id: 'asc' }
      ]
    });

    // Group by type for summary
    const salesItems = items.filter(i =>
      i.invoice.type === 'SALES' || i.invoice.type === 'SALES_RETURN'
    );
    const purchaseItems = items.filter(i =>
      i.invoice.type === 'PURCHASES' || i.invoice.type === 'PURCHASES_RETURN'
    );

    // Product-level aggregation for both sales and purchases
    const salesByProduct = new Map<number, {
      name: string;
      category: string;
      unit: string;
      totalQty: number;
      totalValue: number;
      totalCost: number;
      invoiceCount: number;
      avgPrice: number;
      items: any[];
    }>();

    const purchasesByProduct = new Map<number, {
      name: string;
      category: string;
      unit: string;
      totalQty: number;
      totalValue: number;
      invoiceCount: number;
      avgPrice: number;
      items: any[];
    }>();

    salesItems.forEach(item => {
      const pid = item.productId;
      const isReturn = item.invoice.type === 'SALES_RETURN';
      const qty = isReturn ? -item.quantity : item.quantity;
      const value = isReturn ? -item.total : item.total;

      if (!salesByProduct.has(pid)) {
        salesByProduct.set(pid, {
          name: item.product.name,
          category: item.product.category || 'غير مصنف',
          unit: item.product.unit || 'قطعه',
          totalQty: 0,
          totalValue: 0,
          totalCost: 0,
          invoiceCount: 0,
          avgPrice: 0,
          items: []
        });
      }
      const entry = salesByProduct.get(pid)!;
      entry.totalQty += qty;
      entry.totalValue += value;
      entry.totalCost += qty * (item.costPrice || 0);
      entry.invoiceCount++;
      entry.items.push({
        date: item.invoice.date,
        invoiceNumber: item.invoice.invoiceNumber,
        invoiceId: item.invoice.id,
        personName: item.invoice.person?.name || 'نقدي',
        qty: qty,
        price: item.price,
        total: value,
        costPrice: item.costPrice || 0,
        unitType: item.unitType,
        isReturn,
      });
    });

    // Calculate avg price for sales
    salesByProduct.forEach(entry => {
      entry.avgPrice = entry.totalQty !== 0 ? entry.totalValue / entry.totalQty : 0;
    });

    purchaseItems.forEach(item => {
      const pid = item.productId;
      const isReturn = item.invoice.type === 'PURCHASES_RETURN';
      const qty = isReturn ? -item.quantity : item.quantity;
      const value = isReturn ? -item.total : item.total;

      if (!purchasesByProduct.has(pid)) {
        purchasesByProduct.set(pid, {
          name: item.product.name,
          category: item.product.category || 'غير مصنف',
          unit: item.product.unit || 'قطعه',
          totalQty: 0,
          totalValue: 0,
          invoiceCount: 0,
          avgPrice: 0,
          items: []
        });
      }
      const entry = purchasesByProduct.get(pid)!;
      entry.totalQty += qty;
      entry.totalValue += value;
      entry.invoiceCount++;
      entry.items.push({
        date: item.invoice.date,
        invoiceNumber: item.invoice.invoiceNumber,
        invoiceId: item.invoice.id,
        personName: item.invoice.person?.name || 'غير محدد',
        qty: qty,
        price: item.price,
        total: value,
        unitType: item.unitType,
        isReturn,
      });
    });

    // Calculate avg price for purchases
    purchasesByProduct.forEach(entry => {
      entry.avgPrice = entry.totalQty !== 0 ? entry.totalValue / entry.totalQty : 0;
    });

    // Overall summary
    const totalSalesValue = salesItems
      .filter(i => i.invoice.type === 'SALES')
      .reduce((s, i) => s + i.total, 0);
    const totalSalesReturnValue = salesItems
      .filter(i => i.invoice.type === 'SALES_RETURN')
      .reduce((s, i) => s + i.total, 0);
    const totalPurchasesValue = purchaseItems
      .filter(i => i.invoice.type === 'PURCHASES')
      .reduce((s, i) => s + i.total, 0);
    const totalPurchasesReturnValue = purchaseItems
      .filter(i => i.invoice.type === 'PURCHASES_RETURN')
      .reduce((s, i) => s + i.total, 0);

    // Unique invoice counts
    const salesInvoiceIds = new Set(salesItems.map(i => i.invoice.id));
    const purchaseInvoiceIds = new Set(purchaseItems.map(i => i.invoice.id));

    // Get all people and products for filters
    const people = await prisma.person.findMany({
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' }
    });
    const products = await prisma.product.findMany({
      select: { id: true, name: true, category: true },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalSalesValue,
        totalSalesReturnValue,
        netSales: totalSalesValue - totalSalesReturnValue,
        totalPurchasesValue,
        totalPurchasesReturnValue,
        netPurchases: totalPurchasesValue - totalPurchasesReturnValue,
        salesInvoiceCount: salesInvoiceIds.size,
        purchaseInvoiceCount: purchaseInvoiceIds.size,
        salesItemCount: salesItems.length,
        purchaseItemCount: purchaseItems.length,
        uniqueSalesProducts: salesByProduct.size,
        uniquePurchaseProducts: purchasesByProduct.size,
      },
      salesByProduct: Array.from(salesByProduct.entries())
        .map(([id, data]) => ({ productId: id, ...data }))
        .sort((a, b) => b.totalValue - a.totalValue),
      purchasesByProduct: Array.from(purchasesByProduct.entries())
        .map(([id, data]) => ({ productId: id, ...data }))
        .sort((a, b) => b.totalValue - a.totalValue),
      // Raw items for detailed view
      allSalesItems: salesItems.map(i => ({
        id: i.id,
        date: i.invoice.date,
        invoiceNumber: i.invoice.invoiceNumber,
        invoiceId: i.invoice.id,
        invoiceType: i.invoice.type,
        personName: i.invoice.person?.name || 'نقدي',
        personId: i.invoice.person?.id,
        productId: i.productId,
        productName: i.product.name,
        category: i.product.category || 'غير مصنف',
        quantity: i.quantity,
        unitType: i.unitType,
        price: i.price,
        total: i.total,
        costPrice: i.costPrice || 0,
      })),
      allPurchaseItems: purchaseItems.map(i => ({
        id: i.id,
        date: i.invoice.date,
        invoiceNumber: i.invoice.invoiceNumber,
        invoiceId: i.invoice.id,
        invoiceType: i.invoice.type,
        personName: i.invoice.person?.name || 'غير محدد',
        personId: i.invoice.person?.id,
        productId: i.productId,
        productName: i.product.name,
        category: i.product.category || 'غير مصنف',
        quantity: i.quantity,
        unitType: i.unitType,
        price: i.price,
        total: i.total,
      })),
      filters: { people, products },
    });

  } catch (error: any) {
    console.error('Account Statement Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
