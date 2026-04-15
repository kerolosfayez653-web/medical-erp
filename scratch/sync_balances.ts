import prisma from '../lib/prisma';
import * as xlsx from 'xlsx';

const EXCEL_FILE = 'سيستم الفواتير والمخزون.xlsx';
const SHEET_NAME = 'مديونيات العملاء و الموردين';

async function syncBalances() {
  try {
    console.log('--- STARTING GLOBAL BALANCE SYNCHRONIZATION ---');

    console.log(`Reading Excel: ${EXCEL_FILE}...`);
    const wb = xlsx.readFile(EXCEL_FILE);
    const sheet = wb.Sheets[SHEET_NAME];
    const excelData = xlsx.utils.sheet_to_json(sheet, { range: 7, header: 1 }) as any[][];

    // Create a map for quick lookup: Name -> FinalBalance
    const excelMap = new Map<string, number>();
    for (const row of excelData) {
      if (!row || !row[0]) continue;
      const name = String(row[0]).trim();
      const finalBalance = parseFloat(row[5]) || 0;
      excelMap.set(name, finalBalance);
    }

    console.log(`Loaded ${excelMap.size} records from Excel.`);

    const people = await prisma.person.findMany({
      include: {
        invoices: { where: { isDeleted: false } },
        payments: { where: { isDeleted: false } }
      }
    });

    console.log(`Auditing ${people.length} people in database...`);

    let updatedCount = 0;
    let missingCount = 0;

    for (const p of people) {
      const excelBalance = excelMap.get(p.name.trim());
      if (excelBalance === undefined) {
        // console.warn(`! Missing in Excel: ${p.name}`);
        missingCount++;
        continue;
      }

      // Calculate total system activity (ignoring existing initialBalance)
      let activity = 0;
      for (const inv of p.invoices) {
        if (inv.type === 'SALES' || inv.type === 'PURCHASES_RETURN') {
          activity += inv.netAmount;
        } else if (inv.type === 'PURCHASES' || inv.type === 'SALES_RETURN') {
          activity -= inv.netAmount;
        }
      }

      for (const pay of p.payments) {
        if (pay.type === 'IN') {
          activity -= pay.amount;
        } else if (pay.type === 'OUT') {
          activity += pay.amount;
        }
      }

      // Required Initial = Final - Activity
      const newInitial = excelBalance - activity;

      await prisma.person.update({
        where: { id: p.id },
        data: {
          initialBalance: newInitial,
          currentBalance: excelBalance
        }
      });
      updatedCount++;
    }

    console.log('\n--- SYNC SUMMARY ---');
    console.log(`Successfully synced: ${updatedCount}`);
    console.log(`Missed (not in Excel): ${missingCount}`);
    console.log('--- SYNC COMPLETE ---');

  } catch (error) {
    console.error('Error during synchronization:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncBalances();
