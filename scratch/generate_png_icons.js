import fs from 'fs';
import path from 'path';

// 最小限の有効な1x1～プレースホルダーPNGバイナリ生成、またはSVGデータURI生成
// 現代のChrome / Android PWA では SVG アイコンがフルサポートされています。
const svgContent = fs.readFileSync('public/icon.svg', 'utf-8');

console.log('SVG icon loaded successfully.');
