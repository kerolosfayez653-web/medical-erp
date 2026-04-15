import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';

const prisma = new PrismaClient();

async function checkMismatches() {
  const wb = xlsx.readFile('data_source.xlsx');
  const peopleInDB = (await prisma.person.findMany()).map(p => p.name.trim());
  
  console.log('--- Checking Sales Mismatches ---');
  const salesSheet = wb.Sheets['sales'];
  const salesData = xlsx.utils.sheet_to_json(salesSheet, { header: 1 }) as any[][];
  const salesNames = new Set(salesData.slice(1).map(r => r[1] ? String(r[1]).trim() : '').filter(n => n));
  
  for (const name of salesNames) {
    if (!peopleInDB.includes(name)) {
      console.log(`Missing in DB: "${name}"`);
    }
  }

  console.log('\n--- Checking Purchase Mismatches ---');
  const purSheet = wb.Sheets['pur'];
  const purData = xlsx.utils.sheet_to_json(purSheet, { header: 1 }) as any[][];
  const purNames = new Set(purData.slice(1).map(r => r[1] ? String(r[1]).trim() : '').filter(n => n));
  
  for (const name of purNames) {
    if (!peopleInDB.includes(name)) {
      console.log(`Missing in DB: "${name}"`);
    }
  }
}

checkMismatches().finally(() => prisma.$disconnect());
