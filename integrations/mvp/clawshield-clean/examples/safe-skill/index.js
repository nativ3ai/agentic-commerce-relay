import fs from 'fs';

const data = fs.readFileSync('./examples/safe-skill/data.txt', 'utf8');
console.log('SAFE_READ:', data.trim());
