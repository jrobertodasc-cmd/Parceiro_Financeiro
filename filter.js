const fs = require('fs');
const cat = fs.readFileSync('lib/categorias.ts', 'utf8');
const lines = cat.split('\n');
const filtered = lines.filter(l => {
    if (!l.match(/\d/)) return true; // Keep lines like export const...
    return l.match(/^\s*\"[0-9]{5} -/); // Keep only 5 digit categories
});
fs.writeFileSync('lib/categorias.ts', filtered.join('\n'));
console.log("Filtered to " + filtered.length + " lines");
