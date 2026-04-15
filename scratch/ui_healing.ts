import fs from 'fs';
import path from 'path';

const baseDir = 'c:/Users/Administrator/.gemini/antigravity/scratch/medical_erp/app';

function healFile(filePath: string, replacements: Array<{search: RegExp | string, replace: string}>) {
  const fullPath = path.join(baseDir, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${filePath} (Not found)`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  let original = content;
  
  for (const r of replacements) {
    content = content.replace(r.search, r.replace);
  }
  
  if (content !== original) {
    fs.writeFileSync(fullPath, content);
    console.log(`Healed ${filePath}`);
  } else {
    console.log(`No changes needed for ${filePath}`);
  }
}

// 1. Unified Quantity Input (Change parseInt to parseFloat everywhere in relevant pages)
const pages = [
  'sales/page.tsx',
  'purchases/page.tsx',
  'quotations/page.tsx',
  'invoices/page.tsx'
];

for (const p of pages) {
  healFile(p, [
    {
      search: /parseInt\(e\.target\.value\)/g,
      replace: `parseFloat(e.target.value)`
    }
  ]);
}

// 2. Remove legacy piece-box display in Statement
healFile('people/[id]/statement/page.tsx', [
  {
     search: /\{item\.unitType === 'SECONDARY' \? item\.quantity : \(item\.quantity \/ \(item\.product\?\.conversionFactor \|\| 1\)\)\} \{item\.unitType === 'SECONDARY' \? \(item\.product\?\.secondaryUnit \|\| 'قطعة'\) : \(item\.product\?\.unit \|\| 'علبة'\)\}/g,
     replace: `{item.quantity.toFixed(1)} {item.product?.unit || 'علبة'}`
  }
]);

// 3. Remove legacy piece-box in Movements
healFile('inventory/[id]/movements/page.tsx', [
  {
     search: /Math\.floor\(m\.quantity \/ \(product\?\.conversionFactor \|\| 1\)\)/g,
     replace: `m.quantity`
  },
  {
     search: /m\.quantity % \(product\?\.conversionFactor \|\| 1\)/g,
     replace: `0`
  }
]);

console.log('Global UI Decimal Alignment Complete.');
