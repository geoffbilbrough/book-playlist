require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

if (isProd) {
  app.set('trust proxy', 1); // trust Railway/Render's reverse proxy
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'book-playlist-dev-secret',
  resave: false,
  saveUninitialized: false,
  proxy: isProd,
  cookie: {
    secure: isProd,
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

// Rate limiting — max 5 playlist generations per IP per hour
const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);
app.get('/callback', authRoutes.handleCallback);
app.use('/api/analyze', analyzeLimiter);
app.use('/api', require('./routes/analyze'));
app.use('/api/spotify', require('./routes/spotify'));

if (isProd) {
  app.listen(PORT, () => console.log(`BookPlaylist running on port ${PORT}`));
} else {
  const https = require('https');
  const selfsigned = require('selfsigned');
  const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
    days: 365,
    keySize: 2048,
  });
  https.createServer({ key: pems.private, cert: pems.cert }, app).listen(PORT, () => {
    console.log(`\n✓ BookPlaylist running at https://localhost:${PORT}`);
    console.log('  Accept the self-signed certificate warning in your browser.\n');
  });
}
