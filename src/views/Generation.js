// /src/views/Generation.js
// Final version: integrates Gemini + Firestore.
// - Ensures room document exists (status: "generating").
// - Generates quiz questions, Jemima interludes, and Jemima maths via Netlify function.
// - Writes all seeds to Firestore under rooms/{code}/seed/*
// - Shows live progress; GO activates when 100% and moves to Countdown.

import { geminiCall } from '../lib/gemini.js';
import {
  initFirebase, ensureAuth, db, doc, collection, setDoc, getDoc, updateDoc
} from '../lib/firebase.js';
import { JEMIMA_MATH_INTERLUDES_SPEC, QUIZ_MECHANICS_SPEC } from '../specs.js';

export default function Generation(ctx = {}) {
  const navigate = (hash) => {
    if (ctx && typeof ctx.navigate === 'function') ctx.navigate(hash);
    else location.hash = hash;
  };

  // ---- Local helpers ----
  const get = (k, d = '') => {
    try { return localStorage.getItem(k) ?? d; } catch { return d; }
  };

  const keyRoom = safeJSON(get('keyRoom', '{}'));
  const hasGemini = !!(keyRoom?.geminiKey || getEnvGeminiHint()); // joiners may not have this locally
  const roomCode = (get('lastGameCode', '') || '').toUpperCase();

  // Root UI
  const wrap = document.createElement('div');
  wrap.className = 'center-stage';

  const box = document.createElement('div');
  box.style.textAlign = 'center';
  box.style.maxWidth = '860px';
  box.style.margin = '0 auto';

  const title = document.createElement('div');
  title.className = 'panel-title accent-white';
  title.textContent = 'GENERATING…';

  const sub = document.createElement('div');
  sub.className = 'note';
  sub.textContent = hasGemini
    ? `Seeding questions and Jemima passages for room ${roomCode || '—'}.`
    : 'Proceeding — host key or server env key will be used.';

  const statusCard = document.createElement('div');
  statusCard.className = 'card';
 
