/**
 * REELIX - MAIN APP LOGIC (SECURE PRODUCTION VERSION)
 * - DOM batching with DocumentFragment
 * - Debounced event handlers
 * - Responsive images with srcset
 * - Efficient modal and list rendering
 * - Routed via Cloudflare Worker proxy to secure TMDB tokens
 */

const IMG_W = 'https://image.tmdb.org/t/p/w500';
const IMG_W342 = 'https://image.tmdb.org/t/p/w342';
const IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';

let myList = JSON.parse(localStorage.getItem('reelix-mylist') || '[]');

// ── Search interface management with debouncing ──
const searchWrap = document.getElementById('search-wrap');
const searchInput = document.getElementById('search');
const searchToggle = document.getElementById('search-toggle');
const searchResults = document.getElementById('search-results');

if (searchToggle && searchWrap && searchInput) {
  searchToggle.addEventListener('click', () => {
    searchWrap.classList.toggle('open');
    if (searchWrap.classList.contains('open')) {
      searchInput.focus();
    }
  });
}

let searchTimeout;
if (searchInput && searchResults) {
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim().toLowerCase();
    
    if (!query) {
      searchResults.classList.remove('active');
      return;
    }
    
    searchTimeout = setTimeout(() => performSearch(query), 300);
  });
}

/**
 * Dynamic TMDB secure middleware data proxy fetching routine.
 * Routes client catalog and media queries via your Cloudflare Worker infrastructure safely.
 */
async function fetchFromTMDBProxy(apiEndpointPath, queryParamsString = '') {
  const SECURE_BACKEND_WORKER_URL = "https://reelix.wooskinner.workers.dev/api/tmdb";
  
  // Construct destination url addressing our worker gateway securely
  const proxyTargetUrl = `${SECURE_BACKEND_WORKER_URL}?endpoint=${encodeURIComponent(apiEndpointPath)}&${queryParamsString}`;
  
  try {
    const response = await fetch(proxyTargetUrl);
    if (!response.ok) throw new Error('Secure proxy network stream transaction failed');
    return await response.json();
  } catch (error) {
    console.error("TMDB Core metadata system link exception:", error);
    return null;
  }
}

async function performSearch(query) {
  // Route multi-search queries securely through the backend proxy
  const data = await fetchFromTMDBProxy('/search/multi', `query=${encodeURIComponent(query)}`);
  if (!data || !data.results) return;

  if (searchResults) {
    searchResults.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    // Filter out items missing backdrop or posters, cap at 5 records
    const validItems = data.results
      .filter(item => item.backdrop_path || item.poster_path)
      .slice(0, 5);

    validItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'search-item';
      const title = item.title || item.name || 'Untitled';
      const imgPath = item.poster_path ? `${IMG_W342}${item.poster_path}` : `${IMG_W342}${item.backdrop_path}`;
      
      div.innerHTML = `
        <img src="${imgPath}" alt="${title}" loading="lazy" />
        <div class="search-item-info">
          <h4>${title}</h4>
          <p>${item.release_date || item.first_air_date || ''}</p>
        </div>
      `;
      div.addEventListener('click', () => {
        openModal(item.id, item.media_type || 'movie');
        if (searchWrap) searchWrap.classList.remove('open');
        if (searchInput) searchInput.value = '';
        searchResults.classList.remove('active');
      });
      fragment.appendChild(div);
    });

    if (validItems.length > 0) {
      searchResults.appendChild(fragment);
      searchResults.classList.add('active');
    } else {
      searchResults.classList.remove('active');
    }
  }
}

// ── Modal Frame and Lifecycle Handlers ──
async function openModal(id, mediaType = 'movie') {
  const data = await fetchFromTMDBProxy(`/${mediaType}/${id}`, 'append_to_response=videos,credits');
  if (!data) return;

  const modal = document.getElementById('movie-modal');
  if (!modal) return;

  const title = data.title || data.name || 'Untitled';
  const backdrop = data.backdrop_path ? `${IMG_ORIGINAL}${data.backdrop_path}` : '';
  const genres = data.genres ? data.genres.map(g => g.name).join(', ') : '';
  
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-overview').textContent = data.overview || 'No description available.';
  document.getElementById('modal-meta').textContent = `${data.release_date || data.first_air_date || ''} • ${genres}`;
  
  const hero = document.getElementById('modal-hero');
  if (hero && backdrop) {
    hero.style.backgroundImage = `url(${backdrop})`;
  }

  // Setup Watch Trailer button binding if trailer exists
  const trailerBtn = document.getElementById('btn-trailer');
  const trailerVideo = data.videos && data.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  
  if (trailerBtn) {
    if (trailerVideo) {
      trailerBtn.style.display = 'inline-flex';
      trailerBtn.onclick = () => watchTrailer(trailerVideo.key);
    } else {
      trailerBtn.style.display = 'none';
    }
  }

  // Setup Watch Now button subscription gate binding
  const watchBtn = document.getElementById('btn-watch-now');
  if (watchBtn) {
    watchBtn.onclick = () => {
      const isPaid = localStorage.getItem('reelix-paid') === 'true';
      if (isPaid) {
        window.location.href = `player.html?id=${id}&type=${mediaType}`;
      } else {
        window.location.href = 'browse.html';
      }
    };
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('movie-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

const modalCloseBtn = document.getElementById('modal-close');
if (modalCloseBtn) {
  modalCloseBtn.addEventListener('click', closeModal);
}

// ── YouTube Trailer Lightbox Engine ──
function watchTrailer(key) {
  const container = document.getElementById('trailer-container');
  if (container) {
    container.innerHTML = `
      <iframe src="https://www.youtube.com/embed/${key}?autoplay=1&rel=0&modestbranding=1" 
              allow="autoplay; encrypted-media" 
              allowfullscreen></iframe>`;
  }
  const backdrop = document.getElementById('trailer-backdrop');
  if (backdrop) backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeTrailer() {
  const backdrop = document.getElementById('trailer-backdrop');
  if (backdrop) backdrop.classList.remove('open');
  const container = document.getElementById('trailer-container');
  if (container) container.innerHTML = '';
  if (!document.getElementById('movie-modal').classList.contains('open')) {
    document.body.style.overflow = '';
  }
}

const trailerBackdrop = document.getElementById('trailer-backdrop');
if (trailerBackdrop) {
  trailerBackdrop.addEventListener('click', (e) => {
    if (e.target === trailerBackdrop) closeTrailer();
  });
}

// ── Application Keydown Bindings ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeTrailer();
    if (searchWrap) searchWrap.classList.remove('open');
  }
});

// ── Filter and Navigation Helpers ──
function filterGenre(id, btn, name) {
  document.querySelectorAll('.genre-pill').forEach((p) => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function filterMediaType(type, btn) {
  document.querySelectorAll('.media-toggle-btn').forEach((b) => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function seeAll(genre, name, type) {
  window.location.href = `browse.html?genre=${genre}&name=${encodeURIComponent(name)}&type=${type}`;
}

function goToPayment() {
  window.location.href = 'https://selar.co/m/reelix';
}

// Global scope exports for inline HTML onclick hooks
window.openModal = openModal;
window.closeModal = closeModal;
window.watchTrailer = watchTrailer;
window.closeTrailer = closeTrailer;
window.filterGenre = filterGenre;
window.filterMediaType = filterMediaType;
window.seeAll = seeAll;
window.goToPayment = goToPayment;  }
  
  searchTimeout = setTimeout(() => performSearch(query), 300);
});

async function performSearch(query) {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`
    );
    const data = await res.json();
    renderSearchResults(data.results || []);
    searchResults.classList.add('active');
  } catch (err) {
    console.error('Search failed:', err);
  }
}

function renderSearchResults(items) {
  const grid = document.getElementById('search-grid');
  grid.innerHTML = '';
  
  // Batch DOM operations with DocumentFragment
  const fragment = document.createDocumentFragment();
  
  items.slice(0, 20).forEach((item) => {
    if (!item.poster_path) return;
    const div = document.createElement('div');
    div.className = 'poster-portrait';
    div.style.cursor = 'pointer';
    
    const img = document.createElement('img');
    img.srcset = `${IMG_W342 + item.poster_path} 342w, ${IMG_W + item.poster_path} 500w`;
    img.sizes = '(max-width: 600px) 100vw, 342px';
    img.src = IMG_W + item.poster_path;
    img.alt = item.title || item.name || '';
    img.loading = 'lazy';
    
    div.appendChild(img);
    div.addEventListener('click', () => {
      const type = item.media_type === 'tv' ? 'tv' : 'movie';
      openModal(item.id, type);
    });
    
    fragment.appendChild(div);
  });
  
  grid.appendChild(fragment);
}

// ── Row scrolling ──
function scrollRow(rowId, direction) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const scrollAmount = 260 * direction;
  row.scrollBy({ left: scrollAmount, behavior: 'smooth' });
}

// ── Continue Watching ──
function getLocalWatchHistory() {
  try {
    return JSON.parse(localStorage.getItem('reelix-continue-watching') || '[]');
  } catch {
    return [];
  }
}

function renderContinueWatching(items) {
  const container = document.getElementById('watched-list');
  const row = document.getElementById('row-watched');
  if (!container || !row) return;
  if (!items || !items.length) {
    row.style.display = 'none';
    return;
  }

  container.innerHTML = '';
  const fragment = document.createDocumentFragment();
  
  items.forEach((item) => {
    const imgPath = item.backdrop || item.poster;
    if (!imgPath) return;
    const style = item.backdrop ? 'landscape' : 'portrait';
    const div = createPosterElement(item.mediaId, item.mediaType, imgPath, item.title, style);
    fragment.appendChild(div);
  });
  
  container.appendChild(fragment);
  row.style.display = 'block';
}

// ── Create optimized poster element ──
function createPosterElement(id, type, imgPath, title, style = 'portrait') {
  const div = document.createElement('div');
  div.className = `poster-${style}`;
  div.style.cursor = 'pointer';
  
  // Responsive images with srcset
  const img = document.createElement('img');
  const sizes = style === 'landscape' 
    ? '(max-width: 600px) 200px, 260px'
    : '(max-width: 600px) 120px, 150px';
  
  img.srcset = `${IMG_W342 + imgPath} 342w, ${IMG_W + imgPath} 500w`;
  img.sizes = sizes;
  img.src = IMG_W + imgPath;
  img.alt = title;
  img.loading = 'lazy';
  
  div.appendChild(img);
  
  // Card overlay
  const overlay = document.createElement('div');
  overlay.className = 'card-overlay';
  overlay.innerHTML = `<div class="card-title">${title}</div>`;
  div.appendChild(overlay);
  
  // Play button
  const playBtn = document.createElement('div');
  playBtn.className = 'card-play-btn';
  playBtn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  div.appendChild(playBtn);
  
  // My List button
  const myListBtn = document.createElement('button');
  myListBtn.className = 'card-mylist';
  myListBtn.setAttribute('aria-label', 'Add to My List');
  myListBtn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  myListBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    quickAddList(id, type, imgPath, title);
  });
  div.appendChild(myListBtn);
  
  div.addEventListener('click', () => openModal(id, type));
  return div;
}

// ── My List Panel ──
function openMyList() {
  const panel = document.getElementById('mylist-panel');
  const content = document.getElementById('mylist-content');
  
  content.innerHTML = '';
  if (!myList.length) {
    content.innerHTML = '<div class="mylist-empty">Your list is empty.<br>Add movies and shows to get started.</div>';
  } else {
    const fragment = document.createDocumentFragment();
    myList.forEach((item) => {
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
      const removeBtn = div.querySelector('button');
      removeBtn.addEventListener('click', () => {
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
  const entry = { id, type, title, backdrop, poster: backdrop };
  const idx = myList.findIndex((x) => x.id === id);
  if (idx > -1) {
    myList.splice(idx, 1);
    showToast('Removed from My List');
  } else {
    myList.push(entry);
    showToast('Added to My List');
  }
  localStorage.setItem('reelix-mylist', JSON.stringify(myList));
}

function removeFromList(id) {
  myList = myList.filter((x) => x.id !== id);
  localStorage.setItem('reelix-mylist', JSON.stringify(myList));
}

// ── Toast ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerText = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ── Modal ──
async function openModal(id, type) {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${type}/${id}?api_key=${API_KEY}&append_to_response=videos`
    );
    const m = await res.json();
    
    document.getElementById('modal-img').src = m.backdrop_path 
      ? IMG_ORIGINAL + m.backdrop_path 
      : (m.poster_path ? IMG_W + m.poster_path : '');
    document.getElementById('modal-title').innerText = m.title || m.name || '';
    
    const year = (m.release_date || m.first_air_date || '').slice(0, 4);
    const runtime = m.runtime 
      ? `${Math.floor(m.runtime / 60)}h ${m.runtime % 60}m` 
      : (m.number_of_seasons ? `${m.number_of_seasons} season${m.number_of_seasons > 1 ? 's' : ''}` : '');
    const rating = m.vote_average ? '★ ' + m.vote_average.toFixed(1) : '';
    const genres = (m.genres || []).slice(0, 3).map((g) => g.name).join(' · ');
    
    document.getElementById('modal-meta').innerHTML = `
      <span style="background:var(--red);color:#fff;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;">${type === 'tv' ? 'TV Show' : 'Movie'}</span>
      ${year ? `<span>${year}</span>` : ''}
      ${runtime ? `<span>${runtime}</span>` : ''}
      ${rating ? `<span class="modal-rating">${rating}</span>` : ''}
      ${genres ? `<span>${genres}</span>` : ''}
    `;
    
    document.getElementById('modal-overview').innerText = m.overview || '';
    document.getElementById('modal-play').onclick = () => {
      window.location.href = `watch.html?id=${id}&type=${type}`;
    };
    
    // Trailer
    const trailer = (m.videos?.results || []).find((v) => v.type === 'Trailer' && v.site === 'YouTube') ||
      (m.videos?.results || []).find((v) => v.site === 'YouTube');
    const trailerBtn = document.getElementById('modal-trailer-btn');
    if (trailer) {
      trailerBtn.style.display = 'flex';
      trailerBtn.onclick = () => openTrailer(trailer.key, m.title || m.name);
    } else {
      trailerBtn.style.display = 'none';
    }
    
    // My List
    const inList = myList.some((x) => x.id === id);
    const mlBtn = document.getElementById('modal-mylist-btn');
    mlBtn.innerText = inList ? '✓ In My List' : '+ Add to My List';
    mlBtn.onclick = () => {
      const entry = { id, type, title: m.title || m.name, backdrop: m.backdrop_path, poster: m.poster_path };
      const idx = myList.findIndex((x) => x.id === id);
      if (idx > -1) {
        myList.splice(idx, 1);
        showToast('Removed from My List');
      } else {
        myList.push(entry);
        showToast('Added to My List');
      }
      localStorage.setItem('reelix-mylist', JSON.stringify(myList));
      closeModal();
    };
    
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

// ── Trailer ──
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
  document.body.style.overflow = '';
}

function closeTrailerOnBg(e) {
  if (e.target === document.getElementById('trailer-backdrop')) closeTrailer();
}

// ── Close on ESC ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeTrailer();
    searchWrap.classList.remove('open');
  }
});

// ── Filter functions ──
function filterGenre(id, btn, name) {
  document.querySelectorAll('.genre-pill').forEach((p) => p.classList.remove('active'));
  btn.classList.add('active');
}

function filterMediaType(type, btn) {
  document.querySelectorAll('.media-toggle-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
}

function seeAll(genre, name, type) {
  window.location.href = `browse.html?genre=${genre}&name=${encodeURIComponent(name)}&type=${type}`;
}

function goToPayment() {
  window.location.href = 'pricing.html';
}

// ── Initialize on page load ──
window.addEventListener('load', () => {
  renderContinueWatching(getLocalWatchHistory());
});
