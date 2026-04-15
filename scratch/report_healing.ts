import fs from 'fs';
import path from 'path';

const reportPath = 'c:/Users/Administrator/.gemini/antigravity/scratch/medical_erp/app/api/reports/route.ts';

if (!fs.existsSync(reportPath)) {
  console.log('Report API not found!');
  process.exit(1);
}

let content = fs.readFileSync(reportPath, 'utf8');

// 1. Simplify Product WAC Accumulation (Remove heuristic normalized check)
content = content.replace(/const purQty = pItems\.reduce\(\(s, i\) => \{[\s\S]*?\}, 0\);/g, 
`const purQty = pItems.reduce((s, i) => s + i.quantity, 0);`);

// 2. Simplify COGS calculation for period (Remove heuristic guessing)
content = content.replace(/salesItemsForPeriod\.forEach\(item => \{[\s\S]*?\}\);/g, 
`salesItemsForPeriod.forEach(item => {
      const qty = item.quantity;
      totalCOGS += (qty * (productWAC.get(item.productId) || 0));
    });`);

// 3. Simplify Inventory Value calculation (Remove any hidden splits)
// (The current code already uses pPurchased and pSold derived from clean sums, but ensuring it's direct)
// No changes needed for the endingInventoryValue loop as it uses purMap and salesMap which we healed.

fs.writeFileSync(reportPath, content);
console.log('Report API Healed Globally.');
