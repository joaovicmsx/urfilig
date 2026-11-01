import { BACKEND_URL } from './authGuard.js';
import { invoke, isTauri } from '@tauri-apps/api/core';

const TOKEN_PREFIX = 'urfilig_spotify_session:';
const REDIRECT_URI = `http://127.0.0.1:${new URL(BACKEND_URL).port || '3000'}/api/spotify/callback`;
const el = (selector) => document.querySelector(selector);
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function getUserKey() {
  try { return JSON.parse(localStorage.getItem('urfilig_usuario') || '{}').id || 'local'; }
  catch { return 'local'; }
}

function formatTime(milliseconds = 0) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function iniciarSpotify() {
  const drawer = el('#spotify-drawer');
  const backdrop = el('#spotify-backdrop');
  const status = el('#spotify-status');
  const connectPanel = el('#spotify-connect-panel');
  const libraryPanel = el('#spotify-library-panel');
  const playlists = el('#spotify-playlists');
  const mini = el('#spotify-mini-player');
  if (!drawer || !backdrop || !playlists || !mini) return;

  let credentials = null;
  let player = null;
  let deviceId = null;
  let authPollTimer = null;
  let playbackPollTimer = null;
  let currentPlayback = null;
  let playbackDuration = 0;
  let sdkPromise = null;

  const say = (message) => {
    if (status) {
      status.textContent = message;
      status.classList.toggle('spotify-status-visible', Boolean(message));
    }
    const button = el('#spotify-connect');
    if (button && message) button.title = message;
  };
  const showConnection = (connected) => {
    const button = el('#spotify-connect');
    connectPanel.hidden = false;
    libraryPanel.hidden = true;
    button?.classList.toggle('conectado', connected);
    button?.setAttribute('aria-label', connected ? 'Spotify conectado' : 'Conectar ao Spotify');
    button?.setAttribute('title', connected ? 'Spotify conectado' : 'Conectar ao Spotify');
  };
  const tokenKey = () => `${TOKEN_PREFIX}${getUserKey()}`;
  const readCredentials = () => {
    try { return JSON.parse(localStorage.getItem(tokenKey()) || 'null'); }
    catch { return null; }
  };
  const saveCredentials = (value) => {
    credentials = value;
    localStorage.setItem(tokenKey(), JSON.stringify(value));
  };
  const api = async (path, options = {}) => {
    const token = localStorage.getItem('urfilig_token');
    const response = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.erro || 'Não foi possível concluir a solicitação.');
    return data;
  };

  async function validAccessToken() {
    credentials ||= readCredentials();
    if (!credentials?.refreshToken || !credentials?.clientId) throw new Error('Conecte sua conta Spotify novamente.');
    if (credentials.expiresAt > Date.now() + 60000) return credentials.accessToken;

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: credentials.refreshToken, client_id: credentials.clientId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
      localStorage.removeItem(tokenKey());
      credentials = null;
      throw new Error('A conexão expirou. Conecte a conta Spotify novamente.');
    }
    saveCredentials({
      ...credentials,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || credentials.refreshToken,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    });
    return credentials.accessToken;
  }

  async function spotifyApi(path, options = {}, retry = true) {
    const token = await validAccessToken();
    const response = await fetch(`https://api.spotify.com/v1/${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
    });
    if (response.status === 401 && retry) {
      credentials.expiresAt = 0;
      return spotifyApi(path, options, false);
    }
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 403) throw new Error('O Spotify exige Premium para reproduzir pelo mini player.');
      throw new Error(data.error?.message || 'O Spotify não concluiu esta ação.');
    }
    return data;
  }

  function updateTrack(track, playing = false, progress = 0) {
    currentPlayback = currentPlayback || {};
    currentPlayback.item = track || null;
    currentPlayback.is_playing = playing;
    currentPlayback.progress_ms = progress;
    playbackDuration = Number(track?.duration_ms) || 0;
    const artists = (track?.artists || []).map((artist) => artist.name).join(', ');
    const cover = track?.album?.images?.[0]?.url || track?.images?.[0]?.url || '';
    const name = track?.name || 'Nada tocando';
    const artistText = artists || (track ? 'Spotify' : 'Escolha uma playlist para começar');
    el('#spotify-track-name').textContent = name;
    el('#spotify-track-artists').textContent = artistText;
    el('#spotify-track-album').textContent = track?.album?.name || '';
    const art = el('#spotify-track-image');
    art.hidden = !cover;
    if (cover) art.src = cover;
    el('#spotify-track-placeholder').hidden = Boolean(cover);
    el('#spotify-mini-name').textContent = name;
    el('#spotify-mini-artist').textContent = artistText;
    const miniArt = el('#spotify-mini-image');
    miniArt.hidden = !cover;
    if (cover) miniArt.src = cover;
    el('#spotify-toggle').textContent = playing ? 'Pausar' : 'Reproduzir';
    el('#spotify-mini-toggle').textContent = playing ? 'Ⅱ' : '▶';
    el('#spotify-progress-current').textContent = formatTime(progress);
    el('#spotify-progress-total').textContent = formatTime(playbackDuration);
    el('#spotify-progress').value = playbackDuration ? String(Math.round(progress / playbackDuration * 1000)) : '0';
    mini.hidden = false;
  }

  function updatePlayback(state) {
    if (!state) {
      currentPlayback = null;
      updateTrack(null, false, 0);
      return;
    }
    currentPlayback = state;
    updateTrack(state.track_window?.current_track || state.item, !state.paused && state.is_playing !== false, state.position || state.progress_ms || 0);
  }

  async function loadCurrentPlayback() {
    try {
      const data = await spotifyApi('me/player');
      if (!data) { updateTrack(null, false, 0); return; }
      currentPlayback = data;
      updateTrack(data.item, Boolean(data.is_playing), data.progress_ms || 0);
    } catch (error) { say(error.message); }
  }

  function loadSdk() {
    if (window.Spotify?.Player) return Promise.resolve();
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('O player Spotify não carregou. Verifique a conexão e tente novamente.')), 18000);
      const previous = window.onSpotifyWebPlaybackSDKReady;
      window.onSpotifyWebPlaybackSDKReady = () => {
        window.clearTimeout(timeout);
        previous?.();
        resolve();
      };
      let script = document.querySelector('script[data-spotify-sdk]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        script.dataset.spotifySdk = 'true';
        script.onerror = () => { window.clearTimeout(timeout); reject(new Error('Não foi possível carregar o player do Spotify.')); };
        document.head.append(script);
      }
    });
    return sdkPromise;
  }

  async function initializePlayer() {
    if (player) return;
    await loadSdk();
    player = new window.Spotify.Player({
      name: 'Urfilig · Mini player',
      volume: Number(el('#spotify-volume').value) / 100,
      getOAuthToken: (callback) => validAccessToken().then(callback).catch((error) => say(error.message)),
    });
    player.addListener('ready', async ({ device_id: id }) => {
      deviceId = id;
      say('Player pronto na Urfilig. Escolha uma playlist para tocar.');
      await loadCurrentPlayback();
    });
    player.addListener('not_ready', () => { deviceId = null; say('O player Spotify ficou indisponível.'); });
    player.addListener('player_state_changed', (state) => { if (state) updatePlayback(state); });
    player.addListener('initialization_error', ({ message }) => say(`Não foi possível iniciar o player: ${message}`));
    player.addListener('authentication_error', ({ message }) => say(`Falha na autenticação Spotify: ${message}`));
    player.addListener('account_error', () => say('O player dentro da Urfilig exige uma conta Spotify Premium.'));
    player.addListener('playback_error', ({ message }) => say(`Falha ao reproduzir: ${message}`));
    await player.connect();
  }

  async function loadPlaylists() {
    playlists.replaceChildren(make('p', 'profile-message', 'Carregando playlists…'));
    try {
      const data = await spotifyApi('me/playlists?limit=50');
      playlists.replaceChildren();
      const items = (data?.items || []).filter(Boolean);
      if (!items.length) {
        playlists.append(make('p', 'profile-message', 'Nenhuma playlist disponível nesta conta.'));
        return;
      }
      for (const playlist of items) {
        const button = make('button', 'spotify-playlist');
        button.type = 'button';
        const image = document.createElement('img');
        image.alt = '';
        image.loading = 'lazy';
        image.src = playlist.images?.[0]?.url || '';
        image.hidden = !image.src;
        const copy = make('span', 'spotify-playlist-copy');
        copy.append(make('strong', '', playlist.name || 'Playlist'), make('small', '', `${playlist.tracks?.total ?? 0} faixas`));
        button.append(image, copy, make('span', 'spotify-playlist-play', '▶'));
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            if (!player) await initializePlayer();
            if (!deviceId) throw new Error('Aguarde o player Spotify ficar pronto.');
            await player.activateElement?.();
            await spotifyApi('me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play: false }) });
            await spotifyApi(`me/player/play?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT', body: JSON.stringify({ context_uri: playlist.uri }) });
            say(`Reproduzindo “${playlist.name}” na Urfilig.`);
            await loadCurrentPlayback();
          } catch (error) { say(error.message); }
          finally { button.disabled = false; }
        });
        playlists.append(button);
      }
    } catch (error) {
      playlists.replaceChildren(make('p', 'profile-message', error.message));
    }
  }

  async function togglePlayback() {
    if (!credentials) return say('Conecte sua conta Spotify primeiro.');
    try {
      if (!player) await initializePlayer();
      await player.activateElement?.();
      if (currentPlayback?.is_playing) {
        await spotifyApi('me/player/pause', { method: 'PUT' });
      } else if (deviceId) {
        await spotifyApi('me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play: false }) });
        await spotifyApi(`me/player/play?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' });
      }
      window.setTimeout(loadCurrentPlayback, 500);
    } catch (error) { say(error.message); }
  }

  async function playbackCommand(command) {
    if (!credentials) return say('Conecte sua conta Spotify primeiro.');
    try {
      await spotifyApi(`me/player/${command}`, { method: 'POST' });
      window.setTimeout(loadCurrentPlayback, 500);
    } catch (error) { say(error.message); }
  }

  async function disconnect() {
    window.clearInterval(playbackPollTimer);
    if (player) { await player.disconnect(); player = null; deviceId = null; }
    localStorage.removeItem(tokenKey());
    credentials = null;
    currentPlayback = null;
    mini.hidden = true;
    libraryPanel.hidden = true;
    connectPanel.hidden = false;
    say('Conta Spotify desconectada da Urfilig.');
    showConnection(false);
  }

  async function pollAuthorization(state, popup) {
    const started = Date.now();
    window.clearInterval(authPollTimer);
    authPollTimer = window.setInterval(async () => {
      if (Date.now() - started > 10 * 60 * 1000) {
        window.clearInterval(authPollTimer);
        popup?.close();
        say('A conexão expirou. Tente conectar novamente.');
        return;
      }
      try {
        const result = await api(`/api/spotify/auth/status?state=${encodeURIComponent(state)}`, { cache: 'no-store' });
        if (result.status === 'pending') return;
        window.clearInterval(authPollTimer);
        popup?.close();
        if (result.status !== 'connected') { say('A autorização não foi concluída. Confira o Redirect URI e tente novamente.'); return; }
        saveCredentials({
          clientId: result.clientId,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: Date.now() + result.expiresIn * 1000,
        });
        showConnection(true);
        mini.hidden = false;
        say('Conta Spotify conectada. Carregando suas playlists…');
        await Promise.allSettled([initializePlayer(), loadPlaylists(), loadCurrentPlayback()]);
        window.clearInterval(playbackPollTimer);
        playbackPollTimer = window.setInterval(loadCurrentPlayback, 8000);
      } catch (error) {
        window.clearInterval(authPollTimer);
        popup?.close();
        say(error.message || 'Não foi possível verificar a autorização Spotify.');
      }
    }, 1200);
  }

  async function connectSpotify() {
    const popup = isTauri() ? null : window.open('about:blank', 'urfilig-spotify-auth', 'popup,width=520,height=720');
    say('Abrindo autorização segura do Spotify…');
    el('#spotify-connect').disabled = true;
    try {
      const result = await api('/api/spotify/auth/start', { method: 'POST' });
      if (isTauri()) await invoke('abrir_url_externa', { url: result.authorizationUrl });
      else if (popup) popup.location.href = result.authorizationUrl;
      else throw new Error('O navegador bloqueou a janela de autorização. Permita pop-ups e tente novamente.');
      say('Autorize o acesso na janela do Spotify. Esta tela seguirá aguardando o retorno.');
      pollAuthorization(result.state, popup);
    } catch (error) {
      popup?.close();
      say(error.message);
    } finally { el('#spotify-connect').disabled = false; }
  }

  function openDrawer() {
    document.querySelectorAll('.profile-drawer.aberta, .sidebar-cerebro.aberta, .sidebar.aberta').forEach((panel) => panel.classList.remove('aberta'));
    document.querySelectorAll('.profile-backdrop.visible').forEach((panel) => panel.classList.remove('visible'));
    el('#email-painel')?.classList.remove('aberta');
    el('#calendario-painel')?.classList.remove('aberta');
    el('#menu-lateral')?.classList.remove('visible', 'aberto', 'active');
    drawer.classList.add('aberta');
    backdrop.classList.add('visible');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.setAttribute('aria-hidden', 'false');
    credentials = readCredentials();
    if (credentials) {
      showConnection(true);
      mini.hidden = false;
      Promise.allSettled([initializePlayer(), loadPlaylists(), loadCurrentPlayback()]);
      if (!playbackPollTimer) playbackPollTimer = window.setInterval(loadCurrentPlayback, 8000);
    } else {
      showConnection(false);
    }
    el('#spotify-back')?.focus();
  }

  function closeDrawer() {
    drawer.classList.remove('aberta');
    backdrop.classList.remove('visible');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.setAttribute('aria-hidden', 'true');
  }

  credentials = readCredentials();
  if (credentials) {
    showConnection(true);
    mini.hidden = false;
    Promise.allSettled([initializePlayer(), loadCurrentPlayback()]);
    playbackPollTimer = window.setInterval(loadCurrentPlayback, 8000);
  } else showConnection(false);

  el('#nav-spotify')?.addEventListener('click', openDrawer);
  el('#spotify-back')?.addEventListener('click', closeDrawer);
  el('#spotify-close')?.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);
  document.querySelectorAll('.hud-nav .nav-item:not(#nav-spotify)').forEach((item) => item.addEventListener('click', closeDrawer, { capture: true }));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDrawer(); });
  el('#spotify-connect')?.addEventListener('click', connectSpotify);
  el('#spotify-disconnect')?.addEventListener('click', disconnect);
  el('#spotify-refresh')?.addEventListener('click', () => { loadPlaylists(); loadCurrentPlayback(); });
  el('#spotify-toggle')?.addEventListener('click', togglePlayback);
  el('#spotify-mini-toggle')?.addEventListener('click', togglePlayback);
  el('#spotify-mini-open')?.addEventListener('click', openDrawer);
  el('#spotify-previous')?.addEventListener('click', () => playbackCommand('previous'));
  el('#spotify-next')?.addEventListener('click', () => playbackCommand('next'));
  el('#spotify-volume')?.addEventListener('input', async (event) => {
    if (player) await player.setVolume(Number(event.currentTarget.value) / 100).catch(() => {});
  });
  el('#spotify-progress')?.addEventListener('change', async (event) => {
    if (!player || !playbackDuration) return;
    await player.seek(Math.round(Number(event.currentTarget.value) / 1000 * playbackDuration)).catch((error) => say(error.message));
  });
  el('#spotify-copy-redirect')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(REDIRECT_URI);
      say('Endereço de retorno copiado.');
    } catch { say(`Cadastre este endereço: ${REDIRECT_URI}`); }
  });
}
