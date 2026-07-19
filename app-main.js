/**
 * REELIX - MAIN APP LOGIC
 * Drives the homepage: hero carousel, category rows, search, modal,
 * trailer lightbox, My List, and Continue Watching.
 */

const API = 'https://api.themoviedb.org/3';
const API_KEY = '1d3ae144acfb6bfcb25f70361cedcf29';
const IMG_W = 'https://image.tmdb.org/t/p/w500';
const IMG_W342 = 'https://image.tmdb.org/t/p/w342';
const IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';
const TODAY_ISO = new Date().toISOString().slice(0, 10);

// ─── TMDB RESPONSE CACHE ───
// This site is plain multi-page navigation (index → browse → back), not a
// SPA, so a sessionStorage cache is what actually helps here — it survives
// full page loads within the same tab/session, unlike an in-memory JS cache
// which would reset on every navigation. Trending/discover data doesn't
// need to be second-by-second fresh, so a short TTL is fine.
const TMDB_CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes
const TMDB_CACHE_PREFIX = 'tmdb-cache:';

async function cachedFetchJSON(url) {
  const cacheKey = TMDB_CACHE_PREFIX + url;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < TMDB_CACHE_TTL_MS) return data;
    }
  } catch {
    // Corrupt cache entry or sessionStorage unavailable — fall through to a real fetch.
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  const data = await res.json();

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // sessionStorage full or unavailable (e.g. private browsing) — caching
    // is a nice-to-have, not worth failing the request over.
  }
  return data;
}

let myList = JSON.parse(localStorage.getItem('reelix-mylist') || '[]');

// ─── SEARCH ───
const searchWrap = document.getElementById('search-wrap');
const searchInput = document.getElementById('search');
const searchToggle = document.getElementById('search-toggle');
const searchResults = document.getElementById('search-results');

if (searchToggle && searchWrap && searchInput) {
  searchToggle.addEventListener('click', () => {
    searchWrap.classList.toggle('open');
    if (searchWrap.classList.contains('open')) searchInput.focus();
  });
}

let searchTimeout;
if (searchInput && searchResults) {
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    if (!query) {
      searchResults.classList.remove('active');
      return;
    }
    searchTimeout = setTimeout(() => performSearch(query), 300);
  });
}

async function performSearch(query) {
  try {
    const res = await fetch(`${API}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search request failed');
    const data = await res.json();
    renderSearchResults(data.results || []);
    searchResults.classList.add('active');
  } catch (err) {
    console.warn('Search failed:', err);
  }
}

function renderSearchResults(items) {
  const grid = document.getElementById('search-grid');
  const heading = document.getElementById('search-heading');
  if (!grid) return;
  grid.innerHTML = '';

  const valid = items.filter(i => i.poster_path && (i.media_type === 'movie' || i.media_type === 'tv')).slice(0, 20);
  if (heading) heading.textContent = valid.length ? 'Search Results' : 'No results found';

  const fragment = document.createDocumentFragment();
  valid.forEach(item => {
    const type = item.media_type === 'tv' ? 'tv' : 'movie';
    const title = item.title || item.name || 'Untitled';
    const div = createPosterElement(item.id, type, item.poster_path, title, 'portrait');
    fragment.appendChild(div);
  });
  grid.appendChild(fragment);
}

// ─── ROW SCROLLING ───
function scrollRow(rowId, direction) {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.scrollBy({ left: 260 * direction, behavior: 'smooth' });
}

// ─── POSTER CARD (shared by all rows, search, and My List) ───
function createPosterElement(id, type, imgPath, title, style = 'portrait', rank = null) {
  const wrap = document.createElement('div');
  wrap.className = 'card-wrap';

  const poster = document.createElement('div');
  poster.className = style === 'landscape' ? 'poster-landscape' : 'poster-portrait';

  const img = document.createElement('img');
  img.srcset = `${IMG_W342 + imgPath} 342w, ${IMG_W + imgPath} 500w`;
  img.sizes = style === 'landscape' ? '(max-width: 600px) 200px, 260px' : '(max-width: 600px) 120px, 150px';
  img.src = IMG_W + imgPath;
  img.alt = title;
  img.loading = 'lazy';
  poster.appendChild(img);

  const overlay = document.createElement('div');
  overlay.className = 'card-overlay';
  overlay.innerHTML = `<div class="card-title">${title}</div>`;
  poster.appendChild(overlay);

  const playBtn = document.createElement('div');
  playBtn.className = 'card-play-btn';
  playBtn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  poster.appendChild(playBtn);

  const myListBtn = document.createElement('button');
  myListBtn.className = 'card-mylist';
  myListBtn.setAttribute('aria-label', 'Add to My List');
  myListBtn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  myListBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    quickAddList(id, type, imgPath, title);
  });
  poster.appendChild(myListBtn);

  if (rank !== null && style === 'landscape') {
    const rankEl = document.createElement('div');
    rankEl.className = 'card-rank';
    rankEl.textContent = rank;
    poster.appendChild(rankEl);
  }

  wrap.appendChild(poster);

  const label = document.createElement('div');
  label.className = 'card-label';
  label.textContent = title;
  wrap.appendChild(label);

  wrap.addEventListener('click', () => openModal(id, type));
  return wrap;
}

// ─── CONTINUE WATCHING (with progress bar) ───
function getLocalWatchHistory() {
  try {
    return JSON.parse(localStorage.getItem('reelix-continue-watching') || '[]');
  } catch {
    return [];
  }
}

function buildWatchedRowShell() {
  const row = document.createElement('div');
  row.className = 'row';
  row.id = 'row-watched';
  row.style.display = 'none';
  row.innerHTML = `
    <div class="row-header"><h2><span class="row-emoji">▶</span> Continue Watching</h2></div>
    <div class="row-container">
      <button class="arrow left" onclick="scrollRow('watched-list',-1)" aria-label="Scroll left">
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button class="arrow right" onclick="scrollRow('watched-list',1)" aria-label="Scroll right">
        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <div class="row-posters" id="watched-list"></div>
    </div>
  `;
  return row;
}

function renderContinueWatching(items) {
  const wrap = document.getElementById('rows-wrap');
  if (!wrap) return;
  if (!document.getElementById('row-watched')) {
    wrap.prepend(buildWatchedRowShell());
  }

  const container = document.getElementById('watched-list');
  const row = document.getElementById('row-watched');
  if (!container || !row) return;
  if (!items || !items.length) {
    row.style.display = 'none';
    return;
  }

  container.innerHTML = '';
  const fragment = document.createDocumentFragment();

  items.forEach(item => {
    const imgPath = item.backdrop || item.poster;
    if (!imgPath) return;
    usedMediaKeys.add(`${item.mediaType}-${item.mediaId}`);
    const style = item.backdrop ? 'landscape' : 'portrait';
    const wrap = createPosterElement(item.mediaId, item.mediaType, imgPath, item.title, style);

    // Percent watched, clamped 0-100. Only shown when we have both figures.
    if (item.duration && item.progress) {
      const percent = Math.max(0, Math.min(100, (item.progress / item.duration) * 100));
      const track = document.createElement('div');
      track.className = 'progress-track';
      track.innerHTML = `<div class="progress-fill" style="width:${percent}%;"></div>`;
      wrap.querySelector('.poster-landscape, .poster-portrait').appendChild(track);
    }

    fragment.appendChild(wrap);
  });

  container.appendChild(fragment);
  row.style.display = 'block';
}

// ─── FALLBACK CONTENT ───
// Shown if TMDB is unreachable, so a row never just sits empty.
const FALLBACK_MOVIES = [
  { id: 278, title: 'The Shawshank Redemption', release_date: '1994', poster_path: '/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg', backdrop_path: '/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg' },
  { id: 238, title: 'The Godfather', release_date: '1972', poster_path: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg', backdrop_path: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg' },
  { id: 155, title: 'The Dark Knight', release_date: '2008', poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', backdrop_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg' },
  { id: 680, title: 'Pulp Fiction', release_date: '1994', poster_path: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', backdrop_path: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg' },
  { id: 13, title: 'Forrest Gump', release_date: '1994', poster_path: '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg', backdrop_path: '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg' },
  { id: 550, title: 'Fight Club', release_date: '1999', poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', backdrop_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg' },
  { id: 597, title: 'Titanic', release_date: '1997', poster_path: '/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg', backdrop_path: '/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg' },
  { id: 769, title: 'GoodFellas', release_date: '1990', poster_path: '/aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg', backdrop_path: '/aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg' },
];

function addSkeletons(containerId, count, style) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const d = document.createElement('div');
    d.className = 'skeleton';
    d.style.width = style === 'landscape' ? '260px' : '150px';
    d.style.height = style === 'landscape' ? '146px' : '225px';
    d.style.flexShrink = '0';
    c.appendChild(d);
  }
}

// ─── CATEGORY ROWS ───
// Each entry describes one horizontally-scrolling row on the homepage.
// Rows are built and inserted into #rows-wrap dynamically (it starts empty
// in the HTML), then populated from TMDB.
const ROW_CONFIG = [
  { id: 'trending-list', emoji: '🔥', title: 'Hot Right Now', genreKey: null,
    url: `${API}/trending/movie/week?api_key=${API_KEY}`, type: 'movie', style: 'landscape', showRank: true },
  { id: 'top-list', emoji: '⭐', title: 'Critically Acclaimed', genreKey: null,
    url: `${API}/movie/top_rated?api_key=${API_KEY}`, type: 'movie', style: 'portrait' },
  { id: 'action-list', emoji: '💥', title: 'Action-Packed', genreKey: 28,
    url: `${API}/discover/movie?api_key=${API_KEY}&with_genres=28&sort_by=primary_release_date.desc&vote_count.gte=25&primary_release_date.lte=${TODAY_ISO}`, type: 'movie', style: 'landscape' },
  { id: 'tv-list', emoji: '📺', title: 'Binge-Worthy Series', genreKey: null,
    url: `${API}/discover/tv?api_key=${API_KEY}&sort_by=first_air_date.desc&vote_count.gte=25&first_air_date.lte=${TODAY_ISO}`, type: 'tv', style: 'portrait' },
  { id: 'horror-list', emoji: '👻', title: 'Spine-Chillers', genreKey: 27,
    url: `${API}/discover/movie?api_key=${API_KEY}&with_genres=27&sort_by=primary_release_date.desc&vote_count.gte=25&primary_release_date.lte=${TODAY_ISO}`, type: 'movie', style: 'landscape' },
  { id: 'comedy-list', emoji: '😂', title: 'Laugh Out Loud', genreKey: 35,
    url: `${API}/discover/movie?api_key=${API_KEY}&with_genres=35&sort_by=primary_release_date.desc&vote_count.gte=25&primary_release_date.lte=${TODAY_ISO}`, type: 'movie', style: 'landscape' },
  { id: 'anime-list', emoji: '🎌', title: 'Anime Picks', genreKey: null,
    url: `${API}/discover/tv?api_key=${API_KEY}&with_genres=16&with_original_language=ja&sort_by=first_air_date.desc&vote_count.gte=15&first_air_date.lte=${TODAY_ISO}`, type: 'tv', style: 'portrait' },
  { id: 'scifi-list', emoji: '🛸', title: 'Mind-Bending Sci-Fi', genreKey: 878,
    url: `${API}/discover/movie?api_key=${API_KEY}&with_genres=878|53&sort_by=primary_release_date.desc&vote_count.gte=25&primary_release_date.lte=${TODAY_ISO}`, type: 'movie', style: 'landscape' },
  { id: 'romance-list', emoji: '💕', title: 'Love Stories', genreKey: 10749,
    url: `${API}/discover/movie?api_key=${API_KEY}&with_genres=10749&sort_by=primary_release_date.desc&vote_count.gte=25&primary_release_date.lte=${TODAY_ISO}`, type: 'movie', style: 'landscape' },
  { id: 'drama-list', emoji: '🎭', title: 'Award-Worthy Drama', genreKey: 18,
    url: `${API}/discover/movie?api_key=${API_KEY}&with_genres=18&sort_by=primary_release_date.desc&vote_count.gte=25&primary_release_date.lte=${TODAY_ISO}`, type: 'movie', style: 'landscape' },
  { id: 'animation-list', emoji: '🎨', title: 'Family Animation', genreKey: 16,
    url: `${API}/discover/movie?api_key=${API_KEY}&with_genres=16&without_genres=10749&sort_by=primary_release_date.desc&vote_count.gte=25&primary_release_date.lte=${TODAY_ISO}`, type: 'movie', style: 'landscape' },
  { id: 'documentary-list', emoji: '🎥', title: 'Real Stories', genreKey: 99,
    url: `${API}/discover/movie?api_key=${API_KEY}&with_genres=99&sort_by=primary_release_date.desc&vote_count.gte=10&primary_release_date.lte=${TODAY_ISO}`, type: 'movie', style: 'landscape' },
  { id: 'featured-list', emoji: '✨', title: 'Reelix Picks', genreKey: null,
    url: `${API}/discover/movie?api_key=${API_KEY}&sort_by=vote_average.desc&vote_count.gte=3000`, type: 'movie', style: 'portrait' },
];

function buildRowShell(cfg) {
  const row = document.createElement('div');
  row.className = 'row';
  row.id = `row-${cfg.id.replace('-list', '')}`;
  row.dataset.genreKey = cfg.genreKey ?? '';

  row.innerHTML = `
    <div class="row-header"><h2><span class="row-emoji">${cfg.emoji}</span> ${cfg.title}</h2></div>
    <div class="row-container">
      <button class="arrow left" onclick="scrollRow('${cfg.id}',-1)" aria-label="Scroll left">
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button class="arrow right" onclick="scrollRow('${cfg.id}',1)" aria-label="Scroll right">
        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <div class="row-posters" id="${cfg.id}"></div>
    </div>
  `;
  return row;
}

// Movies/shows already placed in an earlier row won't be repeated in a
// later one. Rows are processed in ROW_CONFIG order, so higher-priority
// rows (Trending, Top Rated) get first pick of any title that could
// plausibly fit multiple categories.
const usedMediaKeys = new Set();

async function fetchRowPage(cfg, page) {
  const sep = cfg.url.includes('?') ? '&' : '?';
  const data = await cachedFetchJSON(`${cfg.url}${sep}page=${page}`);
  return { results: data.results || [], totalPages: data.total_pages || 1 };
}

function renderRow(cfg, items) {
  const container = document.getElementById(cfg.id);
  if (!container) return;
  container.innerHTML = '';
  const fragment = document.createDocumentFragment();
  items.forEach((item, i) => {
    const title = item.title || item.name || 'Untitled';
    const imgPath = cfg.style === 'landscape' ? item.backdrop_path : item.poster_path;
    const rank = cfg.showRank ? i + 1 : null;
    fragment.appendChild(createPosterElement(item.id, cfg.type, imgPath, title, cfg.style, rank));
  });
  container.appendChild(fragment);
}

const ROW_WANTED = 20;

async function loadAllRows() {
  const wrap = document.getElementById('rows-wrap');
  if (!wrap) return;
  ROW_CONFIG.forEach(cfg => wrap.appendChild(buildRowShell(cfg)));
  ROW_CONFIG.forEach(cfg => addSkeletons(cfg.id, 8, cfg.style));

  // ── Phase 1: fetch every row's first page in parallel ──
  const firstPageResults = await Promise.all(
    ROW_CONFIG.map(cfg =>
      fetchRowPage(cfg, 1).catch(e => {
        console.warn(`Failed to load row ${cfg.id}:`, e);
        return null;
      })
    )
  );

  // ── Phase 2: claim unique items in row-priority order ──
  // (must be sequential — this is what makes dedupe deterministic)
  const rowItems = new Map(); // cfg.id -> collected items so far
  ROW_CONFIG.forEach((cfg, i) => {
    const page1 = firstPageResults[i];
    const collected = [];
    if (page1) {
      for (const item of page1.results) {
        const imgPath = cfg.style === 'landscape' ? item.backdrop_path : item.poster_path;
        if (!imgPath) continue;
        const key = `${cfg.type}-${item.id}`;
        if (usedMediaKeys.has(key)) continue;
        usedMediaKeys.add(key);
        collected.push(item);
        if (collected.length >= ROW_WANTED) break;
      }
    }
    rowItems.set(cfg.id, collected);
  });

  // ── Phase 3: top up any row that's still short (rare — usually only
  // very small genres) by pulling more pages, one row at a time so
  // dedupe priority still holds ──
  for (let i = 0; i < ROW_CONFIG.length; i++) {
    const cfg = ROW_CONFIG[i];
    const collected = rowItems.get(cfg.id);
    const page1 = firstPageResults[i];
    let totalPages = page1 ? page1.totalPages : 1;
    let page = 2;

    while (collected.length < ROW_WANTED && page <= Math.min(totalPages, 5)) {
      try {
        const { results, totalPages: tp } = await fetchRowPage(cfg, page);
        totalPages = tp;
        for (const item of results) {
          const imgPath = cfg.style === 'landscape' ? item.backdrop_path : item.poster_path;
          if (!imgPath) continue;
          const key = `${cfg.type}-${item.id}`;
          if (usedMediaKeys.has(key)) continue;
          usedMediaKeys.add(key);
          collected.push(item);
          if (collected.length >= ROW_WANTED) break;
        }
      } catch (e) {
        console.warn(`Failed to top up row ${cfg.id}:`, e);
        break;
      }
      page += 1;
    }

    if (collected.length) {
      renderRow(cfg, collected);
    } else {
      // Total failure for this row (TMDB down, network issue, etc.) —
      // show fallback content instead of leaving it empty.
      renderRow(cfg, FALLBACK_MOVIES);
    }
  }
}

// ─── GENRE NAV ───
// Jumps to the matching row rather than re-querying, since the homepage
// already surfaces most genres as their own row. "All" (id 0) just
// scrolls back to the top of the rows.
function filterGenre(id, btn, name) {
  document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');

  if (!id) {
    document.getElementById('rows-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const match = document.querySelector(`.row[data-genre-key="${id}"]`);
  if (match) {
    match.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    // No dedicated row for this genre — send them to the full browse grid instead.
    seeAll(id, name, 'movie');
  }
}

function filterMediaType(type, btn) {
  document.querySelectorAll('.media-toggle-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function seeAll(genre, name, type) {
  window.location.href = `browse.html?genre=${genre}&name=${encodeURIComponent(name)}&type=${type}`;
}

function goToPayment() {
  window.location.href = 'https://selar.co/m/reelix';
}

// ─── HERO CAROUSEL ───
let heroMovies = [];
let heroIndex = 0;
let heroTimer = null;
let heroBgToggle = false;
let heroPaused = false;
const HERO_SLIDE_MS = 7000;
const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function renderHeroSlide(movie, animate) {
  if (!movie) return;
  const contentEl = document.getElementById('hero-content');
  const bgA = document.getElementById('hero-bg-a');
  const bgB = document.getElementById('hero-bg-b');
  const incomingBg = heroBgToggle ? bgA : bgB;
  const outgoingBg = heroBgToggle ? bgB : bgA;

  const applyContent = () => {
    if (incomingBg) {
      incomingBg.style.backgroundImage = `url(${IMG_ORIGINAL + movie.backdrop_path})`;
      incomingBg.classList.add('active');
    }
    if (outgoingBg) outgoingBg.classList.remove('active');
    heroBgToggle = !heroBgToggle;

    document.getElementById('hero-title').innerText = movie.title || 'Loading...';
    document.getElementById('hero-desc').innerText = movie.overview || '';
    document.getElementById('hero-rating').innerText = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    document.getElementById('hero-year').innerText = movie.release_date?.slice(0, 4) || '';
    const genreEl = document.getElementById('hero-genre');
    if (genreEl) genreEl.innerText = '';
    document.getElementById('hero-play').onclick = () => {
      window.location.href = `watch.html?id=${movie.id}&type=movie`;
    };
    document.getElementById('hero-info').onclick = () => openModal(movie.id, 'movie');
    updateHeroDots();
  };

  if (!animate || prefersReducedMotion || !contentEl) {
    applyContent();
    return;
  }

  contentEl.classList.add('hero-slide-out');
  setTimeout(() => {
    applyContent();
    contentEl.classList.remove('hero-slide-out');
    contentEl.classList.add('hero-slide-in');
    void contentEl.offsetWidth; // force reflow before animating back in
    contentEl.classList.remove('hero-slide-in');
  }, 600);
}

function updateHeroDots() {
  const dotsEl = document.getElementById('hero-dots');
  if (!dotsEl) return;
  dotsEl.innerHTML = '';
  heroMovies.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.className = 'hero-dot-btn' + (i === heroIndex ? ' active' : '');
    btn.setAttribute('aria-label', `Go to slide ${i + 1}`);
    btn.onclick = () => goToHeroSlide(i);
    dotsEl.appendChild(btn);
  });
}

function goToHeroSlide(i) {
  if (i === heroIndex || !heroMovies[i]) return;
  heroIndex = i;
  renderHeroSlide(heroMovies[heroIndex], true);
  restartHeroTimer();
}

function advanceHero() {
  if (!heroMovies.length || heroPaused) return;
  heroIndex = (heroIndex + 1) % heroMovies.length;
  renderHeroSlide(heroMovies[heroIndex], true);
}

function restartHeroTimer() {
  if (heroTimer) clearInterval(heroTimer);
  if (prefersReducedMotion) return;
  heroTimer = setInterval(advanceHero, HERO_SLIDE_MS);
}

async function loadHero() {
  try {
    const data = await cachedFetchJSON(`${API}/trending/movie/week?api_key=${API_KEY}`);
    heroMovies = (data.results || []).filter(m => m.backdrop_path).slice(0, 6);
    if (!heroMovies.length) throw new Error('No movies found');

    heroIndex = 0;
    renderHeroSlide(heroMovies[0], false);
    restartHeroTimer();

    const heroEl = document.getElementById('hero');
    if (heroEl) {
      heroEl.addEventListener('mouseenter', () => { heroPaused = true; });
      heroEl.addEventListener('mouseleave', () => { heroPaused = false; });
      heroEl.addEventListener('touchstart', () => { heroPaused = true; }, { passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      heroPaused = document.hidden;
    });
  } catch (e) {
    console.warn('Hero failed to load:', e);
    document.getElementById('hero-title').innerText = 'Welcome to Reelix';
    document.getElementById('hero-desc').innerText = 'Discover the best movies and TV shows.';
    document.getElementById('hero-rating').innerText = '★ 4.5';
    document.getElementById('hero-year').innerText = '2025';
  } finally {
    window.dispatchEvent(new Event('heroReady'));
  }
}

// ─── MODAL ───
async function openModal(id, type) {
  try {
    const m = await cachedFetchJSON(`${API}/${type}/${id}?api_key=${API_KEY}&append_to_response=videos`);

    document.getElementById('modal-img').src = m.backdrop_path
      ? IMG_ORIGINAL + m.backdrop_path
      : (m.poster_path ? IMG_W + m.poster_path : '');
    document.getElementById('modal-title').innerText = m.title || m.name || '';

    const year = (m.release_date || m.first_air_date || '').slice(0, 4);
    const runtime = m.runtime
      ? `${Math.floor(m.runtime / 60)}h ${m.runtime % 60}m`
      : (m.number_of_seasons ? `${m.number_of_seasons} season${m.number_of_seasons > 1 ? 's' : ''}` : '');
    const rating = m.vote_average ? '★ ' + m.vote_average.toFixed(1) : '';
    const genres = (m.genres || []).slice(0, 3).map(g => g.name).join(' · ');

    document.getElementById('modal-meta').innerHTML = `
      <span class="modal-type-badge">${type === 'tv' ? 'TV Show' : 'Movie'}</span>
      ${year ? `<span>${year}</span>` : ''}
      ${runtime ? `<span>${runtime}</span>` : ''}
      ${rating ? `<span class="modal-rating">${rating}</span>` : ''}
      ${genres ? `<span>${genres}</span>` : ''}
    `;

    document.getElementById('modal-overview').innerText = m.overview || '';
    document.getElementById('modal-play').onclick = () => {
      window.location.href = `watch.html?id=${id}&type=${type}`;
    };

    const trailer = (m.videos?.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube')
      || (m.videos?.results || []).find(v => v.site === 'YouTube');
    const trailerBtn = document.getElementById('modal-trailer-btn');
    if (trailerBtn) {
      if (trailer) {
        trailerBtn.style.display = 'flex';
        trailerBtn.onclick = () => openTrailer(trailer.key, m.title || m.name);
      } else {
        trailerBtn.style.display = 'none';
      }
    }

    const inList = myList.some(x => String(x.id) === String(id));
    const mlBtn = document.getElementById('modal-mylist-btn');
    if (mlBtn) {
      mlBtn.innerHTML = inList
        ? '✓ In My List'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add to My List';
      mlBtn.onclick = () => {
        quickAddList(id, type, m.backdrop_path || m.poster_path, m.title || m.name);
        openModal(id, type); // refresh the button label in place
      };
    }

    document.getElementById('modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    console.error('Modal error:', err);
  }
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
}

function closeModalOnBg(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}

// ─── TRAILER LIGHTBOX ───
function openTrailer(key, title) {
  document.getElementById('trailer-title-label').innerText = title || 'Trailer';
  document.getElementById('trailer-container').innerHTML =
    `<iframe src="https://www.youtube.com/embed/${key}?autoplay=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  document.getElementById('trailer-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeTrailer() {
  document.getElementById('trailer-backdrop').classList.remove('open');
  document.getElementById('trailer-container').innerHTML = '';
  if (!document.getElementById('modal').classList.contains('open')) {
    document.body.style.overflow = '';
  }
}

function closeTrailerOnBg(e) {
  if (e.target === document.getElementById('trailer-backdrop')) closeTrailer();
}

// ─── MY LIST PANEL ───
function openMyList() {
  const panel = document.getElementById('mylist-panel');
  const content = document.getElementById('mylist-content');
  content.innerHTML = '';

  if (!myList.length) {
    content.innerHTML = '<div class="mylist-empty">Your list is empty.<br>Add movies and shows to get started.</div>';
  } else {
    const fragment = document.createDocumentFragment();
    myList.forEach(item => {
      const div = document.createElement('div');
      div.className = 'mylist-item';
      div.innerHTML = `
        <img src="${IMG_W + (item.backdrop || item.poster)}" alt="${item.title}" loading="lazy">
        <div class="mylist-item-info">
          <div class="mylist-item-title">${item.title}</div>
          <div class="mylist-item-type">${item.type === 'tv' ? 'TV Show' : 'Movie'}</div>
        </div>
        <button class="mylist-item-rm" aria-label="Remove">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;
      div.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromList(item.id);
        openMyList();
      });
      div.addEventListener('click', () => {
        closeMyList();
        openModal(item.id, item.type);
      });
      fragment.appendChild(div);
    });
    content.appendChild(fragment);
  }
  panel.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMyList() {
  document.getElementById('mylist-panel').classList.remove('open');
  document.body.style.overflow = '';
}

function quickAddList(id, type, backdrop, title) {
  const idx = myList.findIndex(x => String(x.id) === String(id));
  if (idx > -1) {
    myList.splice(idx, 1);
    showToast('Removed from My List');
  } else {
    myList.push({ id, type, title, backdrop, poster: backdrop });
    showToast('Added to My List');
  }
  localStorage.setItem('reelix-mylist', JSON.stringify(myList));
}

function removeFromList(id) {
  myList = myList.filter(x => String(x.id) !== String(id));
  localStorage.setItem('reelix-mylist', JSON.stringify(myList));
}

// ─── TOAST ───
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ─── KEYBOARD ───
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeTrailer();
    closeMyList();
    if (searchWrap) searchWrap.classList.remove('open');
  }
});

// ─── GLOBAL EXPORTS (for inline onclick handlers in the HTML) ───
window.openModal = openModal;
window.closeModal = closeModal;
window.closeModalOnBg = closeModalOnBg;
window.openTrailer = openTrailer;
window.closeTrailer = closeTrailer;
window.closeTrailerOnBg = closeTrailerOnBg;
window.filterGenre = filterGenre;
window.filterMediaType = filterMediaType;
window.seeAll = seeAll;
window.goToPayment = goToPayment;
window.scrollRow = scrollRow;
window.openMyList = openMyList;
window.closeMyList = closeMyList;

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
  loadHero();
  renderContinueWatching(getLocalWatchHistory());
  loadAllRows();
});
