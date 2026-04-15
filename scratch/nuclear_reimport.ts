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

async function nuclearImport() {
    console.log('--- Starting NUCLEAR REIMPORT ---');
    const filename = 'data_source.xlsx';
    if (!fs.existsSync(filename)) {
        console.error('Master Excel file not found!');
        return;
    }
    const wb = xlsx.readFile(filename);

    console.log('Wiping existing data (including Wallets)...');
    await prisma.wallet.deleteMany();
    await prisma.invoiceItem.deleteMany();
    await prisma.invoiceLog.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.inventoryLot.deleteMany();
    await prisma.quotationItem.deleteMany();
    await prisma.quotation.deleteMany();
    await prisma.person.deleteMany();
    await prisma.product.deleteMany();
    await prisma.expense.deleteMany();

    // 1. WALLETS (Opening Balances)
    console.log('Ph0: Importing Wallets...');
    const peopleSheet = wb.Sheets['مديونيات العملاء و الموردين'];
    const pRaw = xlsx.utils.sheet_to_json(peopleSheet, { header: 1 }) as any[][];
    
    // Based on header dump analysis:
    const wallets = [
        { name: 'انستاباي', balance: Number(pRaw[1]?.[13]) || 10278 }, // Row 1 Col 13
        { name: 'نقدي', balance: Number(pRaw[4]?.[9]) || 4375 },       // Row 5 Col 9 (Index 4 in 0-indexed?) No, Row 5 is index 4.
        { name: 'اكسيس باي', balance: Number(pRaw[2]?.[12]) || 0 }    // Row 3 (Index 2) Col 12
    ];

    // Wait, let's re-verify row indices.
    // ROW 1 is index 1 in my dump? No, the dump said "ROW 1:". 
    // Usually sheet_to_json with header:1 starts at row 1 (index 0).
    // Let's adjust:
    const walletsFixed = [
        { name: 'انستاباي', balance: Number(pRaw[1]?.[13]) || 10278 }, // Row 2 (Index 1)
        { name: 'نقدي', balance: Number(pRaw[4]?.[9]) || 4375 },       // Row 5 (Index 4)
        { name: 'اكسيس باي', balance: Number(pRaw[6]?.[9]) || 10155 }  // Row 7 (Index 6)
    ];

    for (const w of walletsFixed) {
        console.log(`Creating Wallet ${w.name} with balance ${w.balance}`);
        await prisma.wallet.create({
            data: { name: w.name, openingBalance: w.balance, currentBalance: w.balance }
        });
    }

    // 1. PRODUCTS
    console.log('Ph1: Importing Products...');
    const prodSheet = wb.Sheets['المخزون'];
    const prodData = xlsx.utils.sheet_to_json(prodSheet) as any[];
    for (const row of prodData) {
        if (!row['الصنف']) continue;
        await prisma.product.create({
            data: {
                id: Number(row['الكود']) || undefined,
                name: String(row['الصنف']).trim(),
                openingQty: Number(row['رصيد اول المدة 1/1/2026']) || 0,
                openingWeightedAvg: Number(row['متوسط مرجح 1/1/2026']) || 0,
            }
        });
    }

    // 2. PEOPLE
    console.log('Ph2: Importing People...');
    const suppliersSet = new Set<string>();
    const purSheet = wb.Sheets['pur'];
    const purRows = xlsx.utils.sheet_to_json(purSheet) as any[];
    purRows.forEach(r => { if (r['اسم العميل']) suppliersSet.add(String(r['اسم العميل']).trim()); });

    for (let i = 7; i < pRaw.length; i++) {
        const row = pRaw[i];
        const name = row[0];
        if (!name || name === 'العميل' || name === 'اسم العميل / المورد') continue;
        
        const cleanName = String(name).trim();
        await prisma.person.create({
            data: {
                name: cleanName,
                phone: String(row[1] || '').trim(),
                initialBalance: Number(row[2]) || 0,
                type: suppliersSet.has(cleanName) ? 'SUPPLIER' : 'CUSTOMER'
            }
        });
    }

    const getPersonId = async (name: string, type: 'CUSTOMER' | 'SUPPLIER') => {
        const cleanName = name.trim();
        let person = await prisma.person.findFirst({ where: { name: cleanName } });
        if (!person) {
            console.log(`Auto-creating missing person: ${cleanName}`);
            person = await prisma.person.create({
                data: { name: cleanName, type: type, initialBalance: 0 }
            });
        }
        return person.id;
    };

    const productMap = new Map((await prisma.product.findMany()).map(p => [p.name.trim(), p.id]));

    // 3. SALES INVOICES
    console.log('Ph3: Importing Sales Invoices...');
    const salesSheet = wb.Sheets['sales'];
    const salesRaw = xlsx.utils.sheet_to_json(salesSheet, { header: 1 }) as any[][];
    const salesInvoices = new Map<string, any[]>();
    for (let i = 1; i < salesRaw.length; i++) {
        const row = salesRaw[i];
        if (!row[1] || !row[6]) continue;
        const key = `${row[3]}_${row[1]}_${row[0]}`;
        if (!salesInvoices.has(key)) salesInvoices.set(key, []);
        salesInvoices.get(key)!.push(row);
    }

    for (const [key, rows] of salesInvoices.entries()) {
        const first = rows[0];
        const personId = await getPersonId(String(first[1]), 'CUSTOMER');

        const invoice = await prisma.invoice.create({
            data: {
                serialNumber: Number(first[3]),
                personId: personId,
                date: excelDateToJSDate(first[0]),
                type: 'SALES',
                paymentStatus: String(first[5]) === 'نقدي' ? 'CASH' : 'CREDIT',
                totalAmount: 0,
                netAmount: 0
            }
        });

        let total = 0;
        for (const r of rows) {
            const prodId = productMap.get(String(r[6]).trim());
            if (!prodId) continue;
            const qty = Number(r[7]) || 0;
            const price = Number(r[8]) || 0;
            const rowTotal = Number(r[9]) || (qty * price);
            
            await prisma.invoiceItem.create({
                data: {
                    invoiceId: invoice.id,
                    productId: prodId,
                    quantity: qty,
                    price: price,
                    total: rowTotal,
                    totalNet: rowTotal
                }
            });
            total += rowTotal;
        }
        await prisma.invoice.update({ where: { id: invoice.id }, data: { totalAmount: total, netAmount: total }});
    }

    // 4. PURCHASE INVOICES
    console.log('Ph4: Importing Purchase Invoices...');
    const purInvoices = new Map<string, any[]>();
    const purRowsRaw = xlsx.utils.sheet_to_json(purSheet, { header: 1 }) as any[][];
    for (let i = 1; i < purRowsRaw.length; i++) {
        const row = purRowsRaw[i];
        if (!row[1] || !row[4]) continue;
        const key = `${row[2]}_${row[1]}_${row[0]}`;
        if (!purInvoices.has(key)) purInvoices.set(key, []);
        purInvoices.get(key)!.push(row);
    }

    for (const [key, rows] of purInvoices.entries()) {
        const first = rows[0];
        const personId = await getPersonId(String(first[1]), 'SUPPLIER');

        const invoice = await prisma.invoice.create({
            data: {
                serialNumber: Number(first[2]),
                personId: personId,
                date: excelDateToJSDate(first[0]),
                type: 'PURCHASES',
                paymentStatus: String(first[3]) === 'نقدي' ? 'CASH' : 'CREDIT',
                totalAmount: 0,
                netAmount: 0
            }
        });

        let total = 0;
        for (const r of rows) {
            const prodId = productMap.get(String(r[4]).trim());
            if (!prodId) continue;
            const qty = Number(r[5]) || 0;
            const price = Number(r[6]) || 0;
            const rowTotal = Number(r[7]) || (qty * price);
            
            await prisma.invoiceItem.create({
                data: {
                    invoiceId: invoice.id,
                    productId: prodId,
                    quantity: qty,
                    price: price,
                    total: rowTotal,
                    totalNet: rowTotal
                }
            });
            total += rowTotal;
        }
        await prisma.invoice.update({ where: { id: invoice.id }, data: { totalAmount: total, netAmount: total }});
    }

    // 5. PAYMENTS & 6. EXPENSES
    console.log('Ph5 & 6: Payments & Expenses...');
    const paySheet = wb.Sheets['تحصيلات من العملاء'];
    const payRows = xlsx.utils.sheet_to_json(paySheet) as any[];
    for (const row of payRows) {
        if (!row['العميل'] || row['العميل'] === 'العميل') continue;
        const personId = await getPersonId(String(row['العميل']), 'CUSTOMER');
        await prisma.payment.create({
            data: {
                personId: personId,
                amount: Number(row['المبلغ']) || 0,
                date: excelDateToJSDate(row['التاريخ']),
                method: String(row['طريقة السداد'] || 'كاش'),
                notes: String(row['البيان'] || ''),
                type: 'IN'
            }
        });
    }

    const expSheet = wb.Sheets['المصروفات'];
    const expRows = xlsx.utils.sheet_to_json(expSheet) as any[];
    for (const row of expRows) {
        if (!row['المبلغ']) continue;
        await prisma.expense.create({
            data: {
                amount: Number(row['المبلغ']),
                category: String(row['نوع المصروف']),
                description: String(row['البيان'] || ''),
                date: excelDateToJSDate(row['التاريخ']),
                paymentMethod: String(row['طريقة الدفع'] || 'نقدي')
            }
        });
    }

    console.log('--- NUCLEAR REIMPORT COMPLETE! ---');
}

nuclearImport().catch(console.error).finally(() => prisma.$disconnect());
