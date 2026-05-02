const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'https://localhost:3000/callback';
const SCOPES = 'playlist-modify-public playlist-modify-private user-read-private user-read-email';

function authHeader() {
  return `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;
}

// GET /auth/login — redirect user to Spotify OAuth
router.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.spotifyState = state;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// Callback handler — exported so server.js can mount it at /callback
async function handleCallback(req, res) {
  const { code, state, error } = req.query;

  if (error) return res.redirect('/?error=access_denied');

  if (!state || state !== req.session.spotifyState) {
    return res.redirect('/?error=state_mismatch');
  }

  try {
    const tokenRes = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: authHeader(),
        },
      },
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    req.session.spotifyTokens = {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
    };

    const profileRes = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    req.session.spotifyUser = {
      id: profileRes.data.id,
      display_name: profileRes.data.display_name || profileRes.data.id,
    };

    res.redirect('/');
  } catch (err) {
    console.error('Spotify callback error:', err.response?.data || err.message);
    res.redirect('/?error=auth_failed');
  }
}

router.get('/callback', handleCallback);

// GET /auth/logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// GET /auth/status — checked by frontend on page load
router.get('/status', (req, res) => {
  if (req.session.spotifyTokens && req.session.spotifyUser) {
    res.json({ authenticated: true, user: req.session.spotifyUser });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;
module.exports.handleCallback = handleCallback;
