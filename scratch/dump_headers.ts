import * as xlsx from 'xlsx';

async function dumpHeaderArea() {
  const wb = xlsx.readFile('data_source.xlsx');
  const sheet = wb.Sheets['مديونيات العملاء و الموردين'];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  for (let i = 0; i < 10; i++) {
    const row = data[i];
    if (!row) continue;
    console.log(`ROW ${i}:`);
    row.forEach((cell, j) => {
        if (cell !== undefined && cell !== '') {
            console.log(`  [${j}]: ${cell}`);
        }
    });
  }
}

dumpHeaderArea();
