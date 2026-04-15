import { PrismaClient } from '@prisma/client';
import xlsx from 'xlsx';
import * as fs from 'fs';

const prisma = new PrismaClient();

function excelDateToJSDate(serial: any) {
    if (typeof serial !== 'number') return new Date();
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return date_info;
}

// Normalized Factor Helper
function getFactor(name: string): number {
    const n = name.toLowerCase();
    if (n.includes('جوانتي') || n.includes('مشرط') || n.includes('سرنجة') || n.includes('glove') || n.includes('syringe') || n.includes('scalpel')) {
        return 100;
    }
    return 1;
}

async function perfectImport() {
    console.log('--- Starting PERFECT REIMPORT (with Unit Normalization) ---');
    const filename = 'data_source.xlsx';
    if (!fs.existsSync(filename)) {
        console.error('Master Excel file not found!');
        return;
    }
    const wb = xlsx.readFile(filename);

    console.log('Wiping existing data...');
    await prisma.wallet.deleteMany();
    await prisma.invoiceItem.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.inventoryLot.deleteMany();
    await prisma.person.deleteMany();
    await prisma.product.deleteMany();
    await prisma.expense.deleteMany();

    // 1. Wallets
    const peopleSheet = wb.Sheets['مديونيات العملاء و الموردين'];
    const pRaw = xlsx.utils.sheet_to_json(peopleSheet, { header: 1 }) as any[][];
    const wallets = [
        { name: 'انستاباي', balance: Number(pRaw[1]?.[13]) || 10278 },
        { name: 'نقدي', balance: Number(pRaw[4]?.[9]) || 4375 },
        { name: 'اكسيس باي', balance: Number(pRaw[6]?.[9]) || 7370 }
    ];
    for (const w of wallets) {
        await prisma.wallet.create({ data: { name: w.name, openingBalance: w.balance, currentBalance: w.balance } });
    }

    // 2. Products
    console.log('Ph1: Importing Products...');
    const prodSheet = wb.Sheets['المخزون'];
    const prodData = xlsx.utils.sheet_to_json(prodSheet) as any[];
    for (const row of prodData) {
        if (!row['الصنف']) continue;
        const name = String(row['الصنف']).trim();
        const factor = getFactor(name);
        
        await prisma.product.create({
            data: {
                id: Number(row['الكود']) || undefined,
                name: name,
                conversionFactor: factor,
                unit: factor > 1 ? 'علبة' : 'قطعة',
                secondaryUnit: factor > 1 ? 'قطعة' : null,
                openingQty: (Number(row['رصيد اول المدة 1/1/2026']) || 0) * factor,
                openingWeightedAvg: (Number(row['متوسط مرجح 1/1/2026']) || 0) / factor,
            }
        });
    }

    // 3. People
    console.log('Ph2: Importing People...');
    const suppliersSet = new Set<string>();
    const purSheet = wb.Sheets['pur'];
    const purRows = xlsx.utils.sheet_to_json(purSheet) as any[];
    purRows.forEach(r => { if (r['اسم العميل']) suppliersSet.add(String(r['اسم العميل']).trim()); });

    for (let i = 7; i < pRaw.length; i++) {
        const row = pRaw[i];
        if (!row[0] || row[0] === 'العميل') continue;
        await prisma.person.create({
            data: {
                name: String(row[0]).trim(),
                initialBalance: Number(row[2]) || 0,
                type: suppliersSet.has(String(row[0]).trim()) ? 'SUPPLIER' : 'CUSTOMER'
            }
        });
    }

    const products = await prisma.product.findMany();
    const productMap = new Map(products.map(p => [p.name.trim(), p]));
    const people = await prisma.person.findMany();
    const peopleMap = new Map(people.map(p => [p.name.trim(), p.id]));

    // 4. Sales
    console.log('Ph3: Sales...');
    const salesSheet = wb.Sheets['sales'];
    const salesRaw = xlsx.utils.sheet_to_json(salesSheet, { header: 1 }) as any[][];
    const salesInvoices = new Map<string, any[]>();
    for (let i = 1; i < salesRaw.length; i++) {
        const row = salesRaw[i];
        if (!row[1] || !row[6]) continue;
        const key = `${row[3] || 'S'}_${row[1]}_${row[0]}`;
        if (!salesInvoices.has(key)) salesInvoices.set(key, []);
        salesInvoices.get(key)!.push(row);
    }

    for (const [key, rows] of salesInvoices.entries()) {
        const first = rows[0];
        const pId = peopleMap.get(String(first[1]).trim()) || (await prisma.person.create({ data: { name: String(first[1]).trim(), type: 'CUSTOMER' }})).id;
        const invoice = await prisma.invoice.create({
            data: {
                serialNumber: Number(first[3]) || null,
                personId: pId,
                date: excelDateToJSDate(first[0]),
                type: 'SALES',
                paymentStatus: String(first[5]) === 'نقدي' ? 'CASH' : 'CREDIT',
                totalAmount: 0, netAmount: 0
            }
        });
        let total = 0;
        for (const r of rows) {
            const prod = productMap.get(String(r[6]).trim());
            if (!prod) continue;
            const factor = prod.conversionFactor || 1;
            const qty = (Number(r[7]) || 0) * factor;
            const price = (Number(r[8]) || 0) / factor;
            const rowTotal = Number(r[9]) || (qty * price);
            await prisma.invoiceItem.create({
                data: {
                    invoiceId: invoice.id, productId: prod.id,
                    quantity: qty, price: price, total: rowTotal, totalNet: rowTotal,
                    unitType: factor > 1 ? 'SECONDARY' : 'PRIMARY'
                }
            });
            total += rowTotal;
        }
        await prisma.invoice.update({ where: { id: invoice.id }, data: { totalAmount: total, netAmount: total }});
    }

    // 5. Purchases
    console.log('Ph4: Purchases...');
    const purInvoices = new Map<string, any[]>();
    const purRowsRaw = xlsx.utils.sheet_to_json(purSheet, { header: 1 }) as any[][];
    for (let i = 1; i < purRowsRaw.length; i++) {
        const row = purRowsRaw[i];
        if (!row[1] || !row[4]) continue;
        const key = `${row[2] || 'P'}_${row[1]}_${row[0]}`;
        if (!purInvoices.has(key)) purInvoices.set(key, []);
        purInvoices.get(key)!.push(row);
    }
    for (const [key, rows] of purInvoices.entries()) {
        const first = rows[0];
        const pId = peopleMap.get(String(first[1]).trim()) || (await prisma.person.create({ data: { name: String(first[1]).trim(), type: 'SUPPLIER' }})).id;
        const invoice = await prisma.invoice.create({
            data: {
                serialNumber: Number(first[2]) || null,
                personId: pId,
                date: excelDateToJSDate(first[0]),
                type: 'PURCHASES',
                paymentStatus: 'CREDIT',
                totalAmount: 0, netAmount: 0
            }
        });
        let total = 0;
        for (const r of rows) {
            const prod = productMap.get(String(r[4]).trim());
            if (!prod) continue;
            const factor = prod.conversionFactor || 1;
            const qty = (Number(r[5]) || 0) * factor;
            const price = (Number(r[6]) || 0) / factor;
            const rowTotal = Number(r[7]) || (qty * price);
            await prisma.invoiceItem.create({
                data: {
                    invoiceId: invoice.id, productId: prod.id,
                    quantity: qty, price: price, total: rowTotal, totalNet: rowTotal,
                    unitType: factor > 1 ? 'SECONDARY' : 'PRIMARY'
                }
            });
            total += rowTotal;
        }
        await prisma.invoice.update({ where: { id: invoice.id }, data: { totalAmount: total, netAmount: total }});
    }

    // 6. Payments
    console.log('Ph5: Payments...');
    const paySheet = wb.Sheets['تحصيلات من العملاء'];
    const payRows = xlsx.utils.sheet_to_json(paySheet) as any[];
    for (const row of payRows) {
        if (!row['العميل'] || row['العميل'] === 'العميل') continue;
        const pId = peopleMap.get(String(row['العميل']).trim());
        if (!pId) continue;
        await prisma.payment.create({
            data: {
                personId: pId, amount: Number(row['المبلغ']) || 0,
                date: excelDateToJSDate(row['التاريخ']),
                method: String(row['طريقة السداد'] || 'كاش'),
                notes: String(row['البيان'] || ''), type: 'IN'
            }
        });
    }

    console.log('--- PERFECT REIMPORT COMPLETE! ---');
}

perfectImport().catch(console.error).finally(() => prisma.$disconnect());
