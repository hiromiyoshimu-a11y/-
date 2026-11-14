/**
 * 主要循環器・不整脈13誌の発行頻度・発売日・先行公開スケジュールデータ
 */
export const JOURNAL_SCHEDULES = [
  {
    id: 'nejm',
    name: 'NEJM (New England Journal of Medicine)',
    category: '総合医学（世界最高峰）',
    frequency: '週刊（Weekly）',
    releaseDay: '毎週木曜日',
    releaseTiming: '毎週木曜日発行（米東部時間 水曜夕方に先行オンライン公開）',
    epRelevance: 'カテーテルアブレーション・PFAの大規模RCT、新規抗不整脈薬の大規模臨床試験',
    impactFactor: '96.2',
    publisher: 'Massachusetts Medical Society',
    badgeClass: 'badge-general'
  },
  {
    id: 'circulation',
    name: 'Circulation',
    category: '循環器全般（AHA旗艦誌）',
    frequency: '週刊（Weekly）',
    releaseDay: '毎週火曜日',
    releaseTiming: '毎週火曜日発行（先行論文は平日随時オンライン公開）',
    epRelevance: 'PFA/RFの主要RCT、心房細動ガイドライン、大規模レジストリ研究',
    impactFactor: '35.5',
    publisher: 'American Heart Association (LWW)',
    badgeClass: 'badge-major'
  },
  {
    id: 'ehj',
    name: 'European Heart Journal (EHJ)',
    category: '循環器全般（ESC旗艦誌）',
    frequency: '週刊（Weekly / 月4回）',
    releaseDay: '毎週木曜日',
    releaseTiming: '毎週木曜日発行（Advance Articlesは随時オンライン公開）',
    epRelevance: 'ESCガイドライン、欧州多施設RCT、LAAO・PFA安全性比較',
    impactFactor: '37.6',
    publisher: 'Oxford University Press',
    badgeClass: 'badge-major'
  },
  {
    id: 'jama',
    name: 'JAMA / JAMA Cardiology',
    category: '総合医学・循環器',
    frequency: '週刊 / 月刊',
    releaseDay: 'JAMA: 毎週火曜 / JAMA Cardiol: 毎月第3水曜',
    releaseTiming: 'JAMA: 毎週火曜日 / JAMA Cardiology: 毎月第3水曜日発行',
    epRelevance: '心房細動と認知機能、抗凝固療法比較、アブレーション長期予後RCT',
    impactFactor: 'JAMA 63.1 / JAMA Cardiol 14.8',
    publisher: 'American Medical Association',
    badgeClass: 'badge-general'
  },
  {
    id: 'hr',
    name: 'Heart Rhythm',
    category: '不整脈専門誌（HRS公式誌）',
    frequency: '月刊（Monthly）',
    releaseDay: '毎月1日',
    releaseTiming: '毎月1日発行（Articles in Pressは採択後随時公開）',
    epRelevance: 'PFAカテーテル技術、心室頻拍(VT)・心室性不整脈、新デバイス手技',
    impactFactor: '5.5',
    publisher: 'Heart Rhythm Society (Elsevier)',
    badgeClass: 'badge-ep'
  },
  {
    id: 'europace',
    name: 'EP Europace',
    category: '不整脈専門誌（EHRA公式誌）',
    frequency: '月刊（Monthly）',
    releaseDay: '毎月上旬（1〜5日頃）',
    releaseTiming: '毎月上旬（1〜5日頃）発行（Advance Articlesは随時公開）',
    epRelevance: '欧州不整脈学会公式誌。PFA臨床成績、合併症、最新マッピング技術',
    impactFactor: '6.1',
    publisher: 'EHRA (Oxford University Press)',
    badgeClass: 'badge-ep'
  },
  {
    id: 'jacc_ep',
    name: 'JACC: Clinical Electrophysiology',
    category: '不整脈専門誌（ACC公式誌）',
    frequency: '月刊（Monthly）',
    releaseDay: '毎月第3〜第4水曜日',
    releaseTiming: '毎月第3〜第4水曜日頃発行（In Press論文は随時公開）',
    epRelevance: 'カテーテルアブレーション臨床研究、Sphere-9、FARAPULSE等の実臨床データ',
    impactFactor: '7.0',
    publisher: 'American College of Cardiology (Elsevier)',
    badgeClass: 'badge-ep'
  },
  {
    id: 'circ_ep',
    name: 'Circulation: Arrhythmia and Electrophysiology',
    category: '不整脈専門誌（AHA専門誌）',
    frequency: '月刊（Monthly）',
    releaseDay: '毎月中旬（第2〜第3火曜日）',
    releaseTiming: '毎月中旬（第2〜第3火曜日頃）発行',
    epRelevance: '不整脈機序解明、最先端電気生理学解析、PFA心筋傷害メカニズム',
    impactFactor: '5.4',
    publisher: 'American Heart Association (LWW)',
    badgeClass: 'badge-ep'
  },
  {
    id: 'jce',
    name: 'Journal of Cardiovascular Electrophysiology (JCE)',
    category: '不整脈専門誌（国際老舗誌）',
    frequency: '月刊（Monthly）',
    releaseDay: '毎月中旬',
    releaseTiming: '毎月中旬発行（Early Viewは随時公開）',
    epRelevance: 'アブレーション手技の工夫、高周波ホットバルーン/クライオ/PFA比較',
    impactFactor: '2.6',
    publisher: 'Wiley',
    badgeClass: 'badge-ep'
  },
  {
    id: 'jice',
    name: 'Journal of Interventional Cardiac Electrophysiology (JICE)',
    category: '不整脈インターベンション専門誌',
    frequency: '月刊（年10〜12回）',
    releaseDay: '毎月中旬〜下旬',
    releaseTiming: '毎月中旬〜下旬発行（Online Firstは随時公開）',
    epRelevance: 'カテーテルインターベンション手技、解剖学的アプローチ、デバイス臨床評価',
    impactFactor: '2.1',
    publisher: 'Springer',
    badgeClass: 'badge-ep'
  },
  {
    id: 'hrcr',
    name: 'Heart Rhythm Case Reports',
    category: '症例報告専門誌（HRS公式誌）',
    frequency: '月刊（Monthly / オープンアクセス）',
    releaseDay: '毎月中旬',
    releaseTiming: '毎月中旬発行（オンライン即時公開）',
    epRelevance: '稀有な不整脈回路、合併症救命例、PFA後の特異な心電図変化',
    impactFactor: '0.8',
    publisher: 'Elsevier',
    badgeClass: 'badge-case'
  },
  {
    id: 'joa',
    name: 'Journal of Arrhythmia (JoA)',
    category: '不整脈専門誌（JHRS / APHRS公式誌）',
    frequency: '隔月刊（Bimonthly / 年6回）',
    releaseDay: '偶数月（2, 4, 6, 8, 10, 12月）下旬',
    releaseTiming: '偶数月（2, 4, 6, 8, 10, 12月）下旬発行（PMC・Wileyにて即時公開）',
    epRelevance: '日本不整脈心電学会公式英文誌。本邦多施設データ、アジア太平洋地域の知見',
    impactFactor: '2.5',
    publisher: 'Japanese Heart Rhythm Society (Wiley)',
    badgeClass: 'badge-jhrs'
  },
  {
    id: 'jhrs_jp',
    name: '和文誌（心電図 / 心臓）',
    category: '国内学会公式和文誌',
    frequency: '季刊〜隔月刊（年4〜6回）',
    releaseDay: '各学会総会期および定期刊行月',
    releaseTiming: '各学会の学術総会期および定期刊行月（随時J-STAGE公開）',
    epRelevance: 'JHRSガイドライン日本語版、国内施設の手技解説・エキスパートコンセンサス',
    impactFactor: 'N/A',
    publisher: '日本不整脈心電学会 / 日本心臓病学会',
    badgeClass: 'badge-jhrs'
  }
];
