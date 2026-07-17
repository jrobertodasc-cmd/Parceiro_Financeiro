const XLSX = require('xlsx');
const workbook = XLSX.readFile('C:\\Users\\Roberto\\Desktop\\PARCEIRO FINANCEIRO\\financeiro-parceiro\\CATEGORIAS\\Grupos e Categorias.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const categorias = [];
data.forEach(row => {
  if (row[0] && typeof row[0] === 'string' && /^\d+ - /.test(row[0].trim())) {
    categorias.push(row[0].trim());
  }
});

console.log("Found " + categorias.length + " categories.");
console.log(JSON.stringify(categorias, null, 2));
