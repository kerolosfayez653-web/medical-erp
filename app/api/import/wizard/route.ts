import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

function parseExcelDate(serialOrStr: any): Date {
  if (!serialOrStr) return new Date();
  if (typeof serialOrStr === 'number') {
    const utcValue = Math.floor(serialOrStr - 25569) * 86400;
    return new Date(utcValue * 1000);
  }
  const d = new Date(serialOrStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Group invoice lines by (invoiceNumber + personName) → one invoice per group
function groupInvoiceLines(items: any[], invNumKey: string, personKey: string, dateKey: string) {
  const groups = new Map<string, any[]>();
  for (const item of items) {
    const invNum = String(item[invNumKey] || '').trim();
    const person = String(item[personKey] || '').trim();
    if (!person || !invNum) continue; // skip empty rows
    const key = `${invNum}__${person}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { step, items } = body;

    // ── STEP 1: CLEANUP ──────────────────────────────────────────
    if (step === 'RESET') {
      await prisma.payment.deleteMany();
      await prisma.invoiceItem.deleteMany();
      await prisma.invoice.deleteMany();
      await prisma.inventoryLot.deleteMany();
      await prisma.product.deleteMany();
      await prisma.person.deleteMany();
      return NextResponse.json({ success: true, message: 'Wiped' });
    }

    // ── STEP 2: INITIAL BALANCES (sheet: المخزون) ─────────────────
    // Columns: الكود | الصنف | متوسط مرجح 1/1/2026 | رصيد اول المدة 1/1/2026 | التصنيف | متوسط سعر البيع
    if (step === 'INITIAL') {
      let created = 0, skipped = 0;
      for (const item of items) {
        const pName = String(item['الصنف'] || item['الاسم'] || '').trim();
        if (!pName) { skipped++; continue; }

        const barcodeVal = String(item['الكود'] || `AUTO_${Date.now()}_${Math.random().toString(36).substring(7)}`);
        const openingWA  = parseFloat(String(item['متوسط مرجح 1/1/2026'] || 0))  || 0;
        const openingQty = parseFloat(String(item['رصيد اول المدة 1/1/2026'] || 0)) || 0;
        const category   = String(item['التصنيف'] || 'عام').trim() || 'عام';
        const avgSell    = parseFloat(String(item['متوسط سعر البيع'] || 0)) || 0;

        let product = await prisma.product.findFirst({
          where: { OR: [{ barcode: barcodeVal }, { name: pName }] }
        });
        if (!product) {
          product = await prisma.product.create({
            data: { name: pName, category, barcode: barcodeVal, openingQty, openingWeightedAvg: openingWA }
          });
        } else {
          product = await prisma.product.update({
            where: { id: product.id },
            data: { openingQty, openingWeightedAvg: openingWA, category }
          });
        }

        if (openingQty > 0) {
          await prisma.inventoryLot.create({
            data: {
              productId: product.id,
              batchNumber: 'INIT-اول-المدة',
              expiryDate: new Date('2099-12-31'),
              quantity: openingQty,
              costPrice: openingWA,
              sellingPrice: avgSell,
            }
          });
        }
        created++;
      }
      return NextResponse.json({ success: true, created, skipped });
    }

    // ── STEP 2.5: INITIAL DEBTS (sheet: مديونيات) ─────────────────
    if (step === 'DEBTS') {
      for (const item of items) {
        const personName = String(
          item['اسم العميل / المورد'] || item['العميل'] || item['اسم العميل'] || ''
        ).trim();
        if (!personName) continue;

        const phone   = String(item['رقم التليفون'] || item['التليفون'] || item['الهاتف'] || '').trim() || null;
        const address = String(item['العنوان'] || item['عنوان'] || '').trim() || null;

        let person = await prisma.person.findFirst({ where: { name: personName } });
        if (!person) {
          person = await prisma.person.create({ 
            data: { 
              name: personName, 
              type: 'CUSTOMER',
              phone: phone,
              address: address
            } 
          });
        }
        const debt = parseFloat(String(item['رصيد 2025'] || item['رصيد اول المدة'] || item['رصيد'] || 0)) || 0;
        if (debt !== 0 || phone || address) {
          await prisma.person.update({
            where: { id: person.id },
            data: { 
              initialBalance: debt, 
              currentBalance: { increment: debt - person.initialBalance },
              phone: phone || undefined,
              address: address || undefined
            }
          });
        }
      }
      return NextResponse.json({ success: true });
    }

    // ── STEP 3: PURCHASES (sheet: pur) ───────────────────────────
    // Each invoice = group of rows with same (رقم الفاتورة + اسم العميل/المورد)
    // IMPORTANT: In the pur sheet, "اسم العميل" column = SUPPLIER name
    if (step === 'PURCHASES') {
      // Group rows by (invoice number + supplier)
      const groups = groupInvoiceLines(items, 'رقم الفاتورة', 'اسم العميل', 'التاريخ');

      for (const [, lines] of groups) {
        const firstLine = lines[0];
        const supplierName = String(firstLine['اسم العميل'] || '').trim();
        if (!supplierName) continue;

        // Get or create supplier
        const supplierPhone   = String(firstLine['رقم التليفون'] || '').trim() || null;
        const supplierAddress = String(firstLine['العنوان'] || '').trim() || null;
        let person = await prisma.person.findFirst({ where: { name: supplierName, type: 'SUPPLIER' } });
        if (!person) {
          person = await prisma.person.create({ data: { name: supplierName, type: 'SUPPLIER', phone: supplierPhone, address: supplierAddress } });
        } else if (supplierPhone && !person.phone) {
          person = await prisma.person.update({ where: { id: person.id }, data: { phone: supplierPhone, address: supplierAddress } });
        }

        const invDate  = parseExcelDate(firstLine['التاريخ']);
        const invNum   = String(firstLine['رقم الفاتورة'] || '');

        // Build invoice items
        const invoiceItemsData: { productId: number; quantity: number; price: number; total: number }[] = [];
        let invoiceTotal = 0;
        const lotCreations: { productId: number; qty: number; cost: number }[] = [];

        for (const line of lines) {
          const pName = String(line['الصنف'] || '').trim();
          if (!pName) continue;

          const qty  = parseFloat(String(line['الكمية'] || 0)) || 0;
          if (qty <= 0) continue;

          const cost  = parseFloat(String(line['السعر'] || line['المتوسط المرجح'] || 0)) || 0;
          const total = parseFloat(String(line['الاجمالي'] || 0)) || (qty * cost);
          invoiceTotal += total;

          let product = await prisma.product.findFirst({ where: { name: pName } });
          if (!product) {
            product = await prisma.product.create({
              data: { name: pName, barcode: `AUTO_${Date.now()}_${Math.random().toString(36).substring(7)}` }
            });
          }

          invoiceItemsData.push({ productId: product.id, quantity: qty, price: cost, total });
          lotCreations.push({ productId: product.id, qty, cost });
        }

        if (invoiceItemsData.length === 0) continue;

        const discount   = parseFloat(String(firstLine['خصم نقدي'] || firstLine['اجمالي الخصم'] || 0)) || 0;
        const delivery   = 0; // No delivery in purchases sheet usually
        const netFromSheet = parseFloat(String(firstLine['الصافي'] || firstLine['الاجمالي'] || 0)) || 0;
        const finalTotal = netFromSheet > 0 ? netFromSheet : (invoiceTotal + delivery - discount);

        const collectionSuppliers = body.collectionSuppliers || [];
        const isCreditPurchase = collectionSuppliers.includes(person.name) || Math.abs(person.initialBalance) > 0;
        const paid      = isCreditPurchase ? 0 : finalTotal;
        const payStatus = isCreditPurchase ? 'CREDIT' : 'CASH';

        // Create invoice with all items
        const inv = await prisma.invoice.create({
          data: {
            type: 'PURCHASES',
            personId: person.id,
            totalAmount: finalTotal,
            paidAmount: paid,
            paymentStatus: payStatus,
            discount: discount,
            deliveryFee: delivery,
            invoiceNumber: invNum,
            date: invDate,
            items: { create: invoiceItemsData }
          }
        });

        // Create purchase lots for each line
        for (const lot of lotCreations) {
          await prisma.inventoryLot.create({
            data: {
              productId: lot.productId,
              batchNumber: `PUR-${inv.id}`,
              expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              quantity: lot.qty,
              costPrice: lot.cost,
              sellingPrice: lot.cost * 1.3,
            }
          });
        }
        
        // Update person balance if credit invoice
        if (payStatus === 'CREDIT') {
          await prisma.person.update({
             where: { id: person.id },
             data: { currentBalance: { increment: finalTotal } }
          });
        }
      }
      return NextResponse.json({ success: true });
    }

    // ── STEP 4: SALES (sheet: sales) ─────────────────────────────
    // Each invoice = group of rows with same (رقم الفاتورة + اسم العميل)
    if (step === 'SALES') {
      const groups = groupInvoiceLines(items, 'رقم الفاتورة', 'اسم العميل', 'التاريخ');

      for (const [, lines] of groups) {
        const firstLine   = lines[0];
        const custName    = String(firstLine['اسم العميل'] || '').trim();
        if (!custName) continue;

        const custPhone   = String(firstLine['رقم التليفون'] || '').trim() || null;
        const custAddress = String(firstLine['العنوان'] || '').trim() || null;
        let person = await prisma.person.findFirst({ where: { name: custName, type: 'CUSTOMER' } });
        if (!person) {
          person = await prisma.person.create({ data: { name: custName, type: 'CUSTOMER', phone: custPhone, address: custAddress } });
        } else if (custPhone && !person.phone) {
          person = await prisma.person.update({ where: { id: person.id }, data: { phone: custPhone, address: custAddress } });
        }

        const invDate = parseExcelDate(firstLine['التاريخ']);
        const invNum  = String(firstLine['رقم الفاتورة'] || '');

        // Total invoice value: use صافي الفاتورة from last non-empty line, or sum
        let invoiceTotal = 0;
        const invoiceItemsData: { productId: number; quantity: number; price: number; total: number }[] = [];
        const deductLater: { productId: number; qty: number }[] = [];

        for (const line of lines) {
          const pName = String(line['الصنف'] || '').trim();
          if (!pName) continue;

          const qty   = Math.abs(parseFloat(String(line['الكمية'] || 0))) || 0;
          if (qty <= 0) continue;

          const price = parseFloat(String(line['سعر البيع'] || 0)) || 0;
          const lineTotal = qty * price;
          invoiceTotal += lineTotal;

          let product = await prisma.product.findFirst({ where: { name: pName } });
          if (!product) {
            product = await prisma.product.create({
              data: { name: pName, barcode: `AUTO_${Date.now()}_${Math.random().toString(36).substring(7)}` }
            });
          }

          invoiceItemsData.push({ productId: product.id, quantity: qty, price, total: lineTotal });
          deductLater.push({ productId: product.id, qty });
        }

        if (invoiceItemsData.length === 0) continue;

        const discount    = parseFloat(String(firstLine['اجمالي الخصم'] || firstLine['الخصم'] || 0)) || 0;
        const delivery    = parseFloat(String(firstLine['توصيل'] || 0)) || 0;

        // Use صافي الفاتورة from first line if available (it's the invoice-level total)
        const netFromSheet = parseFloat(String(firstLine['صافي الفاتورة'] || firstLine['الصافى'] || 0)) || 0;
        const finalTotal   = netFromSheet > 0 ? netFromSheet : (invoiceTotal + delivery - discount);

        const collectionCustomers = body.collectionCustomers || [];
        const isCreditSales = collectionCustomers.includes(person.name) || Math.abs(person.initialBalance) > 0;
        const paid      = isCreditSales ? 0 : finalTotal;
        const payStatus = isCreditSales ? 'CREDIT' : 'CASH';

        await prisma.invoice.create({
          data: {
            type: 'SALES',
            personId: person.id,
            totalAmount: finalTotal,
            paidAmount: paid,
            paymentStatus: payStatus,
            discount: discount,
            deliveryFee: delivery,
            invoiceNumber: invNum,
            date: invDate,
            items: { create: invoiceItemsData }
          }
        });

        // FIFO deduction from inventory lots
        for (const deduct of deductLater) {
          let qtyNeeded = deduct.qty;
          const lots = await prisma.inventoryLot.findMany({
            where: { productId: deduct.productId, quantity: { gt: 0 } },
            orderBy: { id: 'asc' }
          });
          for (const lot of lots) {
            if (qtyNeeded <= 0) break;
            const take = Math.min(lot.quantity, qtyNeeded);
            await prisma.inventoryLot.update({
              where: { id: lot.id },
              data: { quantity: { decrement: take } }
            });
            qtyNeeded -= take;
          }
          // If still negative: create a negative lot to reflect reality
            if (qtyNeeded > 0) {
            await prisma.inventoryLot.create({
              data: {
                productId: deduct.productId,
                batchNumber: 'DEFICIT',
                expiryDate: new Date('2099-12-31'),
                quantity: -qtyNeeded,
                costPrice: 0,
                sellingPrice: 0,
              }
            });
          }
        }
        
        // Update person balance if credit invoice
        if (payStatus === 'CREDIT') {
          await prisma.person.update({
             where: { id: person.id },
             data: { currentBalance: { increment: finalTotal } }
          });
        }
      }
      return NextResponse.json({ success: true });
    }

    // ── STEP 5: PAYMENTS ─────────────────────────────────────────
    if (step === 'PAYMENTS') {
      for (const item of items) {
        const isCustomer  = !!item['العميل'];
        const personName  = String(item['العميل'] || item['اسم المورد'] || '').trim();
        if (!personName) continue;

        const typeEnum    = isCustomer ? 'CUSTOMER' : 'SUPPLIER';
        const paymentType = isCustomer ? 'IN' : 'OUT';

        let person = await prisma.person.findFirst({ where: { name: personName, type: typeEnum } });
        if (!person) {
          person = await prisma.person.create({ data: { name: personName, type: typeEnum } });
        }

        const amount = parseFloat(String(item['المبلغ'] || 0)) || 0;
        
        const methodRaw = String(item['طريقة السداد'] || item['طريقة الدفع'] || 'نقدي').trim();
        const dateVal   = item['التاريخ'] ? parseExcelDate(item['التاريخ']) : new Date();
        const invNumber = String(item['ف'] || item['رقم الفاتورة'] || '').trim();

        if (amount > 0) {
          // Find matching invoice for linkage
          let matchedInvoiceId = null;
          if (invNumber && invNumber !== 'undefined' && invNumber !== '') {
            const match = await prisma.invoice.findFirst({ where: { invoiceNumber: invNumber, personId: person.id } });
            if (match) matchedInvoiceId = match.id;
          }

          await prisma.payment.create({
            data: { 
              personId: person.id, 
              amount, 
              type: paymentType, 
              notes: String(item['البيان'] || 'تسديد'),
              method: methodRaw,
              date: dateVal,
              invoiceId: matchedInvoiceId
            }
          });
          await prisma.person.update({
            where: { id: person.id },
            data: { currentBalance: { decrement: amount } }
          });
        }
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown step' }, { status: 400 });

  } catch (error) {
    console.error('Wizard Error:', error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}
