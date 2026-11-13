/**
 * ⚡ カテーテル / パルスフィールドアブレーション 最新論文ナビ
 * モバイル・スマホ最適化 Web アプリケーション フロントエンド Script
 */

import { SplashScreen } from '@capacitor/splash-screen';

let allPapers = [];
let bookmarks = JSON.parse(localStorage.getItem('ep_paper_bookmarks') || '[]');
let readPapers = JSON.parse(localStorage.getItem('ep_paper_read') || '[]');
let currentFilterTab = 'all';
let selectedJournals = null; // Set of selected journal keys. null = initial state (all selected)

let deferredPrompt;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
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

/**
 * 📲 下に引っ張って更新 (Pull to Refresh) 機能
 */
function initPullToRefresh() {
  const ptrEl = document.getElementById('pullToRefresh');
  const ptrIcon = document.getElementById('ptrIcon');
  const ptrText = document.getElementById('ptrText');
  if (!ptrEl || !ptrIcon || !ptrText) return;

  let startY = 0;
  let isTracking = false;
  let isRefreshing = false;
  const THRESHOLD = 65; // ピクセル

  window.addEventListener('touchstart', (e) => {
    if (isRefreshing) return;
    // 画面が最上部にあり、モーダルが開いていない場合のみ監視
    const isModalOpen = document.querySelector('.modal-overlay[style*="display: flex"]');
    if (window.scrollY <= 2 && !isModalOpen && e.touches.length === 1) {
      startY = e.touches[0].pageY;
      isTracking = true;
    } else {
      isTracking = false;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isTracking || isRefreshing) return;
    const currentY = e.touches[0].pageY;
    const diff = currentY - startY;

    if (diff > 0 && window.scrollY <= 0) {
      // 指の引きに抵抗感（ダンピング）を付加
      const pullDistance = Math.min(diff * 0.45, 80);
      ptrEl.style.transition = 'none';
      ptrEl.style.transform = `translate(-50%, ${pullDistance}px)`;
      ptrEl.style.opacity = String(Math.min(pullDistance / 35, 1));

      if (pullDistance >= THRESHOLD * 0.75) {
        ptrIcon.style.transform = 'rotate(180deg)';
        ptrText.textContent = '離して最新論文を更新';
        ptrEl.classList.add('ptr-ready');
      } else {
        ptrIcon.style.transform = 'rotate(0deg)';
        ptrText.textContent = '下に引っ張って更新';
        ptrEl.classList.remove('ptr-ready');
      }
    } else if (diff < 0) {
      // 上にスクロールした場合は追従解除
      isTracking = false;
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
      // 閾値未満で指を離した場合はスムーズに戻す
      ptrEl.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      ptrEl.style.transform = 'translate(-50%, -130%)';
      ptrEl.style.opacity = '0';
      setTimeout(() => {
        ptrEl.style.transition = '';
        ptrIcon.style.transform = 'rotate(0deg)';
      }, 250);
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
  
  // 1. まずローカルストレージの最新キャッシュをチェック（オフラインでも瞬時に起動）
  const cachedDataStr = localStorage.getItem('ep_papers_cache');
  if (cachedDataStr) {
    try {
      const cached = JSON.parse(cachedDataStr);
      if (cached && Array.isArray(cached.papers) && cached.papers.length > 0) {
        console.log('Loaded from local storage cache:', cached.papers.length, 'papers');
        applyPaperData(cached);
        return;
      }
    } catch (e) {
      console.warn('Failed to parse cached papers:', e);
    }
  }

  // 2. キャッシュがなければアプリバンドル内のローカル papers.json を読み込む
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
    localStorage.setItem('ep_papers_cache', JSON.stringify(data));
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

/**
 * 取得したデータをUIへ反映
 */
function applyPaperData(data) {
  allPapers = data.papers || [];
  updateJournalOptions();

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
    applyPaperData(latestData);
    localStorage.setItem('ep_papers_cache', JSON.stringify(latestData));

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
    key: 'heart_rhythm',
    label: 'Heart Rhythm（Heart Rhythm）',
    match: (t, a) => (t.includes('heart rhythm') || a.includes('heart rhythm')) && !t.includes('case') && !a.includes('case')
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

  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilterTab = e.target.dataset.filter;
      renderPapers();
    });
  });

  // 期間選択
  const periodSelect = document.getElementById('periodSelect');
  if (periodSelect) {
    const savedPeriod = localStorage.getItem('ep_period');
    if (savedPeriod && ['3m', '6m', '1y'].includes(savedPeriod)) {
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
    sortSelect.addEventListener('change', renderPapers);
  }

  const fontSelect = document.getElementById('fontSizeSelect');
  if (fontSelect) {
    fontSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      applyFontSize(selected);
      localStorage.setItem('ep_font_size', selected);
    });
  }

  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') closeModal();
  });

  const infoBtn = document.getElementById('infoBtn');
  if (infoBtn) {
    infoBtn.addEventListener('click', () => {
      document.getElementById('disclaimerModal').style.display = 'flex';
    });
  }

  const closeDisclaimerModal = document.getElementById('closeDisclaimerModal');
  if (closeDisclaimerModal) {
    closeDisclaimerModal.addEventListener('click', () => {
      document.getElementById('disclaimerModal').style.display = 'none';
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

  const syncBtn = document.getElementById('syncOnlineBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      syncWithCloud(true);
      pullUserStateFromCloud(getSyncCode(), false, false);
    });
  }

  // 🔗 端末間データ同期モーダル制御
  const openSyncModal = () => {
    initDeviceSyncCode();
    document.getElementById('deviceSyncModal').style.display = 'flex';
  };
  const deviceSyncBtn = document.getElementById('deviceSyncBtn');
  if (deviceSyncBtn) deviceSyncBtn.addEventListener('click', openSyncModal);
  const metaDeviceSyncBtn = document.getElementById('metaDeviceSyncBtn');
  if (metaDeviceSyncBtn) metaDeviceSyncBtn.addEventListener('click', openSyncModal);

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

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  const icon = document.querySelector('.theme-icon');
  icon.textContent = isLight ? '☀️' : '🌙';
  localStorage.setItem('ep_theme', isLight ? 'light' : 'dark');
}

function loadThemePreference() {
  const pref = localStorage.getItem('ep_theme');
  if (pref === 'light') {
    document.body.classList.add('light-theme');
    document.querySelector('.theme-icon').textContent = '☀️';
  }
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

  // 1. 崩れた「〜しる」「ありる」の徹底修復
  s = s.replace(/可能性がありる/g, '可能性がある');
  s = s.replace(/([でとも])ありる/g, '$1ある');
  s = s.replace(/ありる(?=[。、\n\r\t 　\)]|$)/g, 'ある');
  s = s.replace(/ありる/g, 'ある');
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

  // 2. 進行・完了の丁寧語（〜ています、〜ていました 等）
  s = s.replace(/([てで])います/g, '$1いる');
  s = s.replace(/([てで])いました/g, '$1いた');
  s = s.replace(/([てで])おります/g, '$1いる');
  s = s.replace(/([てで])おりました/g, '$1いた');

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

  s = s.replace(/([一-龠]{2,})しました/g, '$1した');
  s = s.replace(/([ァ-ヴー]+)しました/g, '$1した');
  s = s.replace(/([一-龠ぁ-んァ-ヴー]+)としました/g, '$1とした');
  s = s.replace(/([一-龠ぁ-んァ-ヴー]+)ですが/g, '$1であるが');
  s = s.replace(/([一-龠ぁ-んァ-ヴー]+)でしたが/g, '$1であったが');

  s = s.replace(/満たしました/g, '満たした');
  s = s.replace(/示しました/g, '示した');
  s = s.replace(/見出しました/g, '見出した');
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

  // 5. 判断・指定・否定（〜です、〜でした、〜ません 等）
  s = s.replace(/でした/g, 'であった');
  s = s.replace(/ではありません/g, 'ではない');
  s = s.replace(/ではありませんでした/g, 'ではなかった');
  s = s.replace(/ません/g, 'ない');
  s = s.replace(/です(?=[。、\n\r\t 　\)]|$)/g, 'である');
  s = s.replace(/ます(?=[。、\n\r\t 　\)]|$)/g, 'る');

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

// 抄録・臨床要約の共通見出し正規化＆バッジ化ヘルパー
function formatSectionText(text) {
  if (!text) return '';
  let str = normalizeJotaiStyle(String(text));

  // 1. Background and aims / 背景と目的 の完全統一
  str = str.replace(/(?:Background and aims|Background and objectives|Background & aims|BACKGROUND AND AIMS|BACKGROUND AND OBJECTIVES|背景と目的|背景および目的|背景・目的|背景\/目的|【概要】および目的|【背景】および目的|【背景】そして目的|背景と\s*目的)[:：]?/gi, '【背景と目的】');
  str = str.replace(/背景と\s*【目的】/g, '【背景と目的】');
  str = str.replace(/【背景と目的】\s*そして目的[:：]?/g, '【背景と目的】');

  // 2. Methods and results / 方法と結論 の完全統一
  str = str.replace(/(?:Methods and results|Methods & results|METHODS AND RESULTS|METHODS & RESULTS|方法と結果|方法および結果|方法と結論|方法・結果)[:：]?/gi, '【方法と結論】');
  str = str.replace(/【方法】\s*そして\s*\n*【結果】/g, '【方法と結論】');
  str = str.replace(/【方法】\s*そして/g, '【方法と結論】');

  // 3. Backgraand / Background / 概要 を 【背景】 に統一
  str = str.replace(/(?:Backgraand|Background|BACKGROUND|【概要】)[:：]?/gi, '【背景】');
  str = str.replace(/【概要】/g, '【背景】');

  // 4. 単独見出しの統一（コロンの有無を問わず見出しとして置換）
  str = str.replace(/(?<!【背景と)(?:Aims|Aim|Objectives|Objective|AIMS|OBJECTIVES)[:：]/gi, '【目的】');
  str = str.replace(/(?<!【)(?:Methods|Method|METHODS|対象・方法|対象と方法)[:：]/gi, '【方法】');
  str = str.replace(/(?<!【)(?:Results|Result|RESULTS|成績)[:：]/gi, '【結果】');
  str = str.replace(/(?<!【)(?:Conclusions|Conclusion|CONCLUSIONS|考察)[:：]/gi, '【結論】');

  // 二重括弧の解消
  str = str.replace(/【+([^】]+)】+/g, '【$1】');

  // 連続改行の圧縮
  str = str.replace(/\n{2,}/g, '\n').trim();

  // HTMLエスケープ後に見出しバッジ化
  let escaped = escapeHtml(str);
  escaped = escaped.replace(/\n*【(背景と目的|背景・目的|背景|目的|方法と結論|方法|結果|結論)】\n*/g, '<span class="abs-header-badge">【$1】</span>');

  return escaped;
}

function renderPapers() {
  const paperListEl = document.getElementById('paperList');
  const searchText = document.getElementById('searchInput').value.toLowerCase().trim();
  const sortVal = document.getElementById('sortSelect')?.value || 'priority';
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

    // 期間フィルター（過去3ヶ月・過去6ヶ月・過去1年間）
    if (periodVal !== '1y') {
      const pDate = parsePubDateToDate(paper.pubDate);
      if (pDate) {
        const daysLimit = periodVal === '3m' ? 92 : 185;
        const cutoffTime = Date.now() - (daysLimit * 24 * 60 * 60 * 1000);
        if (pDate.getTime() < cutoffTime) {
          return false;
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

    return `
      <div class="paper-card ${paper.isNew ? 'is-new' : ''} ${isRead ? 'is-read' : ''}" onclick="openDetail('${paper.pmid}')">
        <div class="paper-card-header">
          <div class="card-badges">
            ${paper.isNew ? '<span class="new-badge">✨ NEW 新着</span>' : ''}
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
        <div class="card-title-ja">${escapeHtml(paper.titleJa || paper.title)}</div>
        <div class="card-title-en">(${escapeHtml(paper.title)})</div>
        <div class="card-summary-box">${formatSectionText(paper.summaryJa || '要約準備中')}</div>
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

  // iOS Safari 対策: モーダル開閉時のフォントサイズクラス再確定
  loadFontSizePreference();

  const modalBody = document.getElementById('modalBody');
  const pmidStr = String(paper.pmid);
  const isRead = readPapers.includes(pmidStr);
  const isBookmarked = bookmarks.includes(pmidStr);

  // 臨床要約 (summaryJa) の見出しバッジ化（【背景】【背景と目的】【方法と結論】等に対応）
  let formattedSummaryJa = formatSectionText(paper.summaryJa || '要約準備中');

  // 抄録全訳 (abstractJa) の見出しバッジ化＆無駄な空白行完全排除
  let formattedAbsJa = formatSectionText(paper.abstractJa || paper.abstract || '抄録の全訳がありません。');

  // 英語抄録 (abstractEn) の見出しバッジ化
  let formattedAbsEn = escapeHtml(paper.abstract || '');
  formattedAbsEn = formattedAbsEn
    .replace(/\b(BACKGROUND AND AIMS|BACKGROUND AND OBJECTIVES|BACKGROUND & AIMS|BACKGROUND|OBJECTIVES?|AIMS?|METHODS AND RESULTS|METHODS & RESULTS|METHODS|RESULTS|CONCLUSIONS?):\n?/gi, '<span class="abs-header-badge" style="text-transform:uppercase;">$1</span>');

  modalBody.innerHTML = `
    <div class="detail-title-ja">${escapeHtml(paper.titleJa || paper.title)}</div>
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
      <div class="section-title">💡 臨床要約 (4項目ポイント)</div>
      <div class="section-content">${formattedSummaryJa}</div>
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

  document.getElementById('detailModal').style.display = 'flex';
};

function closeModal() {
  document.getElementById('detailModal').style.display = 'none';
}

window.sharePaper = async function(pmid) {
  const paper = allPapers.find(p => String(p.pmid) === String(pmid));
  if (!paper) return;

  const title = paper.titleJa || paper.title;
  const url = paper.url || `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`;
  const shareData = {
    title: title,
    text: `【最新医学論文】${title} (${getJournalDisplayName(paper)})`,
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
    navigator.clipboard.writeText(`${title}\n${url}`).then(() => {
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
