const fs = require('fs');

console.log('Reading db_dump.sql...');
const data = fs.readFileSync('db_dump.sql', 'utf8');
const lines = data.split(/\r?\n/);
const output = [];

console.log('Splitting oversized insert statements...');
for (let line of lines) {
  // If the line is an INSERT statement and breaks the 100KB limit
  if (line.trim().toUpperCase().startsWith('INSERT INTO ') && line.length > 90000) {
    const valuesIdx = line.search(/VALUES/i);
    if (valuesIdx !== -1) {
      const prefix = line.substring(0, valuesIdx + 6) + ' '; 
      let rowsText = line.substring(valuesIdx + 6).trim();
      
      if (rowsText.endsWith(';')) rowsText = rowsText.slice(0, -1); 
      
      rowsText = rowsText.replace(/\),\s*\(/g, '),(');
      const rows = rowsText.split('),(');
      
      for (let i = 0; i < rows.length; i++) {
        let row = rows[i];
        if (!row.startsWith('(')) row = '(' + row;
        if (!row.endsWith(')')) row = row + ')';
        output.push(`${prefix}${row};`);
      }
      continue;
    }
  }
  output.push(line);
}

fs.writeFileSync('fixed_dump.sql', output.join('\n'));
console.log('Successfully generated fixed_dump.sql!');