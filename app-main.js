/**
 * Reelix - Main App Logic (Unified API Proxy & Optimized)
 */

// Image Base URLs (These remain public as they are just CDNs)
const IMG_W = 'https://image.tmdb.org/t/p/w500';
const IMG_W342 = 'https://image.tmdb.org/t/p/w342';
const IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';

// Update this to your deployed Cloudflare Worker URL
const WORKER_TMDB_PROXY = "https://reelix.wooskinner.workers.dev/tmdb";

/**
 * Unified API Proxy Helper
 * Secures the API Key by fetching through Cloudflare Worker
 */
async function fetchProxy(endpoint, params = "") {
  const url = `${WORKER_TMDB_PROXY}/${endpoint}${params}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("API Proxy error");
    return await response.json();
  } catch (err) {
    console.error("Fetch failed:", err);
    return null;
  }
}

let myList = JSON.parse(localStorage.getItem('reelix-mylist') || '[]');

// ── Search with debouncing ──
const searchWrap = document.getElementById('search-wrap');
const searchInput = document.getElementById('search');
const searchToggle = document.getElementById('search-toggle');
const searchResults = document.getElementById('search-results');

if (searchToggle) {
  searchToggle.addEventListener('click', () => {
    searchWrap.classList.toggle('open');
    if (searchWrap.classList.contains('open')) {
      searchInput.focus();
    }
  });
}

let searchTimeout;
if (searchInput) {
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

async function performSearch(query) {
  // Use Proxy instead of direct TMDB call
  const data = await fetchProxy('search/multi', `?query=${encodeURIComponent(query)}`);
  if (data) {
    renderSearchResults(data.results || []);
    searchResults.classList.add('active');
  }
}

function renderSearchResults(items) {
  const grid = document.getElementById('search-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
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
window.scrollRow = function(rowId, direction) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const scrollAmount = 260 * direction;
  row.scrollBy({ left: scrollAmount, behavior: 'smooth' });
};

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
  
  const overlay = document.createElement('div');
  overlay.className = 'card-overlay';
  overlay.innerHTML = `<div class="card-title">${title}</div>`;
  div.appendChild(overlay);
  
  const playBtn = document.createElement('div');
  playBtn.className = 'card-play-btn';
  playBtn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  div.appendChild(playBtn);
  
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

// ── My List Logic ──
window.openMyList = function() {
  const panel = document.getElementById('mylist-panel');
  const content = document.getElementById('mylist-content');
  if (!panel || !content) return;
  
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
      div.querySelector('.mylist-item-rm').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromList(item.id);
        window.openMyList();
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
};

window.closeMyList = function() {
  const panel = document.getElementById('mylist-panel');
  if (panel) panel.classList.remove('open');
  document.body.style.overflow = '';
};

function quickAddList(id, type, backdrop, title) {
  const idx = myList.findIndex((x) => x.id === id);
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
  myList = myList.filter((x) => x.id !== id);
  localStorage.setItem('reelix-mylist', JSON.stringify(myList));
}

// ── Toast ──
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ── Modal ──
async function openModal(id, type) {
  // Use Proxy for detailed info
  const m = await fetchProxy(`${type}/${id}`, `?append_to_response=videos`);
  if (!m) return;

  const modalImg = document.getElementById('modal-img');
  const modalTitle = document.getElementById('modal-title');
  const modalMeta = document.getElementById('modal-meta');
  const modalOverview = document.getElementById('modal-overview');
  const modalPlay = document.getElementById('modal-play');

  if (modalImg) modalImg.src = m.backdrop_path ? IMG_ORIGINAL + m.backdrop_path : (m.poster_path ? IMG_W + m.poster_path : '');
  if (modalTitle) modalTitle.innerText = m.title || m.name || '';
  
  const year = (m.release_date || m.first_air_date || '').slice(0, 4);
  const runtime = m.runtime ? `${Math.floor(m.runtime / 60)}h ${m.runtime % 60}m` : (m.number_of_seasons ? `${m.number_of_seasons} Season${m.number_of_seasons > 1 ? 's' : ''}` : '');
  const rating = m.vote_average ? '★ ' + m.vote_average.toFixed(1) : '';
  const genres = (m.genres || []).slice(0, 3).map((g) => g.name).join(' · ');
  
  if (modalMeta) {
    modalMeta.innerHTML = `
      <span style="background:var(--red);color:#fff;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;">${type === 'tv' ? 'TV' : 'MOVIE'}</span>
      ${year ? `<span>${year}</span>` : ''}
      ${runtime ? `<span>${runtime}</span>` : ''}
      ${rating ? `<span class="modal-rating">${rating}</span>` : ''}
      ${genres ? `<span>${genres}</span>` : ''}
    `;
  }
  
  if (modalOverview) modalOverview.innerText = m.overview || '';
  if (modalPlay) {
    modalPlay.onclick = () => {
      window.location.href = `watch.html?id=${id}&type=${type}`;
    };
  }
  
  // Trailer
  const trailer = (m.videos?.results || []).find((v) => v.type === 'Trailer' && v.site === 'YouTube');
  const trailerBtn = document.getElementById('modal-trailer-btn');
  if (trailer && trailerBtn) {
    trailerBtn.style.display = 'flex';
    trailerBtn.onclick = () => openTrailer(trailer.key, m.title || m.name);
  } else if (trailerBtn) {
    trailerBtn.style.display = 'none';
  }
  
  const modal = document.getElementById('modal');
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

window.closeModal = function() {
  const modal = document.getElementById('modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
};

// ── Trailer ──
function openTrailer(key, title) {
  const label = document.getElementById('trailer-title-label');
  const container = document.getElementById('trailer-container');
  const backdrop = document.getElementById('trailer-backdrop');

  if (label) label.innerText = title || 'Trailer';
  if (container) container.innerHTML = `<iframe src="https://www.youtube.com/embed/${key}?autoplay=1&rel=0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  if (backdrop) backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

window.closeTrailer = function() {
  const backdrop = document.getElementById('trailer-backdrop');
  const container = document.getElementById('trailer-container');
  if (backdrop) backdrop.classList.remove('open');
  if (container) container.innerHTML = '';
  document.body.style.overflow = '';
};

// ── Event Listeners ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.closeModal();
    window.closeTrailer();
    if (searchWrap) searchWrap.classList.remove('open');
  }
});

window.addEventListener('load', () => {
  renderContinueWatching(getLocalWatchHistory());
});
