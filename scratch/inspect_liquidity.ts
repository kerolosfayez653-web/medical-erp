import * as xlsx from 'xlsx';

async function inspectLiquidity() {
  const wb = xlsx.readFile('data_source.xlsx');
  const sheet = wb.Sheets['مديونيات العملاء و الموردين'];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  console.log('--- Checking Row 1 to 10 for Liquidity/Opening Cash ---');
  data.slice(0, 10).forEach((row, i) => {
      console.log(`${i}:`, row);
  });
}

inspectLiquidity();
