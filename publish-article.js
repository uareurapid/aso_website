#!/usr/bin/env node
/**
 * publish-article.js — ASO Blog Article Publisher
 *
 * Converts an ASO Blog markdown file into a full website article page.
 * Also updates blog/index.html (featured card, grid cards, article count)
 * and sitemap.xml.
 *
 * Usage:
 *   node publish-article.js <path-to-markdown> [--slug <custom-slug>]
 *
 * Examples:
 *   node publish-article.js ../ASO_BLOG/2026-05-10-5-keyword-mistakes-killing-app-visibility.md
 *   node publish-article.js ../ASO_BLOG/2026-05-10-foo.md --slug my-custom-slug
 *
 * Run from the aso_website/ directory.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ── Paths ────────────────────────────────────────────────────────────────────
const SITE_DIR     = __dirname;
const BLOG_DIR     = path.join(SITE_DIR, 'blog');
const ARTICLES_DIR = path.join(BLOG_DIR, 'articles');
const BLOG_INDEX   = path.join(BLOG_DIR, 'index.html');
const SITEMAP      = path.join(SITE_DIR, 'sitemap.xml');
const BASE_URL     = 'https://www.cristomade.it';

// ── CLI ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (!argv[0]) {
  console.error('Usage: node publish-article.js <markdown-file> [--slug <slug>]');
  process.exit(1);
}
const mdFile    = path.resolve(argv[0]);
const slugIdx   = argv.indexOf('--slug');
const forceSlug = slugIdx !== -1 ? argv[slugIdx + 1] : null;

if (!fs.existsSync(mdFile)) {
  console.error(`File not found: ${mdFile}`);
  process.exit(1);
}

// ── Read markdown ────────────────────────────────────────────────────────────
const rawMd   = fs.readFileSync(mdFile, 'utf8');
const mdLines = rawMd.split('\n');

// ── Metadata helpers ─────────────────────────────────────────────────────────
function extractTitle(lines) {
  const l = lines.find(l => /^# /.test(l));
  return l ? l.replace(/^# /, '').trim() : 'Untitled';
}

function extractDate(filename) {
  const m = path.basename(filename).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : new Date().toISOString().slice(0, 10);
}

function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function deriveSlug(filename, override) {
  if (override) return override;
  let s = path.basename(filename, '.md');
  s = s.replace(/^\d{4}-\d{2}-\d{2}-/, ''); // strip date prefix
  s = s.replace(/^\d+-/, '');                 // strip leading "5-" style numbers
  return s;
}

function calcReadTime(text) {
  const words = text.trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function deriveCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('algorithm') || (t.includes('how') && t.includes('work'))) return 'ASO Fundamentals';
  if (t.includes('keyword') || t.includes('mistake')) return 'Keyword Strategy';
  if (t.includes('competitor'))  return 'Competitor Intel';
  if (t.includes('screenshot') || t.includes('visual') || t.includes('icon') || t.includes('preview') || t.includes('video')) return 'Visual ASO';
  if (t.includes('review') || t.includes('rating'))  return 'Reviews & Ratings';
  if (t.includes('local'))       return 'Localization';
  if (t.includes('metric') || t.includes('analytic') || t.includes('measur')) return 'Analytics';
  if (t.includes('long-tail') || t.includes('long tail')) return 'Keyword Strategy';
  if (t.includes('seasonal'))    return 'Advanced ASO';
  if (t.includes('categor'))     return 'Advanced ASO';
  return 'ASO Guide';
}

function categoryStyles(cat) {
  if (cat === 'Keyword Strategy') return {
    color: 'var(--accent-2)',
    bg: 'rgba(255,209,102,0.08)',
    border: 'rgba(255,209,102,0.2)',
  };
  if (cat === 'Competitor Intel') return {
    color: 'var(--accent-1)',
    bg: 'rgba(94,236,192,0.07)',
    border: 'rgba(94,236,192,0.2)',
  };
  // default purple (ASO Fundamentals, etc.)
  return {
    color: 'var(--accent-3)',
    bg: 'rgba(124,111,255,0.1)',
    border: 'rgba(124,111,255,0.2)',
  };
}

function categoryIcon(cat) {
  const map = {
    'ASO Fundamentals':  '🔍',
    'Keyword Strategy':  '🔑',
    'Competitor Intel':  '⚔️',
    'Visual ASO':        '🎨',
    'Reviews & Ratings': '⭐',
    'Localization':      '🌍',
    'Analytics':         '📊',
    'Advanced ASO':      '🚀',
    'ASO Guide':         '📋',
  };
  return map[cat] || '📋';
}

// ── Inline markdown → HTML ────────────────────────────────────────────────────
function inlineMd(text) {
  // Links first: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Bold: **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* (single asterisk, not touching double)
  text = text.replace(/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Inline code: `code`
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  return text;
}

// ── Body markdown → HTML ──────────────────────────────────────────────────────
function convertBody(lines, skipSet) {
  let out   = '';
  let state = 'none'; // none | p | ul | ol
  let buf   = [];

  const flush = () => {
    if (!buf.length) return;
    if (state === 'p') {
      out += `    <p>${inlineMd(buf.join(' '))}</p>\n`;
    } else if (state === 'ul') {
      out += '    <ul>\n';
      buf.forEach(item => { out += `      <li>${inlineMd(item)}</li>\n`; });
      out += '    </ul>\n';
    } else if (state === 'ol') {
      out += '    <ol>\n';
      buf.forEach(item => { out += `      <li>${inlineMd(item)}</li>\n`; });
      out += '    </ol>\n';
    }
    buf = []; state = 'none';
  };

  for (let i = 0; i < lines.length; i++) {
    if (skipSet.has(i)) continue;
    const trimmed = lines[i].trim();

    if (!trimmed) { flush(); continue; }

    if (trimmed === '---') { flush(); out += '    <hr />\n'; continue; }

    if (/^#### /.test(trimmed)) { flush(); out += `    <h3>${inlineMd(trimmed.slice(5))}</h3>\n`; continue; }
    if (/^### /.test(trimmed))  { flush(); out += `    <h3>${inlineMd(trimmed.slice(4))}</h3>\n`; continue; }
    if (/^## /.test(trimmed))   { flush(); out += `    <h2>${inlineMd(trimmed.slice(3))}</h2>\n`; continue; }

    if (/^[-*] /.test(trimmed)) {
      if (state !== 'ul') { flush(); state = 'ul'; }
      buf.push(trimmed.replace(/^[-*] /, ''));
      continue;
    }
    if (/^\d+\. /.test(trimmed)) {
      if (state !== 'ol') { flush(); state = 'ol'; }
      buf.push(trimmed.replace(/^\d+\. /, ''));
      continue;
    }

    if (state !== 'p') { flush(); state = 'p'; }
    buf.push(trimmed);
  }

  flush();
  return out;
}

// ── Find lede paragraph and build skip set ────────────────────────────────────
function findLedeAndSkips(lines) {
  const skip = new Set();

  // Title line
  for (let i = 0; i < lines.length; i++) {
    if (/^# /.test(lines[i])) { skip.add(i); break; }
  }
  // Published/date metadata line
  for (let i = 0; i < lines.length; i++) {
    if (/^\*Published:/.test(lines[i].trim())) { skip.add(i); break; }
  }
  // Leading --- separator
  for (let i = 0; i < lines.length; i++) {
    if (skip.has(i)) continue;
    if (lines[i].trim() === '---') { skip.add(i); }
    else if (lines[i].trim() !== '') break;
  }

  // First real paragraph = lede
  let ledeLines = [];
  let ledeStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (skip.has(i)) continue;
    const t = lines[i].trim();
    if (!t || t === '---' || /^#/.test(t)) continue;
    ledeStart = i;
    for (let j = i; j < lines.length; j++) {
      const l = lines[j].trim();
      if (!l) break;
      ledeLines.push(l);
      skip.add(j);
    }
    // Also skip the blank line right after lede
    const after = ledeStart + ledeLines.length;
    if (after < lines.length && lines[after].trim() === '') skip.add(after);
    break;
  }

  return { skip, lede: ledeLines.join(' ') };
}

// ── Extract tags ──────────────────────────────────────────────────────────────
function extractTags(title, category, raw) {
  const tags = [category, 'App Store Optimization', 'iOS Dev'];
  if (/keyword/i.test(raw))    tags.push('Keyword Strategy');
  if (/indie/i.test(raw))      tags.push('Indie Developer');
  if (/ranking/i.test(raw))    tags.push('App Discovery');
  if (/competitor/i.test(raw)) tags.push('Competitor Analysis');
  if (/review|rating/i.test(raw)) tags.push('Reviews');
  if (/conversion/i.test(raw)) tags.push('Conversion Rate');
  if (/long.tail/i.test(raw))  tags.push('Long-tail Keywords');
  return [...new Set(tags)].slice(0, 6);
}

// ── HTML escaping ─────────────────────────────────────────────────────────────
function esc(s)     { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escA(s)    { return esc(s).replace(/"/g,'&quot;'); }
function escJSON(s) { return s.replace(/\\/g,'\\\\').replace(/"/g,'\\"'); }

// ── Build article HTML page ───────────────────────────────────────────────────
function buildArticlePage({ title, rawDate, dateFormatted, readTime, slug, articleUrl, lede, bodyHtml, tags, category }) {
  const metaDesc  = lede.replace(/<[^>]+>/g, '').slice(0, 155).replace(/\s+\S*$/, '...');
  const catStyle  = categoryStyles(category);
  const tagsHtml  = tags.map(t => `      <span class="tag">${esc(t)}</span>`).join('\n');
  const crumb     = title.length > 45 ? title.slice(0, 42) + '…' : title;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} — ASO Analytics Blog</title>
  <meta name="description" content="${escA(metaDesc)}" />
  <meta name="author" content="CristoMade" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${articleUrl}" />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${articleUrl}" />
  <meta property="og:title" content="${escA(title)}" />
  <meta property="og:description" content="${escA(metaDesc)}" />
  <meta property="og:image" content="https://www.cristomade.it/og-image.png" />
  <meta property="og:site_name" content="ASO Analytics by CristoMade" />
  <meta property="article:published_time" content="${rawDate}" />
  <meta property="article:author" content="CristoMade" />
  <meta property="article:tag" content="ASO" />
  <meta property="article:tag" content="App Store Optimization" />
  <meta property="article:tag" content="iOS development" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escA(title)}" />
  <meta name="twitter:description" content="${escA(metaDesc)}" />
  <meta name="twitter:image" content="https://www.cristomade.it/og-image.png" />

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap" rel="stylesheet" />

  <!-- Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${escJSON(title)}",
    "description": "${escJSON(metaDesc)}",
    "url": "${articleUrl}",
    "datePublished": "${rawDate}",
    "author": { "@type": "Organization", "name": "CristoMade", "url": "https://www.cristomade.it/" },
    "publisher": { "@type": "Organization", "name": "CristoMade", "url": "https://www.cristomade.it/" }
  }
  </script>

  <style>
    :root {
      --ink:       #0e0f11;
      --ink-2:     #1c1d21;
      --ink-3:     #2d2e35;
      --muted:     #6b7280;
      --muted-2:   #9ca3af;
      --line:      rgba(255,255,255,0.07);
      --white:     #ffffff;
      --accent-1:  #5eecc0;
      --accent-2:  #ffd166;
      --accent-3:  #7c6fff;
      --serif:     'DM Serif Display', Georgia, serif;
      --sans:      'DM Sans', system-ui, sans-serif;
      --mono:      'DM Mono', 'Fira Code', monospace;
      --radius:    10px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { font-family: var(--sans); background: var(--ink); color: var(--white); line-height: 1.6; overflow-x: hidden; }
    img { max-width: 100%; display: block; }
    a { color: inherit; text-decoration: none; }
    body::before {
      content: '';
      position: fixed; inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
      opacity: 0.028; pointer-events: none; z-index: 1000;
    }

    .wrap { max-width: 1160px; margin: 0 auto; padding: 0 24px; }

    /* Nav */
    .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 18px 0; transition: background 0.3s, backdrop-filter 0.3s; }
    .nav.scrolled { background: rgba(14,15,17,.88); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border-bottom: 1px solid var(--line); }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; }
    .logo { display: flex; align-items: center; }
    .logo img { height: 52px; width: auto; display: block; }
    .nav-links { display: flex; align-items: center; gap: 32px; list-style: none; }
    .nav-links a { font-size: 14px; font-weight: 500; color: var(--muted-2); transition: color 0.2s; }
    .nav-links a:hover, .nav-links a.active { color: var(--white); }
    .nav-cta { background: var(--white); color: var(--ink) !important; padding: 8px 20px; border-radius: 999px; font-size: 14px; font-weight: 600 !important; transition: opacity 0.2s !important; }
    .nav-cta:hover { opacity: 0.85; }
    .nav-hamburger { display: none; flex-direction: column; gap: 5px; cursor: pointer; padding: 4px; }
    .nav-hamburger span { width: 22px; height: 2px; background: var(--white); border-radius: 2px; }
    .mobile-nav { display: none; position: fixed; inset: 0; background: rgba(14,15,17,.97); z-index: 99; flex-direction: column; align-items: center; justify-content: center; gap: 32px; }
    .mobile-nav.open { display: flex; }
    .mobile-nav a { font-size: 24px; font-family: var(--serif); color: var(--white); transition: color 0.2s; }
    .mobile-nav a:hover { color: var(--accent-1); }
    .mobile-nav-close { position: absolute; top: 24px; right: 24px; font-size: 24px; cursor: pointer; color: var(--muted-2); }

    /* Article header */
    .article-header { padding: 140px 24px 64px; max-width: 760px; margin: 0 auto; }
    .article-breadcrumb { display: flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 12px; color: var(--muted); margin-bottom: 28px; }
    .article-breadcrumb a { color: var(--muted); transition: color 0.2s; }
    .article-breadcrumb a:hover { color: var(--accent-1); }
    .article-breadcrumb span { color: var(--muted); opacity: 0.4; }
    .article-meta { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; flex-wrap: wrap; }
    .article-category {
      font-family: var(--mono); font-size: 10px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase;
      color: ${catStyle.color}; background: ${catStyle.bg}; border: 1px solid ${catStyle.border}; padding: 3px 10px; border-radius: 4px;
    }
    .article-date { font-family: var(--mono); font-size: 12px; color: var(--muted); }
    .article-readtime { font-family: var(--mono); font-size: 12px; color: var(--muted); }
    .article-readtime::before { content: '·'; margin-right: 14px; }
    .article-header h1 { font-family: var(--serif); font-size: clamp(32px, 5vw, 54px); font-weight: 400; line-height: 1.15; margin-bottom: 24px; color: var(--white); }
    .article-header .lede { font-size: 18px; color: var(--muted-2); line-height: 1.75; font-weight: 300; border-left: 3px solid var(--accent-1); padding-left: 20px; }

    .article-divider { max-width: 760px; margin: 0 auto; padding: 0 24px; border-bottom: 1px solid var(--line); }

    /* Body */
    .article-body { max-width: 760px; margin: 0 auto; padding: 64px 24px; }
    .article-body p { font-size: 16px; line-height: 1.85; color: var(--muted-2); font-weight: 300; margin-bottom: 24px; }
    .article-body p strong { color: var(--white); font-weight: 600; }
    .article-body h2 { font-family: var(--serif); font-size: clamp(22px, 3vw, 32px); font-weight: 400; color: var(--white); margin-top: 56px; margin-bottom: 18px; line-height: 1.2; }
    .article-body h3 { font-size: 17px; font-weight: 600; color: var(--white); margin-top: 32px; margin-bottom: 14px; }
    .article-body ul, .article-body ol { padding-left: 0; list-style: none; margin-bottom: 24px; display: flex; flex-direction: column; gap: 10px; }
    .article-body ul li { font-size: 15px; color: var(--muted-2); font-weight: 300; line-height: 1.7; padding-left: 20px; position: relative; }
    .article-body ul li::before { content: '✦'; position: absolute; left: 0; color: var(--accent-1); font-size: 9px; top: 6px; }
    .article-body ul li strong { color: var(--white); font-weight: 600; }
    .article-body ol { counter-reset: list; }
    .article-body ol li { font-size: 15px; color: var(--muted-2); font-weight: 300; line-height: 1.7; padding-left: 28px; position: relative; counter-increment: list; }
    .article-body ol li::before { content: counter(list); position: absolute; left: 0; color: var(--accent-1); font-family: var(--mono); font-size: 12px; font-weight: 500; top: 3px; width: 18px; text-align: right; }
    .article-body ol li strong { color: var(--white); font-weight: 600; }
    .article-body hr { border: none; border-top: 1px solid var(--line); margin: 48px 0; }
    .article-body a { color: var(--accent-1); text-decoration: underline; text-underline-offset: 3px; transition: opacity 0.2s; }
    .article-body a:hover { opacity: 0.8; }
    .article-body em { font-style: italic; }
    .article-body code { font-family: var(--mono); font-size: 13px; background: rgba(255,255,255,0.08); padding: 2px 7px; border-radius: 4px; color: var(--accent-1); }

    /* End / CTA */
    .article-end { max-width: 760px; margin: 0 auto; padding: 0 24px 80px; }
    .article-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 48px; }
    .tag { font-family: var(--mono); font-size: 11px; color: var(--muted); background: rgba(255,255,255,0.06); border: 1px solid var(--line); padding: 4px 12px; border-radius: 999px; letter-spacing: 0.05em; }
    .article-cta { background: var(--ink-2); border: 1px solid rgba(94,236,192,.2); border-radius: 14px; padding: 36px 40px; display: flex; align-items: center; justify-content: space-between; gap: 24px; position: relative; overflow: hidden; }
    .article-cta::before { content: ''; position: absolute; left: -40px; top: -40px; width: 180px; height: 180px; background: radial-gradient(circle, rgba(94,236,192,.1), transparent 65%); pointer-events: none; }
    .article-cta-text h3 { font-size: 18px; font-weight: 600; margin-bottom: 6px; }
    .article-cta-text p { font-size: 14px; color: var(--muted-2); font-weight: 300; max-width: 380px; }
    .btn-primary { display: inline-flex; align-items: center; gap: 8px; background: var(--accent-1); color: var(--ink); font-weight: 700; font-size: 15px; padding: 13px 24px; border-radius: 999px; transition: transform .2s, box-shadow .2s; box-shadow: 0 0 28px rgba(94,236,192,.28); white-space: nowrap; flex-shrink: 0; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 44px rgba(94,236,192,.42); }
    .next-article { margin-top: 40px; padding: 24px 0; border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .next-label { font-family: var(--mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
    .next-title { font-size: 15px; font-weight: 500; color: var(--muted-2); max-width: 480px; }
    .next-arrow { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--accent-1); white-space: nowrap; flex-shrink: 0; }
    .back-link { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); transition: color .2s; margin-bottom: 40px; }
    .back-link:hover { color: var(--accent-1); }

    /* Footer */
    footer { border-top: 1px solid var(--line); padding: 48px 0; }
    .footer-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; }
    .footer-left { font-size: 13px; color: var(--muted); }
    .footer-left a { color: var(--muted-2); text-decoration: underline; text-underline-offset: 3px; }
    .footer-right { display: flex; gap: 24px; }
    .footer-right a { font-size: 13px; color: var(--muted); transition: color .2s; }
    .footer-right a:hover { color: var(--white); }

    .progress-bar { position: fixed; top: 0; left: 0; height: 2px; width: 0%; background: linear-gradient(90deg, var(--accent-1), var(--accent-3)); z-index: 200; transition: width .1s linear; }

    @media (max-width: 768px) {
      .nav-links { display: none; }
      .nav-hamburger { display: flex; }
      .article-cta { flex-direction: column; align-items: flex-start; padding: 28px; }
      .next-article { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>

<div class="progress-bar" id="progressBar" aria-hidden="true"></div>

<nav class="mobile-nav" id="mobileNav" aria-label="Mobile navigation">
  <span class="mobile-nav-close" onclick="toggleMobileNav()" aria-label="Close menu">✕</span>
  <a href="/#features" onclick="toggleMobileNav()">Features</a>
  <a href="/#pricing" onclick="toggleMobileNav()">Pricing</a>
  <a href="/#faq" onclick="toggleMobileNav()">FAQ</a>
  <a href="/blog/" onclick="toggleMobileNav()">Blog</a>
  <a href="https://aso.cristomade.it/" class="btn-primary" style="font-size:16px;margin-top:8px;">Start Free</a>
</nav>

<header class="nav" id="mainNav" role="banner">
  <div class="wrap nav-inner">
    <a href="/" class="logo" aria-label="ASO Analytics home">
      <img src="/ASO_WEBSITE_BANNER_2.svg" alt="ASO Analytics" width="130" height="40" />
    </a>
    <ul class="nav-links" role="list">
      <li><a href="/#features">Features</a></li>
      <li><a href="/#pricing">Pricing</a></li>
      <li><a href="/#faq">FAQ</a></li>
      <li><a href="/blog/" class="active">Blog</a></li>
      <li><a href="https://aso.cristomade.it/auth/login">Sign in</a></li>
      <li><a href="https://aso.cristomade.it/auth/register" class="nav-cta">Get started free</a></li>
    </ul>
    <button class="nav-hamburger" onclick="toggleMobileNav()" aria-label="Open menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>

<main>
<article>
  <header class="article-header">
    <nav class="article-breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a>
      <span aria-hidden="true">›</span>
      <a href="/blog/">Blog</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">${esc(crumb)}</span>
    </nav>
    <div class="article-meta">
      <span class="article-category">${esc(category)}</span>
      <span class="article-date">${esc(dateFormatted)}</span>
      <span class="article-readtime">${esc(readTime)}</span>
    </div>
    <h1>${esc(title)}</h1>
    <p class="lede">${inlineMd(lede)}</p>
  </header>

  <div class="article-divider"></div>

  <div class="article-body">
${bodyHtml}
  </div>

  <div class="article-end">
    <div class="article-tags" aria-label="Article tags">
${tagsHtml}
    </div>

    <div class="article-cta">
      <div class="article-cta-text">
        <h3>Track your keyword rankings automatically</h3>
        <p>ASO Analytics monitors every keyword you care about — daily — so you always know what's moving. Free plan available, no credit card required.</p>
      </div>
      <a href="https://aso.cristomade.it/auth/register" class="btn-primary">
        Start for free
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 7H11.5M7.5 3L11.5 7L7.5 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
    </div>

    <div class="next-article">
      <div>
        <p class="next-label">Up next</p>
        <p class="next-title">More ASO guides coming soon</p>
      </div>
      <span class="next-arrow" aria-label="Coming soon">
        Coming soon
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 7H11.5M7.5 3L11.5 7L7.5 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    </div>

    <a href="/blog/" class="back-link">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M11.5 7H2.5M6.5 11L2.5 7L6.5 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Back to all articles
    </a>
  </div>
</article>
</main>

<footer role="contentinfo">
  <div class="wrap">
    <div class="footer-inner">
      <div class="footer-left">
        <p>© 2026 <a href="https://www.cristomade.it/">CristoMade</a>. All rights reserved.</p>
        <p style="margin-top:4px;">Built with ♥ for independent iOS developers.</p>
      </div>
      <nav class="footer-right" aria-label="Footer navigation">
        <a href="https://aso.cristomade.it/">App</a>
        <a href="/#pricing">Pricing</a>
        <a href="/blog/">Blog</a>
        <a href="https://aso.cristomade.it/auth/register">Sign up</a>
        <a href="/terms.html">Terms</a>
        <a href="/privacy.html">Privacy</a>
      </nav>
    </div>
  </div>
</footer>

<script>
  const nav = document.getElementById('mainNav');
  window.addEventListener('scroll', () => { nav.classList.toggle('scrolled', window.scrollY > 40); }, { passive: true });
  function toggleMobileNav() {
    const mn = document.getElementById('mobileNav');
    mn.classList.toggle('open');
    document.body.style.overflow = mn.classList.contains('open') ? 'hidden' : '';
  }
  const progressBar = document.getElementById('progressBar');
  window.addEventListener('scroll', () => {
    const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    progressBar.style.width = scrolled + '%';
  }, { passive: true });
</script>

</body>
</html>`;
}

// ── Update blog/index.html ────────────────────────────────────────────────────
function updateBlogIndex({ title, dateFormatted, readTime, slug, articleUrl, category, lede }) {
  let html = fs.readFileSync(BLOG_INDEX, 'utf8');
  const icon     = categoryIcon(category);
  const catStyle = categoryStyles(category);
  const excerpt  = inlineMd(lede).replace(/<[^>]+>/g, '').slice(0, 130).replace(/\s+\S*$/, '...');

  // ── 1. Update the featured card (hero) ──────────────────────────────────────
  const newFeatured = `<a href="/blog/articles/${slug}/" class="featured-card" aria-label="Read: ${escA(title)}">
        <div class="featured-visual">
          <div class="featured-visual-inner">
            <span class="featured-visual-icon">${icon}</span>
            <div class="featured-visual-tag">${esc(category)}</div>
          </div>
        </div>
        <div class="featured-content">
          <div class="featured-meta">
            <span class="article-category" style="color:${catStyle.color};background:${catStyle.bg};border:1px solid ${catStyle.border};">${esc(category)}</span>
            <span class="article-date">${esc(dateFormatted)}</span>
            <span class="article-readtime">${esc(readTime)}</span>
          </div>
          <h2>${esc(title)}</h2>
          <p>${esc(excerpt)}</p>
          <span class="article-link">
            Read article
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 7H11.5M7.5 3L11.5 7L7.5 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </div>
      </a>`;
  html = html.replace(/<a\s+href="[^"]*"\s+class="featured-card"[\s\S]*?<\/a>/, newFeatured);

  // ── 2. Build the new article card HTML ──────────────────────────────────────
  const newCard = `<!-- Article: ${slug} -->
      <a href="/blog/articles/${slug}/" class="article-card reveal">
        <div class="card-icon">${icon}</div>
        <div class="card-meta">
          <span class="article-category" style="color:${catStyle.color};background:${catStyle.bg};border:1px solid ${catStyle.border};">${esc(category)}</span>
        </div>
        <h3>${esc(title)}</h3>
        <p>${esc(excerpt)}</p>
        <div class="card-footer">
          <span class="article-date">${esc(dateFormatted)}</span>
          <span class="article-link" style="font-size:13px;">
            Read
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2.5 7H11.5M7.5 3L11.5 7L7.5 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </div>
      </a>`;

  // ── 3. Extract the articles-grid block (depth-counting) ─────────────────────
  const gridOpen  = '<div class="articles-grid">';
  const gridStart = html.indexOf(gridOpen);
  if (gridStart === -1) { console.warn('⚠ Could not find articles-grid in blog/index.html'); return; }

  let depth = 0, gridEnd = -1;
  for (let i = gridStart; i < html.length - 5; i++) {
    if (html.slice(i, i + 4) === '<div') depth++;
    if (html.slice(i, i + 6) === '</div>') { depth--; if (depth === 0) { gridEnd = i + 6; break; } }
  }
  if (gridEnd === -1) { console.warn('⚠ Could not find end of articles-grid'); return; }

  const gridInner = html.slice(gridStart + gridOpen.length, gridEnd - 6);

  // ── 4. Remove any coming-soon card that matches this article slug ────────────
  //     Strategy: remove coming-soon divs whose h3 text shares ≥40% slug words
  // coming-soon cards have structure: <div.coming-soon> <div.card-icon/> <div.card-meta/> ... <div.card-footer/> </div>
  // We use a comment-anchor approach: match from the HTML comment before the coming-soon div
  // to the 3rd closing </div>, then check if it matches the new slug.
  let cleaned = gridInner.replace(
    /<!--[^>]*-->\s*<div class="article-card coming-soon"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g,
    (match) => {
      const slugWords = slug.split('-').filter(w => w.length > 3);
      const matchLower = match.toLowerCase();
      const hits = slugWords.filter(w => matchLower.includes(w)).length;
      return hits >= Math.ceil(slugWords.length * 0.4) ? '' : match;
    }
  );

  // Remove existing real card for this slug (idempotent re-runs)
  cleaned = cleaned.replace(new RegExp(`<!-- Article: ${slug} -->[\\s\\S]*?<\\/a>`, 'g'), '');

  // ── 5. Prepend new card (newest first) ──────────────────────────────────────
  const newGridInner = `\n      ${newCard}\n${cleaned}`;

  // ── 6. Count real article cards and update the counter ──────────────────────
  const realCardCount = (newGridInner.match(/class="article-card reveal"/g) || []).length;
  html = html.replace(/(<span>)(\d+) articles?(<\/span>)/, `$1${realCardCount} article${realCardCount !== 1 ? 's' : ''}$3`);

  // ── 7. Splice the new grid back into the full HTML ───────────────────────────
  html = html.slice(0, gridStart + gridOpen.length) + newGridInner + '\n    ' + html.slice(gridEnd - 6);

  fs.writeFileSync(BLOG_INDEX, html, 'utf8');
  console.log(`✅ blog/index.html updated (${realCardCount} article${realCardCount !== 1 ? 's' : ''} in grid, newest first)`);
}

// ── Update previous article's "next" link ─────────────────────────────────────
function updatePreviousArticleNext({ title, slug }) {
  try {
    const dirs = fs.readdirSync(ARTICLES_DIR)
      .filter(d => fs.statSync(path.join(ARTICLES_DIR, d)).isDirectory() && d !== slug)
      .sort();
    if (!dirs.length) return;
    // Update the most recent previous article
    const prevSlug = dirs[dirs.length - 1];
    const prevFile = path.join(ARTICLES_DIR, prevSlug, 'index.html');
    if (!fs.existsSync(prevFile)) return;
    let prevHtml = fs.readFileSync(prevFile, 'utf8');
    const newNext = `<div class="next-article">
      <div>
        <p class="next-label">Up next</p>
        <p class="next-title">${esc(title)}</p>
      </div>
      <a href="/blog/articles/${slug}/" class="next-arrow">
        Read
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 7H11.5M7.5 3L11.5 7L7.5 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
    </div>`;
    prevHtml = prevHtml.replace(/<div class="next-article">[\s\S]*?<\/div>\s*<\/div>/, newNext);
    fs.writeFileSync(prevFile, prevHtml, 'utf8');
    console.log(`✅ Updated "next article" link in: ${prevSlug}/index.html`);
  } catch (e) {
    console.warn('⚠ Could not update previous article next link:', e.message);
  }
}

// ── Update sitemap.xml ────────────────────────────────────────────────────────
function updateSitemap(articleUrl, rawDate) {
  let xml = fs.readFileSync(SITEMAP, 'utf8');
  if (xml.includes(articleUrl)) {
    console.log('ℹ️  sitemap.xml already contains this URL — skipping');
    return;
  }
  const newEntry = `  <url>
    <loc>${articleUrl}</loc>
    <lastmod>${rawDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`;
  xml = xml.replace(/<\/urlset>/, newEntry);
  fs.writeFileSync(SITEMAP, xml, 'utf8');
  console.log('✅ sitemap.xml updated');
}

// ── Main ──────────────────────────────────────────────────────────────────────
const title        = extractTitle(mdLines);
const rawDate      = extractDate(mdFile);
const dateFormatted = formatDate(rawDate);
const slug         = deriveSlug(mdFile, forceSlug);
const readTime     = calcReadTime(rawMd);
const category     = deriveCategory(title);
const articleUrl   = `${BASE_URL}/blog/articles/${slug}/`;

const { skip, lede } = findLedeAndSkips(mdLines);
const bodyHtml       = convertBody(mdLines, skip);
const tags           = extractTags(title, category, rawMd);

console.log(`\n📄 Title:    ${title}`);
console.log(`📅 Date:     ${dateFormatted}`);
console.log(`🔗 Slug:     ${slug}`);
console.log(`🏷  Category: ${category}`);
console.log(`⏱  Read time: ${readTime}`);
console.log(`🔗 URL:      ${articleUrl}\n`);

// Build + write article page
const articleDir = path.join(ARTICLES_DIR, slug);
fs.mkdirSync(articleDir, { recursive: true });
const pageHtml = buildArticlePage({ title, rawDate, dateFormatted, readTime, slug, articleUrl, lede, bodyHtml, tags, category });
fs.writeFileSync(path.join(articleDir, 'index.html'), pageHtml, 'utf8');
console.log(`✅ Article written: blog/articles/${slug}/index.html`);

// Update blog index
updateBlogIndex({ title, dateFormatted, readTime, slug, articleUrl, category, lede });

// Update previous article's "next" pointer
updatePreviousArticleNext({ title, slug });

// Update sitemap
updateSitemap(articleUrl, rawDate);

console.log(`\n🎉 Done! Published at:\n   ${articleUrl}\n`);
