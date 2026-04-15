import * as xlsx from 'xlsx';

async function inspectSalesPur() {
  const wb = xlsx.readFile('سيستم الفواتير والمخزون.xlsx');
  
  console.log('--- Sales Sheet Sample ---');
  const salesSheet = wb.Sheets['sales'];
  const salesData = xlsx.utils.sheet_to_json(salesSheet, { header: 1 }) as any[][];
  salesData.slice(0, 10).forEach((row, i) => console.log(i, row));

  console.log('\n--- Pur Sheet Sample ---');
  const purSheet = wb.Sheets['pur'];
  const purData = xlsx.utils.sheet_to_json(purSheet, { header: 1 }) as any[][];
  purData.slice(0, 10).forEach((row, i) => console.log(i, row));
}

inspectSalesPur();
