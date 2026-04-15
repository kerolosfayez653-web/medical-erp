import * as xlsx from 'xlsx';
import * as fs from 'fs';

async function analyzeAllExcelFiles() {
  const files = fs.readdirSync('.');
  const excelFiles = files.filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  
  for (const file of excelFiles) {
    console.log(`\n=========================================`);
    console.log(`FILE: ${file}`);
    try {
      const wb = xlsx.readFile(file);
      console.log('Sheet Names:', wb.SheetNames);
      for (const sheetName of wb.SheetNames) {
        console.log(`\n--- Sheet: ${sheetName} ---`);
        const sheet = wb.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet);
        console.log(`Rows: ${rows.length}`);
        if (rows.length > 0) {
          console.log('Columns:', Object.keys(rows[0]));
          console.log('First Row Sample:', rows[0]);
        }
      }
    } catch (err) {
      console.error(`Error reading ${file}:`, err);
    }
  }
}

analyzeAllExcelFiles();
