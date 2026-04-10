import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const personId = searchParams.get('personId');

  try {
    let data: any[] = [];
    let fileName = 'export.xlsx';
    let sheetName = 'Data';

    if (type === 'people') {
      const people = await prisma.person.findMany({
        orderBy: { name: 'asc' }
      });
      fileName = 'العملاء_والموردين.xlsx';
      sheetName = 'الأرصدة';
      data = people.map(p => ({
        'الاسم': p.name,
        'النوع': p.type === 'CUSTOMER' ? 'عميل' : 'مورد',
        'التليفون': p.phone || '',
        'العنوان': p.address || '',
        'رصيد أول المدة': p.initialBalance,
        'الرصيد الحالي': p.currentBalance,
        'آخر تحديث': p.updatedAt.toLocaleDateString('ar-EG')
      }));
    } 
    else if (type === 'inventory') {
      const products = await prisma.product.findMany({
        include: { lots: true },
        orderBy: { name: 'asc' }
      });
      fileName = 'جرد_المستودع.xlsx';
      sheetName = 'المخزن';
      data = products.map(p => {
        const totalQty = p.lots.reduce((sum, lot) => sum + lot.quantity, 0);
        return {
          'اسم الصنف': p.name,
          'الباركود': p.barcode || '',
          'الفئة': p.category || '',
          'الكمية المتوفرة': totalQty,
          'الوحدة': p.unit || '',
          'متوسط التكلفة': p.weightedAvgCost,
          'إجمالي القيمة': totalQty * p.weightedAvgCost
        };
      });
    }
    else if (type === 'invoices') {
      const invType = searchParams.get('invType'); // SALES or PURCHASES
      const invoices = await prisma.invoice.findMany({
        where: invType ? { type: invType as any } : {},
        include: { person: { select: { name: true } } },
        orderBy: { date: 'desc' }
      });
      fileName = invType === 'SALES' ? 'سجل_المبيعات.xlsx' : 'سجل_المشتريات.xlsx';
      sheetName = 'الفواتير';
      data = invoices.map(inv => ({
        'رقم الفاتورة': inv.invoiceNumber || inv.id,
        'التاريخ': inv.date.toLocaleDateString('ar-EG'),
        'العميل/المورد': inv.person.name,
        'الإجمالي': inv.totalAmount,
        'المدفوع': inv.paidAmount,
        'الحالة': inv.paymentStatus === 'CASH' ? 'مسدد' : (inv.paymentStatus === 'PARTIAL' ? 'جزئي' : 'آجل'),
        'طريقة السداد': inv.paymentMethod || ''
      }));
    }
    else if (type === 'statement' && personId) {
      const pId = parseInt(personId);
      const person = await prisma.person.findUnique({ where: { id: pId } });
      if (!person) throw new Error('Person not found');

      // Re-use logic from statement API
      const invoices = await prisma.invoice.findMany({ where: { personId: pId }, orderBy: { date: 'asc' } });
      const payments = await prisma.payment.findMany({ where: { personId: pId }, orderBy: { date: 'asc' } });

      const entries: any[] = [];
      let runningBalance = person.initialBalance;

      // Initial
      entries.push({ 'التاريخ': 'سابق', 'البيان': 'رصيد أول المدة', 'مدين': person.initialBalance > 0 ? person.initialBalance : 0, 'دائن': person.initialBalance < 0 ? Math.abs(person.initialBalance) : 0, 'الرصيد': runningBalance });

      const allEvents = [
        ...invoices.map(inv => ({ date: inv.date, type: 'INV', data: inv })),
        ...payments.map(pay => ({ date: pay.date, type: 'PAY', data: pay }))
      ].sort((a, b) => a.date.getTime() - b.date.getTime());

      for (const event of allEvents) {
        let debit = 0, credit = 0, desc = '';
        if (event.type === 'INV') {
          const inv = event.data;
          desc = `فاتورة ${inv.type === 'SALES' ? 'مبيعات' : 'مشتريات'} ${inv.invoiceNumber || inv.id}`;
          if (inv.type === 'SALES') debit = inv.totalAmount;
          else credit = inv.totalAmount;
        } else {
          const pay = event.data;
          desc = pay.notes || 'سداد/تحصيل';
          if (pay.type === 'IN') credit = pay.amount;
          else debit = pay.amount;
        }
        runningBalance += (debit - credit);
        entries.push({
          'التاريخ': event.date.toLocaleDateString('ar-EG'),
          'البيان': desc,
          'مدين': debit,
          'دائن': credit,
          'الرصيد': runningBalance
        });
      }
      data = entries;
      fileName = `كشف_حساب_${person.name.replace(/\s+/g, '_')}.xlsx`;
      sheetName = 'كشف الحساب';
    }

    // Generate Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Set RTL
    ws['!dir'] = 'rtl';
    
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
