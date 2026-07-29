
function localStockSearch(q) {
  if (!q || !leaderboardData || !leaderboardData.stocks) return {results:[]};
  const ql = q.toLowerCase();
  const out = leaderboardData.stocks.filter(s =>
    (s.name||'').toLowerCase().includes(ql) ||
    (s.ts_code||'').toLowerCase().includes(ql)
  ).slice(0, 20);
  return {results: out.map(s => ({ts_code: s.ts_code, name: s.name}))};
}

let stocksData = null;
async function ensureStocksLoaded() {
  if (stocksData) return stocksData;
  const ts = Date.now();
  const resp = await fetch(`./data/stocks.json?v=${ts}`);
  if (!resp.ok) throw new Error(`stocks.json HTTP ${resp.status}`);
  const j = await resp.json();
  stocksData = j.stocks || {};
  return stocksData;
}
function goStock(tsCode) {
  location.hash = '#stock/' + encodeURIComponent(tsCode);
}
function gradeClass(g) {
  if (!g) return '';
  if (g.includes('强势买入')) return 'grade-1';
  if (g.includes('积极关注')) return 'grade-2';
  if (g.includes('谨慎观望')) return 'grade-3';
  if (g.includes('中性偏弱')) return 'grade-4';
  if (g.includes('弱势回避')) return 'grade-5';
  return '';
}
function buildPriceChart(history) {
  if (!history || history.length < 2) return '<div class="chart-empty">数据不足</div>';
  const W = 600, H = 120, P = 10;
  const closes = history.map(h => h.c).filter(v => v != null);
  const min = Math.min(...closes), max = Math.max(...closes);
  const range = max - min || 1;
  const points = history.map((h, i) => {
    const x = P + (W - 2*P) * i / (history.length - 1);
    const y = P + (H - 2*P) * (1 - (h.c - min) / range);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="mini-chart" viewBox="0 0 ${W} ${H}"><polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="1.5"/></svg>`;
}
function buildScoreChart(history) {
  if (!history || history.length < 2) return '<div class="chart-empty">数据不足</div>';
  const h = [...history].reverse();
  const W = 600, H = 120, P = 10;
  const min = 0, max = 100;
  const points = h.map((x, i) => {
    const xv = P + (W - 2*P) * i / (h.length - 1);
    const yv = P + (H - 2*P) * (1 - (x.t - min) / (max - min));
    return `${xv.toFixed(1)},${yv.toFixed(1)}`;
  }).join(' ');
  return `<svg class="mini-chart" viewBox="0 0 ${W} ${H}"><polyline points="${points}" fill="none" stroke="var(--green)" stroke-width="1.5"/></svg>`;
}
async function renderStockDetail(tsCode) {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div>加载中...</div></div>';
  try {
    const stocks = await ensureStocksLoaded();
    const s = stocks[tsCode];
    if (!s) {
      main.innerHTML = `<div class="empty">未找到股票 ${tsCode}</div>`;
      return;
    }
    const gc = gradeClass(s.grade);
    const pct = s.pct_change || 0;
    const pctClass = pct > 0 ? 'pct-up' : pct < 0 ? 'pct-down' : 'pct-flat';
    const fmtPct = `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
    const last = s.price_history && s.price_history.length ? s.price_history[s.price_history.length - 1] : {};
    const lastPrice = last.c != null ? last.c.toFixed(2) : '--';
    const lastScore = s.score_history && s.score_history[0];
    const historyTags = [];
    if (s.ai_layer) historyTags.push(s.ai_layer);
    if (s.ai_chokepoint) historyTags.push(s.ai_chokepoint);
    if (s.serenity != null) historyTags.push(`Serenity ${Number(s.serenity).toFixed(1)}`);
    if (s.industry) historyTags.push(s.industry);
    const conceptHtml = (s.concept_tags || []).slice(0, 8).map(t => `<span class="tag">${t}</span>`).join('');
    const indexHtml = (s.index_tags || []).slice(0, 6).map(t => `<span class="tag">${t}</span>`).join('');
    main.innerHTML = `
      <div class="detail-card">
        <div class="detail-head">
          <button class="btn btn-ghost" onclick="location.hash=''">← 返回榜单</button>
          <h2 class="detail-name">${s.name} <span class="ts-code">${s.ts_code}</span></h2>
          <span class="grade ${gc}">${s.grade || '--'}</span>
        </div>
        <div class="detail-grid">
          <div class="detail-stat"><div class="lbl">总分</div><div class="val">${(s.total_score || 0).toFixed(1)}</div><div class="note">排名 #${s.rank || '--'}</div></div>
          <div class="detail-stat"><div class="lbl">涨跌幅</div><div class="val ${pctClass}">${fmtPct}</div><div class="note">${s.trade_date || '--'}</div></div>
          <div class="detail-stat"><div class="lbl">最新收盘</div><div class="val">${lastPrice}</div><div class="note">${last.d || '--'}</div></div>
        </div>
        <div class="detail-section">
          <h3>评分构成 (A/B/C/D)</h3>
          <div class="abc-bar">
            ${['a','b','c','d2'].map(k => {
              const v = lastScore ? lastScore[k] : 0;
              return `<div class="abc-cell"><div class="abc-num">${(v || 0).toFixed(1)}</div><div class="abc-lbl">${k === 'd2' ? 'D' : k.toUpperCase()}</div></div>`;
            }).join('')}
          </div>
        </div>
        <div class="detail-section">
          <h3>近30天评分走势</h3>
          ${buildScoreChart(s.score_history)}
        </div>
        <div class="detail-section">
          <h3>近30天收盘价</h3>
          ${buildPriceChart(s.price_history)}
        </div>
        <div class="detail-section">
          <h3>标签</h3>
          <div class="tag-list">${conceptHtml}${indexHtml}${historyTags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
        </div>
      </div>
    `;
  } catch (e) {
    main.innerHTML = `<div class="empty">加载失败: ${e.message}</div>`;
  }
}
function route() {
  const hash = location.hash;
  if (hash.startsWith('#stock/')) {
    const code = decodeURIComponent(hash.slice(7));
    renderStockDetail(code);
  } else {
    if (typeof loadLeaderboard === 'function') loadLeaderboard(currentPool);
  }
}
window.addEventListener('hashchange', route);


// This page depends on Flask APIs and cannot run correctly from a file:// URL.
// Redirect accidental direct opens to the local application automatically.
if (window.location.protocol === 'file:') {
  window.location.replace('http://127.0.0.1:18800/');
}

// State
let currentPool = '股票池';
let currentFilterCat = 'market';
let currentFilters = []; // active filter labels
let leaderboardData = null;
let refreshing = false;
let filterOptions = {}; // loaded filter metadata
const SCREENER_FIELDS = [
  ['score', 'total_score'],
  ['pct', 'pct_change'],
  ['mv', 'mv_total_yi'],
  ['float', 'mv_float_yi'],
  ['pe', 'pe'],
  ['pb', 'pb'],
  ['roe', 'roe'],
  ['turnover', 'turnover_rate'],
];
const screenerState = {};
const SCREENER_CONFIG = {
  score: {
    label: '总分', unit: '',
    options: [
      ['80+', '强势进入', 80, null],
      ['70-80', '积极关注', 70, 80],
      ['60-70', '谨慎观察', 60, 70],
      ['50-60', '中性区间', 50, 60],
      ['<50', '偏弱', null, 50],
    ]
  },
  pct: {
    label: '涨跌幅', unit: '%',
    options: [
      ['>10%', '强势上涨', 10, null],
      ['5% 到 10%', '明显上涨', 5, 10],
      ['0% 到 5%', '上涨', 0, 5],
      ['-5% 到 0%', '回调', -5, 0],
      ['<-5%', '明显下跌', null, -5],
    ]
  },
  mv: {
    label: '总市值', unit: '亿',
    options: [
      ['>1000亿', '超大市值', 1000, null],
      ['300-1000亿', '大市值', 300, 1000],
      ['100-300亿', '中盘', 100, 300],
      ['30-100亿', '小盘', 30, 100],
      ['<30亿', '微盘', null, 30],
    ]
  },
  float: {
    label: '流通市值', unit: '亿',
    options: [
      ['>500亿', '大流通盘', 500, null],
      ['100-500亿', '中等流通盘', 100, 500],
      ['30-100亿', '小流通盘', 30, 100],
      ['<30亿', '低流通盘', null, 30],
    ]
  },
  pe: {
    label: 'PE', unit: '',
    options: [
      ['0-15', '低估值', 0, 15],
      ['15-30', '合理区间', 15, 30],
      ['30-60', '成长溢价', 30, 60],
      ['>60', '高估值', 60, null],
      ['<0', '亏损/异常', null, 0],
    ]
  },
  pb: {
    label: 'PB', unit: '',
    options: [
      ['<1', '破净', null, 1],
      ['1-2', '低 PB', 1, 2],
      ['2-5', '中等 PB', 2, 5],
      ['>5', '高 PB', 5, null],
    ]
  },
  roe: {
    label: 'ROE', unit: '%',
    options: [
      ['>20%', '高净资产收益', 20, null],
      ['15% 到 20%', '优秀', 15, 20],
      ['10% 到 15%', '良好', 10, 15],
      ['5% 到 10%', '一般', 5, 10],
      ['0% 到 5%', '偏低', 0, 5],
      ['<0%', '亏损/负 ROE', null, 0],
    ]
  },
  turnover: {
    label: '换手率', unit: '%',
    options: [
      ['>10%', '高度活跃', 10, null],
      ['5% 到 10%', '活跃', 5, 10],
      ['2% 到 5%', '正常偏活跃', 2, 5],
      ['0.5% 到 2%', '温和', 0.5, 2],
      ['<0.5%', '低活跃', null, 0.5],
    ]
  },
};

// Filter metadata (hardcoded for performance)
const FILTER_DEFS = {
  market: {
    label: '交易所',
    options: [
      { v: '主板', label: '主板', suffix: '0,1,2,3,6', count: null },
      { v: '科创板', label: '科创板', suffix: '688', count: null },
      { v: '创业板', label: '创业板', suffix: '3', count: null },
      { v: '北交所', label: '北交所', suffix: '4,8', count: null },
    ]
  },
  index: {
    label: '指数板块',
    options: [
      { v: 'hs300', label: '沪深300', tags: ['沪深300'], count: 300 },
      { v: 'csi500', label: '中证500', tags: ['中证500'], count: 500 },
      { v: 'csi1000', label: '中证1000', tags: ['中证1000'], count: 1000 },
      { v: 'csi2000', label: '中证2000', tags: ['中证2000'], count: 1425 },
      { v: 'cyb50', label: '创业板50', tags: ['创业板指'], count: 100 },
      { v: 'kc50', label: '科创50', tags: ['科创50'], count: 50 },
    ]
  },
  industry: {
    label: '行业',
    options: []
  },
  concept: {
    label: '概念/赛道',
    options: []
  },
  ai_chain: {
    label: 'AI全链路',
    options: []
  },
  serenity: {
    label: 'Serenity数据库',
    options: []
  },
  score_trend: {
    label: '评分趋势',
    options: [
      { v: 'score_slope_surge', label: '评分斜率突然上升', count: null }
    ]
  }
};

// Init
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('filterSection').style.display = 'flex';
  document.getElementById('filterSection').style.flexDirection = 'column';
  await loadFilterOptions();
  showFilterChips(currentFilterCat);
  loadLeaderboard(currentPool);

  // 股票搜索: Enter 跳转, input 防抖实时下拉, Esc/外部点击关闭
  const searchInput = document.getElementById('stockSearch');
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); searchStock(); }
    if (e.key === 'Escape') { hideSearchResults(); }
  });
  searchInput.addEventListener('input', debounce(liveSearch, 250));
  renderScreenerFilters();
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) hideSearchResults();
    if (!e.target.closest('.screener-filter')) closeScreenerMenus();
  });
});

function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

let _searchSeq = 0;
async function liveSearch() {
  const q = document.getElementById('stockSearch').value.trim();
  if (!q) { hideSearchResults(); return; }
  const seq = ++_searchSeq;
  try {
    const r = await /* local search */ Promise.resolve({json: () => localStockSearch(q)});
    const d = await r.json();
    if (seq !== _searchSeq) return;  // 忽略过期响应
    renderSearchResults(d, q);
  } catch(e) { /* 网络错不扰民 */ }
}

async function searchStock() {
  const q = document.getElementById('stockSearch').value.trim();
  if (!q) return;
  try {
    const r = await /* local search */ Promise.resolve({json: () => localStockSearch(q)});
    const d = await r.json();
    if (d.code !== 0 || d.count === 0) { showSearchEmpty(q); return; }
    if (d.count === 1) {
      void 0;
    } else {
      renderSearchResults(d, q);
    }
  } catch(e) {
    alert('搜索失败: ' + e.message);
  }
}

function renderSearchResults(d, q) {
  const box = document.getElementById('searchResults');
  if (d.count === 0) { showSearchEmpty(q); return; }
  box.innerHTML = d.results.map(r => `
    <div class="search-result-item" onclick="window.void 0">
      <div>
        <span class="search-result-name">${r.name}</span>
        <span class="search-result-meta">${r.industry || ''} · ${r.market || ''}</span>
      </div>
      <span class="search-result-code">${r.ts_code}</span>
    </div>
  `).join('');
  box.style.display = 'block';
}

function showSearchEmpty(q) {
  const box = document.getElementById('searchResults');
  box.innerHTML = `<div class="search-empty">未找到 "${q}"<br/><span style="font-size:11px">试试 6 位代码或股票名称关键词</span></div>`;
  box.style.display = 'block';
}

function hideSearchResults() {
  document.getElementById('searchResults').style.display = 'none';
}

// 2026-06-07: 单股详情 Modal 卡片 (后端 API 已存在 /api/stock/<ts_code>)
async function openStockCard(ts_code) {
  hideSearchResults();
  const mask = document.getElementById('stockCardModal');
  const body = document.getElementById('stockCardBody');
  mask.classList.add('active');
  body.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div>加载中...</div></div>';
  try {
    const r = await fetch(`./data/leaderboard.json`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    if (json.code !== 0) throw new Error(json.msg);
    body.innerHTML = renderStockCard(json.data);
  } catch(e) {
    body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--red)">加载失败: ${e.message}</div>`;
  }
}

function closeStockCard() {
  document.getElementById('stockCardModal').classList.remove('active');
}

// ESC 关闭 modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('stockCardModal').classList.contains('active')) {
    closeStockCard();
  }
});

function renderStockCard(d) {
  const c = d.components;
  const A = c.A, B = c.B, C = c.C, D = c.D;
  const pct = d.pct_change || 0;
  const pctClass = pct > 0 ? 'price-up' : pct < 0 ? 'price-down' : '';
  const warningsHtml = (d.warnings && d.warnings.length)
    ? `<div class="warnings" style="background:rgba(210,153,34,0.1);border:1px solid rgba(210,153,34,0.3);border-radius:6px;padding:10px 14px;margin-top:12px">${d.warnings.map(w => `<div style="font-size:12px;color:var(--yellow);padding:3px 0">${w}</div>`).join('')}</div>`
    : '';
  return `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:18px;margin-bottom:14px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:12px">
        <div>
          <div style="font-size:20px;font-weight:700">${d.name}</div>
          <div style="font-size:12px;color:var(--dim);font-family:monospace;margin-top:2px">${d.ts_code}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
          <div style="font-size:32px;font-weight:800;color:var(--accent);line-height:1">${Math.round(d.total_score)}</div>
          <div style="font-size:13px;font-weight:600;color:var(--text)">${d.grade || ''}</div>
        </div>
      </div>
      <div style="display:flex;gap:16px;font-size:13px;color:var(--dim)">
        <span>现价：${d.close}元</span>
        <span class="${pctClass}">今日：${pct > 0 ? '+' : ''}${pct.toFixed(2)}%</span>
      </div>
      ${warningsHtml}
    </div>
    ${renderCardSection('A', '资金流向', A, 'score-a', 'a', [
      {key:'A1', label:'60日主力净流入率', max:17},
      {key:'A2', label:'残差资金流溢价', max:8},
      {key:'A3', label:'融资情绪代理', max:7},
      {key:'A4', label:'北向观察（降级）', max:2},
      {key:'A5a', label:'流出收缩率', max:3},
      {key:'A5b', label:'中期趋势分', max:3},
    ])}
    ${renderCardSection('B', '估值', B, 'score-b', 'b', [
      {key:'B1', label:'行业PE客观分', max:10},
      {key:'B2', label:'叙事动态系数', max:8},
      {key:'B3', label:'自身历史分位', max:7},
    ])}
    ${renderCardSection('C', '技术信号', C, 'score-c', 'c', [
      {key:'C1', label:'量价背离度', max:10},
      {key:'C2', label:'相对拥挤度', max:10},
      {key:'C3', label:'换手率偏离度', max:5},
    ])}
    ${renderCardSection('D', '基本面', D, 'score-d', 'd', [
      {key:'D1', label:'ROE行业分位', max:6},
      {key:'D2', label:'毛利率趋势', max:5},
      {key:'D3', label:'营收增速', max:4},
    ])}
    <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">💬 综合结论</div>
      <div style="background:var(--bg);border-radius:6px;padding:12px 14px;font-size:13px;line-height:1.7">${d.conclusion || '暂无'}</div>
    </div>
    <div style="text-align:center;padding-top:8px">
      <span data-ts="${d.ts_code}" style="color:var(--accent);font-size:12px;text-decoration:none">查看完整详情与历史趋势 →</span>
    </div>
  `;
}

function renderCardSection(letter, title, data, badgeClass, fillLetter, items) {
  const pct = (data.score / data.max * 100).toFixed(0);
  const barColor = letter === 'A' ? '#e06c75' : letter === 'B' ? '#98c379' : letter === 'C' ? '#61afef' : '#c678dd';
  const itemsHtml = items.map(it => {
    const v = data[it.key] || 0;
    const ratio = v / it.max;
    const tagBg   = ratio >= 0.7 ? 'rgba(63,185,80,0.15)'  : ratio >= 0.4 ? 'rgba(210,153,34,0.15)' : 'rgba(248,81,73,0.15)';
    const tagFg   = ratio >= 0.7 ? 'var(--green)'          : ratio >= 0.4 ? 'var(--yellow)'          : 'var(--red)';
    const barWidth = Math.min(100, (ratio * 100).toFixed(0));
    return `
    <div style="background:rgba(255,255,255,0.02);border-radius:6px;padding:8px 12px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:11px;color:var(--dim)">${it.label}</span>
        <span style="font-size:10px;padding:1px 5px;border-radius:6px;background:${tagBg};color:${tagFg}">${v.toFixed(2)} / ${it.max}</span>
      </div>
      <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
        <div style="height:100%;background:${barColor};border-radius:2px;width:${barWidth}%"></div>
      </div>
    </div>`;
  }).join('');
  return `
  <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:15px;font-weight:800;color:${barColor}">${letter}</span>
        <span style="font-size:13px;font-weight:700">${title}</span>
      </div>
      <div style="font-size:13px;font-weight:700;padding:2px 10px;border-radius:10px;background:rgba(88,166,255,0.15);color:var(--accent)">${data.score.toFixed(1)}/${data.max}</div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
      <span style="color:var(--text)">综合进度</span>
      <span style="color:var(--accent);font-weight:600">${pct}%</span>
    </div>
    <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:10px">
      <div style="height:100%;background:${barColor};border-radius:3px;width:${pct}%"></div>
    </div>
    <div>${itemsHtml}</div>
  </div>`;
}

async function loadFilterOptions() {
  try {
    const r = await fetch('./data/filters.json?v=1785345324');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.code === 0) {
      if (d.industry) FILTER_DEFS.industry.options = d.industry;
      if (d.concepts) FILTER_DEFS.concept.options = d.concepts;
      if (d.ai_layers) FILTER_DEFS.ai_chain.options = d.ai_layers;
      if (d.serenity) FILTER_DEFS.serenity.options = d.serenity;
    }
  } catch(e) {
    console.warn('filter options load failed, using defaults:', e.message);
  }
}

function switchFilterCat(cat) {
  currentFilterCat = cat;
  currentFilters = [];
  document.querySelectorAll('.filter-cat-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[onclick="switchFilterCat('${cat}')"]`).classList.add('active');
  showFilterChips(cat);
  updateActiveFilters();
}

function showFilterChips(cat) {
  const wrap = document.getElementById('filterChipsWrap');
  const container = document.getElementById('filterChips');
  const def = FILTER_DEFS[cat];
  if (!def || !def.options.length) {
    container.innerHTML = `<span style="font-size:12px;color:var(--dim);padding:4px">加载中...</span>`;
    return;
  }
  const visibleOptions = def.options.filter(o => {
    const dynamicCount = getFilterOptionCount(cat, o);
    return dynamicCount === null || dynamicCount > 0 || currentFilters.includes(o.v);
  });
  if (!visibleOptions.length) {
    container.innerHTML = `<span style="font-size:12px;color:var(--dim);padding:4px">当前榜单没有可用筛选项</span>`;
    return;
  }
  container.innerHTML = visibleOptions.map(o => {
    const label = o.label || o.v;
    const dynamicCount = getFilterOptionCount(cat, o);
    const countValue = dynamicCount !== null ? dynamicCount : o.count;
    const count = countValue !== null && countValue !== undefined ? `<span class="filter-chip-count">${countValue}</span>` : '';
    const active = currentFilters.includes(o.v) ? 'active' : '';
    return `<button class="filter-chip ${active}" onclick="toggleFilter('${o.v}', '${label}')">${label}${count}</button>`;
  }).join('');
}

function getFilterOptionCount(cat, option) {
  if (!leaderboardData || !leaderboardData.stocks) return null;
  return leaderboardData.stocks.filter(s => stockMatchesFilterOption(s, cat, option)).length;
}

function stockMatchesFilterOption(s, cat, option) {
  const ts = s.ts_code || '';
  const industry = s.industry || '';
  const indexTags = s.index_tags || [];
  const conceptTags = s.concept_tags || [];
  const aiLayer = s.ai_layer || '';
  const serenity = Number(s.serenity);

  if (option.suffix !== undefined) {
    if (option.v === '北交所') return /\.BJ$/.test(ts);  // 2026-06-10 修: 旧代码 (430/830/870) 已废弃, 北交所现统一为 92xxxx.BJ
    if (option.v === '科创板') return ts.startsWith('688') || ts.startsWith('689');  // 2026-06-10 补: 689 为科创板延伸
    if (option.v === '创业板') return ts.startsWith('300') || ts.startsWith('301') || ts.startsWith('302');  // 2026-06-10 补: 301/302 为创业板延伸
    return /^(000|001|002|003|600|601|603|605)/.test(ts);
  }
  if (option.tags) return option.tags.some(t => indexTags.includes(t));
  if (cat === 'industry') return industry === option.v;
  if (cat === 'concept') return conceptTags.includes(option.v);
  if (cat === 'ai_chain') return aiLayer === option.v;
  if (cat === 'serenity') {
    if (!Number.isFinite(serenity)) return false;
    if (option.v === 'serenity_all') return true;
    if (option.v === 'serenity_70') return serenity >= 70;
    if (option.v === 'serenity_60') return serenity >= 60 && serenity < 70;
    if (option.v === 'serenity_lt60') return serenity < 60;
  }
  if (cat === 'score_trend') return option.v === 'score_slope_surge' && s.score_slope_surge === true;
  return false;
}

function toggleFilter(v, label) {
  const idx = currentFilters.indexOf(v);
  if (idx >= 0) {
    currentFilters.splice(idx, 1);
  } else {
    currentFilters.push(v);
  }
  showFilterChips(currentFilterCat);
  updateActiveFilters();
  applyFiltersAndReload();
}

function updateActiveFilters() {
  const bar = document.getElementById('activeFilterBar');
  const count = document.getElementById('resultCount');
  let html = '';
  for (const f of currentFilters) {
    html += `<span class="active-filter-tag" onclick="removeFilter('${f}')">✕ ${f}<span class="remove">✕</span></span>`;
  }
  bar.innerHTML = html + (html ? ' ' : '') + (count ? count.outerHTML : '');
}

function removeFilter(f) {
  const idx = currentFilters.indexOf(f);
  if (idx >= 0) { currentFilters.splice(idx, 1); }
  showFilterChips(currentFilterCat);
  updateActiveFilters();
  applyFiltersAndReload();
}

async function loadLeaderboard(pool) {
  currentPool = pool;
  const content = document.getElementById('mainContent');
  content.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div>加载中...</div></div>';
  document.getElementById('filterSection').style.display = 'flex';

  try {
    let url = `./data/leaderboard.json?v=1785345324`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error('JSON解析失败'); }
    if (json.code !== 0) throw new Error(json.msg || '加载失败');
    leaderboardData = json;
    document.getElementById('updateTime').textContent = json.updated_at ? `更新于 ${json.updated_at}` : '--';
    renderLeaderboard(json);
    showFilterChips(currentFilterCat);
  } catch(e) {
    content.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><div>加载失败: ${e.message}</div></div>`;
  }
}

function applyFiltersAndReload() {
  if (!leaderboardData) return;
  renderLeaderboard(leaderboardData);
}

function getFilteredStocks() {
  if (!leaderboardData || !leaderboardData.stocks) return [];
  let stocks = leaderboardData.stocks;
  if (currentFilters.length > 0) {
    stocks = stocks.filter(s => {
      for (const f of currentFilters) {
        const def = (FILTER_DEFS[currentFilterCat]?.options || []).find(o => o.v === f);
        if (!def) continue;
        if (stockMatchesFilterOption(s, currentFilterCat, def)) return true;
      }
      return false;
    });
  }
  return stocks.filter(stockMatchesScreener);
}

function renderScreenerFilters() {
  document.querySelectorAll('.screener-filter').forEach(box => {
    const field = box.dataset.field;
    const cfg = SCREENER_CONFIG[field];
    if (!cfg) return;
    const state = screenerState[field] || {};
    const value = state.label ? `<span class="value">${state.label}</span>` : '';
    box.innerHTML = `
      <button class="screen-trigger ${state.label ? 'active' : ''}" onclick="toggleScreenerMenu('${field}', event)">
        <span>${cfg.label}</span>${value}<span>⌄</span>
      </button>
      <div class="screen-menu" id="screenMenu_${field}">
        <div class="screen-menu-head">
          <span>${cfg.label}</span>
          <button class="btn-small" onclick="clearScreenerField('${field}', event)">清除</button>
        </div>
        ${cfg.options.map(opt => {
          const [label, sub, min, max] = opt;
          const active = state.label === label ? 'active' : '';
          return `<button class="screen-option ${active}" onclick="setScreenerRange('${field}', '${label}', ${min === null ? 'null' : min}, ${max === null ? 'null' : max}, event)">
            <div class="screen-option-title">${label}</div>
            <div class="screen-option-sub">${sub}</div>
          </button>`;
        }).join('')}
        <div class="manual-row">
          <input id="manual_${field}_min" placeholder="最小">
          <input id="manual_${field}_max" placeholder="最大">
        </div>
        <div class="screen-actions">
          <button class="btn-small" onclick="applyManualRange('${field}', event)">手动设置</button>
        </div>
      </div>
    `;
  });
}

function closeScreenerMenus() {
  document.querySelectorAll('.screen-menu').forEach(m => m.classList.remove('open'));
}

function toggleScreenerMenu(field, event) {
  event.stopPropagation();
  const menu = document.getElementById(`screenMenu_${field}`);
  const willOpen = !menu.classList.contains('open');
  closeScreenerMenus();
  if (willOpen) menu.classList.add('open');
}

function setScreenerRange(field, label, min, max, event) {
  event.stopPropagation();
  screenerState[field] = { label, min, max };
  closeScreenerMenus();
  renderScreenerFilters();
  applyFiltersAndReload();
}

function applyManualRange(field, event) {
  event.stopPropagation();
  const min = readNum(`manual_${field}_min`);
  const max = readNum(`manual_${field}_max`);
  if (min === null && max === null) return;
  const label = `${min === null ? '-∞' : min} - ${max === null ? '+∞' : max}`;
  screenerState[field] = { label, min, max };
  closeScreenerMenus();
  renderScreenerFilters();
  applyFiltersAndReload();
}

function clearScreenerField(field, event) {
  event.stopPropagation();
  delete screenerState[field];
  closeScreenerMenus();
  renderScreenerFilters();
  applyFiltersAndReload();
}

function readNum(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const raw = String(el.value || '').trim();
  if (!raw) return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}

function stockMatchesScreener(s) {
  for (const [prefix, field] of SCREENER_FIELDS) {
    const state = screenerState[prefix] || {};
    const min = state.min ?? null;
    const max = state.max ?? null;
    if (min === null && max === null) continue;
    const value = Number(s[field]);
    if (!Number.isFinite(value)) return false;
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
  }
  return true;
}

function resetScreener() {
  Object.keys(screenerState).forEach(k => delete screenerState[k]);
  renderScreenerFilters();
  applyFiltersAndReload();
}

function applyPreset(name) {
  resetScreener();
  const set = (field, label, min, max) => { screenerState[field] = { label, min, max }; };
  if (name === 'largeQuality') {
    set('mv', '>300亿', 300, null);
    set('pe', '0-30', 0, 30);
    set('pb', '<3', null, 3);
    set('score', '60+', 60, null);
  } else if (name === 'activeSmall') {
    set('mv', '30-300亿', 30, 300);
    set('turnover', '>3%', 3, null);
    set('score', '55+', 55, null);
  } else if (name === 'highScore') {
    set('score', '75+', 75, null);
    set('pct', '>-5%', -5, null);
  }
  renderScreenerFilters();
  applyFiltersAndReload();
}

function fmtNum(v, digits=1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '--';
  return n.toFixed(digits);
}

function numericValues(stocks, field, onlyPositive=false) {
  return stocks
    .map(s => Number(s[field]))
    .filter(v => Number.isFinite(v) && (!onlyPositive || v > 0));
}

function avg(values) {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getFilterDisplayLabel(value) {
  const def = FILTER_DEFS[currentFilterCat];
  const opt = (def?.options || []).find(o => o.v === value);
  return opt?.label || value;
}

function getBasketScopeLabel() {
  if (currentFilters.length > 0) {
    return currentFilters.map(getFilterDisplayLabel).join(' 或 ');
  }
  const catName = FILTER_DEFS[currentFilterCat]?.label || '当前列表';
  return `${catName} · 全部`;
}

function getActiveScreenerCount() {
  return Object.values(screenerState).filter(v => v && (v.min !== null || v.max !== null)).length;
}

function renderBasketStats(stocks) {
  const peValues = numericValues(stocks, 'pe', true);
  const pbValues = numericValues(stocks, 'pb', true);
  const scoreValues = numericValues(stocks, 'total_score');
  const scope = getBasketScopeLabel();
  const activeScreens = getActiveScreenerCount();

  document.getElementById('basketTitle').textContent = currentFilters.length > 0
    ? `${scope} 概览`
    : '当前列表概览';
  document.getElementById('basketSub').textContent = activeScreens > 0
    ? `已叠加 ${activeScreens} 个股票筛选条件`
    : '未叠加股票筛选条件';
  document.getElementById('basketCount').textContent = stocks.length;
  document.getElementById('basketScope').textContent = scope;
  document.getElementById('basketPe').textContent = fmtNum(avg(peValues), 1);
  document.getElementById('basketPb').textContent = fmtNum(avg(pbValues), 2);
  document.getElementById('basketScoreAvg').textContent = fmtNum(avg(scoreValues), 1);
  document.getElementById('basketScoreMed').textContent = fmtNum(median(scoreValues), 1);
  document.getElementById('basketPeNote').textContent = `可算 ${peValues.length}/${stocks.length}`;
  document.getElementById('basketPbNote').textContent = `可算 ${pbValues.length}/${stocks.length}`;
}

function sortArrow(key) {
  if (sortKey !== key) return '<span class="sort-muted">↕</span>';
  return `<span class="sort-arrow">${sortDesc ? '↓' : '↑'}</span>`;
}

function sortTh(label, key) {
  return `<th class="sortable" onclick="sortBy('${key}')"><span class="sort-head">${sortArrow(key)}${label}</span></th>`;
}

function sortPill(label, key) {
  const active = sortKey === key ? 'active' : '';
  return `<button class="sort-pill ${active}" onclick="event.stopPropagation(); sortBy('${key}')">${sortArrow(key)}${label}</button>`;
}

function renderLeaderboard(data) {
  const content = document.getElementById('mainContent');
  const stocks = getFilteredStocks();
  renderBasketStats(stocks);

  document.getElementById('cardTitle').textContent = `${data.pool}股票评分排行`;
  document.getElementById('tableSubtitle').textContent = currentFilters.length > 0
    ? `已选 ${currentFilters.join(', ')} · 共 ${stocks.length} 只`
    : `共 ${stocks.length} 只`;
  document.getElementById('resultCount').textContent = `${stocks.length} 只`;

  if (stocks.length === 0) {
    content.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><div>暂无数据</div><div style="margin-top:8px;font-size:12px;color:var(--dim)">${currentFilters.length > 0 ? '当前筛选条件无匹配股票' : '请先刷新评分'}</div></div>`;
    return;
  }

  let html = `
  <div class="table-sort-bar">
    <span class="table-sort-label">列表排序</span>
    ${sortPill('排名', 'rank')}
    ${sortPill('总分', 'total_score')}
    ${sortPill('总市值', 'mv_total_yi')}
    ${sortPill('流通市值', 'mv_float_yi')}
    ${sortPill('PE', 'pe')}
    ${sortPill('PB', 'pb')}
    ${sortPill('ROE', 'roe')}
    ${sortPill('涨跌', 'pct_change')}
    ${sortPill('排名变化', 'rank_change')}
    ${sortPill('3期斜率', 'score_slope_3')}
  </div>
  <table class="stock-table">
    <thead>
      <tr>
        ${sortTh('排名', 'rank')}
        ${sortTh('股票', 'name')}
        ${sortTh('总分', 'total_score')}
        <th>
          <div class="dual-sort">
            ${sortPill('总市值', 'mv_total_yi')}
            ${sortPill('流通', 'mv_float_yi')}
          </div>
        </th>
        <th>
          <div class="dual-sort">
            ${sortPill('PE', 'pe')}
            ${sortPill('PB', 'pb')}
          </div>
        </th>
        ${sortTh('ROE', 'roe')}
        <th>评分构成</th>
        <th>评级</th>
        ${sortTh('涨跌', 'pct_change')}
        ${sortTh('排名变化', 'rank_change')}
        <th>板块标签</th>
      </tr>
    </thead>
    <tbody>
  `;

  stocks.forEach((s, i) => {
    const rankClass = s.rank <= 3 ? 'rank-top3' : 'rank-normal';
    const gradeClass = getGradeClass(s.grade);
    const pct = s.pct_change || 0;
    const pctClass = pct > 0 ? 'pct-up' : pct < 0 ? 'pct-down' : 'pct-flat';
    const rc = s.rank_change || 0;
    const rcClass = rc > 0 ? 'rank-up' : rc < 0 ? 'rank-down' : 'rank-same';
    const rcSymbol = rc > 0 ? `↑${rc}` : rc < 0 ? `↓${Math.abs(rc)}` : '➖';

    const visibleTags = [];
    if (s.ai_layer) visibleTags.push(`${s.ai_layer}`);
    if (s.ai_chokepoint) visibleTags.push(s.ai_chokepoint);
    if (Number.isFinite(Number(s.serenity))) visibleTags.push(`Serenity ${Number(s.serenity).toFixed(1)}`);
    if (s.score_slope_surge) visibleTags.push(`斜率突升 +${fmtNum(s.score_slope_3, 1)}`);
    if (s.index_tags) visibleTags.push(...s.index_tags.slice(0, 2));
    const tags = visibleTags.slice(0, 4).map(t => `<span class="tag">${t}</span>`).join('');

    html += `
    <tr onclick="goStock(${s.ts_code})">
      <td><span class="rank ${rankClass}">${s.rank || '-'}</span></td>
      <td class="name-cell">
        <div class="name">${s.name || s.ts_code}</div>
        <div class="ts-code">${s.ts_code}</div>
      </td>
      <td><span class="score-total">${Math.round(s.total_score || 0)}</span></td>
      <td>
        <div style="font-weight:700;color:var(--text)">${fmtNum(s.mv_total_yi, 0)}</div>
        <div class="ts-code">流 ${fmtNum(s.mv_float_yi, 0)}</div>
      </td>
      <td>
        <div style="font-weight:700;color:var(--text)">${fmtNum(s.pe, 1)}</div>
        <div class="ts-code">PB ${fmtNum(s.pb, 2)}</div>
      </td>
      <td>
        <div style="font-weight:700;color:var(--text)">${fmtNum(s.roe, 1)}%</div>
        <div class="ts-code">${s.roe_end_date || '--'}</div>
      </td>
      <td class="score-breakdown">
        <span class="a">A${Math.round(s.a_score||0)}</span>
        <span class="b">B${Math.round(s.b_score||0)}</span>
        <span class="c">C${Math.round(s.c_score||0)}</span>
        <span class="d">D${Math.round(s.d_score||0)}</span>
      </td>
      <td><span class="grade ${gradeClass}">${s.grade || '--'}</span></td>
      <td class="pct ${pctClass}">${pct > 0 ? '+' : ''}${pct.toFixed(1)}%</td>
      <td><span class="rank-change ${rcClass}">${rcSymbol}</span></td>
      <td class="tag-cell">${tags}</td>
    </tr>
    `;
  });

  html += '</tbody></table>';
  content.innerHTML = html;
}

function getGradeClass(grade) {
  if (!grade) return '';
  if (grade.includes('🥇') || grade.includes('强势')) return 'grade-1';
  if (grade.includes('🥈') || grade.includes('积极')) return 'grade-2';
  if (grade.includes('🥉') || grade.includes('谨慎')) return 'grade-3';
  if (grade.includes('⚠️')) return 'grade-4';
  return 'grade-5';
}

function switchTab(pool) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  const tab = document.querySelector(`[onclick="switchTab('${pool}')"]`);
  if (tab) tab.classList.add('active');
  currentFilters = [];
  showFilterChips(currentFilterCat);
  updateActiveFilters();
  loadLeaderboard(pool);
}

let updatePollTimer = null;

// Sort
let sortKey = 'total_score';
let sortDesc = true;

function comparableValue(stock, key) {
  if (key === 'name') return String(stock.name || stock.ts_code || '').toLowerCase();
  const value = Number(stock[key]);
  if ((key === 'pe' || key === 'pb') && (!Number.isFinite(value) || value <= 0)) return null;
  return Number.isFinite(value) ? value : null;
}

function sortBy(key) {
  if (sortKey === key) sortDesc = !sortDesc;
  else { sortKey = key; sortDesc = true; }
  if (!leaderboardData) return;
  const stocks = leaderboardData.stocks || [];
  stocks.sort((a, b) => {
    const av = comparableValue(a, key);
    const bv = comparableValue(b, key);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === 'string' || typeof bv === 'string') {
      const cmp = String(av).localeCompare(String(bv), 'zh-Hans-CN');
      return sortDesc ? -cmp : cmp;
    }
    return sortDesc ? bv - av : av - bv;
  });
  renderLeaderboard(leaderboardData);
}
