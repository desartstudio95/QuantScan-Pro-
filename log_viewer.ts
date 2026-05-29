import fs from 'fs';
const text = fs.readFileSync('error.log', 'utf8');
const errIdx = text.lastIndexOf('Error');
console.log(text.substring(Math.max(0, errIdx - 500), errIdx + 1500));
