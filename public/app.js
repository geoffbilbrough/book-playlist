let currentPlaylist = null;
let isAuthenticated = false;
let selectedEra = 'contemporary';

// ── Era pills ────────────────────────────────────────────────────────────────

document.getElementById('eraPills').addEventListener('click', (e) => {
  const pill = e.target.closest('.era-pill');
  if (!pill) return;
  document.querySelectorAll('.era-pill').forEach((p) => p.classList.remove('active'));
  pill.classList.add('active');
  selectedEra = pill.dataset.value;
});

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  try {
    const res = await fetch('/auth/status');
    const data = await res.json();
    isAuthenticated = data.authenticated;
    if (data.authenticated) {
      showUserInfo(data.user);
    } else {
      showLoginBtn();
    }
  } catch {
    showLoginBtn();
  }

  const params = new URLSearchParams(location.search);
  if (params.get('error')) {
    showError('Spotify login failed. Please try again.');
    history.replaceState({}, '', '/');
    return;
  }

  // Restore playlist after Spotify login
  const pending = sessionStorage.getItem('pendingPlaylist');
  if (pending && isAuthenticated) {
    sessionStorage.removeItem('pendingPlaylist');
    const { title, author, era, analysis, songs } = JSON.parse(pending);
    selectedEra = era;
    showLoading('Searching Spotify for your tracks…');
    try {
      const searchRes = await fetch('/api/spotify/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songs }),
      });
      const enrichedSongs = searchRes.ok ? (await searchRes.json()).results : songs;
      currentPlaylist = { title, author, songs: enrichedSongs };
      hideLoading();
      renderResults(analysis, enrichedSongs, title, author);
      showToast('Spotify connected — your playlist is ready to save!', 'success');
    } catch {
      currentPlaylist = { title, author, songs };
      hideLoading();
      renderResults(analysis, songs, title, author);
    }
  }
}

function showLoginBtn() {
  document.getElementById('loginBtn').classList.remove('hidden');
  document.getElementById('userInfo').classList.add('hidden');
}

function showUserInfo(user) {
  document.getElementById('loginBtn').classList.add('hidden');
  const userInfo = document.getElementById('userInfo');
  userInfo.classList.remove('hidden');
  document.getElementById('userName').textContent = user.display_name || user.id;
  updateSaveBtn();
}

function login() {
  location.href = '/auth/login';
}

// ── Form submit ──────────────────────────────────────────────────────────────

async function handleSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('bookTitle').value.trim();
  const author = document.getElementById('bookAuthor').value.trim();
  if (!title || !author) return;

  showLoading('Analysing your book…');
  hideResults();
  hideError();

  let analysisData;
  try {
    setLoadingText('Asking Claude to analyse the book…');
    const analyzeRes = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, author, era: selectedEra }),
    });

    if (!analyzeRes.ok) {
      const err = await analyzeRes.json().catch(() => ({}));
      throw new Error(err.error || 'Analysis failed.');
    }
    analysisData = await analyzeRes.json();
  } catch (err) {
    hideLoading();
    showError(err.message);
    return;
  }

  // Save state so we can restore it after Spotify login
  sessionStorage.setItem('pendingPlaylist', JSON.stringify({
    title, author, era: selectedEra,
    analysis: analysisData.analysis,
    songs: analysisData.songs,
  }));

  let songs = analysisData.songs || [];

  if (isAuthenticated && songs.length) {
    setLoadingText('Searching Spotify for your tracks…');
    try {
      const searchRes = await fetch('/api/spotify/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songs }),
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        songs = searchData.results;
      }
    } catch {
      // Non-fatal — render without Spotify data
    }
    sessionStorage.removeItem('pendingPlaylist');
  }

  currentPlaylist = { title, author, songs };
  hideLoading();
  renderResults(analysisData.analysis, songs, title, author);
  gtag('event', 'playlist_generated', { book_title: title, book_author: author, era: selectedEra });
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderResults(analysis, songs, title, author) {
  document.getElementById('analysisBook').textContent = `${title} — ${author}`;

  const grid = document.getElementById('analysisGrid');
  grid.innerHTML = '';

  const items = [
    { label: 'Mood', value: analysis.mood },
    { label: 'Setting', value: analysis.setting },
    { label: 'Era', value: analysis.era },
    { label: 'Characters', value: analysis.characters },
    { label: 'Themes', value: analysis.themes, isThemes: true, fullWidth: true },
  ];

  for (const item of items) {
    const div = document.createElement('div');
    div.className = `analysis-item${item.fullWidth ? ' full-width' : ''}`;
    div.innerHTML = `<div class="analysis-label">${item.label}</div>`;

    if (item.isThemes && Array.isArray(item.value)) {
      const themesList = document.createElement('div');
      themesList.className = 'themes-list';
      for (const theme of item.value) {
        const tag = document.createElement('span');
        tag.className = 'theme-tag';
        tag.textContent = theme.charAt(0).toUpperCase() + theme.slice(1).toLowerCase();
        themesList.appendChild(tag);
      }
      div.appendChild(themesList);
    } else {
      const val = document.createElement('div');
      val.className = 'analysis-value';
      val.textContent = item.value;
      div.appendChild(val);
    }

    grid.appendChild(div);
  }

  const songsGrid = document.getElementById('songsGrid');
  songsGrid.innerHTML = '';

  const found = songs.filter((s) => s.found !== false);
  document.getElementById('trackCount').textContent =
    isAuthenticated
      ? `${found.length}/${songs.length} on Spotify`
      : `${songs.length} songs`;

  songs.forEach((song, i) => {
    songsGrid.appendChild(buildSongCard(song, i + 1));
  });

  updateSaveBtn();
  document.getElementById('resultsSection').classList.remove('hidden');
}

function buildSongCard(song, n) {
  const card = document.createElement('div');
  card.className = `song-card${song.found === false ? ' not-found' : ''}`;

  const numEl = document.createElement('div');
  numEl.className = 'song-number';
  numEl.textContent = n;

  let artEl;
  if (song.album_art) {
    artEl = document.createElement('img');
    artEl.className = 'song-art';
    artEl.src = song.album_art;
    artEl.alt = '';
    artEl.loading = 'lazy';
  } else {
    artEl = document.createElement('div');
    artEl.className = 'song-art-placeholder';
    artEl.textContent = '♪';
  }

  const info = document.createElement('div');
  info.className = 'song-info';

  const titleRow = document.createElement('div');
  titleRow.className = 'song-title-row';

  const titleEl = document.createElement('span');
  titleEl.className = 'song-title';
  titleEl.textContent = song.spotify_title || song.title;

  const artistEl = document.createElement('span');
  artistEl.className = 'song-artist';
  artistEl.textContent = song.spotify_artist || song.artist;

  titleRow.appendChild(titleEl);
  titleRow.appendChild(artistEl);
  info.appendChild(titleRow);

  if (song.album) {
    const albumEl = document.createElement('div');
    albumEl.className = 'song-album';
    albumEl.textContent = song.album;
    info.appendChild(albumEl);
  }

  if (song.reason) {
    const reasonEl = document.createElement('div');
    reasonEl.className = 'song-reason';
    reasonEl.textContent = song.reason;
    info.appendChild(reasonEl);
  }

  const actions = document.createElement('div');
  actions.className = 'song-actions';

  if (song.external_url) {
    const link = document.createElement('a');
    link.className = 'spotify-link';
    link.href = song.external_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open ↗';
    actions.appendChild(link);
  } else if (song.found === false) {
    const badge = document.createElement('span');
    badge.className = 'not-found-badge';
    badge.textContent = 'Not found';
    actions.appendChild(badge);
  }

  card.appendChild(numEl);
  card.appendChild(artEl);
  card.appendChild(info);
  card.appendChild(actions);

  return card;
}

// ── Share playlist ───────────────────────────────────────────────────────────

async function sharePlaylist() {
  if (!currentPlaylist) return;

  const text = `I just created an AI playlist for "${currentPlaylist.title}" by ${currentPlaylist.author} 🎵`;
  const url = 'https://book-playlist-production.up.railway.app';

  if (navigator.share) {
    try {
      await navigator.share({ title: 'BookPlaylist', text, url });
    } catch {
      // User cancelled — do nothing
    }
  } else {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    showToast('Copied to clipboard!', 'success');
  }
}

// ── Save playlist ────────────────────────────────────────────────────────────

async function savePlaylist() {
  if (!currentPlaylist || !isAuthenticated) return;

  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.querySelector('svg').style.opacity = '0.5';

  try {
    const res = await fetch('/api/spotify/create-playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookTitle: currentPlaylist.title,
        bookAuthor: currentPlaylist.author,
        songs: currentPlaylist.songs,
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to save playlist.');

    gtag('event', 'playlist_saved', { book_title: currentPlaylist.title, book_author: currentPlaylist.author });
    showToast(
      `Playlist saved! <a href="${data.playlistUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">Open in Spotify ↗</a>`,
      'success',
    );
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.querySelector('svg').style.opacity = '';
  }
}

function updateSaveBtn() {
  const btn = document.getElementById('saveBtn');
  if (!btn) return;
  btn.disabled = !isAuthenticated || !currentPlaylist;
}

// ── UI helpers ───────────────────────────────────────────────────────────────

function showLoading(text) {
  setLoadingText(text);
  document.getElementById('loadingSection').classList.remove('hidden');
  document.getElementById('generateBtn').disabled = true;
}

function hideLoading() {
  document.getElementById('loadingSection').classList.add('hidden');
  document.getElementById('generateBtn').disabled = false;
}

function setLoadingText(text) {
  document.getElementById('loadingText').textContent = text;
}

function showError(msg) {
  document.getElementById('errorText').textContent = msg;
  document.getElementById('errorSection').classList.remove('hidden');
}

function hideError() {
  document.getElementById('errorSection').classList.add('hidden');
}

function hideResults() {
  document.getElementById('resultsSection').classList.add('hidden');
}

function resetUI() {
  hideError();
  hideResults();
  hideLoading();
  currentPlaylist = null;
  updateSaveBtn();
}

let toastTimer;
function showToast(html, type = '') {
  const toast = document.getElementById('toast');
  toast.innerHTML = html;
  toast.className = `toast${type ? ' ' + type : ''}`;
  toast.style.opacity = '1';

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 5000);
}

// ── Start ────────────────────────────────────────────────────────────────────

init();
