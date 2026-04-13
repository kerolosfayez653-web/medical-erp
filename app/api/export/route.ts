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

    // Helper: Optimized WAC (Database Level)
    const getWACMap = async (endDate: Date) => {
      const products = await prisma.product.findMany({
        select: { id: true, openingQty: true, openingWeightedAvg: true }
      });
      const purchaseAgg = await prisma.invoiceItem.groupBy({
        by: ['productId'],
        where: { invoice: { type: 'PURCHASES', date: { lt: endDate } } },
        _sum: { quantity: true, totalNet: true }
      });
      const purMap = new Map(purchaseAgg.map(i => [i.productId, i]));
      const wacMap = new Map();
      products.forEach(p => {
        const agg = purMap.get(p.id);
        const q = p.openingQty + (agg?._sum?.quantity || 0);
        const v = (p.openingQty * p.openingWeightedAvg) + (agg?._sum?.totalNet || 0);
        wacMap.set(p.id, q > 0 ? v / q : p.openingWeightedAvg);
      });
      return wacMap;
    };

    if (type === 'people') {
      const people = await prisma.person.findMany({ orderBy: { name: 'asc' } });
      fileName = 'العملاء_والموردين.xlsx';
      sheetName = 'الأرصدة';
      data = people.map(p => ({
        'الاسم': p.name || 'بدون اسم',
        'النوع': p.type === 'CUSTOMER' ? 'عميل' : 'مورد',
        'التليفون': p.phone || '',
        'العنوان': p.address || '',
        'رصيد أول المدة': p.initialBalance || 0,
        'الرصيد الحالي': p.currentBalance || 0,
        'آخر تحديث': p.updatedAt ? p.updatedAt.toLocaleDateString('ar-EG') : ''
      }));
    } 
    else if (type === 'inventory') {
      const wacMap = await getWACMap(new Date());
      const products = await prisma.product.findMany({
        include: { lots: true },
        orderBy: { name: 'asc' }
      });
      
      const salesHistory = await prisma.invoiceItem.groupBy({
        by: ['productId'],
        where: { invoice: { type: 'SALES' } },
        _sum: { quantity: true }
      });
      const salesMap = new Map(salesHistory.map(i => [i.productId, i._sum.quantity || 0]));

      fileName = 'جرد_المستودع.xlsx';
      sheetName = 'المخزن';
      
      // Pre-fetch all purchased quantities in one go to optimize
      const purchaseAgg = await prisma.invoiceItem.groupBy({
        by: ['productId'],
        where: { invoice: { type: 'PURCHASES' } },
        _sum: { quantity: true }
      });
      const purchaseMap = new Map(purchaseAgg.map(i => [i.productId, i._sum.quantity || 0]));

      data = products.map((p) => {
        const pPurchased = purchaseMap.get(p.id) || 0;
        const totalQty = (p.openingQty || 0) + pPurchased - (salesMap.get(p.id) || 0);
        const wac = wacMap.get(p.id) || 0;
        return {
          'اسم الصنف': p.name || 'صنف غير مسمى',
          'الباركود': p.barcode || '',
          'الفئة': p.category || '',
          'الكمية المتوفرة': totalQty,
          'الوحدة': p.unit || '',
          'متوسط التكلفة (WAC)': Number(wac.toFixed(2)),
          'إجمالي القيمة': Number((totalQty * wac).toFixed(2))
        };
      });
    }
    else if (type === 'invoices') {
      const invType = searchParams.get('invType');
      const invoices = await prisma.invoice.findMany({
        where: invType && invType !== 'ALL' ? { type: invType as any } : {},
        include: { person: { select: { name: true, type: true } } },
        orderBy: { date: 'desc' }
      });
      fileName = invType === 'SALES' ? 'سجل_المبيعات.xlsx' : invType === 'PURCHASES' ? 'سجل_المشتريات.xlsx' : 'سجل_الفواتير.xlsx';
      sheetName = 'الفواتير';
      data = invoices.map(inv => ({
        'رقم الفاتورة': inv.invoiceNumber || inv.id.toString(),
        'التاريخ': inv.date ? inv.date.toLocaleDateString('ar-EG') : '',
        'النوع': inv.type === 'SALES' ? 'مبيعات' : inv.type === 'PURCHASES' ? 'مشتريات' : inv.type,
        'تصنيف الجهة': inv.person?.type === 'CUSTOMER' ? 'عميل' : inv.person?.type === 'SUPPLIER' ? 'مورد' : 'غير محدد',
        'العميل/المورد': inv.person?.name || 'غير محدد',
        'الإجمالي': inv.totalAmount || 0,
        'الخصم': inv.discount || 0,
        'التوصيل': inv.deliveryFee || 0,
        'الصافي': inv.netAmount || 0,
        'المدفوع': inv.paidAmount || 0,
        'الحالة': inv.paymentStatus === 'CASH' ? 'مسدد' : 'آجل',
        'طريقة السداد': inv.paymentMethod || ''
      }));
    }
    else if (type === 'quotations') {
      const quotations = await prisma.quotation.findMany({
        include: { person: { select: { name: true } } },
        orderBy: { date: 'desc' }
      });
      fileName = 'عروض_الأسعار.xlsx';
      sheetName = 'العروض';
      data = quotations.map(q => ({
        'رقم العرض': q.quotationNumber || q.id.toString(),
        'التاريخ': q.date ? q.date.toLocaleDateString('ar-EG') : '',
        'العميل': q.person?.name || 'عميل عام',
        'الإجمالي': q.totalAmount || 0,
        'الخصم': q.discount || 0,
        'الصافي': q.netAmount || 0,
        'ملاحظات': q.notes || ''
      }));
    }
    else if (type === 'statement' && personId) {
      const pId = parseInt(personId);
      const person = await prisma.person.findUnique({ where: { id: pId } });
      if (!person) throw new Error('Person not found');

      const invoices = await prisma.invoice.findMany({ where: { personId: pId }, orderBy: { date: 'asc' } });
      const payments = await prisma.payment.findMany({ where: { personId: pId }, orderBy: { date: 'asc' } });

      const entries: any[] = [];
      let runningBalance = person.initialBalance || 0;

      entries.push({ 
        'التاريخ': 'سابق', 
        'البيان': 'رصيد أول المدة', 
        'مدين': runningBalance > 0 ? runningBalance : 0, 
        'دائن': runningBalance < 0 ? Math.abs(runningBalance) : 0, 
        'الرصيد': runningBalance 
      });

      const allEvents = [
        ...invoices.map(inv => ({ date: inv.date, type: 'INV', data: inv })),
        ...payments.map(pay => ({ date: pay.date, type: 'PAY', data: pay }))
      ].sort((a, b) => a.date.getTime() - b.date.getTime());

      for (const event of allEvents) {
        let debit = 0, credit = 0, desc = '';
        if (event.type === 'INV') {
          const inv = event.data;
          desc = `فاتورة ${inv.type === 'SALES' ? 'مبيعات' : 'مشتريات'} ${inv.invoiceNumber || inv.id}`;
          if (inv.type === 'SALES') debit = inv.netAmount;
          else credit = inv.netAmount;
        } else {
          const pay = event.data;
          desc = pay.notes || 'سداد/تحصيل';
          if (pay.type === 'IN') credit = pay.amount;
          else debit = pay.amount;
        }
        runningBalance += (debit - credit);
        entries.push({
          'التاريخ': event.date ? event.date.toLocaleDateString('ar-EG') : '',
          'البيان': desc,
          'مدين': debit,
          'دائن': credit,
          'الرصيد': runningBalance
        });
      }
      data = entries;
      fileName = `كشف_حساب_${(person.name || 'عميل').replace(/\s+/g, '_')}.xlsx`;
      sheetName = 'كشف الحساب';
    }

    if (data.length === 0) {
      // Return a basic sheet with a "No Data" message if empty
      data = [{ 'تنبيه': 'لا توجد بيانات متاحة لهذا التقرير حالياً' }];
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Enable Autofilter
    if (data.length > 0) {
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
      ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };
    }
    
    // Attempt Right-to-Left (Note: Support varies by XLSX reader)
    if (!ws['!views']) ws['!views'] = [];
    ws['!views'].push({ RTL: true });
    
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Export error details:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'خطأ أثناء تصدير البيانات: ' + (error instanceof Error ? error.message : String(error)) 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
