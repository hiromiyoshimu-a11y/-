/**
 * ⚡ カテーテル / パルスフィールドアブレーション 最新論文ナビ
 * モバイル・スマホ最適化 Web アプリケーション フロントエンド Script
 */

let allPapers = [];
let bookmarks = JSON.parse(localStorage.getItem('ep_paper_bookmarks') || '[]');
let currentFilterTab = 'all';

let deferredPrompt;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  setupEventListeners();
  loadThemePreference();
  loadFontSizePreference();
  registerServiceWorker();
  setupPwaInstaller();
  await loadPaperData();
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
        .then(reg => console.log('ServiceWorker registered:', reg.scope))
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

/**
 * 論文データの読み込み (public/papers.json または outputs/papers.json)
 */
async function loadPaperData() {
  const paperListEl = document.getElementById('paperList');
  
  // 現在のページのアドレスから絶対URLを組み立てる (末尾スラッシュ補正)
  let currentPath = window.location.pathname;
  if (!currentPath.endsWith('/') && !currentPath.includes('.html')) {
    currentPath += '/';
  }
  
  const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);

  const candidateUrls = [
    `${window.location.origin}${basePath}papers.json`,
    './papers.json',
    'papers.json',
    '/papers.json',
    `${window.location.origin}/papers.json`,
    './outputs/papers.json'
  ];

  let data = null;
  let lastError = null;

  for (const url of candidateUrls) {
    try {
      const cacheBustUrl = url.includes('?') ? `${url}&_=${Date.now()}` : `${url}?_=${Date.now()}`;
      console.log('Trying to fetch paper data from:', cacheBustUrl);
      const res = await fetch(cacheBustUrl);
      if (res.ok) {
        data = await res.json();
        console.log('Successfully loaded paper data from:', url);
        break;
      }
    } catch (e) {
      lastError = e;
    }
  }

  if (!data || !data.papers) {
    console.error('All fetch attempts failed:', lastError);
    paperListEl.innerHTML = `
      <div class="loading-state" style="text-align: center; padding: 28px 16px;">
        <p style="color: #EF4444; font-weight: 700; font-size: 16px;">⚠️ 論文データを読み込めませんでした</p>
        <p style="font-size: 12px; margin-top: 8px; color: var(--text-secondary);">
          ブラウザのキャッシュが残っている可能性があります。下のボタンを押して再読み込みをお試しください。
        </p>
        <button onclick="location.reload(true)" style="margin-top: 16px; padding: 10px 24px; background: var(--accent-blue); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
          🔄 ページを強制作再読み込み
        </button>
      </div>
    `;
    return;
  }

  allPapers = data.papers || [];

  // 新着数およびメタ情報更新
  const newCount = data.newCount || allPapers.filter(p => p.isNew).length;
  document.getElementById('updatedDateBadge').textContent = `📅 最終更新: ${data.updatedAt || '2026-09-29'}`;
  document.getElementById('paperCountBadge').textContent = `📄 ${allPapers.length}件の最新論文`;

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

  document.getElementById('journalSelect').addEventListener('change', renderPapers);
  document.getElementById('sortSelect').addEventListener('change', renderPapers);

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

/**
 * 論文リストのフィルタリング・ソート＆描画
 */
function renderPapers() {
  const paperListEl = document.getElementById('paperList');
  const searchText = document.getElementById('searchInput').value.toLowerCase().trim();
  const journalVal = document.getElementById('journalSelect').value;
  const sortVal = document.getElementById('sortSelect').value;

  let filtered = allPapers.filter(paper => {
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
    if (currentFilterTab === 'bookmarks' && !bookmarks.includes(paper.pmid)) return false;

    if (journalVal !== 'all') {
      const jTitle = (paper.journal || '').toLowerCase();
      const jAbbr = (paper.journalAbbr || '').toLowerCase();
      if (!jTitle.includes(journalVal) && !jAbbr.includes(journalVal)) {
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
    if (sortVal === 'date') {
      return (b.pubDate || '').localeCompare(a.pubDate || '');
    }
    if (sortVal === 'sampleSize') {
      return (b.sampleSize || 0) - (a.sampleSize || 0);
    }
    return 0;
  });

  if (filtered.length === 0) {
    paperListEl.innerHTML = `
      <div class="loading-state">
        <p>🔍 該当する論文は見つかりませんでした。</p>
      </div>
    `;
    return;
  }

  paperListEl.innerHTML = filtered.map((paper) => {
    const isBookmarked = bookmarks.includes(paper.pmid);
    let designBadgeClass = 'other';
    if (paper.designRank === 1) designBadgeClass = 'rct';
    else if (paper.designRank === 2) designBadgeClass = 'prospective';
    else if (paper.designRank === 99) designBadgeClass = 'case';

    const sampleStr = paper.sampleSize > 0 ? `N=${paper.sampleSize.toLocaleString()}例` : 'N不明';

    return `
      <div class="paper-card ${paper.isNew ? 'is-new' : ''}" onclick="openDetail('${paper.pmid}')">
        <div class="paper-card-header">
          <div class="card-badges">
            ${paper.isNew ? '<span class="new-badge">✨ NEW 新着</span>' : ''}
            <span class="design-badge ${designBadgeClass}">${paper.studyTypeLabel}</span>
            <span class="sample-badge">👥 ${sampleStr}</span>
          </div>
          <button class="bookmark-btn ${isBookmarked ? 'active' : ''}" onclick="event.stopPropagation(); toggleBookmark('${paper.pmid}')">
            ${isBookmarked ? '❤️' : '🤍'}
          </button>
        </div>
        <div class="card-date-journal">
          📅 ${paper.pubDate} | 📖 ${paper.journalAbbr || paper.journal}
        </div>
        <div class="card-title-ja">${escapeHtml(paper.titleJa || paper.title)}</div>
        <div class="card-title-en">(${escapeHtml(paper.title)})</div>
        <div class="card-summary-box">${escapeHtml(paper.summaryJa || '要約準備中')}</div>
        <div class="card-footer">
          <span>抄録全訳・原文を見る</span>
          <span>➔</span>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleBookmark = function(pmid) {
  if (bookmarks.includes(pmid)) {
    bookmarks = bookmarks.filter(id => id !== pmid);
    showToast('ブックマークから削除しました');
  } else {
    bookmarks.push(pmid);
    showToast('❤️ ブックマークに保存しました');
  }
  localStorage.setItem('ep_paper_bookmarks', JSON.stringify(bookmarks));
  renderPapers();
};

window.openDetail = function(pmid) {
  const paper = allPapers.find(p => String(p.pmid) === String(pmid));
  if (!paper) return;

  // iOS Safari 対策: モーダル開閉時のフォントサイズクラス再確定
  loadFontSizePreference();

  const modalBody = document.getElementById('modalBody');

  // 臨床要約 (summaryJa) の【概要】【方法】【結果】【結論】バッジ化
  let formattedSummaryJa = escapeHtml(paper.summaryJa || '要約準備中');
  formattedSummaryJa = formattedSummaryJa
    .replace(/【(概要|方法|結果|結論)】/g, '<span class="abs-header-badge">【$1】</span>');

  // 抄録全訳 (abstractJa) の【背景】【目的】【方法】【結果】【結論】バッジ化＆無駄な空白行完全排除
  let rawAbsJa = paper.abstractJa || paper.abstract || '抄録の全訳がありません。';
  rawAbsJa = rawAbsJa
    .replace(/(?:背景・目的|背景\/目的)[:：]/g, '【背景・目的】')
    .replace(/(?:背景)[:：]/g, '【背景】')
    .replace(/(?:目的)[:：]/g, '【目的】')
    .replace(/(?:方法|対象・方法|対象と方法)[:：]/g, '【方法】')
    .replace(/(?:結果|成績)[:：]/g, '【結果】')
    .replace(/(?:結論|考察)[:：]/g, '【結論】')
    .replace(/\n{2,}/g, '\n') // 連続する改行を単一改行へ圧縮
    .trim();

  let formattedAbsJa = escapeHtml(rawAbsJa);
  // 見出しバッジ前後の余分な改行を消去し、CSSのmarginのみでコンパクトにレイアウト
  formattedAbsJa = formattedAbsJa
    .replace(/\n*【(背景|目的|方法|結果|結論|背景・目的)】\n*/g, '<span class="abs-header-badge">【$1】</span>');

  // 英語抄録 (abstractEn) の見出しバッジ化
  let formattedAbsEn = escapeHtml(paper.abstract || '');
  formattedAbsEn = formattedAbsEn
    .replace(/\b(BACKGROUND|OBJECTIVE|METHODS|RESULTS|CONCLUSIONS):\n?/gi, '<span class="abs-header-badge" style="text-transform:uppercase;">$1</span>');

  modalBody.innerHTML = `
    <div class="detail-title-ja">${escapeHtml(paper.titleJa || paper.title)}</div>
    <div class="detail-title-en">(${escapeHtml(paper.title)})</div>

    <div class="action-row">
      <button class="action-btn primary" onclick="copyCitation('${paper.pmid}')">
        📋 出典(Vancouver)をコピー
      </button>
      <a class="action-btn" href="${paper.url}" target="_blank" rel="noopener">
        🔗 PubMed 原文ページ ↗
      </a>
    </div>

    <div class="detail-meta-list">
      <div class="meta-item"><span class="meta-label">掲載日</span><span class="meta-value">${paper.pubDate}</span></div>
      <div class="meta-item"><span class="meta-label">雑誌名・巻号</span><span class="meta-value">${paper.journal} ${paper.volumeIssuePage}</span></div>
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
