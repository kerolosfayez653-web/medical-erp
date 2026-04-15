import * as fs from 'fs';

function renameExcel() {
    const files = fs.readdirSync('.');
    const excelFile = files.find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
    if (excelFile) {
        console.log(`Renaming "${excelFile}" to "data_source.xlsx"`);
        fs.renameSync(excelFile, 'data_source.xlsx');
    } else {
        console.log('No Excel file found');
    }
}

renameExcel();
