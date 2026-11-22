/**
 * ⚡ カテーテル / パルスフィールドアブレーション 最新論文ナビ
 * モバイル・スマホ最適化 Web アプリケーション フロントエンド Script
 */

import { SplashScreen } from '@capacitor/splash-screen';
import { JOURNAL_SCHEDULES } from './journalScheduleData.js';

let allPapers = [];
let bookmarks = JSON.parse(localStorage.getItem('ep_paper_bookmarks') || '[]');
let readPapers = JSON.parse(localStorage.getItem('ep_paper_read') || '[]');
let currentFilterTab = 'all';
let currentDomainFilter = localStorage.getItem('ep_paper_domain_filter') || 'all';
let selectedJournals = null; // Set of selected journal keys. null = initial state (all selected)
let currentDetailPaper = null;

let deferredPrompt;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  // 大容量の論文キャッシュがlocalStorageを圧迫しiOSで他設定が消えるのを防ぐ
  try { localStorage.removeItem('ep_papers_cache'); } catch (_) {}
  initDeviceSyncCode();
  setupEventListeners();
  loadThemePreference();
  loadFontSizePreference();
  registerServiceWorker();
  setupPwaInstaller();
  initPullToRefresh();
  await loadPaperData();

  // スプラッシュスクリーンのスムーズなフェードアウト
  try {
    if (window.Capacitor) {
      await SplashScreen.hide({ fadeOutDuration: 500 });
    }
  } catch (e) {
    console.log('SplashScreen hide skipped:', e);
  }

  // 起動完了後、バックグラウンドでクラウド最新データ＆既読・ブックマークを自動同期
  setTimeout(() => {
    syncWithCloud(false);
    pullUserStateFromCloud(getSyncCode(), false, false);
  }, 800);

  // 別端末で操作した後に画面へ戻ってきた際にも自動同期
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pullUserStateFromCloud(getSyncCode(), false, false);
    }
  });
}

function setSearchDrawerOpen(open, focusInput = false) {
  const drawer = document.getElementById('searchRevealDrawer');
  const searchInput = document.getElementById('searchInput');
  if (!drawer) return;

  if (open) {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (focusInput && searchInput) {
      setTimeout(() => {
        try { searchInput.focus(); } catch (_) {}
      }, 60);
    }
  } else {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (searchInput && document.activeElement === searchInput) {
      searchInput.blur();
    }
  }
}

/**
 * 📲 下に引っ張って検索表示 & さらに引っ張って更新 (2段階 Pull to Search / Refresh)
 */
function initPullToRefresh() {
  const ptrEl = document.getElementById('pullToRefresh');
  const ptrIcon = document.getElementById('ptrIcon');
  const ptrText = document.getElementById('ptrText');
  if (!ptrEl || !ptrIcon || !ptrText) return;

  let startY = 0;
  let isTracking = false;
  let isRefreshing = false;
  let maxPullDistance = 0;
  const THRESHOLD = 85; // ピクセル（誤作動防止のため少し深めに設定）
  const SEARCH_PULL_THRESHOLD = 20;

  // 検索バー開閉ボタン・閉じるボタン・スクロール自動収納
  const toggleSearchBtn = document.getElementById('toggleSearchBtn');
  if (toggleSearchBtn) {
    toggleSearchBtn.addEventListener('click', () => {
      const drawer = document.getElementById('searchRevealDrawer');
      const isOpen = drawer && drawer.classList.contains('is-open');
      setSearchDrawerOpen(!isOpen, !isOpen);
    });
  }

  const closeSearchDrawerBtn = document.getElementById('closeSearchDrawerBtn');
  if (closeSearchDrawerBtn) {
    closeSearchDrawerBtn.addEventListener('click', () => {
      setSearchDrawerOpen(false, false);
    });
  }

  window.addEventListener('scroll', () => {
    if (window.scrollY > 45) {
      const drawer = document.getElementById('searchRevealDrawer');
      const searchInput = document.getElementById('searchInput');
      if (drawer && drawer.classList.contains('is-open') && searchInput && !searchInput.value.trim() && document.activeElement !== searchInput) {
        setSearchDrawerOpen(false, false);
      }
    }
  }, { passive: true });

  window.addEventListener('touchstart', (e) => {
    if (isRefreshing) return;
    // ボタン・セレクト・入力欄などの操作要素やヘッダー上部のタップ時は引っ張り更新を無効化
    if (e.target && e.target.closest('button, select, input, a, .header-top, .header-actions')) {
      isTracking = false;
      return;
    }
    // 画面が最上部にあり、モーダルが開いていない場合のみ監視
    const isModalOpen = document.querySelector('.modal-overlay[style*="display: flex"]');
    if (window.scrollY <= 1 && !isModalOpen && e.touches.length === 1) {
      startY = e.touches[0].pageY;
      maxPullDistance = 0;
      isTracking = true;
    } else {
      isTracking = false;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isTracking || isRefreshing) return;
    const currentY = e.touches[0].pageY;
    const diff = currentY - startY;

    // 25px以上の明確な下引っ張りのみ反応させる（わずかな指ブレでの誤発動防止）
    if (diff > 25 && window.scrollY <= 0) {
      // 指の引きに抵抗感（ダンピング）を付加
      const pullDistance = Math.min((diff - 25) * 0.45, 85);
      if (pullDistance > maxPullDistance) maxPullDistance = pullDistance;
      ptrEl.style.transition = 'none';
      ptrEl.style.transform = `translate(-50%, ${pullDistance}px)`;
      ptrEl.style.opacity = String(Math.min(pullDistance / 35, 1));

      if (pullDistance >= THRESHOLD * 0.7) {
        ptrIcon.textContent = '⬇️';
        ptrIcon.style.transform = 'rotate(180deg)';
        ptrText.textContent = '離して最新論文を更新';
        ptrEl.classList.add('ptr-ready');
      } else if (pullDistance >= SEARCH_PULL_THRESHOLD) {
        const drawer = document.getElementById('searchRevealDrawer');
        const isAlreadyOpen = drawer && drawer.classList.contains('is-open');
        ptrIcon.textContent = isAlreadyOpen ? '⬇️' : '🔍';
        ptrIcon.style.transform = 'rotate(0deg)';
        ptrText.textContent = isAlreadyOpen
          ? 'さらに下に引っ張って更新'
          : '離すと検索を表示（さらに引くと更新）';
        ptrEl.classList.remove('ptr-ready');
      } else {
        ptrIcon.textContent = '⬇️';
        ptrIcon.style.transform = 'rotate(0deg)';
        ptrText.textContent = '下に引っ張って検索 / 更新';
        ptrEl.classList.remove('ptr-ready');
      }
    } else if (diff < 0) {
      // 上にスクロールした場合は追従解除
      isTracking = false;
      maxPullDistance = 0;
      ptrEl.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
      ptrEl.style.transform = 'translate(-50%, -130%)';
      ptrEl.style.opacity = '0';
    }
  }, { passive: true });

  window.addEventListener('touchend', async () => {
    if (!isTracking || isRefreshing) return;
    isTracking = false;

    if (ptrEl.classList.contains('ptr-ready')) {
      // 更新処理の実行
      isRefreshing = true;
      ptrEl.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      ptrEl.style.transform = 'translate(-50%, 55px)';
      ptrIcon.textContent = '🔄';
      ptrIcon.classList.add('ptr-spin');
      ptrText.textContent = '最新論文を同期中...';

      try {
        await window.syncWithCloud(true);
        if (typeof pullUserStateFromCloud === 'function') {
          await pullUserStateFromCloud(getSyncCode(), false, false);
        }
        ptrIcon.classList.remove('ptr-spin');
        ptrIcon.textContent = '✓';
        ptrText.textContent = '最新データに更新完了';
      } catch (err) {
        ptrIcon.classList.remove('ptr-spin');
        ptrIcon.textContent = '✓';
        ptrText.textContent = '更新完了';
      } finally {
        setTimeout(() => {
          ptrEl.style.transition = 'transform 0.35s ease, opacity 0.35s ease';
          ptrEl.style.transform = 'translate(-50%, -130%)';
          ptrEl.style.opacity = '0';
          setTimeout(() => {
            ptrEl.style.transition = '';
            ptrEl.classList.remove('ptr-ready');
            ptrIcon.textContent = '⬇️';
            ptrIcon.style.transform = 'rotate(0deg)';
            ptrText.textContent = '下に引っ張って更新';
            isRefreshing = false;
          }, 350);
        }, 700);
      }
    } else {
      // 閾値未満で指を離した場合：検索表示閾値を超えていれば検索バーを開く
      const shouldOpenSearch = maxPullDistance >= SEARCH_PULL_THRESHOLD;
      maxPullDistance = 0;
      ptrEl.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      ptrEl.style.transform = 'translate(-50%, -130%)';
      ptrEl.style.opacity = '0';
      setTimeout(() => {
        ptrEl.style.transition = '';
        ptrIcon.textContent = '⬇️';
        ptrIcon.style.transform = 'rotate(0deg)';
      }, 250);
      if (shouldOpenSearch) {
        setSearchDrawerOpen(true, true);
      }
    }
  });
}

// ====================================================
// 🔗 10桁コードによる複数端末（iPhone / Mac / iPad / Android）同期機能
// ====================================================
const KV_APP_KEY = 'y3liigs4';

function generateTenCharCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = 'EP';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getSyncCode() {
  let code = localStorage.getItem('ep_sync_code');
  if (!code || code.length < 6) {
    code = generateTenCharCode();
    localStorage.setItem('ep_sync_code', code);
  }
  return code;
}

function initDeviceSyncCode() {
  const code = getSyncCode();
  const displayEl = document.getElementById('mySyncCodeDisplay');
  if (displayEl) displayEl.textContent = code;
  updateSyncStatusUI('クラウド自動同期：有効');
}

function updateSyncStatusUI(statusMsg) {
  const statusEl = document.getElementById('syncStatusText');
  if (statusEl) {
    statusEl.textContent = `${statusMsg}（既読 ${readPapers.length}件 / ブックマーク ${bookmarks.length}件）`;
  }
  const displayEl = document.getElementById('mySyncCodeDisplay');
  if (displayEl) {
    displayEl.textContent = getSyncCode();
  }
}

function toBase64Url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(b64u) {
  let s = String(b64u).replace(/"/g, '').trim().replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return decodeURIComponent(escape(atob(s)));
}

async function pushUserStateToCloud(code = getSyncCode()) {
  if (!code) return;
  const ts = Date.now();
  localStorage.setItem('ep_user_state_ts', String(ts));

  const payload = {
    b: [...new Set(bookmarks.map(String))],
    r: [...new Set(readPapers.map(String))],
    ts
  };
  const jsonStr = JSON.stringify(payload);
  const encoded = toBase64Url(jsonStr);

  updateSyncStatusUI('☁️ クラウドへ保存中...');

  try {
    await Promise.any([
      fetch(`https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${KV_APP_KEY}/ep_${code}/${encoded}`, {
        method: 'POST'
      }),
      fetch(`https://ntfy.sh/ep_pfa_sync_${code}`, {
        method: 'POST',
        body: jsonStr
      })
    ]);
    updateSyncStatusUI('✅ クラウド同期完了');
  } catch (e) {
    console.warn('[Device Sync] Cloud push failed:', e);
    updateSyncStatusUI('⚠️ オフライン（次回通信時に同期）');
  }
}

async function fetchCloudPayloads(code) {
  const results = [];

  const p1 = (async () => {
    try {
      const res = await fetch(`https://keyvalue.immanuel.co/api/KeyVal/GetValue/${KV_APP_KEY}/ep_${code}?_=${Date.now()}`);
      if (res.ok) {
        const raw = (await res.text()).replace(/"/g, '').trim();
        if (raw && raw !== 'null') {
          const parsed = JSON.parse(fromBase64Url(raw));
          if (parsed && Array.isArray(parsed.b) && Array.isArray(parsed.r)) {
            results.push(parsed);
          }
        }
      }
    } catch {}
  })();

  const p2 = (async () => {
    try {
      const res = await fetch(`https://ntfy.sh/ep_pfa_sync_${code}/json?poll=1&since=24h&_=${Date.now()}`);
      if (res.ok) {
        const lines = (await res.text()).trim().split('\n').filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const evt = JSON.parse(lines[i]);
            if (evt && evt.message) {
              const parsed = JSON.parse(evt.message);
              if (parsed && Array.isArray(parsed.b) && Array.isArray(parsed.r)) {
                results.push(parsed);
                break;
              }
            }
          } catch {}
        }
      }
    } catch {}
  })();

  await Promise.allSettled([p1, p2]);
  if (results.length === 0) return null;
  results.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return results[0];
}

async function pullUserStateFromCloud(code = getSyncCode(), mergeMode = false, showFeedback = false) {
  if (!code) return;
  if (showFeedback) updateSyncStatusUI('🔄 クラウドから同期中...');

  const cloudData = await fetchCloudPayloads(code);
  const localTs = Number(localStorage.getItem('ep_user_state_ts') || 0);

  if (!cloudData) {
    // クラウド側にまだデータがなく、ローカルに既読・ブックマークがある場合はクラウドへ初回登録
    if (bookmarks.length > 0 || readPapers.length > 0 || showFeedback) {
      await pushUserStateToCloud(code);
    }
    if (showFeedback) {
      showToast(`✅ 同期コード「${code}」のデータをクラウドに保存しました`);
    }
    updateSyncStatusUI('✅ クラウド同期済み');
    return;
  }

  if (mergeMode) {
    // 別端末の10桁コードを入力して連携したときは、両方の端末の既読・ブックマークを合算（マージ）
    bookmarks = [...new Set([...bookmarks.map(String), ...cloudData.b.map(String)])];
    readPapers = [...new Set([...readPapers.map(String), ...cloudData.r.map(String)])];
    localStorage.setItem('ep_paper_bookmarks', JSON.stringify(bookmarks));
    localStorage.setItem('ep_paper_read', JSON.stringify(readPapers));
    renderPapers();
    await pushUserStateToCloud(code);
    if (showFeedback) {
      showToast(`🔗 コード「${code}」で連携完了！（既読 ${readPapers.length}件 / ブックマーク ${bookmarks.length}件）`);
    }
    return;
  }

  // 通常の自動同期：クラウド側の方が新しい変更であればローカルに反映
  if ((cloudData.ts || 0) > localTs) {
    const prevReadLen = readPapers.length;
    const prevBmLen = bookmarks.length;
    bookmarks = [...new Set(cloudData.b.map(String))];
    readPapers = [...new Set(cloudData.r.map(String))];
    localStorage.setItem('ep_paper_bookmarks', JSON.stringify(bookmarks));
    localStorage.setItem('ep_paper_read', JSON.stringify(readPapers));
    localStorage.setItem('ep_user_state_ts', String(cloudData.ts));
    renderPapers();
    updateSyncStatusUI('✅ クラウドから最新状態を反映');
    if (showFeedback || prevReadLen !== readPapers.length || prevBmLen !== bookmarks.length) {
      showToast(`🔄 別端末の既読・ブックマークを同期しました`);
    }
  } else if (localTs > (cloudData.ts || 0)) {
    await pushUserStateToCloud(code);
  } else {
    updateSyncStatusUI('✅ クラウドと最新状態で同期済み');
    if (showFeedback) {
      showToast('✅ 既読・ブックマークは最新の状態です');
    }
  }
}

function loadFontSizePreference() {
  const size = localStorage.getItem('ep_font_size') || 'normal';
  applyFontSize(size);
  const select = document.getElementById('fontSizeSelect');
  if (select) select.value = size;
}

function applyFontSize(size) {
  document.body.classList.remove('font-small', 'font-normal', 'font-large', 'font-xlarge');
  document.body.classList.add(`font-${size}`);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          console.log('ServiceWorker registered:', reg.scope);
          reg.update();
        })
        .catch(err => console.log('ServiceWorker registration failed:', err));
    });
  }
}

function setupPwaInstaller() {
  const installBtn = document.getElementById('pwaInstallBtn');
  if (!installBtn) return;

  // デフォルトは非表示
  installBtn.style.display = 'none';

  // Android 端末のみ判定
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (!isAndroid) {
    // iPhone / iPad / PC等ではボタンを非表示
    return;
  }

  // Android端末のみ beforeinstallprompt を検知してボタン表示
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'inline-flex';
    console.log('PWA installer prompt captured for Android.');
  });

  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA install outcome: ${outcome}`);
      deferredPrompt = null;
      installBtn.style.display = 'none';
    } else {
      showAndroidInstallGuideModal();
    }
  });
}

function showAndroidInstallGuideModal() {
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
    <div style="text-align: center; padding: 10px 0;">
      <div style="font-size: 48px; margin-bottom: 8px;">🤖</div>
      <h3 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px;">Android アプリの追加方法</h3>
      
      <div style="background: var(--bg-secondary); border-radius: var(--radius-md); padding: 16px; text-align: left; margin-bottom: 16px; font-size: 13px; line-height: 1.8;">
        <p style="font-weight: 700; color: var(--accent-blue); margin-bottom: 6px;">Android (Chrome) での手順:</p>
        <ol style="padding-left: 20px;">
          <li>画面右上のメニューアイコン <strong>「⋮」</strong> (3点マーク) をタップ</li>
          <li><strong>「ホーム画面に追加」</strong> または <strong>「アプリをインストール」</strong> を選択</li>
          <li>「追加」を押すと、ホーム画面にアプリが追加されます！</li>
        </ol>
      </div>

      <button onclick="closeModal()" style="width: 100%; padding: 12px; background: var(--accent-blue); color: white; border: none; border-radius: var(--radius-sm); font-weight: 700; font-size: 14px; cursor: pointer;">
        閉じる
      </button>
    </div>
  `;
  document.getElementById('detailModal').style.display = 'flex';
}

// リモートクラウド上の最新論文URL (GitHub Raw / GitHub Pages)
const REMOTE_DATA_URLS = [
  'https://raw.githubusercontent.com/hiromiyoshimu-a11y/-/main/public/papers.json',
  'https://hiromiyoshimu-a11y.github.io/-/papers.json'
];

/**
 * 論文データの読み込み (Offline-First: ローカルキャッシュを即座に表示)
 */
async function loadPaperData() {
  const paperListEl = document.getElementById('paperList');

  // アプリバンドル内のローカル papers.json を読み込む（Service Worker / Capacitor キャッシュ利用）
  let currentPath = window.location.pathname;
  if (!currentPath.endsWith('/') && !currentPath.includes('.html')) {
    currentPath += '/';
  }
  const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);

  const localUrls = [
    `${window.location.origin}${basePath}papers.json`,
    './papers.json',
    'papers.json',
    '/papers.json'
  ];

  let data = null;
  for (const url of localUrls) {
    try {
      const res = await fetch(`${url}?_=${Date.now()}`);
      if (res.ok) {
        data = await res.json();
        break;
      }
    } catch {}
  }

  if (data && data.papers) {
    applyPaperData(data);
  } else {
    paperListEl.innerHTML = `
      <div class="loading-state" style="text-align: center; padding: 28px 16px;">
        <p style="color: #EF4444; font-weight: 700; font-size: 16px;">⚠️ 論文データを読み込めませんでした</p>
        <p style="font-size: 12px; margin-top: 8px; color: var(--text-secondary);">
          通信環境を確認の上、同期ボタンを押してください。
        </p>
        <button onclick="syncWithCloud(true)" style="margin-top: 16px; padding: 10px 24px; background: var(--accent-blue); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
          🔄 最新データを同期する
        </button>
      </div>
    `;
  }
}

const DEVICE_DOMAIN_RE = /(ペースメーカ|ペースメーカー|\bICD\b|\bS-ICD\b|\bEV-ICD\b|\bCRT-D\b|\bCRT-P\b|\bCRTD\b|\bCRTP\b|左脚領域ペーシング|左脚ペーシング|ヒス束ペーシング|刺激伝導系ペーシング|\bLBBAP\b|\bLBBP\b|\bHBP\b|\bCSP\b|心臓再同期療法|両心室ペーシング|リードレス|Micra|Aveir|房室ブロック|洞不全症候群|徐脈|植込み型除細動器|植込み型心臓モニタ|\bICM\b|\bILR\b|ループレコーダ|リード抜去|デバイス感染|pacemaker|pacing|leadless|cardiac resynchronization|conduction system pacing|left bundle branch|his bundle|defibrillator|bradycardia|atrioventricular block|sick sinus|lead extraction|loop recorder)/gi;
const EP_DOMAIN_RE = /(アブレーション|パルスフィールド|\bPFA\b|高周波|クライオ|冷凍凝固|電気生理学的検査|電気生理|\bEPS\b|マッピング|頻脈|頻拍|肺静脈隔離|\bPVI\b|心房細動|心房粗動|心房頻拍|上室|PSVT|AVNRT|AVRT|WPW|心室頻拍|心室細動|心室性期外収縮|心室期外収縮|左心耳|\bLAAO\b|\bPVC\b|\bVT\b|\bVF\b|\bAF\b|\bAFL\b|ablation|pulsed field|electrophysiolog|mapping|pulmonary vein|tachycardia|fibrillation|flutter|arrhythmia|supraventricular|premature ventricular)/gi;
const EP_SUPRAVENTRICULAR_RE = /(心房細動|心房粗動|心房頻拍|発作性上室|上室性|上室頻拍|肺静脈隔離|左心耳|\bLAAO\b|\bPVI\b|\bAF\b|\bAFL\b|\bAT\b|\bSVT\b|\bPSVT\b|\bAVNRT\b|\bAVRT\b|\bWPW\b|副伝導路|房室結節|atrial fibrillation|atrial flutter|atrial tachycardia|supraventricular|pulmonary vein|left atrial)/gi;
const EP_VENTRICULAR_RE = /(心室頻拍|心室細動|心室性期外収縮|心室期外収縮|心室性|心室不整脈|流出路|プルキンエ|乳頭筋|\bVT\b|\bVF\b|\bPVC\b|\bPVCs\b|\bRVOT\b|\bLVOT\b|ventricular tachycardia|ventricular fibrillation|premature ventricular|ventricular arrhythmia|outflow tract|brugada|ブルガダ|\bARVC\b)/gi;

function classifyPaperDomain(paper) {
  if (paper._domain) return;
  const titleTxt = `${paper.title || ''} ${paper.titleJa || ''}`;
  const bodyTxt = `${paper.summaryJa || ''} ${paper.abstractJa || ''}`;
  const devScore = (titleTxt.match(DEVICE_DOMAIN_RE) || []).length * 3 + (bodyTxt.match(DEVICE_DOMAIN_RE) || []).length;
  const epScore = (titleTxt.match(EP_DOMAIN_RE) || []).length * 3 + (bodyTxt.match(EP_DOMAIN_RE) || []).length;

  if (devScore > epScore) {
    paper._domain = 'device';
    paper._epRegion = null;
  } else {
    paper._domain = 'ep';
    const svScore = (titleTxt.match(EP_SUPRAVENTRICULAR_RE) || []).length * 3 + (bodyTxt.match(EP_SUPRAVENTRICULAR_RE) || []).length;
    const vScore = (titleTxt.match(EP_VENTRICULAR_RE) || []).length * 3 + (bodyTxt.match(EP_VENTRICULAR_RE) || []).length;
    paper._epRegion = (vScore > svScore) ? 'ventricular' : 'supraventricular';
  }
}

/**
 * 取得したデータをUIへ反映
 */
function applyPaperData(data, skipPopup = false) {
  allPapers = data.papers || [];
  allPapers.forEach(classifyPaperDomain);
  updateJournalOptions();
  populatePeriodSelect();
  if (!skipPopup) {
    renderSyncNotificationBar(data);
  }
  renderJournalScheduleModal();

  const newCount = data.newCount || allPapers.filter(p => p.isNew).length;
  const unreadCount = allPapers.filter(p => !readPapers.includes(String(p.pmid))).length;
  const readCount = readPapers.length;

  document.getElementById('updatedDateBadge').textContent = `📅 最終更新: ${data.updatedAt || '2026-09-29'}`;
  document.getElementById('paperCountBadge').textContent = `📄 未読 ${unreadCount}件 (既読 ${readCount}件)`;

  const readTabBtn = document.getElementById('readTabBtn');
  if (readTabBtn) readTabBtn.textContent = `☑ 既読のみ (${readCount})`;
  const showAllTabBtn = document.getElementById('showAllTabBtn');
  if (showAllTabBtn) showAllTabBtn.textContent = `📋 全件表示 (${allPapers.length})`;

  const newBadgeEl = document.getElementById('newCountBadge');
  if (newCount > 0) {
    newBadgeEl.textContent = `✨ 今週の新着: ${newCount}件`;
    newBadgeEl.style.display = 'inline-block';
  } else {
    newBadgeEl.style.display = 'none';
  }

  renderPapers();
}

/**
 * クラウド（GitHub / サーバー）から最新論文データを自動同期
 */
window.syncWithCloud = async function(isManual = false) {
  const syncIcon = document.getElementById('syncIcon');
  const syncText = document.getElementById('syncText');

  if (syncIcon) syncIcon.style.transform = 'rotate(360deg)';
  if (syncText) syncText.textContent = '同期中...';

  let latestData = null;
  for (const url of REMOTE_DATA_URLS) {
    try {
      console.log('[Cloud Sync] Checking remote url:', url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${url}?_=${Date.now()}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        latestData = await res.json();
        console.log('[Cloud Sync] Successfully fetched latest data from:', url);
        break;
      }
    } catch (e) {
      console.warn('[Cloud Sync] Failed from', url, e.message);
    }
  }

  if (syncIcon) {
    setTimeout(() => { syncIcon.style.transform = 'rotate(0deg)'; }, 600);
  }
  if (syncText) syncText.textContent = '最新同期';

  if (latestData && Array.isArray(latestData.papers)) {
    const prevCount = allPapers.length;
    applyPaperData(latestData, isManual);

    if (isManual) {
      showToast(`✅ クラウド最新データ (${latestData.papers.length}件) を同期しました！`);
    } else if (latestData.papers.length !== prevCount) {
      showToast(`✨ 最新論文データが更新されました (${latestData.papers.length}件)`);
    }
  } else {
    if (isManual) {
      showToast('⚠️ クラウドと通信できませんでした。現在のデータを表示します。');
    }
  }
};

const PREDEFINED_JOURNALS = [
  {
    key: 'jce',
    label: 'JCE（Journal of Cardiovascular Electrophysiology）',
    match: (t, a) => t.includes('cardiovasc') || a.includes('cardiovasc') || t.includes('jce') || a.includes('jce')
  },
  {
    key: 'jice',
    label: 'JICE（Journal of Interventional Cardiac Electrophysiology）',
    match: (t, a) => t.includes('interv card') || a.includes('interv card') || t.includes('jice') || a.includes('jice')
  },
  {
    key: 'heart_rhythm_o2',
    label: 'Heart Rhythm O2（Heart Rhythm O2）',
    match: (t, a) => t.includes('heart rhythm o2') || a.includes('heart rhythm o2')
  },
  {
    key: 'heart_rhythm',
    label: 'Heart Rhythm（Heart Rhythm）',
    match: (t, a) => (t.includes('heart rhythm') || a.includes('heart rhythm')) && !t.includes('case') && !a.includes('case') && !t.includes('o2') && !a.includes('o2')
  },
  {
    key: 'europace',
    label: 'EP Europace（Europace）',
    match: (t, a) => t.includes('europace') || a.includes('europace')
  },
  {
    key: 'jacc_ep',
    label: 'JACC EP（JACC: Clinical Electrophysiology）',
    match: (t, a) => t.includes('jacc') || a.includes('jacc')
  },
  {
    key: 'circ_ep',
    label: 'Circ EP（Circulation: Arrhythmia and Electrophysiology）',
    match: (t, a) => t.includes('circ arrhythm') || a.includes('circ arrhythm') || (t.includes('circulation') && t.includes('arrhythm'))
  },
  {
    key: 'circulation',
    label: 'Circulation（Circulation）',
    match: (t, a) => (t.includes('circulation') || a.includes('circulation')) && !t.includes('arrhythm') && !a.includes('arrhythm')
  },
  {
    key: 'ehj',
    label: 'EHJ（European Heart Journal）',
    match: (t, a) => t.includes('eur heart j') || a.includes('eur heart j') || t.includes('european heart') || a.includes('european heart')
  },
  {
    key: 'joa',
    label: 'JoA（Journal of Arrhythmia）',
    match: (t, a) => a.includes('j arrhythm') || t.startsWith('journal of arrhythmia')
  },
  {
    key: 'hr_case_rep',
    label: 'Heart Rhythm Case Rep（Heart Rhythm Case Reports）',
    match: (t, a) => t.includes('case rep') || a.includes('case rep')
  },
  {
    key: 'nejm',
    label: 'NEJM（The New England Journal of Medicine）',
    match: (t, a) => t.includes('engl j med') || a.includes('engl j med') || t.includes('new england') || a.includes('new england') || t.includes('nejm')
  },
  {
    key: 'nat_med',
    label: 'Nat Med（Nature Medicine）',
    match: (t, a) => t.includes('nat med') || a.includes('nat med') || t.includes('nature medicine')
  },
  {
    key: 'jama_cardiol',
    label: 'JAMA Cardiol（JAMA Cardiology）',
    match: (t, a) => t.includes('jama cardiol') || a.includes('jama cardiol')
  },
  {
    key: 'jama',
    label: 'JAMA（Journal of the American Medical Association）',
    match: (t, a) => (t.includes('jama') || a.includes('jama')) && !t.includes('cardiol') && !a.includes('cardiol')
  },
  {
    key: 'shindenzu',
    label: '心電図（日本不整脈心電学会学術誌『心電図』）',
    match: (t, a) => t.includes('心電図') || t.includes('shin-denzu') || a.includes('shin-denzu') || t.includes('shinzo') || a.includes('shinzo') || t.includes('electrocardiology')
  }
];

export function getJournalDisplayName(paper) {
  if (!paper) return '';
  const t = (paper.journal || '').toLowerCase();
  const a = (paper.journalAbbr || '').toLowerCase();

  const found = PREDEFINED_JOURNALS.find(j => j.match(t, a));
  if (found) {
    return found.label;
  }

  if (paper.journalAbbr && paper.journal && paper.journalAbbr !== paper.journal) {
    return `${paper.journalAbbr}（${paper.journal}）`;
  }
  return paper.journalAbbr || paper.journal || '';
}

function paperMatchesJournalFilter(paper) {
  if (!selectedJournals) return true;
  if (selectedJournals.size === 0) return false;

  const t = (paper.journal || '').toLowerCase();
  const a = (paper.journalAbbr || '').toLowerCase();

  for (const jKey of selectedJournals) {
    const predefined = PREDEFINED_JOURNALS.find(p => p.key === jKey);
    if (predefined) {
      if (predefined.match(t, a)) return true;
    } else {
      if (t.includes(jKey) || a.includes(jKey)) return true;
    }
  }
  return false;
}

function saveSelectedJournals() {
  if (selectedJournals) {
    localStorage.setItem('ep_selected_journals', JSON.stringify(Array.from(selectedJournals)));
  }
}

function updateJournalFilterLabel(totalCount) {
  const labelEl = document.getElementById('journalFilterLabel');
  if (!labelEl) return;
  const currentCount = selectedJournals ? selectedJournals.size : totalCount;
  if (currentCount >= totalCount) {
    labelEl.textContent = `対象誌: すべて選択中 (${totalCount}誌)`;
  } else if (currentCount === 0) {
    labelEl.textContent = `対象誌: 未選択 (0誌)`;
  } else if (currentCount === 1) {
    const singleKey = Array.from(selectedJournals)[0];
    const item = PREDEFINED_JOURNALS.find(p => p.key === singleKey);
    const label = item ? item.label : singleKey;
    labelEl.textContent = `対象誌: ${label}`;
  } else {
    labelEl.textContent = `対象誌: ${currentCount}誌選択中`;
  }
}

/**
 * 論文データに含まれるすべての雑誌を抽出し、複数選択チェックボックスリストを動的に更新
 */
function updateJournalOptions() {
  const checkboxListEl = document.getElementById('journalCheckboxList');
  if (!checkboxListEl) return;

  const addedKeys = new Set();
  const availableJournals = [];

  // 定義済み主要誌の集計
  PREDEFINED_JOURNALS.forEach(p => {
    const matchCount = allPapers.filter(paper => {
      const t = (paper.journal || '').toLowerCase();
      const a = (paper.journalAbbr || '').toLowerCase();
      return p.match(t, a);
    }).length;

    if (matchCount > 0) {
      availableJournals.push({ key: p.key, label: p.label, count: matchCount });
      addedKeys.add(p.key);
    }
  });

  // 未定義の雑誌があればその他として追加
  const extraCounts = {};
  allPapers.forEach(paper => {
    const t = (paper.journal || '').toLowerCase();
    const a = (paper.journalAbbr || '').toLowerCase();
    const isCovered = PREDEFINED_JOURNALS.some(p => p.match(t, a));
    if (!isCovered) {
      const j = (paper.journalAbbr || paper.journal || '').trim();
      if (j) extraCounts[j] = (extraCounts[j] || 0) + 1;
    }
  });

  Object.entries(extraCounts).forEach(([j, count]) => {
    const lowerKey = j.toLowerCase();
    availableJournals.push({ key: lowerKey, label: j, count: count });
  });

  // 初回ロードで未設定または保存されたキーが古い場合はすべて選択状態に初期化
  if (selectedJournals === null) {
    try {
      const savedJournals = localStorage.getItem('ep_selected_journals');
      if (savedJournals) {
        const parsed = JSON.parse(savedJournals);
        if (Array.isArray(parsed)) {
          const validKeys = new Set(availableJournals.map(j => j.key));
          const filtered = parsed.filter(k => validKeys.has(k));
          if (filtered.length > 0) {
            selectedJournals = new Set(filtered);
          }
        }
      }
    } catch (e) {
      selectedJournals = null;
    }
  }

  if (selectedJournals === null) {
    selectedJournals = new Set(availableJournals.map(j => j.key));
  }

  // チェックボックスHTMLを生成
  checkboxListEl.innerHTML = availableJournals.map(j => {
    const isChecked = selectedJournals.has(j.key);
    return `
      <label class="journal-check-item">
        <input type="checkbox" value="${escapeHtml(j.key)}" data-journal-key="${escapeHtml(j.key)}" ${isChecked ? 'checked' : ''}>
        <span class="item-label">${escapeHtml(j.label)}</span>
        <span class="item-count">${j.count}件</span>
      </label>
    `;
  }).join('');

  // 各チェックボックスの変更イベント
  checkboxListEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const key = e.target.dataset.journalKey;
      if (e.target.checked) {
        selectedJournals.add(key);
      } else {
        selectedJournals.delete(key);
      }
      saveSelectedJournals();
      updateJournalFilterLabel(availableJournals.length);
      renderPapers();
    });
  });

  updateJournalFilterLabel(availableJournals.length);
}

/**
 * 表示期間セレクター（過去◯ヶ月 & 1ヶ月ごとの月別）を動的生成
 */
function populatePeriodSelect() {
  const periodSelect = document.getElementById('periodSelect');
  if (!periodSelect) return;

  const savedVal = localStorage.getItem('ep_period') || '1y';

  let html = `
    <optgroup label="── 過去◯ヶ月 ──">
      <option value="1m">📅 過去1ヶ月</option>
      <option value="2m">📅 過去2ヶ月</option>
      <option value="3m">📅 過去3ヶ月</option>
      <option value="4m">📅 過去4ヶ月</option>
      <option value="5m">📅 過去5ヶ月</option>
      <option value="6m">📅 過去6ヶ月</option>
      <option value="1y">📅 過去1年間（全件）</option>
    </optgroup>
  `;

  // データから実際に存在する年月を降順で収集
  const monthMap = new Map();
  allPapers.forEach(paper => {
    const d = parsePubDateToDate(paper.pubDate);
    if (d) {
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    }
  });

  const sortedMonths = Array.from(monthMap.keys()).sort().reverse();
  if (sortedMonths.length > 0) {
    html += `<optgroup label="── 1ヶ月ごとの月別 ──">`;
    sortedMonths.forEach(ym => {
      const [year, month] = ym.split('-');
      const count = monthMap.get(ym);
      html += `<option value="month:${ym}">🗓️ ${year}年${parseInt(month, 10)}月 (${count}件)</option>`;
    });
    html += `</optgroup>`;
  }

  periodSelect.innerHTML = html;

  const validValues = Array.from(periodSelect.querySelectorAll('option')).map(o => o.value);
  if (validValues.includes(savedVal)) {
    periodSelect.value = savedVal;
  } else {
    periodSelect.value = '1y';
  }
}

function getCookieVal(name) {
  try {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  } catch (_) {
    return '';
  }
}

function setCookieVal(name, value) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=31536000; path=/; SameSite=Lax`;
  } catch (_) {}
}

function isSyncNotifDismissed(syncDateKey, notifKey) {
  try {
    if (localStorage.getItem('ep_disable_sync_popup') === '1' || getCookieVal('ep_disable_sync_popup') === '1') {
      return true;
    }
    const dismissedDateLS = localStorage.getItem('ep_dismissed_sync_date') || '';
    const dismissedDateCK = getCookieVal('ep_dismissed_sync_date') || '';
    const maxDismissedDate = dismissedDateLS > dismissedDateCK ? dismissedDateLS : dismissedDateCK;
    // すでに同日またはより新しい日付の通知を閉じていれば、古いローカルデータでも再表示しない
    if (syncDateKey && maxDismissedDate && syncDateKey <= maxDismissedDate) {
      return true;
    }
    if (localStorage.getItem('ep_dismissed_sync_notif') === notifKey || getCookieVal('ep_dismissed_sync_notif') === notifKey) {
      return true;
    }
  } catch (_) {}
  return false;
}

function markSyncNotifDismissed(syncDateKey, notifKey) {
  try {
    if (syncDateKey) {
      const prevLS = localStorage.getItem('ep_dismissed_sync_date') || '';
      const prevCK = getCookieVal('ep_dismissed_sync_date') || '';
      const prevMax = prevLS > prevCK ? prevLS : prevCK;
      if (syncDateKey >= prevMax) {
        localStorage.setItem('ep_dismissed_sync_date', syncDateKey);
        setCookieVal('ep_dismissed_sync_date', syncDateKey);
      }
    }
    if (notifKey) {
      localStorage.setItem('ep_dismissed_sync_notif', notifKey);
      setCookieVal('ep_dismissed_sync_notif', notifKey);
    }
  } catch (_) {}
}

/**
 * 新着収集アナウンスのポップアップウィンドウ表示
 */
function renderSyncNotificationBar(data) {
  const modal = document.getElementById('syncAnnouncementModal');
  if (!modal) return;

  const newCount = data?.newCount || allPapers.filter(p => p.isNew).length;
  if (newCount <= 0) {
    modal.style.display = 'none';
    return;
  }

  // 同じ更新日（updatedAt）の通知は、件数変動やタスクキル再起動があっても1回しか自動表示しない
  const syncDateKey = String(data?.updatedAt || data?.latestSyncInfo?.syncDate || '').trim();
  const notifKey = `${syncDateKey || 'init'}_${newCount}`;
  if (isSyncNotifDismissed(syncDateKey, notifKey)) {
    modal.style.display = 'none';
    return;
  }
  modal.dataset.notifKey = notifKey;
  modal.dataset.syncDateKey = syncDateKey;
  markSyncNotifDismissed(syncDateKey, notifKey);

  // 最新収集メッセージ
  let msg = data?.latestSyncInfo?.message;
  if (!msg) {
    const journalCounts = {};
    allPapers.filter(p => p.isNew).forEach(p => {
      const j = p.journalAbbr || p.journal || '主要誌';
      journalCounts[j] = (journalCounts[j] || 0) + 1;
    });
    const topJournals = Object.keys(journalCounts).slice(0, 3).join('・');
    msg = `${topJournals || '各主要誌'}から新着論文 ${newCount}件 を自動収集・要約しました！`;
  }

  const msgEl = document.getElementById('syncNotifMessage');
  if (msgEl) msgEl.textContent = msg;
  modal.style.display = 'flex';
}

/**
 * 掲載主要13誌の発売日・刊行スケジュール モーダルの描画
 */
function renderJournalScheduleModal() {
  const container = document.getElementById('journalScheduleContainer');
  if (!container) return;

  // 各雑誌ごとの現在のアブレーション論文収録件数と最新掲載日を算出
  const journalStats = new Map();
  allPapers.forEach(p => {
    const key = (p.journalAbbr || p.journal || '').toLowerCase();
    const curr = journalStats.get(key) || { count: 0, latestDate: '' };
    curr.count++;
    if (p.pubDate && (!curr.latestDate || p.pubDate > curr.latestDate)) {
      curr.latestDate = p.pubDate;
    }
    journalStats.set(key, curr);
  });

  container.innerHTML = JOURNAL_SCHEDULES.map(js => {
    let freqClass = 'monthly';
    if (js.frequency.includes('週刊')) freqClass = 'weekly';
    else if (js.frequency.includes('隔月')) freqClass = 'bimonthly';

    // 該当する収録データを探す
    let stats = { count: 0, latestDate: '' };
    for (const [k, v] of journalStats.entries()) {
      if (js.name.toLowerCase().includes(k) || k.includes(js.id) || (js.id === 'hr' && k.includes('heart rhythm'))) {
        stats.count += v.count;
        if (v.latestDate && (!stats.latestDate || v.latestDate > stats.latestDate)) {
          stats.latestDate = v.latestDate;
        }
      }
    }

    return `
      <div class="schedule-card">
        <div class="schedule-card-header">
          <div class="schedule-card-title">
            <span>📖</span> ${escapeHtml(js.name)}
          </div>
          <span class="schedule-card-freq ${freqClass}">${escapeHtml(js.frequency)}</span>
        </div>
        
        <div class="schedule-timing-row">
          <span class="schedule-timing-label">📅 発売・更新:</span>
          <span class="schedule-timing-value">${escapeHtml(js.releaseTiming)}</span>
        </div>

        <div class="schedule-card-details">
          <div><strong>🔬 主な注目領域:</strong> ${escapeHtml(js.epRelevance)}</div>
        </div>

        <div class="schedule-card-meta">
          <span>🏛️ ${escapeHtml(js.publisher)}</span>
          ${js.impactFactor !== 'N/A' ? `<span>📈 IF: ${escapeHtml(js.impactFactor)}</span>` : ''}
          ${stats.count > 0 ? `<span style="color: var(--accent-blue); font-weight: 700;">📄 収録: ${stats.count}件 ${stats.latestDate ? `(最新: ${stats.latestDate})` : ''}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * イベントリスナー設定
 */
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearch');

  searchInput.addEventListener('input', (e) => {
    clearBtn.style.display = e.target.value ? 'block' : 'none';
    renderPapers();
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    renderPapers();
  });

  const filterSelect = document.getElementById('filterSelect');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      currentFilterTab = e.target.value;
      renderPapers();
    });
  }

  const domainFilterBar = document.getElementById('domainFilterBar');
  if (domainFilterBar) {
    const pills = Array.from(domainFilterBar.querySelectorAll('.domain-pill-btn'));
    const syncActivePill = (val) => {
      pills.forEach(btn => btn.classList.toggle('active', btn.dataset.domain === val));
    };
    syncActivePill(currentDomainFilter);
    pills.forEach(btn => {
      btn.addEventListener('click', () => {
        currentDomainFilter = btn.dataset.domain || 'all';
        try { localStorage.setItem('ep_paper_domain_filter', currentDomainFilter); } catch (_) {}
        syncActivePill(currentDomainFilter);
        renderPapers();
      });
    });
  }

  const newCountBadge = document.getElementById('newCountBadge');
  if (newCountBadge) {
    newCountBadge.addEventListener('click', () => {
      currentFilterTab = 'new';
      if (filterSelect) filterSelect.value = 'new';
      renderPapers();
    });
  }

  // 期間選択
  const periodSelect = document.getElementById('periodSelect');
  if (periodSelect) {
    const savedPeriod = localStorage.getItem('ep_period');
    if (savedPeriod) {
      periodSelect.value = savedPeriod;
    }
    periodSelect.addEventListener('change', (e) => {
      localStorage.setItem('ep_period', e.target.value);
      renderPapers();
    });
  }

  // 雑誌フィルタードロップダウン開閉・クイック操作
  const journalToggleBtn = document.getElementById('journalFilterToggleBtn');
  const journalDropdown = document.getElementById('journalFilterDropdown');
  if (journalToggleBtn && journalDropdown) {
    journalToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = journalDropdown.style.display === 'none';
      if (isHidden) {
        journalDropdown.style.display = 'flex';
        journalToggleBtn.classList.add('open');
        journalToggleBtn.setAttribute('aria-expanded', 'true');
      } else {
        journalDropdown.style.display = 'none';
        journalToggleBtn.classList.remove('open');
        journalToggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    const closeBtn = document.getElementById('closeJournalFilterBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        journalDropdown.style.display = 'none';
        journalToggleBtn.classList.remove('open');
        journalToggleBtn.setAttribute('aria-expanded', 'false');
      });
    }

    const selectAllBtn = document.getElementById('selectAllJournalsBtn');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        const cbs = document.querySelectorAll('#journalCheckboxList input[type="checkbox"]');
        if (!selectedJournals) selectedJournals = new Set();
        cbs.forEach(cb => {
          cb.checked = true;
          selectedJournals.add(cb.dataset.journalKey);
        });
        saveSelectedJournals();
        updateJournalFilterLabel(cbs.length);
        renderPapers();
      });
    }

    const clearAllBtn = document.getElementById('clearAllJournalsBtn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        const cbs = document.querySelectorAll('#journalCheckboxList input[type="checkbox"]');
        cbs.forEach(cb => {
          cb.checked = false;
        });
        if (selectedJournals) selectedJournals.clear();
        saveSelectedJournals();
        updateJournalFilterLabel(cbs.length);
        renderPapers();
      });
    }

    // ドロップダウンの外側タップ/クリックで閉じる
    document.addEventListener('click', (e) => {
      if (!journalDropdown.contains(e.target) && !journalToggleBtn.contains(e.target)) {
        if (journalDropdown.style.display !== 'none') {
          journalDropdown.style.display = 'none';
          journalToggleBtn.classList.remove('open');
          journalToggleBtn.setAttribute('aria-expanded', 'false');
        }
      }
    });
  }

  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    const savedSort = localStorage.getItem('ep_paper_sort_order');
    if (savedSort && Array.from(sortSelect.options).some(opt => opt.value === savedSort)) {
      sortSelect.value = savedSort;
    } else {
      sortSelect.value = 'date_desc';
    }
    sortSelect.addEventListener('change', () => {
      localStorage.setItem('ep_paper_sort_order', sortSelect.value);
      renderPapers();
    });
  }

  // 臨床要約の表示・非表示セグメント切替コントロール
  setupSummaryVisibilityToggle();

  const fontSelect = document.getElementById('fontSizeSelect');
  if (fontSelect) {
    fontSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      applyFontSize(selected);
      localStorage.setItem('ep_font_size', selected);
    });
  }

  // ⑨ ダークモード / ライトモード切替ボタン
  const themeDarkBtn = document.getElementById('themeDarkBtn');
  const themeLightBtn = document.getElementById('themeLightBtn');
  if (themeDarkBtn && themeLightBtn) {
    themeDarkBtn.addEventListener('click', () => setTheme('dark'));
    themeLightBtn.addEventListener('click', () => setTheme('light'));
  }

  // ⚙️ 統合設定モーダルの開閉
  const settingsModal = document.getElementById('settingsModal');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsModal = document.getElementById('closeSettingsModal');
  const settingsDoneBtn = document.getElementById('settingsDoneBtn');

  const closeSettings = () => {
    if (settingsModal) settingsModal.style.display = 'none';
  };

  if (openSettingsBtn && settingsModal) {
    openSettingsBtn.addEventListener('click', () => {
      settingsModal.style.display = 'flex';
      const body = settingsModal.querySelector('.modal-body');
      if (body) body.scrollTop = 0;
    });
  }
  if (closeSettingsModal) closeSettingsModal.addEventListener('click', closeSettings);
  if (settingsDoneBtn) settingsDoneBtn.addEventListener('click', closeSettings);
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') closeSettings();
    });
  }

  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') closeModal();
  });

  // ③ 設定画面から「かんたん使い方ガイド」を開く
  const settingsGuideBtn = document.getElementById('settingsGuideBtn');
  if (settingsGuideBtn) {
    settingsGuideBtn.addEventListener('click', () => {
      closeSettings();
      const modal = document.getElementById('guideModal');
      if (modal) {
        modal.style.display = 'flex';
        const body = modal.querySelector('.modal-body');
        if (body) body.scrollTop = 0;
      }
    });
  }

  const closeGuideModal = document.getElementById('closeGuideModal');
  if (closeGuideModal) {
    closeGuideModal.addEventListener('click', () => {
      const modal = document.getElementById('guideModal');
      if (modal) modal.style.display = 'none';
    });
  }

  const guideModal = document.getElementById('guideModal');
  if (guideModal) {
    guideModal.addEventListener('click', (e) => {
      if (e.target.id === 'guideModal') {
        guideModal.style.display = 'none';
      }
    });
  }

  // ④ 設定画面から「医療免責事項・アプリ情報」を開く
  const settingsDisclaimerBtn = document.getElementById('settingsDisclaimerBtn');
  if (settingsDisclaimerBtn) {
    settingsDisclaimerBtn.addEventListener('click', () => {
      closeSettings();
      const modal = document.getElementById('disclaimerModal');
      if (modal) {
        modal.style.display = 'flex';
        const body = modal.querySelector('.modal-body');
        if (body) body.scrollTop = 0;
      }
    });
  }

  const closeDisclaimerModal = document.getElementById('closeDisclaimerModal');
  if (closeDisclaimerModal) {
    closeDisclaimerModal.addEventListener('click', () => {
      const modal = document.getElementById('disclaimerModal');
      if (modal) modal.style.display = 'none';
    });
  }

  const disclaimerModal = document.getElementById('disclaimerModal');
  if (disclaimerModal) {
    disclaimerModal.addEventListener('click', (e) => {
      if (e.target.id === 'disclaimerModal') {
        disclaimerModal.style.display = 'none';
      }
    });
  }

  setupTranslationReportSystem();

  const syncBtn = document.getElementById('syncOnlineBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      syncWithCloud(true);
      pullUserStateFromCloud(getSyncCode(), false, false);
    });
  }

  // ② 雑誌発売日ガイド モーダル制御
  const openScheduleModal = () => {
    closeSettings();
    renderJournalScheduleModal();
    const modal = document.getElementById('scheduleModal');
    if (modal) modal.style.display = 'flex';
    const journalDropdown = document.getElementById('journalFilterDropdown');
    if (journalDropdown) {
      journalDropdown.style.display = 'none';
      const journalToggleBtn = document.getElementById('journalFilterToggleBtn');
      if (journalToggleBtn) {
        journalToggleBtn.classList.remove('open');
        journalToggleBtn.setAttribute('aria-expanded', 'false');
      }
    }
  };

  const settingsScheduleBtn = document.getElementById('settingsScheduleBtn');
  if (settingsScheduleBtn) settingsScheduleBtn.addEventListener('click', openScheduleModal);

  const openScheduleFromDropdownBtn = document.getElementById('openScheduleFromDropdownBtn');
  if (openScheduleFromDropdownBtn) openScheduleFromDropdownBtn.addEventListener('click', openScheduleModal);

  const closeScheduleModal = document.getElementById('closeScheduleModal');
  if (closeScheduleModal) {
    closeScheduleModal.addEventListener('click', () => {
      const modal = document.getElementById('scheduleModal');
      if (modal) modal.style.display = 'none';
    });
  }

  const scheduleModal = document.getElementById('scheduleModal');
  if (scheduleModal) {
    scheduleModal.addEventListener('click', (e) => {
      if (e.target.id === 'scheduleModal') {
        scheduleModal.style.display = 'none';
      }
    });
  }

  // 🔔 発売・自動収集アナウンスポップアップのイベント
  const syncAnnouncementModal = document.getElementById('syncAnnouncementModal');
  const dismissAnnouncement = () => {
    if (syncAnnouncementModal) {
      markSyncNotifDismissed(syncAnnouncementModal.dataset.syncDateKey, syncAnnouncementModal.dataset.notifKey);
      syncAnnouncementModal.style.display = 'none';
    }
  };

  const disableNotifForeverBtn = document.getElementById('disableNotifForeverBtn');
  if (disableNotifForeverBtn) {
    disableNotifForeverBtn.addEventListener('click', () => {
      try { localStorage.setItem('ep_disable_sync_popup', '1'); } catch (_) {}
      setCookieVal('ep_disable_sync_popup', '1');
      dismissAnnouncement();
      showToast('🔕 お知らせの自動表示をオフにしました');
    });
  }

  const viewNewPapersBtn = document.getElementById('viewNewPapersBtn');
  if (viewNewPapersBtn) {
    viewNewPapersBtn.addEventListener('click', () => {
      dismissAnnouncement();
      currentFilterTab = 'new';
      const filterSelectEl = document.getElementById('filterSelect');
      if (filterSelectEl) filterSelectEl.value = 'new';
      renderPapers();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const closeNotifBtn = document.getElementById('closeNotifBtn');
  if (closeNotifBtn) {
    closeNotifBtn.addEventListener('click', dismissAnnouncement);
  }
  if (syncAnnouncementModal) {
    syncAnnouncementModal.addEventListener('click', (e) => {
      if (e.target.id === 'syncAnnouncementModal') dismissAnnouncement();
    });
  }

  // ① 🔗 端末間データ同期モーダル制御
  const openSyncModal = () => {
    closeSettings();
    initDeviceSyncCode();
    document.getElementById('deviceSyncModal').style.display = 'flex';
  };
  const settingsDeviceSyncBtn = document.getElementById('settingsDeviceSyncBtn');
  if (settingsDeviceSyncBtn) settingsDeviceSyncBtn.addEventListener('click', openSyncModal);

  const closeDeviceSyncModal = document.getElementById('closeDeviceSyncModal');
  if (closeDeviceSyncModal) {
    closeDeviceSyncModal.addEventListener('click', () => {
      document.getElementById('deviceSyncModal').style.display = 'none';
    });
  }
  const deviceSyncModal = document.getElementById('deviceSyncModal');
  if (deviceSyncModal) {
    deviceSyncModal.addEventListener('click', (e) => {
      if (e.target.id === 'deviceSyncModal') {
        deviceSyncModal.style.display = 'none';
      }
    });
  }

  const copySyncCodeBtn = document.getElementById('copySyncCodeBtn');
  if (copySyncCodeBtn) {
    copySyncCodeBtn.addEventListener('click', () => {
      const code = getSyncCode();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
          showToast(`📋 同期コード「${code}」をコピーしました！`);
        });
      }
    });
  }

  const forceCloudSyncBtn = document.getElementById('forceCloudSyncBtn');
  if (forceCloudSyncBtn) {
    forceCloudSyncBtn.addEventListener('click', () => {
      pullUserStateFromCloud(getSyncCode(), false, true);
    });
  }

  const applySyncCodeBtn = document.getElementById('applySyncCodeBtn');
  if (applySyncCodeBtn) {
    applySyncCodeBtn.addEventListener('click', async () => {
      const inputEl = document.getElementById('inputSyncCode');
      const rawInput = (inputEl ? inputEl.value : '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (rawInput.length < 6 || rawInput.length > 14) {
        showToast('⚠️ 10桁の英数字コードを入力してください');
        return;
      }
      localStorage.setItem('ep_sync_code', rawInput);
      if (inputEl) inputEl.value = '';
      initDeviceSyncCode();
      await pullUserStateFromCloud(rawInput, true, true);
    });
  }
}

/**
 * 臨床要約の表示・非表示（セグメントコントロール）設定
 */
function setupSummaryVisibilityToggle() {
  const showBtn = document.getElementById('summaryModeShowBtn');
  const hideBtn = document.getElementById('summaryModeHideBtn');
  const homeToggleBtn = document.getElementById('homeSummaryToggleBtn');
  const paperListEl = document.getElementById('paperList');
  if (!paperListEl) return;

  function updateUi(mode, isUserAction = false) {
    if (mode === 'hide') {
      if (showBtn) showBtn.classList.remove('active');
      if (hideBtn) hideBtn.classList.add('active');
      if (homeToggleBtn) {
        homeToggleBtn.classList.remove('active');
        homeToggleBtn.setAttribute('aria-pressed', 'false');
        homeToggleBtn.textContent = '📋 タイトルのみ';
      }
      paperListEl.classList.add('hide-card-summary');
      localStorage.setItem('ep_paper_summary_visibility', 'hide');
      if (isUserAction) {
        showToast('📋 タイトルのみの一覧表示に切り替えました');
      }
    } else {
      if (hideBtn) hideBtn.classList.remove('active');
      if (showBtn) showBtn.classList.add('active');
      if (homeToggleBtn) {
        homeToggleBtn.classList.add('active');
        homeToggleBtn.setAttribute('aria-pressed', 'true');
        homeToggleBtn.textContent = '📝 ポイントあり';
      }
      paperListEl.classList.remove('hide-card-summary');
      localStorage.setItem('ep_paper_summary_visibility', 'show');
      if (isUserAction) {
        showToast('📝 論文のポイントを表示しました');
      }
    }
  }

  // 保存済みの設定を初期反映
  const savedMode = localStorage.getItem('ep_paper_summary_visibility') || 'show';
  updateUi(savedMode, false);

  if (showBtn) {
    showBtn.addEventListener('click', () => {
      updateUi('show', true);
    });
  }

  if (hideBtn) {
    hideBtn.addEventListener('click', () => {
      updateUi('hide', true);
    });
  }

  if (homeToggleBtn) {
    homeToggleBtn.addEventListener('click', () => {
      const current = localStorage.getItem('ep_paper_summary_visibility') || 'show';
      updateUi(current === 'hide' ? 'show' : 'hide', true);
    });
  }
}

function setTheme(theme) {
  const darkBtn = document.getElementById('themeDarkBtn');
  const lightBtn = document.getElementById('themeLightBtn');
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    if (lightBtn) lightBtn.classList.add('active');
    if (darkBtn) darkBtn.classList.remove('active');
    localStorage.setItem('ep_theme', 'light');
  } else {
    document.body.classList.remove('light-theme');
    if (darkBtn) darkBtn.classList.add('active');
    if (lightBtn) lightBtn.classList.remove('active');
    localStorage.setItem('ep_theme', 'dark');
  }
}

function loadThemePreference() {
  const pref = localStorage.getItem('ep_theme') || 'dark';
  setTheme(pref);
}

const MONTH_MAP = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function parsePubDateValue(dateStr) {
  if (!dateStr) return 0;
  const parts = String(dateStr).trim().split(/[-/\s]+/);
  const year = parseInt(parts[0], 10) || 0;
  let month = 1;
  if (parts[1]) {
    const mLower = parts[1].toLowerCase().slice(0, 3);
    if (MONTH_MAP[mLower]) {
      month = MONTH_MAP[mLower];
    } else if (!isNaN(parseInt(parts[1], 10))) {
      month = parseInt(parts[1], 10);
    }
  }
  const day = parts[2] ? (parseInt(parts[2], 10) || 1) : 1;
  return year * 10000 + month * 100 + day;
}

function parsePubDateToDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).trim().split(/[-/\s]+/);
  const year = parseInt(parts[0], 10);
  if (!year || isNaN(year)) return null;
  let month = 1;
  if (parts[1]) {
    const mLower = parts[1].toLowerCase().slice(0, 3);
    if (MONTH_MAP[mLower]) {
      month = MONTH_MAP[mLower];
    } else if (!isNaN(parseInt(parts[1], 10))) {
      month = parseInt(parts[1], 10);
    }
  }
  const day = parts[2] ? (parseInt(parts[2], 10) || 1) : 1;
  return new Date(year, month - 1, day);
}

/**
 * 論文リストのフィルタリング・ソート＆描画
 */
// 常体（である調・体言止め）徹底正規化ヘルパー
function normalizeJotaiStyle(text) {
  if (!text) return '';
  let s = String(text);

  // 1. 崩れた「〜しる」「ありる」「ありた／なりた」「たであるが」「たである」「ないであった」の徹底修復
  s = s.replace(/ではないであった/g, 'ではなかった');
  s = s.replace(/([あ-ん一-龠])ないであった/g, '$1なかった');
  s = s.replace(/([ったかったなかった])(?:ですが|であるが)/g, '$1が');
  s = s.replace(/(高|低|難し|多|少な|長|短|強|弱|良|悪|新し|古|広|狭|早|遅|深|浅|重|軽|大き|小さ|な|た)い(?:ですが|であるが)/g, '$1いが');
  s = s.replace(/([ったかったなかった])(?:です|である)(?=[。、\n\r\t 　\(\)（）]|$)/g, '$1');
  s = s.replace(/(高|低|難し|多|少な|長|短|強|弱|良|悪|新し|古|広|狭|早|遅|深|浅|重|軽|大き|小さ|な|た)い(?:です|である)(?=[。、\n\r\t 　\(\)（）]|$)/g, '$1い');
  s = s.replace(/ありた(?=[。、\n\r\t 　\)]|$)/g, 'あった');
  s = s.replace(/なりた(?=[。、\n\r\t 　\)]|$)/g, 'なった');
  s = s.replace(/(上回|下回|異な|つなが|見つか|わか|受け取|取|と|決ま|残|変わ|終わ|かか|始ま|至|限|起こ|入|戻|減|回|守|送|測|図|作)りた(?=[。、\n\r\t 　\)]|$)/g, '$1った');
  s = s.replace(/可能性がありる/g, '可能性がある');
  s = s.replace(/([でとも])ありる/g, '$1ある');
  s = s.replace(/ありる(?=[。、\n\r\t 　\)]|$)/g, 'ある');
  s = s.replace(/ありる/g, 'ある');
  s = s.replace(/なりる(?=[。、\n\r\t 　\)]|$)/g, 'なる');
  s = s.replace(/としてるる/g, 'として');
  s = s.replace(/([高低大少重軽長短深浅明確有意])くなりる/g, '$1くなる');
  
  // 動詞の「〜しる」誤変換修復
  s = s.replace(/示しる/g, '示す');
  s = s.replace(/生じしる/g, '生じる');
  s = s.replace(/達しる/g, '達する');
  s = s.replace(/要しる/g, '要する');
  s = s.replace(/満たしる/g, '満たす');
  s = s.replace(/見出しる/g, '見出す');
  s = s.replace(/及ぼしる/g, '及ぼす');
  s = s.replace(/果たしる/g, '果たす');
  s = s.replace(/減らしる/g, '減らす');
  s = s.replace(/増やしる/g, '増やす');
  s = s.replace(/もたらしる/g, 'もたらす');
  s = s.replace(/引き起こしる/g, '引き起こす');
  s = s.replace(/関与しる/g, '関与する');
  s = s.replace(/存在しる/g, '存在する');
  s = s.replace(/行いる/g, '行う');
  s = s.replace(/伴いる/g, '伴う');
  s = s.replace(/従いる/g, '従う');
  s = s.replace(/導きる/g, '導く');
  s = s.replace(/([一-龠]{2,})しる/g, '$1する');

  // 2. 進行・完了・否定過去の丁寧語（順序重要：「〜ませんでした」を「〜でした」「〜ません」より先に処理）
  s = s.replace(/ではありませんでした/g, 'ではなかった');
  s = s.replace(/ていませんでした/g, 'ていなかった');
  s = s.replace(/でいませんでした/g, 'でいなかった');
  s = s.replace(/おりませんでした/g, 'いなかった');
  s = s.replace(/ありませんでした/g, 'なかった');
  s = s.replace(/([一-龠]{2,}|[ァ-ヴー]+)しませんでした/g, '$1しなかった');
  s = s.replace(/しませんでした/g, 'しなかった');
  s = s.replace(/なりませんでした/g, 'ならなかった');
  s = s.replace(/わかりませんでした/g, 'わからなかった');
  s = s.replace(/([あ-ん])ませんでした/g, '$1なかった');
  s = s.replace(/([てで])います/g, '$1いる');
  s = s.replace(/([てで])いました/g, '$1いた');
  s = s.replace(/([てで])いません/g, '$1いない');
  s = s.replace(/([てで])おります/g, '$1いる');
  s = s.replace(/([てで])おりました/g, '$1いた');
  s = s.replace(/てきました/g, 'てきた');
  s = s.replace(/てきます/g, 'てくる');

  // 3. 過去丁寧語（〜ました）の完全常体化（〜た）
  s = s.replace(/されました/g, 'された');
  s = s.replace(/せられました/g, 'せられた');
  s = s.replace(/られました/g, 'られた');
  s = s.replace(/見られました/g, '認めた');
  s = s.replace(/認められました/g, '認めた');
  s = s.replace(/考えられました/g, '考えられた');
  s = s.replace(/思われました/g, '思われた');
  s = s.replace(/望まれました/g, '望まれた');
  s = s.replace(/求められました/g, '求められた');
  s = s.replace(/含まれました/g, '含まれた');
  s = s.replace(/得られました/g, '得られた');
  s = s.replace(/生まれました/g, '生まれた');
  s = s.replace(/行われました/g, '行われた');

  s = s.replace(/([一-龠]{2,})しました/g, '$1した');
  s = s.replace(/([ァ-ヴー]+)しました/g, '$1した');
  s = s.replace(/([一-龠ぁ-んァ-ヴー]+)としました/g, '$1とした');
  s = s.replace(/([ったかったなかった])ですが/g, '$1が');
  s = s.replace(/(高|低|難し|多|少な|長|短|強|弱|良|悪|新し|古|広|狭|早|遅|深|浅|重|軽|大き|小さ|な|た)いですが/g, '$1いが');
  s = s.replace(/([一-龠ぁ-んァ-ヴー]+)ですが/g, '$1であるが');
  s = s.replace(/([一-龠ぁ-んァ-ヴー]+)でしたが/g, '$1であったが');

  s = s.replace(/満たしました/g, '満たした');
  s = s.replace(/示しました/g, '示した');
  s = s.replace(/見出しました/g, '見出した');
  s = s.replace(/生み出しました/g, '生み出した');
  s = s.replace(/行いました/g, '行った');
  s = s.replace(/伴いました/g, '伴った');
  s = s.replace(/用いました/g, '用いた');
  s = s.replace(/従いました/g, '従った');
  s = s.replace(/基づきました/g, '基づいた');
  s = s.replace(/導きました/g, '導いた');
  s = s.replace(/続きました/g, '続いた');
  s = s.replace(/防ぎました/g, '防いだ');
  s = s.replace(/要しました/g, '要した');
  s = s.replace(/達しました/g, '達した');
  s = s.replace(/生じました/g, '生じた');
  s = s.replace(/認めました/g, '認めた');
  s = s.replace(/ありました/g, 'あった');
  s = s.replace(/なりました/g, 'なった');
  s = s.replace(/できました/g, 'できた');
  s = s.replace(/減らしました/g, '減らした');
  s = s.replace(/増やしました/g, '増やした');
  s = s.replace(/及ぼしました/g, '及ぼした');
  s = s.replace(/もたらしました/g, 'もたらした');
  s = s.replace(/果たしました/g, '果たした');
  s = s.replace(/目指しました/g, '目指した');
  s = s.replace(/引き起こしました/g, '引き起こした');
  s = s.replace(/一致しました/g, '一致した');
  s = s.replace(/試みました/g, '試みた');
  s = s.replace(/除外しました/g, '除外した');
  s = s.replace(/割り当てました/g, '割り当てた');
  s = s.replace(/(上回|下回|異な|つなが|見つか|わか|受け取|取|決ま|残|変わ|終わ|かか|始ま|至|限|起こ|入|戻|減|回|守|送|測|図|作)りました/g, '$1った');
  s = s.replace(/([えけげせぜてでねへべめれ])ました(?=[。、\n\r\t 　\(\)（）]|$)/g, '$1た');
  s = s.replace(/([しじ])ました(?=[。、\n\r\t 　\(\)（）]|$)/g, '$1た');

  // 4. 現在丁寧語（〜ます）の完全常体化（〜る・〜す 等）
  s = s.replace(/されます/g, 'される');
  s = s.replace(/せられます/g, 'せられる');
  s = s.replace(/られます/g, 'られる');
  s = s.replace(/見られます/g, '認める');
  s = s.replace(/認められます/g, '認める');
  s = s.replace(/考えられます/g, '考えられる');
  s = s.replace(/思われます/g, '思われる');
  s = s.replace(/望まれます/g, '望まれる');
  s = s.replace(/求められます/g, '求められる');
  s = s.replace(/含まれます/g, '含まれる');
  s = s.replace(/得られます/g, '得られる');

  s = s.replace(/([一-龠]{2,})します/g, '$1する');
  s = s.replace(/([ァ-ヴー]+)します/g, '$1する');

  s = s.replace(/可能性があります/g, '可能性がある');
  s = s.replace(/([高低大少重軽長短深浅明確有意])くなります/g, '$1くなる');
  s = s.replace(/あります/g, 'ある');
  s = s.replace(/満たします/g, '満たす');
  s = s.replace(/示します/g, '示す');
  s = s.replace(/見出します/g, '見出す');
  s = s.replace(/行います/g, '行う');
  s = s.replace(/伴います/g, '伴う');
  s = s.replace(/用います/g, '用いる');
  s = s.replace(/従います/g, '従う');
  s = s.replace(/基づきます/g, '基づく');
  s = s.replace(/導きます/g, '導く');
  s = s.replace(/続きます/g, '続く');
  s = s.replace(/防ぎます/g, '防ぐ');
  s = s.replace(/要します/g, '要する');
  s = s.replace(/達します/g, '達する');
  s = s.replace(/生じます/g, '生じる');
  s = s.replace(/認めます/g, '認める');
  s = s.replace(/なります/g, 'なる');
  s = s.replace(/できます/g, 'できる');
  s = s.replace(/減らします/g, '減らす');
  s = s.replace(/増やします/g, '増やす');
  s = s.replace(/及ぼします/g, '及ぼす');
  s = s.replace(/もたらします/g, 'もたらす');
  s = s.replace(/果たします/g, '果たす');
  s = s.replace(/目指します/g, '目指す');
  s = s.replace(/引き起こします/g, '引き起こす');
  s = s.replace(/一致します/g, '一致する');
  s = s.replace(/試みます/g, '試みる');
  s = s.replace(/除外します/g, '除外する');
  s = s.replace(/割り当てます/g, '割り当てる');

  // 5. 判断・指定・否定・残り丁寧語（〜です、〜でした、〜ません 等）
  s = s.replace(/([えけげせぜてでねへべめれ])ます(?=[。、\n\r\t 　\(\)（）]|$)/g, '$1る');
  s = s.replace(/じます(?=[。、\n\r\t 　\(\)（）]|$)/g, 'じる');
  s = s.replace(/([えけげせぜてでねへべめれ])ません(?=[。、\n\r\t 　\(\)（）]|$)/g, '$1ない');
  s = s.replace(/ではありません/g, 'ではない');
  s = s.replace(/ありません/g, 'ない');
  s = s.replace(/でした/g, 'であった');
  s = s.replace(/でしょう(?=[。、\n\r\t 　\(\)（）]|$)/g, 'だろう');
  s = s.replace(/ません/g, 'ない');
  s = s.replace(/です(?=[。、\n\r\t 　\(\)（）]|$)/g, 'である');
  s = s.replace(/ます(?=[。、\n\r\t 　\(\)（）]|$)/g, 'る');

  // 6. 結論・考察定型句の整理
  s = s.replace(/と結論づけられました/g, 'と結論された');
  s = s.replace(/と結論付けられました/g, 'と結論された');
  s = s.replace(/と結論づけられた/g, 'と結論された');
  s = s.replace(/と結論付けられた/g, 'と結論された');
  s = s.replace(/と結論づけられる/g, 'と結論される');
  s = s.replace(/と結論付けられる/g, 'と結論される');
  s = s.replace(/結論づけられました/g, '結論された');
  s = s.replace(/結論付けられました/g, '結論された');
  s = s.replace(/結論づけられた/g, '結論された');
  s = s.replace(/結論付けられた/g, '結論された');
  s = s.replace(/結論づけられる/g, '結論される');
  s = s.replace(/結論付けられる/g, '結論される');

  // 重複修復
  s = s.replace(/であったであった/g, 'であった');
  s = s.replace(/であるである/g, 'である');
  s = s.replace(/されたされた/g, 'された');
  s = s.replace(/認めた認めた/g, '認めた');

  return s;
}

const MEDICAL_TERM_FIXES = [
  [/Posterior Pulmonary Vein Isolation Lesion Spacing and Left Atrial Posterior Wall Narrowing During Pulsed Field Ablation/gi, 'パルスフィールドアブレーション中の肺静脈隔離後方の間隔と左房後壁の狭小化'],
  [/パルスフィールドアブレーション中の後肺静脈隔離病変の間隔と左心房後壁の狭小化/g, 'パルスフィールドアブレーション中の肺静脈隔離後方の間隔と左房後壁の狭小化'],
  [/Closed-Loop Stimulation\s*[（(]CLS[）)]/gi, 'Closed-Loop刺激 (CLS)'],
  [/Closed-Loop Stimulation|閉ループ刺激|クローズドループ刺激/gi, 'Closed-Loop刺激'],
  [/(?:the )?U\.S\. Food and Drug Administration|米国食品医薬品管理局|食品医薬品管理局|食品医薬品管理データベース/gi, (m) => m.includes('データベース') ? 'FDAデータベース' : 'FDA'],
  [/HD Grid Mapping Catheter|Advisor™?\s*HD Grid/gi, 'HD Grid'],
  [/HD Grid\s*マッピングカテーテル/gi, 'HD Grid'],
  [/maze\s*ablation|メイズアブレーション|迷路アブレーション/gi, 'メイズ手術'],
  [/right ventricular apical leads?|右心室心尖部リード|右室心尖リード/gi, '右室心尖部リード'],
  [/conduction system pacing|(?<!刺激)伝導系ペーシング/gi, '刺激伝導系ペーシング'],
  [/left bundle branch area pacing|左脚枝領域ペーシング/gi, '左脚領域ペーシング'],
  [/左脚枝領域/g, '左脚領域'],
  [/dual-chamber pacemakers?|デュアルチャンバーペースメーカー|二腔ペースメーカ(?:ー)?/gi, 'デュアルチャンバーペースメーカ'],
  [/cardiac implantable electronic devices?|心臓植込み型電子デバイス|心臓植え込み型電子デバイス|心臓植込み型電子機器|心臓植え込み型電子機器/gi, '心臓植込み型デバイス'],
  [/lattice-tip|格子先端|格子チップ/gi, 'ラティスチップ'],
  [/real-world|現実世界/gi, 'リアルワールド'],
  [/radiofrequency applications?|高周波アプリケーション|RFアプリケーション/gi, '高周波通電'],
  [/\b(PV|PW)\s*アプリケーション/g, '$1 通電'],
  [/sinus rate|副鼻腔速度|副鼻腔レート|洞速度/gi, '洞結節rate'],
  [/sinus arrest|副鼻腔停止/gi, '洞停止'],
  [/noninducibility|non-inducibility|非誘導性/gi, '非誘発性'],
  [/inducibility|誘導性/gi, '誘発性'],
  [/acute procedural success|急性手技成功|急性処置成功/gi, '急性期手技成功'],
  [/left atrial posterior wall|左心房後壁/gi, '左房後壁'],
  [/rhythm control|調律制御/gi, 'リズムコントロール'],
  [/blanking period|空白期間/gi, 'ブランキング期間'],
  [/left atrial catheter dwell times?|左心房カテーテルの?滞留時間|左房カテーテル滞留時間/gi, '左房滞在時間'],
  [/バリパルス/g, 'Varipulse'],
  [/蛍光透視|透視検査/g, '透視'],
  [/「?肌と肌の?」?|皮膚から皮膚まで|皮膚対皮膚/g, 'skin-to-skin'],
  [/生理学から光学/g, '生理学から視覚'],
  [/傾向スコアマッチング|傾向スコアと一致した/g, 'プロペンシティスコアマッチング'],
  [/リエントリーサーキット|リエントラント回路|再入回路/gi, 'リエントリー回路'],
  [/critical Purkinje potentials?|臨界プルキンエ電位/gi, '重要なプルキンエ電位'],
  [/冠状静脈系の枝/g, '冠状静脈系の分枝'],
  [/深部鎮静|深い鎮静/g, '深鎮静'],
  [/freedom from recurrence|再発からの自由|再発からの解放/gi, '非再発'],
  [/TEE-induced mechanical injury|TEE誘発性?機械的損傷/gi, 'TEEによる機械的損傷'],
  [/処置時間/g, '手技時間'],
  [/多変数/g, '多変量'],
  [/回顧的|遡及的(?!に報告)/g, '後ろ向き'],
  [/remote monitoring/gi, '遠隔モニタリング'],
  [/atrial tachycardia/gi, '心房頻拍'],
  [/\bdurability\b|耐久性/gi, 'デュラビリティ'],
  [/\bbidirectional\b|双方向性/gi, '両方向性'],
  [/双方向(?!(?:性|ブロック))/g, '両方向'],
  [/false tendons?|偽腱索|偽腱|仮性腱(?!索)/gi, '仮性腱索'],
  [/Activation mapping|活性化マップ/g, 'アクチベーションマップ'],
  [/activation mapping|活性化マッピング|興奮マッピング|アクティベーションマッピング/gi, 'アクチベーションマッピング'],
  [/moderat(?:e|or) band|調節帯|モデレータバンド/gi, 'モデレーターバンド'],
  [/linear ablation|線形アブレーション|線状アブレーション/gi, '線状焼灼'],
  [/left atrial dilat(?:at)?ion|左心房拡張|左心房拡大|左房拡張/gi, '左房拡大'],
  [/recurrence-free rate|無再発率|再発回避率/gi, '非再発率'],
  [/crista terminalis|分界稜|分界陵/gi, 'クリスタ・ターミナーリス'],
  [/Venous Vascular Closure System Versus Conventional Figure of Eight Suture Following Single Shot Device Pulmonary Vein Isolation/gi, 'シングルショットデバイスによる肺静脈隔離における静脈閉鎖システムと従来の八の字縫合の比較'],
  [/静脈血管閉鎖システムとシングルショットデバイス肺静脈隔離後の\s*8\s*本の縫合糸による従来の図/g, 'シングルショットデバイスによる肺静脈隔離における静脈閉鎖システムと従来の八の字縫合の比較'],
  [/(?:catheterization|electrophysiology|EP)\s+laboratory|カテーテル検査室|電気生理検査室|電気生理学検査室|EPラボ/gi, '血管造影室'],
  [/systemic right ventricle|体循環右室|体心室右室/gi, '体循環を担う解剖学的右室'],
  [/congenitally corrected transposition of the great arteries|先天性修正大血管転位/gi, '修正大血管転移'],
  [/posterior wall isolation|左房後壁隔離|左心房後壁隔離/gi, '後壁隔離'],
  [/left ventricular summit|左室サミット|左心室サミット/gi, 'LVサミット'],
  [/ST-segment Elevation|ST部分上昇|ST\s*セグメント上昇/gi, 'ST上昇'],
  [/manual compression|手動圧迫|手圧迫/gi, '用手圧迫'],
  [/\breconnection\b|再接続/gi, '再伝導'],
  [/re-?isolat(?:e|ion)|再分離/gi, '再隔離'],
  [/Receiver operator curve|Receiver operating characteristic(?:\s+curve)?|受信者動作特性曲線/gi, 'ROC曲線'],
  [/\bentrainment\b|エントレインメント（乗っ取り）/gi, 'エントレインメント'],
  [/surgical window|外科的窓|外科窓|手術窓/gi, '外科的開窓'],
];

function normalizeMedicalTerms(text) {
  if (!text) return '';
  let s = String(text);
  for (const [pattern, replacement] of MEDICAL_TERM_FIXES) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

// 抄録・臨床要約の共通見出し正規化＆バッジ化ヘルパー
function formatSectionText(text) {
  if (!text) return '';
  let str = normalizeJotaiStyle(normalizeMedicalTerms(String(text)));

  // 1. Background and aims / 背景と目的 の完全統一
  str = str.replace(/(?:Background and aims|Background and objectives|Background & aims|BACKGROUND AND AIMS|BACKGROUND AND OBJECTIVES|背景と目的|背景および目的|背景・目的|背景\/目的|【概要】および目的|【背景】および目的|【背景】そして目的|背景と\s*目的)[:：]?/gi, '【背景と目的】');
  str = str.replace(/背景と\s*【目的】/g, '【背景と目的】');
  str = str.replace(/【背景と目的】\s*そして目的[:：]?/g, '【背景と目的】');

  // 2. Methods and results / 方法と結論 の完全統一
  str = str.replace(/(?:Methods and results|Methods & results|METHODS AND RESULTS|METHODS & RESULTS|方法と結果|方法および結果|方法と結論|方法・結果)[:：]?/gi, '【方法と結論】');
  str = str.replace(/【方法】\s*そして\s*\n*【結果】/g, '【方法と結論】');
  str = str.replace(/【方法】\s*そして/g, '【方法と結論】');

  // 3. Backgraand / Background / 概要 / 背景: を 【背景】 に統一
  str = str.replace(/(?:Backgraand|Background|BACKGROUND|【概要】)[:：]?/gi, '【背景】');
  str = str.replace(/(?<!【)(?:背景)[:：]/g, '【背景】');
  str = str.replace(/【概要】/g, '【背景】');

  // 4. 単独見出しの統一（日本語「目的:」「方法:」「結果:」「結論:」および英語見出しに対応）
  str = str.replace(/(?<!【背景と)(?:Aims|Aim|Objectives|Objective|AIMS|OBJECTIVES|目的)[:：]/gi, '【目的】');
  str = str.replace(/(?<!【)(?:Methods|Method|METHODS|対象・方法|対象と方法|方法)[:：]/gi, '【方法】');
  str = str.replace(/(?<!【)(?:Results|Result|RESULTS|成績|結果)[:：]/gi, '【結果】');
  str = str.replace(/(?<!【)(?:Conclusions|Conclusion|CONCLUSIONS|考察|結論)[:：]/gi, '【結論】');

  // 二重括弧の解消 & 見出し直後の余分なコロン削除
  str = str.replace(/【+([^】]+)】+[:：]?/g, '【$1】');

  // 連続改行の圧縮
  str = str.replace(/\n{2,}/g, '\n').trim();

  // HTMLエスケープ後に見出しバッジ化
  let escaped = escapeHtml(str);
  escaped = escaped.replace(/\n*【(背景と目的|背景・目的|背景|目的|方法と結論|方法|結果|結論)】\n*/g, '<span class="abs-header-badge">【$1】</span>');

  return escaped;
}

const PLACEHOLDER_POINT_RE = /^(?:対象集団および治療介入プロトコル|主要評価項目および臨床経過の観察|臨床上の有用性と課題を検討|研究目的と対象|臨床知見の詳細については原著参照|心血管疾患治療における臨床アプローチの検証|要約準備中)[。．.]?$/;

function cleanPointFragment(raw) {
  if (!raw) return '';
  let s = raw
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^(?:そして|また|さらに|しかし|一方|なお|ただし|そのため|その結果|背景|目的|方法|結果|結論|対象と方法|対象・方法|および目的)[:：、。\s]*/g, '')
    .replace(/でに/g, 'で')
    .replace(/をを/g, 'を')
    .replace(/がが/g, 'が')
    .replace(/(?:\.\.\.|…)+[。．.]?$/g, '')
    .trim();
  // 短すぎる断片や助詞止め（「CSで」「そして」等）を除外
  if (s.length < 14 || /^(?:そして|また|さらに|しかし|なお)$/.test(s) || /(?:で|に|を|が|は|と|の|へ|から|より)$/.test(s)) {
    return '';
  }
  return s;
}

// 論文のポイント（3〜4行の要約段落）HTML生成ヘルパー
function formatPaperPointsHtml(summaryText, includeHeader = true) {
  if (!summaryText) {
    return `${includeHeader ? '<div class="points-box-header">💡 論文のポイント</div>' : ''}<p class="paper-points-paragraph">要約準備中</p>`;
  }
  let str = normalizeJotaiStyle(normalizeMedicalTerms(String(summaryText)));
  // 先頭・末尾のメタ情報タグ（(無作為化比較試験... / N = ...例) 等）を除去
  str = str.replace(/\s*\((?:無作為化比較試験|前向き研究|後ろ向き研究|観察研究|症例報告)[^)]*?(?:N\s*=|症例数)[^)]*\)/g, '');

  // すでに「・」の箇条書き形式ならそのまま使う
  const rawLines = str.split('\n').map(l => l.trim()).filter(Boolean);
  let points = [];
  if (rawLines.length >= 2 && rawLines.every(l => /^[・•\-]/.test(l))) {
    points = rawLines
      .map(l => cleanPointFragment(l.replace(/^[・•\-]\s*/, '')))
      .filter(Boolean)
      .slice(0, 4);
  } else {
    // 【背景】【方法】【結果】【結論】から要点を抽出して3〜4行の段落に整理
    const sectionMap = {};
    const regex = /【(背景と目的|背景・目的|背景|目的|方法と結論|方法|結果|結論)】([\s\S]*?)(?=【(?:背景と目的|背景・目的|背景|目的|方法と結論|方法|結果|結論)】|$)/g;
    let m;
    while ((m = regex.exec(str)) !== null) {
      const key = m[1];
      const body = cleanPointFragment(m[2]);
      if (body && !PLACEHOLDER_POINT_RE.test(body)) {
        sectionMap[key] = body;
      }
    }

    const candidates = [
      sectionMap['方法'] || sectionMap['背景と目的'] || sectionMap['背景・目的'] || sectionMap['背景'] || sectionMap['目的'],
      sectionMap['結果'] || sectionMap['方法と結論'],
      sectionMap['結論'],
    ].filter(Boolean);

    // もし上記が1件以下しか取れなければ他のセクションも補完
    if (candidates.length <= 1) {
      for (const val of Object.values(sectionMap)) {
        if (!candidates.includes(val)) candidates.push(val);
      }
    }

    const seen = new Set();
    for (const c of candidates) {
      const cleaned = cleanPointFragment(c);
      if (!cleaned || PLACEHOLDER_POINT_RE.test(cleaned)) continue;
      const key = cleaned.slice(0, 24);
      if (seen.has(key)) continue;
      seen.add(key);
      points.push(cleaned);
      if (points.length >= 4) break;
    }

    if (points.length === 0) {
      const fallback = cleanPointFragment(str.replace(/【[^】]+】/g, ''));
      if (fallback) points.push(fallback);
    }
  }

  const headerHtml = includeHeader ? '<div class="points-box-header">💡 論文のポイント</div>' : '';
  const paragraph = points
    .map(p => (/[。．.!?！？]$/.test(p) ? p : `${p}。`))
    .join('');
  return `${headerHtml}<p class="paper-points-paragraph">${escapeHtml(paragraph || '要約準備中')}</p>`;
}

function renderPapers() {
  const paperListEl = document.getElementById('paperList');
  if (!paperListEl) return;

  // 臨床要約の表示・非表示クラスの同期
  const currentSummaryMode = localStorage.getItem('ep_paper_summary_visibility') || 'show';
  if (currentSummaryMode === 'hide') {
    paperListEl.classList.add('hide-card-summary');
  } else {
    paperListEl.classList.remove('hide-card-summary');
  }

  const searchText = document.getElementById('searchInput').value.toLowerCase().trim();
  const sortVal = document.getElementById('sortSelect')?.value || localStorage.getItem('ep_paper_sort_order') || 'date_desc';
  const periodVal = document.getElementById('periodSelect')?.value || '1y';

  const unreadCount = allPapers.filter(p => !readPapers.includes(String(p.pmid))).length;
  const readCount = readPapers.length;

  document.getElementById('paperCountBadge').textContent = `📄 未読 ${unreadCount}件 (既読 ${readCount}件)`;
  const readTabBtn = document.getElementById('readTabBtn');
  if (readTabBtn) readTabBtn.textContent = `☑ 既読のみ (${readCount})`;
  const showAllTabBtn = document.getElementById('showAllTabBtn');
  if (showAllTabBtn) showAllTabBtn.textContent = `📋 全件表示 (${allPapers.length})`;

  let filtered = allPapers.filter(paper => {
    const pmidStr = String(paper.pmid);
    const isRead = readPapers.includes(pmidStr);
    const isBookmarked = bookmarks.includes(pmidStr);

    // 期間フィルター（過去◯ヶ月、1ヶ月ごとの特定月、過去1年間）
    if (periodVal !== '1y') {
      const pDate = parsePubDateToDate(paper.pubDate);
      if (pDate) {
        if (periodVal.startsWith('month:')) {
          const ym = periodVal.replace('month:', '');
          const pYm = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
          if (pYm !== ym) {
            return false;
          }
        } else if (periodVal.endsWith('m')) {
          const months = parseInt(periodVal, 10) || 1;
          const daysLimit = Math.round(months * 30.5);
          const cutoffTime = Date.now() - (daysLimit * 24 * 60 * 60 * 1000);
          if (pDate.getTime() < cutoffTime) {
            return false;
          }
        }
      }
    }

    // 既読の表示/非表示フィルター
    if (currentFilterTab === 'read') {
      // 「既読のみ」タブ：既読がついているものだけ表示
      if (!isRead) return false;
    } else if (currentFilterTab === 'show_all') {
      // 「全件表示」タブ：既読・未読問わず全件表示
    } else {
      // デフォルト（未読のみ、新着、RCT、前向き、症例、ブックマーク等の通常タブ）：
      // 既読がついているものは表示から隠す！
      if (isRead) return false;
    }

    if (searchText) {
      const titleJa = (paper.titleJa || '').toLowerCase();
      const titleEn = (paper.title || '').toLowerCase();
      const abs = (paper.abstract || '').toLowerCase();
      const author = (paper.authors || '').toLowerCase();
      if (!titleJa.includes(searchText) && !titleEn.includes(searchText) && !abs.includes(searchText) && !author.includes(searchText)) {
        return false;
      }
    }

    if (currentFilterTab === 'new' && !paper.isNew) return false;
    if (currentFilterTab === 'rct' && paper.designRank !== 1) return false;
    if (currentFilterTab === 'prospective' && paper.designRank !== 2) return false;
    if (currentFilterTab === 'case' && paper.designRank !== 99) return false;
    if (currentFilterTab === 'bookmarks' && !isBookmarked) return false;

    // 分野・領域フィルター（EP/アブレーション 上室性・心室性 / デバイス）
    if (currentDomainFilter && currentDomainFilter !== 'all') {
      if (currentDomainFilter === 'device' && paper._domain !== 'device') return false;
      if (currentDomainFilter === 'ep' && paper._domain !== 'ep') return false;
      if (currentDomainFilter === 'ep_sv' && (paper._domain !== 'ep' || paper._epRegion !== 'supraventricular')) return false;
      if (currentDomainFilter === 'ep_v' && (paper._domain !== 'ep' || paper._epRegion !== 'ventricular')) return false;
    }

    // 複数雑誌チェックボックスフィルター
    if (selectedJournals) {
      if (selectedJournals.size === 0) {
        return false; // 1誌もチェックされていない場合は表示しない
      }
      if (!paperMatchesJournalFilter(paper)) {
        return false;
      }
    }

    return true;
  });

  filtered.sort((a, b) => {
    if (sortVal === 'priority') {
      if (a.designRank !== b.designRank) return a.designRank - b.designRank;
      if (a.isTargetJournal !== b.isTargetJournal) return b.isTargetJournal ? 1 : -1;
      return (b.sampleSize || 0) - (a.sampleSize || 0);
    }
    if (sortVal === 'date_desc' || sortVal === 'date') {
      const diff = parsePubDateValue(b.pubDate) - parsePubDateValue(a.pubDate);
      if (diff !== 0) return diff;
      return String(b.pmid || '').localeCompare(String(a.pmid || ''));
    }
    if (sortVal === 'date_asc') {
      const diff = parsePubDateValue(a.pubDate) - parsePubDateValue(b.pubDate);
      if (diff !== 0) return diff;
      return String(a.pmid || '').localeCompare(String(b.pmid || ''));
    }
    if (sortVal === 'sampleSize') {
      return (b.sampleSize || 0) - (a.sampleSize || 0);
    }
    return 0;
  });

  if (filtered.length === 0) {
    let emptyMsg = '🔍 該当する論文は見つかりませんでした。';
    if (selectedJournals && selectedJournals.size === 0) {
      emptyMsg = '📚 表示する雑誌が選択されていません。<br>上部の「対象誌」ドロップダウンから雑誌にチェックを入れてください。';
    } else if (currentFilterTab === 'read') {
      emptyMsg = '☑ 既読の論文はまだありません。読んだ論文の「☐ 既読」をチェックするとここに表示されます。';
    } else if (currentFilterTab === 'bookmarks') {
      emptyMsg = '❤️ ブックマークされた論文はありません。';
    } else if (readCount > 0) {
      emptyMsg = `✨ すべての未読論文を読み終えました！（既読論文が ${readCount} 件あります。「☑ 既読のみ」または「📋 全件表示」タブで確認できます）`;
    }
    paperListEl.innerHTML = `
      <div class="loading-state" style="text-align: center; padding: 32px 16px;">
        <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">${emptyMsg}</p>
      </div>
    `;
    return;
  }

  paperListEl.innerHTML = filtered.map((paper) => {
    const pmidStr = String(paper.pmid);
    const isBookmarked = bookmarks.map(String).includes(pmidStr);
    const isRead = readPapers.map(String).includes(pmidStr);

    let designBadgeClass = 'other';
    if (paper.designRank === 1) designBadgeClass = 'rct';
    else if (paper.designRank === 2) designBadgeClass = 'prospective';
    else if (paper.designRank === 99) designBadgeClass = 'case';

    const sampleStr = paper.sampleSize > 0 ? `N=${paper.sampleSize.toLocaleString()}例` : 'N不明';
    let domainBadgeHtml = '';
    if (paper._domain === 'device') {
      domainBadgeHtml = '<span class="domain-badge device">🔋 デバイス</span>';
    } else if (paper._epRegion === 'ventricular') {
      domainBadgeHtml = '<span class="domain-badge ep-v">⚡ 心室性</span>';
    } else {
      domainBadgeHtml = '<span class="domain-badge ep-sv">🫀 上室性</span>';
    }

    return `
      <div class="paper-card ${paper.isNew ? 'is-new' : ''} ${isRead ? 'is-read' : ''}" onclick="openDetail('${paper.pmid}')">
        <div class="paper-card-header">
          <div class="card-badges">
            ${paper.isNew ? '<span class="new-badge">✨ NEW 新着</span>' : ''}
            ${domainBadgeHtml}
            <span class="design-badge ${designBadgeClass}">${paper.studyTypeLabel}</span>
            <span class="sample-badge">👥 ${sampleStr}</span>
          </div>
          <div class="card-actions" onclick="event.stopPropagation();" onpointerdown="event.stopPropagation();" ontouchstart="event.stopPropagation();">
            <button type="button" class="read-btn ${isRead ? 'active' : ''}" onclick="event.stopPropagation(); toggleRead('${paper.pmid}');" onpointerdown="event.stopPropagation();" ontouchstart="event.stopPropagation();" title="${isRead ? 'タップで未読に戻す' : '手動で既読にする（一覧から非表示）'}">
              ${isRead ? '☑ 既読' : '☐ 既読（非表示）'}
            </button>
            <button type="button" class="bookmark-btn ${isBookmarked ? 'active' : ''}" onclick="event.stopPropagation(); toggleBookmark('${paper.pmid}');" onpointerdown="event.stopPropagation();" ontouchstart="event.stopPropagation();" title="${isBookmarked ? 'ブックマークを外す' : 'ブックマークに保存'}">
              ${isBookmarked ? '❤️' : '🤍'}
            </button>
          </div>
        </div>
        <div class="card-date-journal">
          📅 ${paper.pubDate} | 📖 ${escapeHtml(getJournalDisplayName(paper))}
        </div>
        <div class="card-title-ja">${escapeHtml(normalizeMedicalTerms(paper.titleJa || paper.title))}</div>
        <div class="card-title-en">(${escapeHtml(paper.title)})</div>
        <div class="card-summary-box">${formatPaperPointsHtml(paper.summaryJa || '', true)}</div>
        <div class="card-footer">
          <span>抄録全訳・原文を見る</span>
          <span>➔</span>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleRead = function(pmid) {
  const pmidStr = String(pmid);
  const currentRead = readPapers.map(String);
  if (currentRead.includes(pmidStr)) {
    readPapers = currentRead.filter(id => id !== pmidStr);
    showToast('未読に戻しました');
  } else {
    readPapers.push(pmidStr);
    showToast('☑ 既読マークをつけました（一覧から非表示）');
  }
  localStorage.setItem('ep_paper_read', JSON.stringify(readPapers));
  renderPapers();
  pushUserStateToCloud(getSyncCode());
};

window.toggleBookmark = function(pmid) {
  const pmidStr = String(pmid);
  const currentBookmarks = bookmarks.map(String);
  if (currentBookmarks.includes(pmidStr)) {
    bookmarks = currentBookmarks.filter(id => id !== pmidStr);
    showToast('ブックマークから削除しました');
  } else {
    bookmarks.push(pmidStr);
    showToast('❤️ ブックマークに保存しました');
  }
  localStorage.setItem('ep_paper_bookmarks', JSON.stringify(bookmarks));
  renderPapers();
  pushUserStateToCloud(getSyncCode());
};

window.openDetail = function(pmid) {
  const paper = allPapers.find(p => String(p.pmid) === String(pmid));
  if (!paper) return;
  currentDetailPaper = paper;

  // iOS Safari 対策: モーダル開閉時のフォントサイズクラス再確定
  loadFontSizePreference();

  const modalBody = document.getElementById('modalBody');
  const pmidStr = String(paper.pmid);
  const isRead = readPapers.includes(pmidStr);
  const isBookmarked = bookmarks.includes(pmidStr);

  // 論文のポイント (summaryJa) をパターンA（箇条書き3〜4点）へ整形
  let formattedPointsHtml = formatPaperPointsHtml(paper.summaryJa || '要約準備中', false);

  // 抄録全訳 (abstractJa) の見出しバッジ化＆無駄な空白行完全排除
  let formattedAbsJa = formatSectionText(paper.abstractJa || paper.abstract || '抄録の全訳がありません。');

  // 英語抄録 (abstractEn) の見出しバッジ化
  let formattedAbsEn = escapeHtml(paper.abstract || '');
  formattedAbsEn = formattedAbsEn
    .replace(/\b(BACKGROUND AND AIMS|BACKGROUND AND OBJECTIVES|BACKGROUND & AIMS|BACKGROUND|OBJECTIVES?|AIMS?|METHODS AND RESULTS|METHODS & RESULTS|METHODS|RESULTS|CONCLUSIONS?):\n?/gi, '<span class="abs-header-badge" style="text-transform:uppercase;">$1</span>');

  modalBody.innerHTML = `
    <div class="detail-title-ja">${escapeHtml(normalizeMedicalTerms(paper.titleJa || paper.title))}</div>
    <div class="detail-title-en">(${escapeHtml(paper.title)})</div>

    <div class="action-row" style="flex-wrap: wrap; gap: 8px;">
      <button class="action-btn ${isRead ? 'primary' : ''}" onclick="toggleRead('${paper.pmid}'); openDetail('${paper.pmid}');">
        ${isRead ? '☑ 既読マーク中 (タップで未読化)' : '☐ 既読マークを付ける'}
      </button>
      <button class="action-btn ${isBookmarked ? 'primary' : ''}" onclick="toggleBookmark('${paper.pmid}'); openDetail('${paper.pmid}');">
        ${isBookmarked ? '❤️ ブックマーク中' : '🤍 ブックマーク追加'}
      </button>
      <button class="action-btn" onclick="sharePaper('${paper.pmid}')">
        📤 論文を共有
      </button>
      <button class="action-btn" onclick="copyCitation('${paper.pmid}')">
        📋 出典(Vancouver)をコピー
      </button>
      <a class="action-btn" href="${paper.url}" target="_blank" rel="noopener">
        🔗 PubMed 原文ページ ↗
      </a>
    </div>

    <div class="detail-meta-list">
      <div class="meta-item"><span class="meta-label">掲載日</span><span class="meta-value">${paper.pubDate}</span></div>
      <div class="meta-item"><span class="meta-label">雑誌名・巻号</span><span class="meta-value">${escapeHtml(getJournalDisplayName(paper))} ${escapeHtml(paper.volumeIssuePage || '')}</span></div>
      <div class="meta-item"><span class="meta-label">研究デザイン</span><span class="meta-value">${paper.studyTypeLabel} (N = ${paper.sampleSize > 0 ? paper.sampleSize.toLocaleString() + '例' : '不明'})</span></div>
      <div class="meta-item"><span class="meta-label">著者</span><span class="meta-value">${escapeHtml(paper.authors)}</span></div>
      <div class="meta-item"><span class="meta-label">DOI</span><span class="meta-value">${paper.doi ? `<a href="https://doi.org/${paper.doi}" target="_blank">${paper.doi}</a>` : 'N/A'}</span></div>
      <div class="meta-item"><span class="meta-label">出典フォーマット</span><span class="meta-value">${escapeHtml(paper.citation)}</span></div>
    </div>

    <div class="section-block">
      <div class="section-title">💡 論文のポイント</div>
      <div class="section-content">${formattedPointsHtml}</div>
    </div>

    <div class="section-block">
      <div class="section-title">🇯🇵 抄録 (Abstract) 日本語全訳 (全文直訳)</div>
      <div class="section-content">${formattedAbsJa}</div>
    </div>

    <div class="section-block">
      <div class="section-title">🔤 抄録 (Abstract) 英語原文</div>
      <div class="section-content en">${formattedAbsEn}</div>
    </div>
  `;

  const suggestBar = document.getElementById('selectionSuggestBar');
  if (suggestBar) suggestBar.style.display = 'none';
  document.getElementById('detailModal').style.display = 'flex';
};

function closeModal() {
  const suggestBar = document.getElementById('selectionSuggestBar');
  if (suggestBar) suggestBar.style.display = 'none';
  document.getElementById('detailModal').style.display = 'none';
}

const REPORT_NTFY_TOPIC = 'ep_pfa_translation_reports_y3liigs4';

function openTranslationReportModal(prefillEn = '', paperCtx = null) {
  const modal = document.getElementById('translationReportModal');
  const enEl = document.getElementById('reportOriginalEn');
  const jaEl = document.getElementById('reportSuggestedJa');
  const noteEl = document.getElementById('reportNote');
  const ctxEl = document.getElementById('reportPaperContext');
  if (!modal || !enEl || !jaEl) return;

  enEl.value = prefillEn || '';
  jaEl.value = '';
  if (noteEl) noteEl.value = '';

  if (ctxEl && paperCtx) {
    ctxEl.textContent = `📄 対象論文: ${(paperCtx.titleJa || paperCtx.title || '').slice(0, 60)} (PMID: ${paperCtx.pmid})`;
    ctxEl.style.display = 'block';
    modal.dataset.pmid = String(paperCtx.pmid || '');
    modal.dataset.titleJa = String(paperCtx.titleJa || paperCtx.title || '');
  } else if (ctxEl) {
    ctxEl.style.display = 'none';
    modal.dataset.pmid = '';
    modal.dataset.titleJa = '';
  }

  modal.style.display = 'flex';
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;

  setTimeout(() => {
    try {
      if (prefillEn) jaEl.focus();
      else enEl.focus();
    } catch (_) {}
  }, 80);
}

function setupTranslationReportSystem() {
  const settingsBtn = document.getElementById('settingsReportTranslationBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      const sm = document.getElementById('settingsModal');
      if (sm) sm.style.display = 'none';
      openTranslationReportModal('', null);
    });
  }

  const reportModal = document.getElementById('translationReportModal');
  const closeReportBtn = document.getElementById('closeTranslationReportModal');
  if (closeReportBtn && reportModal) {
    closeReportBtn.addEventListener('click', () => {
      reportModal.style.display = 'none';
    });
  }
  if (reportModal) {
    reportModal.addEventListener('click', (e) => {
      if (e.target.id === 'translationReportModal') {
        reportModal.style.display = 'none';
      }
    });
  }

  // 英語原文のテキスト選択を検知して提案バーを表示
  const suggestBar = document.getElementById('selectionSuggestBar');
  const suggestBtn = document.getElementById('selectionSuggestBtn');
  const suggestPreview = document.getElementById('selectionSuggestPreview');
  let lastSelectedEnText = '';

  const checkEnglishSelection = () => {
    const detailModal = document.getElementById('detailModal');
    if (!suggestBar || !detailModal || detailModal.style.display !== 'flex') {
      if (suggestBar) suggestBar.style.display = 'none';
      return;
    }
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (!text || text.length > 300) {
      suggestBar.style.display = 'none';
      return;
    }
    const anchorEl = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    const focusEl = sel.focusNode && (sel.focusNode.nodeType === 1 ? sel.focusNode : sel.focusNode.parentElement);
    const inEnglishBox = (anchorEl && anchorEl.closest('.section-content.en')) || (focusEl && focusEl.closest('.section-content.en'));
    if (!inEnglishBox) {
      suggestBar.style.display = 'none';
      return;
    }
    lastSelectedEnText = text;
    if (suggestPreview) {
      suggestPreview.textContent = text.length > 26 ? `${text.slice(0, 26)}…` : text;
    }
    suggestBar.style.display = 'flex';
  };

  let selTimer = null;
  document.addEventListener('selectionchange', () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(checkEnglishSelection, 140);
  });

  if (suggestBtn) {
    suggestBtn.addEventListener('click', () => {
      if (!lastSelectedEnText) return;
      openTranslationReportModal(lastSelectedEnText, currentDetailPaper);
    });
  }

  const submitBtn = document.getElementById('submitTranslationReportBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const originalEn = (document.getElementById('reportOriginalEn')?.value || '').trim();
      const suggestedJa = (document.getElementById('reportSuggestedJa')?.value || '').trim();
      const note = (document.getElementById('reportNote')?.value || '').trim();

      if (!originalEn) {
        showToast('⚠️ もとの英単語・フレーズを入力してください');
        return;
      }
      if (!suggestedJa) {
        showToast('⚠️ 正しい日本語を入力してください');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '送信中...';

      const payload = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        originalEn,
        suggestedJa,
        note,
        pmid: reportModal?.dataset.pmid || '',
        titleJa: reportModal?.dataset.titleJa || '',
      };

      try {
        const res = await fetch(`https://ntfy.sh/${REPORT_NTFY_TOPIC}`, {
          method: 'POST',
          headers: {
            'Title': `Translation Report: ${originalEn.slice(0, 40)}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        try {
          const hist = JSON.parse(localStorage.getItem('ep_translation_reports_history') || '[]');
          hist.unshift(payload);
          localStorage.setItem('ep_translation_reports_history', JSON.stringify(hist.slice(0, 50)));
        } catch (_) {}

        if (reportModal) reportModal.style.display = 'none';
        showToast('✅ ご報告ありがとうございます！製作者へ送信しました');
      } catch (err) {
        console.error('Translation report send failed:', err);
        showToast('⚠️ 送信に失敗しました。通信環境をご確認ください');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '📤 製作者へ報告を送信する';
      }
    });
  }
}

window.sharePaper = async function(pmid) {
  const paper = allPapers.find(p => String(p.pmid) === String(pmid));
  if (!paper) return;

  const title = normalizeMedicalTerms(paper.titleJa || paper.title);
  const url = paper.url || `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`;
  const noteUrl = 'https://note.com/dreamy_weasel596/n/n862b06f366b9';
  const shareText = `【最新医学論文】${title} (${getJournalDisplayName(paper)})\n\n📱 EP & PFA Papers アプリ詳細\n${noteUrl}`;
  const shareData = {
    title: title,
    text: shareText,
    url: url
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Share failed:', e);
      }
    }
  }

  // フォールバック: クリップボードにURLコピー
  if (navigator.clipboard) {
    navigator.clipboard.writeText(`${shareText}\nPubMed: ${url}`).then(() => {
      showToast('🔗 論文リンクをクリップボードにコピーしました！');
    });
  }
};

window.copyCitation = function(pmid) {
  const paper = allPapers.find(p => String(p.pmid) === String(pmid));
  if (paper && paper.citation) {
    navigator.clipboard.writeText(paper.citation).then(() => {
      showToast('📋 出典フォーマットをコピーしました！');
    });
  }
};

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 2500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
