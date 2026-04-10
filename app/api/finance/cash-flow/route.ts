import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const openingCash = 10278;

    // 1. Fetch all explicit payments (Ledger)
    const allPayments = await prisma.payment.findMany({
      include: { 
        person: { select: { name: true, type: true } }, 
        invoice: { select: { invoiceNumber: true, type: true } } 
      },
      orderBy: { date: 'desc' }
    });

    // --- INFLOWS ---
    const customerCollectionsDetails = allPayments
        .filter(p => p.type === 'IN' && p.person?.type === 'CUSTOMER')
        .map(p => ({ 
          date: p.date, 
          label: p.person?.name || 'عميل', 
          amount: p.amount, 
          method: p.method || 'كاش',
          note: p.notes || (p.invoiceId ? `تحصيل فاتورة ${p.invoice?.invoiceNumber || p.invoiceId}` : 'تحصيل نقدي')
        }));

    // --- OUTFLOWS ---
    const supplierPaymentsDetails = allPayments
        .filter(p => p.type === 'OUT' && (p.person?.type === 'SUPPLIER' || !p.person))
        .map(p => ({ 
          date: p.date, 
          label: p.person?.name || (p.invoice?.type === 'PURCHASES' ? 'مشتريات نقدية' : 'جهة خارجية'), 
          amount: p.amount, 
          method: p.method || 'كاش',
          note: p.notes || (p.invoice?.invoiceNumber ? `سداد فاتورة ${p.invoice.invoiceNumber}` : 'دفعة خارجة')
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const customerRefundsDetails = allPayments
        .filter(p => p.type === 'OUT' && p.person?.type === 'CUSTOMER')
        .map(p => ({ 
          date: p.date, 
          label: p.person.name, 
          amount: p.amount, 
          method: p.method || 'كاش',
          note: p.notes 
        }));

    // --- EXPENSES & DRAWINGS ---
    let expenseDetails: any[] = [];
    let drawingsDetails: any[] = [];
    try {
        const prismaObj = prisma as any;
        if (prismaObj.expense) {
            const expenses = await prismaObj.expense.findMany({ orderBy: { date: 'desc' } });
            expenses.forEach((e: any) => {
                const item = { 
                  date: e.date, 
                  label: e.category, 
                  amount: e.amount, 
                  method: e.paymentMethod || 'كاش',
                  note: e.description 
                };
                // Explicitly check for drawings in category
                if (e.category && e.category.includes('مسحوبات')) drawingsDetails.push(item);
                else expenseDetails.push(item);
            });
        }
    } catch (e) {}

    const totalIn = customerCollectionsDetails.reduce((s, d) => s + d.amount, 0);
    const totalSupplierOut = supplierPaymentsDetails.reduce((s, d) => s + d.amount, 0);
    const totalCustomerRefund = customerRefundsDetails.reduce((s, d) => s + d.amount, 0);
    const totalExpenses = expenseDetails.reduce((s, i) => s + i.amount, 0);
    const totalDrawings = drawingsDetails.reduce((s, i) => s + i.amount, 0);

    const totalOut = totalSupplierOut + totalCustomerRefund + totalExpenses + totalDrawings;
    const closingCash = openingCash + totalIn - totalOut;

    return NextResponse.json({
      success: true,
      data: {
        openingCash, totalIn, totalOut, netChange: totalIn - totalOut, closingCash,
        inflows: [
          { category: 'تحصيل من عملاء (نقد وآجل)', amount: totalIn, details: customerCollectionsDetails }
        ],
        outflows: [
          { category: 'مدفوعات مشتريات وموردين', amount: totalSupplierOut, details: supplierPaymentsDetails },
          { category: 'مسحوبات شخصية (تؤثر على المركز المالي)', amount: totalDrawings, details: drawingsDetails },
          { category: 'مصاريف تشغيلية (تؤثر على الأرباح)', amount: totalExpenses, details: expenseDetails },
          { category: 'مرتجعات لعملاء', amount: totalCustomerRefund, details: customerRefundsDetails }
        ]
      }
    });

  } catch (error) {
    console.error('Cash Flow API Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
