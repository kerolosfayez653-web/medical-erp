import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as fs from 'fs';

const prisma = new PrismaClient();

function excelDateToJSDate(serial: any) {
    if (typeof serial !== 'number') return new Date();
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return date_info;
}

async function totalImport() {
    console.log('--- Starting Total Import ---');
    const filename = 'data_source.xlsx';
    if (!fs.existsSync(filename)) {
        console.error('Master Excel file not found!');
        return;
    }
    const wb = xlsx.readFile(filename);

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
    console.log('Products imported.');

    // 2. PEOPLE
    console.log('Ph2: Importing People...');
    const peopleSheet = wb.Sheets['مديونيات العملاء و الموردين'];
    const peopleRaw = xlsx.utils.sheet_to_json(peopleSheet, { header: 1 }) as any[][];
    // Header is at row 7 (index 6). Data starts at index 7.
    const suppliersSet = new Set<string>();
    
    // Check pur sheet to find suppliers
    const purSheet = wb.Sheets['pur'];
    const purRows = xlsx.utils.sheet_to_json(purSheet) as any[];
    purRows.forEach(r => { if (r['اسم العميل']) suppliersSet.add(String(r['اسم العميل']).trim()); });

    for (let i = 7; i < peopleRaw.length; i++) {
        const row = peopleRaw[i];
        const name = row[0];
        if (!name || name === 'العميل') continue;
        
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
    console.log('People imported.');

    // Pre-cache maps for lookups
    const productMap = new Map((await prisma.product.findMany()).map(p => [p.name.trim(), p.id]));
    const personMap = new Map((await prisma.person.findMany()).map(p => [p.name.trim(), p.id]));

    // 3. SALES INVOICES
    console.log('Ph3: Importing Sales Invoices...');
    const salesSheet = wb.Sheets['sales'];
    const salesRaw = xlsx.utils.sheet_to_json(salesSheet, { header: 1 }) as any[][];
    // Grouping by (Serial, Person, Date)
    const salesInvoices = new Map<string, any[]>();
    for (let i = 1; i < salesRaw.length; i++) {
        const row = salesRaw[i];
        if (!row[1] || !row[6]) continue; // Need person and product
        const key = `${row[3]}_${row[1]}_${row[0]}`; // Serial_Person_Date
        if (!salesInvoices.has(key)) salesInvoices.set(key, []);
        salesInvoices.get(key)!.push(row);
    }

    for (const [key, rows] of salesInvoices.entries()) {
        const first = rows[0];
        const personId = personMap.get(String(first[1]).trim());
        if (!personId) {
            console.warn(`Person ${first[1]} not found for sales serial ${first[3]}`);
            continue;
        }

        const invoice = await prisma.invoice.create({
            data: {
                serialNumber: Number(first[3]),
                personId: personId,
                date: excelDateToJSDate(first[0]),
                type: 'SALES',
                paymentStatus: String(first[5]) === 'نقدي' ? 'CASH' : 'CREDIT',
                totalAmount: 0, // calc later
                netAmount: 0 // calc later
            }
        });

        let total = 0;
        for (const r of rows) {
            const prodId = productMap.get(String(r[6]).trim());
            if (!prodId) {
                console.warn(`Product ${r[6]} not found for sales serial ${r[3]}`);
                continue;
            }
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

        await prisma.invoice.update({
            where: { id: invoice.id },
            data: { totalAmount: total, netAmount: total }
        });
    }

    // 4. PURCHASE INVOICES
    console.log('Ph4: Importing Purchase Invoices...');
    const purRowsRaw = xlsx.utils.sheet_to_json(purSheet, { header: 1 }) as any[][];
    // Headers: ['التاريخ', 'اسم العميل', 'رقم الفاتورة', 'طريقة السداد', 'الصنف', 'الكمية', 'السعر', 'الصافي للصنف']
    const purInvoices = new Map<string, any[]>();
    for (let i = 1; i < purRowsRaw.length; i++) {
        const row = purRowsRaw[i];
        if (!row[1] || !row[4]) continue;
        const key = `${row[2]}_${row[1]}_${row[0]}`;
        if (!purInvoices.has(key)) purInvoices.set(key, []);
        purInvoices.get(key)!.push(row);
    }

    for (const [key, rows] of purInvoices.entries()) {
        const first = rows[0];
        const personId = personMap.get(String(first[1]).trim());
        if (!personId) continue;

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

        await prisma.invoice.update({
            where: { id: invoice.id },
            data: { totalAmount: total, netAmount: total }
        });
    }

    // 5. PAYMENTS
    console.log('Ph5: Importing Payments...');
    const paySheet = wb.Sheets['تحصيلات من العملاء'];
    const payRows = xlsx.utils.sheet_to_json(paySheet) as any[];
    for (const row of payRows) {
        if (!row['العميل'] || row['العميل'] === 'العميل') continue;
        const personId = personMap.get(String(row['العميل']).trim());
        if (!personId) continue;

        await prisma.payment.create({
            data: {
                personId: personId,
                amount: Number(row['المبلغ']) || 0,
                date: excelDateToJSDate(row['التاريخ']),
                method: String(row['طريقة السداد'] || 'كاش'),
                notes: String(row['البيان'] || ''),
                type: 'IN' // Mostly IN from this sheet
            }
        });
    }

    // 6. EXPENSES
    console.log('Ph6: Importing Expenses...');
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

    console.log('--- Total Import Complete! ---');
}

totalImport()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
