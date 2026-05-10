import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = parseInt(id);

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, barcode: true, category: true, unit: true, secondaryUnit: true, conversionFactor: true, openingQty: true }
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get all invoice items for this product, with invoice + person details
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: { productId, invoice: { isDeleted: false } },
      include: {
        invoice: {
          include: {
            person: { select: { id: true, name: true, type: true } }
          }
        }
      },
      orderBy: { invoice: { date: 'asc' } }
    });

    // Build transaction list with running balance
    let runningBalance = product.openingQty;
    const transactionsAsc = invoiceItems.map(item => {
      const type = item.invoice.type;
      let qtyChange = 0;
      if (type === 'PURCHASES' || type === 'SALES_RETURN') {
        qtyChange = item.quantity; // stock increases
      } else if (type === 'SALES' || type === 'PURCHASES_RETURN') {
        qtyChange = -item.quantity; // stock decreases
      }
      runningBalance += qtyChange;

      return {
        date: item.invoice.date,
        invoiceId: item.invoice.id,
        invoiceNumber: item.invoice.invoiceNumber,
        invoiceType: type,
        personId: item.invoice.person?.id,
        personName: item.invoice.person?.name || 'غير محدد',
        personType: item.invoice.person?.type,
        quantity: item.quantity,
        unitType: item.unitType,
        price: item.price,
        total: item.total,
        balanceAfter: runningBalance,
      };
    });

    // Reverse to show newest first, but balance is calculated correctly
    const transactions = [...transactionsAsc].reverse();

    // Build customer summary (aggregated by person)
    const customerMap: Record<number, { name: string; type: string; totalQty: number; totalAmount: number; invoiceCount: number; lastDate: string }> = {};
    for (const t of transactions) {
      if (!t.personId) continue;
      if (!customerMap[t.personId]) {
        customerMap[t.personId] = { name: t.personName, type: t.personType || '', totalQty: 0, totalAmount: 0, invoiceCount: 0, lastDate: '' };
      }
      customerMap[t.personId].totalQty += t.quantity;
      customerMap[t.personId].totalAmount += t.total;
      customerMap[t.personId].invoiceCount++;
      if (!customerMap[t.personId].lastDate || new Date(t.date) > new Date(customerMap[t.personId].lastDate)) {
        customerMap[t.personId].lastDate = t.date.toISOString();
      }
    }

    const customerSummary = Object.entries(customerMap).map(([id, data]) => ({
      personId: parseInt(id),
      ...data
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    // Stats
    const salesTx = transactions.filter(t => t.invoiceType === 'SALES');
    const purchasesTx = transactions.filter(t => t.invoiceType === 'PURCHASES');

    const stats = {
      totalSalesQty: salesTx.reduce((s, t) => s + t.quantity, 0),
      totalSalesRevenue: salesTx.reduce((s, t) => s + t.total, 0),
      totalPurchasesQty: purchasesTx.reduce((s, t) => s + t.quantity, 0),
      totalPurchasesCost: purchasesTx.reduce((s, t) => s + t.total, 0),
      salesInvoiceCount: new Set(salesTx.map(t => t.invoiceId)).size,
      purchasesInvoiceCount: new Set(purchasesTx.map(t => t.invoiceId)).size,
      uniqueCustomers: new Set(salesTx.map(t => t.personId).filter(Boolean)).size,
      uniqueSuppliers: new Set(purchasesTx.map(t => t.personId).filter(Boolean)).size,
    };

    return NextResponse.json({
      success: true,
      product,
      transactions,
      customerSummary,
      stats
    });
  } catch (error) {
    console.error('Product Statement Error:', error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}
