import * as xlsx from 'xlsx';
import * as fs from 'fs';

const filename = 'سیستم الفواتیر والمخزون.xlsx'; 
// Note: I will search for the file again to be sure of the name in the filesystem.
// The dir output showed some weird characters.

async function listSheets() {
  try {
    const files = fs.readdirSync('.');
    const excelFile = files.find(f => f.endsWith('.xlsx'));
    if (!excelFile) {
      console.error('No Excel file found');
      return;
    }
    console.log('Found file:', excelFile);
    const wb = xlsx.readFile(excelFile);
    console.log('Sheets:', wb.SheetNames);
    
    // Also log first few rows of each sheet to understand structure
    for (const sheetName of wb.SheetNames) {
        if (sheetName.includes('Vercel') || sheetName.includes('Sheet')) continue;
        console.log(`\n--- Sheet: ${sheetName} ---`);
        const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
        console.log(data.slice(0, 2));
    }
  } catch (err) {
    console.error('Error reading file:', err);
  }
}

listSheets();
