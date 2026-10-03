import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load JHRS scraped terms
let jhrsRawTerms = [];
try {
  const jsonPath = path.join(__dirname, 'jhrsTerms.json');
  if (fs.existsSync(jsonPath)) {
    jhrsRawTerms = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  }
} catch (e) {
  console.warn('[JHRS Helper] Failed to load jhrsTerms.json:', e.message);
}

// Key EP/Arrhythmia terminology guidelines prompt for Gemini/AI
export const jhrsPromptInstructions = `
【日本不整脈心電学会(JHRS) 公式用語集規約 (https://new.jhrs.or.jp/contents_jse/words/list.php)】
翻訳および要約作成にあたっては、日本不整脈心電学会の公式専門用語を厳格に使用してください：
・Pulsed Field Ablation (PFA) -> パルスフィールドアブレーション
・Radiofrequency Ablation (RFA) -> 高周波アブレーション
・Cryoballoon Ablation -> クライオバルーンアブレーション
・Catheter Ablation -> カテーテルアブレーション
・Pulmonary Vein Isolation (PVI) -> 肺静脈隔離術
・Atrial Fibrillation (AF) -> 心房細動
・Atrial Flutter (AFL) -> 心房粗動
・Ventricular Tachycardia (VT) -> 心室頻拍
・Ventricular Fibrillation (VF) -> 心室細動
・Premature Ventricular Complex / Contraction (PVC) -> 心室性期外収縮
・Premature Atrial Contraction (PAC) -> 心房性期外収縮
・Supraventricular Tachycardia (SVT) -> 上室性頻拍
・Paroxysmal / Persistent Atrial Fibrillation -> 発作性心房細動 / 持続性心房細動
・AV Node / Sinoatrial Node -> 房室結節 / 洞結節
・Left Atrium / Left Ventricle -> 左心房 / 左心室
・Left Atrial Appendage (LAA) -> 左心耳
・Contact Force -> コンタクトフォース（接触圧）
・Electrophysiological Study (EPS) -> 心臓電気生理学的検査
・Implantable Cardioverter Defibrillator (ICD) -> 植込み型除細動器
・Cardiac Resynchronization Therapy (CRT) -> 心臓再同期療法
・Pacemaker -> ペースメーカ
`;

/**
 * 日本不整脈心電学会（JHRS）標準用語への表記揺れ表記補正ポストプロセッサ
 */
export function normalizeJhrsTerms(text) {
  if (!text) return '';
  let s = String(text);

  // 1. 一般的な誤訳・非標準訳の強制定義置換
  const replacements = [
    // パルスフィールドアブレーション
    [/パルス電界アブレーション|パルス電場アブレーション|パルス場アブレーション|パルスフィールド切除/g, 'パルスフィールドアブレーション'],
    [/パルス電界|パルス電場/g, 'パルスフィールド'],

    // 高周波・アブレーション
    [/高周波焼灼術|高周波焼灼|高周波切除術/g, '高周波アブレーション'],
    [/クライオ切除|冷凍アブレーション/g, 'クライオバルーンアブレーション'],

    // 隔離術
    [/肺静脈絶縁|肺静脈遮断術|肺静脈遮断/g, '肺静脈隔離術'],
    [/肺静脈隔離(?![術])(?=における|を実施|を行|の成功|率)/g, '肺静脈隔離術'],

    // 心房細動・不整脈
    [/心房フィブリレーション|心房性フィブリレーション|房細動/g, '心房細動'],
    [/心室フィブリレーション|心室性フィブリレーション/g, '心室細動'],
    [/心房フラッター|心房ふらつき/g, '心房粗動'],
    [/心室頻脈|心室性頻脈/g, '心室頻拍'],
    [/上室頻脈|上室性頻脈/g, '上室性頻拍'],
    [/心室期外収縮|心室性早大収縮|心室性早期収縮/g, '心室性期外収縮'],
    [/心房期外収縮|心房性早期収縮/g, '心房性期外収縮'],

    // 解剖・結節
    [/房室ノード/g, '房室結節'],
    [/洞ノード|サイナスノード/g, '洞結節'],
    [/左アトリウム|左心房耳/g, '左心耳'],

    // デバイス・用語表記
    [/ペースメーカー/g, 'ペースメーカ'],
    [/埋め込み型除細動器|埋込型除細動器/g, '植込み型除細動器'],
    [/ブルガダシンドローム/g, 'ブルガダ症候群'],
    [/タコツボ心筋症|たこつぼ心筋症/g, 'たこつぼ［型］心筋症']
  ];

  for (const [regex, replacement] of replacements) {
    s = s.replace(regex, replacement);
  }

  return s;
}
