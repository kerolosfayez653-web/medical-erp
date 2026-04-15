import fs from 'fs';
import path from 'path';

const baseDir = 'c:/Users/Administrator/.gemini/antigravity/scratch/medical_erp/app';

function healFile(filePath: string, replacements: Array<{search: RegExp | string, replace: string}>) {
  const fullPath = path.join(baseDir, filePath);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let original = content;
  
  for (const r of replacements) {
    content = content.replace(r.search, r.replace);
  }
  
  if (content !== original) {
    fs.writeFileSync(fullPath, content);
    console.log(`Healed UI ${filePath}`);
  }
}

const allFiles = [
  'sales/page.tsx',
  'purchases/page.tsx',
  'quotations/page.tsx',
  'invoices/page.tsx',
  'inventory/page.tsx',
  'invoices/[id]/print/page.tsx',
  'quotations/[id]/print/page.tsx',
  'people/[id]/statement/page.tsx'
];

for (const f of allFiles) {
  healFile(f, [
    // Remove factor-based price calculations
    { search: /const factor\s*=\s*Number\(product\.conversionFactor\)\s*\|\|\s*1;/g, replace: 'const factor = 1;' },
    { search: /const sPrice\s*=\s*typeof product\.secondaryPrice === 'number' \? Number\(product\.secondaryPrice\) : \(currentPrice \/ factor\);/g, replace: 'const sPrice = currentPrice;' },
    // Remove secondary unit display from cart items
    { search: /secondaryUnit: product\.secondaryUnit,/g, replace: 'secondaryUnit: null,' },
    { search: /unitType: 'PRIMARY',/g, replace: "unitType: 'PRIMARY'," },
    // Remove unitType branching in displays
    { search: /item\.unitType === 'SECONDARY' \? item\.quantity : \(item\.quantity \/ \(item\.product\?.conversionFactor \|\| 1\)\)/g, replace: 'item.quantity' },
    { search: /item\.unitType === 'SECONDARY' \? \(item\.product\?.secondaryUnit \|\| 'قطعة'\) : \(item\.product\?.unit \|\| 'علبة'\)/g, replace: "(item.product?.unit || 'وحدة')" }
  ]);
}

console.log('Global UI Purification (Box-Only Model) Complete.');
