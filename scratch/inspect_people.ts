import * as xlsx from 'xlsx';

async function inspectPeopleSheet() {
  const wb = xlsx.readFile('سيستم الفواتير والمخزون.xlsx');
  const sheet = wb.Sheets['مديونيات العملاء و الموردين'];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  console.log('--- Sample Rows (Raw) ---');
  data.slice(0, 10).forEach((row, i) => console.log(i, row));
}

inspectPeopleSheet();
