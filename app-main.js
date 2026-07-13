/**
 * Reelix - Main App Logic (Optimized)
 * - DOM batching with DocumentFragment
 * - Debounced event handlers
 * - Responsive images with srcset
 * - Efficient modal and list rendering
 */

const IMG_W = 'https://image.tmdb.org/t/p/w500';
const IMG_W342 = 'https://image.tmdb.org/t/p/w342';
const IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';
const API_KEY = '1d3ae144acfb6bfcb25f70361cedcf29';

let myList = JSON.parse(localStorage.getItem('reelix-mylist') || '[]');

// ── Search with debouncing ──
const searchWrap = document.getElementById('search-wrap');
const searchInput = document.getElementById('search');
const searchToggle = document.getElementById('search-toggle');
const searchResults = document.getElementById('search-results');

searchToggle.addEventListener('click', () => {
  searchWrap.classList.toggle('open');
  if (searchWrap.classList.contains('open')) {
    searchInput.focus();
  }
});

let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim().toLowerCase();
  
  if (!query) {
    searchResults.classList.remove('active');
    return;
  }
  
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
