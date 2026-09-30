import fs from 'fs';

const buf = fs.readFileSync('public/icon-192.png');
const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
const isJpg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;

console.log('Is PNG:', isPng);
console.log('Is JPG:', isJpg);
