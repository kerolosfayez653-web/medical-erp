import * as xlsx from 'xlsx';
// If the above fails, try:
// const xlsx = require('xlsx');
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function excelDateToDate(excelDate: any): Date {
  if (!excelDate) return new Date();
  if (excelDate instanceof Date) return excelDate;
  if (typeof excelDate === 'number') {
    if (excelDate > 1000000) return new Date(excelDate);
    return new Date((excelDate - 25569) * 86400 * 1000);
  }
  return new Date();
}

function normalize(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .trim()
    .replace(/[د\.\/]/g, '')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('--- RESTORING STABLE SYSTEM (YESTERDAY STATE) ---');
  const wb = xlsx.readFile('data_source.xlsx', { cellDates: true });

  // 1. CLEAR ALL
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "InvoiceLog", "InvoiceItem", "Payment", "Invoice", "Expense", "InventoryLot", "QuotationItem", "Quotation", "Product", "Person" RESTART IDENTITY CASCADE;`);

  // 2. PRODUCTS (From 'المخزون')
  const productMap = new Map<string, number>();
  const invSheet = wb.Sheets['المخزون'];
  let invMaxR = 0;
  Object.keys(invSheet).forEach(k => { if(k[0] !== '!') { const c = xlsx.utils.decode_cell(k); if(c.r > invMaxR) invMaxR = c.r; } });

  for (let r = 1; r <= invMaxR; r++) {
    const get = (c: number) => invSheet[xlsx.utils.encode_cell({r, c})]?.v;
    const name = String(get(1) || '').trim();
    if (!name || name === 'الصنف') continue;
    
    // Default factor is 1, but we will update it in a separate pass if needed
    const p = await prisma.product.create({
      data: {
        name,
        classification: String(get(16) || 'General'),
        unit: 'وحدة',
        openingQty: parseFloat(get(3)) || 0,
        openingWeightedAvg: parseFloat(get(2)) || 0,
        lastPurchasePrice: parseFloat(get(2)) || 0,
        lastSellPrice: parseFloat(get(12)) || 0,
        conversionFactor: 1
      }
    });
    productMap.set(normalize(name), p.id);
  }

  // 3. PEOPLE
  const personMap = new Map<string, number>();
  const findPersonId = async (name: string, type: 'CUSTOMER' | 'SUPPLIER' = 'CUSTOMER') => {
    if (!name) return null;
    const norm = normalize(name);
    if (personMap.has(norm)) return personMap.get(norm);
    for (const [existingNorm, id] of personMap.entries()) {
      if (existingNorm.includes(norm) || norm.includes(existingNorm)) return id;
    }
    const p = await prisma.person.create({ data: { name, type, initialBalance: 0 } });
    personMap.set(norm, p.id);
    return p.id;
  };

  // 4. SALES LOGS (Strict Import)
  const salesSheet = wb.Sheets['sales'];
  const salesByInv = new Map<string, any[]>();
  let sMaxR = 0;
  Object.keys(salesSheet).forEach(k => { if(k[0] !== '!') { const c = xlsx.utils.decode_cell(k); if(c.r > sMaxR) sMaxR = c.r; } });
  
  for (let r = 1; r <= sMaxR; r++) {
    const get = (c: number) => salesSheet[xlsx.utils.encode_cell({r, c})]?.v;
    const row = { date: get(0), customer: get(1), inv: get(3), method: get(5), prod: get(6), qty: get(7), price: get(8), net: get(12) };
    if (!row.customer || !row.prod) continue;
    
    const invNo = String(row.inv || 'MISC-' + r);
    const id = `INV-${invNo}-${row.date}`;
    if (!salesByInv.has(id)) salesByInv.set(id, []);
    salesByInv.get(id)?.push(row);
  }

  const firstProdId = (await prisma.product.findFirst())?.id || 1;

  for (const [id, items] of salesByInv) {
    const pid = await findPersonId(items[0].customer);
    await prisma.invoice.create({
      data: {
        invoiceNumber: String(items[0].inv || 'LOG-' + Math.random()),
        date: excelDateToDate(items[0].date),
        personId: pid as number,
        type: 'SALES',
        paymentStatus: 'CASH',
        totalAmount: items.reduce((s, i) => s + (parseFloat(i.net) || 0), 0),
        netAmount: items.reduce((s, i) => s + (parseFloat(i.net) || 0), 0),
        items: {
          create: items.map(i => ({
            productId: productMap.get(normalize(i.prod)) || firstProdId,
            quantity: parseFloat(i.qty) || 0,
            price: parseFloat(i.price) || 0,
            total: (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0),
            totalNet: parseFloat(i.net) || 0
          }))
        }
      }
    });
  }

  // 5. PURCHASES
  const purSheet = wb.Sheets['pur'];
  let pMaxR = 0;
  Object.keys(purSheet).forEach(k => { if(k[0] !== '!') { const c = xlsx.utils.decode_cell(k); if(c.r > pMaxR) pMaxR = c.r; } });
  const purByInv = new Map<string, any[]>();
  for (let r = 1; r <= pMaxR; r++) {
    const get = (c: number) => purSheet[xlsx.utils.encode_cell({r, c})]?.v;
    const row = { date: get(0), sup: get(1), inv: get(3), prod: get(6), qty: get(7), price: get(8), net: get(9) };
    if (!row.sup || !row.prod) continue;
    const id = `PUR-${row.inv}-${row.date}`;
    if (!purByInv.has(id)) purByInv.set(id, []);
    purByInv.get(id)?.push(row);
  }

  for (const [id, items] of purByInv) {
    const pid = await findPersonId(items[0].sup, 'SUPPLIER');
    await prisma.invoice.create({
      data: {
        invoiceNumber: String(items[0].inv || 'P-' + Math.random()),
        date: excelDateToDate(items[0].date),
        personId: pid as number,
        type: 'PURCHASES',
        paymentStatus: 'CASH',
        totalAmount: items.reduce((s, i) => s + (parseFloat(i.net) || 0), 0),
        netAmount: items.reduce((s, i) => s + (parseFloat(i.net) || 0), 0),
        items: {
          create: items.map(i => ({
            productId: productMap.get(normalize(i.prod)) || firstProdId,
            quantity: parseFloat(i.qty) || 0,
            price: parseFloat(i.price) || 0,
            total: (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0),
            totalNet: parseFloat(i.net) || 0
          }))
        }
      }
    });
  }

  // 6. EXPENSES
  const expRows: any[] = xlsx.utils.sheet_to_json(wb.Sheets['المصروفات']);
  for (const row of expRows) {
    const amt = parseFloat(row['المبلغ']);
    if (!amt) continue;
    await prisma.expense.create({
      data: { date: excelDateToDate(row['التاريخ']), category: String(row['نوع المصروف'] || 'General'), amount: amt, description: String(row['البيان'] || '') }
    });
  }

  // 7. PAYMENTS
  const payRows: any[] = xlsx.utils.sheet_to_json(wb.Sheets['تحصيلات من العملاء']);
  for (const row of payRows) {
    const amt = parseFloat(row['المبلغ']);
    if (!amt) continue;
    const pid = await findPersonId(row['العميل']);
    await prisma.payment.create({
      data: { date: excelDateToDate(row['التاريخ']), personId: pid as number, amount: amt, type: 'IN', method: String(row['طريقة السداد'] || 'كاش') }
    });
  }

  console.log('--- SYSTEM RESTORED TO YESTERDAY STATE ---');
}

main().catch(console.error);
