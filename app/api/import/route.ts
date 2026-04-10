import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items = body.items;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    let importedCount = 0;

    for (const item of items) {
      const pName = item.الاسم || item.name || item.الصنف;
      if (!pName) continue;

      const barcodeVal = String(item.الباركود || item.الكود || item.barcode || `AUTO_${Date.now()}_${Math.random().toString(36).substring(7)}`);

      const product = await prisma.product.upsert({
        where: { barcode: barcodeVal },
        update: {},
        create: {
          name: pName,
          category: item.التصنيف || item.category || 'عام',
          unit: item.الوحدة || item.unit || 'قطعة',
          barcode: barcodeVal,
        }
      });

      // Insert Inventory Lot
      const qty = parseInt(item.الكمية || item.quantity || item.الرصيد) || 0;
      if (qty > 0) {
         let expDate = new Date();
         expDate.setFullYear(expDate.getFullYear() + 1); // Default to +1 year if not provided
         
         const rawDate = item.تاريخ_الصلاحية || item.expiryDate;
         if (rawDate) {
            const parsedDt = new Date(rawDate);
            if (!isNaN(parsedDt.getTime())) expDate = parsedDt;
         }

         const cPrice = parseFloat(String(item.سعر_الشراء || item.costPrice || item['المتوسط المرجح'])) || parseFloat(String(item['متوسط مرجح 1/1/2026'])) || 0;
         const sPrice = parseFloat(String(item.سعر_البيع || item.sellingPrice || item['متوسط سعر البيع'])) || 0;

         await prisma.inventoryLot.create({
            data: {
              productId: product.id,
              batchNumber: String(item.رقم_التشغيلة || item.batchNumber || `B-${Date.now()}`),
              expiryDate: expDate,
              quantity: qty,
              costPrice: cPrice,
              sellingPrice: sPrice,
            }
         });
      }
      importedCount++;
    }

    return NextResponse.json({ success: true, count: importedCount });
  } catch (error) {
    console.error('Import Error: ', error);
    return NextResponse.json({ error: 'Server error during import' }, { status: 500 });
  }
}
