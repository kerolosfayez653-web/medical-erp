import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();

    if (!q || q.length < 1) {
      return NextResponse.json({ success: true, results: [] });
    }

    const query = q.toLowerCase();

    // Parallel search across all entities
    const [products, people, invoices, payments] = await Promise.all([
      // 1. Products
      prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
            { barcode: { contains: query, mode: 'insensitive' } },
          ]
        },
        select: {
          id: true, name: true, category: true, unit: true, barcode: true,
          lastSellPrice: true, lastPurchasePrice: true,
        },
        take: 10
      }),

      // 2. People (Customers & Suppliers)
      prisma.person.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
            { address: { contains: query, mode: 'insensitive' } },
          ]
        },
        select: {
          id: true, name: true, type: true, phone: true, address: true,
          currentBalance: true,
        },
        take: 10
      }),

      // 3. Invoices
      prisma.invoice.findMany({
        where: {
          isDeleted: false,
          OR: [
            { invoiceNumber: { contains: query, mode: 'insensitive' } },
            { person: { name: { contains: query, mode: 'insensitive' } } },
          ]
        },
        select: {
          id: true, invoiceNumber: true, type: true, netAmount: true,
          date: true, paymentStatus: true,
          person: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
        take: 10
      }),

      // 4. Payments
      prisma.payment.findMany({
        where: {
          isDeleted: false,
          OR: [
            { notes: { contains: query, mode: 'insensitive' } },
            { person: { name: { contains: query, mode: 'insensitive' } } },
          ]
        },
        select: {
          id: true, amount: true, type: true, method: true, date: true,
          notes: true,
          person: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
        take: 8
      }),
    ]);

    // Format results into unified structure
    const results: any[] = [];

    products.forEach(p => {
      results.push({
        type: 'product',
        icon: '📦',
        title: p.name,
        subtitle: p.category || p.unit || '',
        detail: p.barcode ? `باركود: ${p.barcode}` : '',
        url: `/inventory`,
        meta: { id: p.id, lastSellPrice: p.lastSellPrice, lastPurchasePrice: p.lastPurchasePrice }
      });
    });

    people.forEach(p => {
      const typeLabel = p.type === 'CUSTOMER' ? 'عميل' : 'مورد';
      const balance = p.currentBalance !== 0 ? `رصيد: ${p.currentBalance.toLocaleString('en-US')} ج.م` : '';
      results.push({
        type: 'person',
        icon: p.type === 'CUSTOMER' ? '👤' : '🏭',
        title: p.name,
        subtitle: `${typeLabel} ${p.phone ? '| ' + p.phone : ''}`,
        detail: balance,
        url: `/people/${p.id}/statement`,
        meta: { id: p.id, personType: p.type }
      });
    });

    invoices.forEach(inv => {
      const typeLabels: Record<string, string> = {
        'SALES': 'مبيعات', 'PURCHASES': 'مشتريات',
        'SALES_RETURN': 'مرتجع مبيعات', 'PURCHASES_RETURN': 'مرتجع مشتريات'
      };
      results.push({
        type: 'invoice',
        icon: '🧾',
        title: inv.invoiceNumber || `فاتورة #${inv.id}`,
        subtitle: `${typeLabels[inv.type] || inv.type} | ${inv.person?.name || 'بدون عميل'}`,
        detail: `${inv.netAmount.toLocaleString('en-US')} ج.م`,
        url: `/invoices/${inv.id}/print`,
        meta: { id: inv.id, date: inv.date, status: inv.paymentStatus }
      });
    });

    payments.forEach(pay => {
      results.push({
        type: 'payment',
        icon: '💰',
        title: `${pay.type === 'IN' ? 'تحصيل' : 'صرف'} - ${pay.person?.name || ''}`,
        subtitle: `${pay.method || 'كاش'} | ${new Date(pay.date).toLocaleDateString('ar-EG')}`,
        detail: `${pay.amount.toLocaleString('en-US')} ج.م`,
        url: `/payments`,
        meta: { id: pay.id, notes: pay.notes }
      });
    });

    return NextResponse.json({
      success: true,
      results,
      counts: {
        products: products.length,
        people: people.length,
        invoices: invoices.length,
        payments: payments.length,
        total: results.length
      }
    });

  } catch (error: any) {
    console.error('Search Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
