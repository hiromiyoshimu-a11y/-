import fs from 'fs';
import path from 'path';

const generatedImagePath = `C:\\Users\\吉村　拓巳\\.gemini\\antigravity-ide\\brain\\348808c8-f45d-49ff-85c2-d19e685f80ed\\pwa_app_icon_1790786118913.jpg`;

if (fs.existsSync(generatedImagePath)) {
  fs.copyFileSync(generatedImagePath, 'public/icon.png');
  fs.copyFileSync(generatedImagePath, 'public/icon-192.png');
  fs.copyFileSync(generatedImagePath, 'public/icon-512.png');
  console.log('Successfully copied PWA app icon to public/ directory!');
} else {
  console.error('Generated image path does not exist:', generatedImagePath);
}
