// scripts/generate-articles.mjs
//
// Dijalankan otomatis oleh GitHub Actions (lihat .github/workflows/generate-articles.yml).
// Tugasnya: baca semua artikel berstatus "published" dari Firestore, lalu buat file
// HTML ASLI (bukan lewat JavaScript) untuk tiap artikel di /{slug}/index.html —
// lengkap dengan meta tag Open Graph (og:title, og:image, dst) supaya preview link
// di WhatsApp/Facebook/Twitter akurat sesuai artikelnya. Juga generate sitemap.xml
// berisi semua URL artikel yang tayang, supaya lebih mudah terindex Google.
//
// TIDAK BUTUH Service Account / kredensial Firebase apa pun — artikel yang statusnya
// "published" memang boleh dibaca publik lewat REST API Firestore (sesuai rules yang
// sudah dipasang), jadi cukup projectId saja.

import fs from 'fs';
import path from 'path';

// ============ GANTI SESUAI DOMAIN & PROJECT ID ASLI KAMU ============
const SITE_URL = 'https://app.afatsumazer.eu.org';
const SITE_NAME = 'AppSaya';
const FIREBASE_PROJECT_ID = 'afatsumazer-app';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`; // opsional: siapkan gambar default 1200x630px

const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
const MANIFEST_PATH = '.generated-articles.json';

// Nama-nama ini TIDAK BOLEH dipakai sebagai slug artikel karena akan menimpa
// folder/file asli di repo. Kalau ketemu, artikel itu dilewati (tidak dibuat).
const RESERVED_SLUGS = new Set([
    'admin', 'dashboard', 'login', 'index', 'js', 'css', 'images', 'assets',
    'tulis-artikel', 'daftar-artikel', '404', 'p', 'scripts', '.github',
    'api', 'fitur', 'src', 'toko-tiket', 'user'
]);

// ================= AMBIL DATA ARTIKEL LEWAT FIRESTORE REST API (PUBLIK) =================
function parseValue(v) {
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
    if (v.doubleValue !== undefined) return v.doubleValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.timestampValue !== undefined) return new Date(v.timestampValue);
    if (v.mapValue !== undefined) {
        const obj = {};
        for (const [k, val] of Object.entries(v.mapValue.fields || {})) obj[k] = parseValue(val);
        return obj;
    }
    if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(parseValue);
    return null;
}

function parseDocument(doc) {
    const fields = {};
    for (const [k, v] of Object.entries(doc.fields || {})) fields[k] = parseValue(v);
    const parts = doc.name.split('/');
    return { id: parts[parts.length - 1], ...fields };
}

async function fetchPublishedArticles() {
    const body = {
        structuredQuery: {
            from: [{ collectionId: 'articles' }],
            where: {
                fieldFilter: {
                    field: { fieldPath: 'status' },
                    op: 'EQUAL',
                    value: { stringValue: 'published' }
                }
            }
        }
    };

    const res = await fetch(FIRESTORE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        throw new Error(`Firestore REST API error: ${res.status} ${await res.text()}`);
    }

    const rows = await res.json();
    return rows.filter(r => r.document).map(r => parseDocument(r.document));
}

// ================= RENDER HALAMAN HTML STATIS =================
function stripHtml(html) {
    return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeAttr(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderPage(article, slug) {
    const title = article.title || 'Artikel';
    const description = stripHtml(article.content).slice(0, 160) || `Baca "${title}" di ${SITE_NAME}.`;
    const image = article.cover || DEFAULT_OG_IMAGE;
    const url = `${SITE_URL}/${slug}`;
    const updatedLabel = (article.updatedAt instanceof Date)
        ? 'Diperbarui ' + article.updatedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeAttr(title)} — ${SITE_NAME}</title>
<meta name="description" content="${escapeAttr(description)}">
<link rel="canonical" href="${escapeAttr(url)}">

<!-- Open Graph: dibaca WhatsApp, Facebook, Telegram, LinkedIn, dll -->
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeAttr(title)}">
<meta property="og:description" content="${escapeAttr(description)}">
<meta property="og:image" content="${escapeAttr(image)}">
<meta property="og:url" content="${escapeAttr(url)}">
<meta property="og:site_name" content="${SITE_NAME}">

<!-- Twitter/X Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeAttr(title)}">
<meta name="twitter:description" content="${escapeAttr(description)}">
<meta name="twitter:image" content="${escapeAttr(image)}">

<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --bg-deep:#0B1120; --teal:#2DD4BF; --violet:#8B5CF6;
    --text-main:#E7ECF6; --text-muted:#7C89AA;
    --card-bg:rgba(19,27,51,0.55); --card-border:rgba(255,255,255,0.08);
  }
  *{ box-sizing:border-box; }
  body{
    margin:0; min-height:100%;
    background:
      radial-gradient(ellipse at 20% 0%, rgba(45,212,191,0.10), transparent 55%),
      radial-gradient(ellipse at 80% 60%, rgba(139,92,246,0.12), transparent 55%),
      var(--bg-deep);
    color:var(--text-main);
    font-family:'Inter',sans-serif;
  }
  .wrap{ max-width:640px; margin:0 auto; padding:40px 20px 60px; }
  .back{
    font-family:'JetBrains Mono',monospace; font-size:11px;
    color:var(--text-muted); text-decoration:none; letter-spacing:0.04em;
  }
  .back:hover{ color:var(--text-main); }
  .card{
    background:var(--card-bg); border:1px solid var(--card-border);
    border-radius:22px; padding:30px 26px; margin-top:18px;
    backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
  }
  .cover{ width:100%; height:220px; object-fit:cover; border-radius:16px; margin-bottom:20px; display:block; }
  h1{
    font-family:'Space Grotesk',sans-serif; font-size:clamp(24px,4.5vw,32px);
    font-weight:700; color:#fff; margin:0 0 8px; line-height:1.25; letter-spacing:-0.01em;
  }
  .date{ font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--text-muted); margin:0 0 22px; }
  .body{ font-size:14px; line-height:1.8; color:#C7D0E6; }
  .body p{ margin:0 0 1em; }
  .body img{ max-width:100%; border-radius:12px; }
  .body a{ color:var(--teal); }
  .share-row{
    display:flex; flex-wrap:wrap; gap:8px; margin-top:26px;
    padding-top:20px; border-top:1px solid rgba(255,255,255,0.08);
  }
  .share-label{
    width:100%; font-family:'JetBrains Mono',monospace; font-size:10px;
    letter-spacing:0.1em; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;
  }
  .share-btn{
    display:inline-flex; align-items:center; gap:6px; padding:8px 14px;
    border-radius:99px; font-size:12px; font-weight:600; text-decoration:none;
    border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); color:var(--text-main);
  }
  .share-btn:hover{ background:rgba(255,255,255,0.08); }
</style>
</head>
<body>
<div class="wrap">
  <a href="/" class="back">← Kembali ke beranda</a>
  <div class="card">
    ${article.cover ? `<img class="cover" src="${escapeAttr(article.cover)}" alt="">` : ''}
    <h1>${escapeAttr(title)}</h1>
    ${updatedLabel ? `<p class="date">${escapeAttr(updatedLabel)}</p>` : ''}
    <div class="body">${article.content || ''}</div>

    <div class="share-row">
      <span class="share-label">Bagikan artikel ini</span>
      <a class="share-btn" href="https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}" target="_blank">WhatsApp</a>
      <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank">Facebook</a>
      <a class="share-btn" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}" target="_blank">X</a>
      <a class="share-btn" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}" target="_blank">Telegram</a>
    </div>
  </div>
</div>
</body>
</html>
`;
}

// ================= GENERATE SITEMAP.XML =================
function escapeXml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderSitemap(articles, currentSlugs) {
    const urls = currentSlugs.map(slug => {
        const article = articles.find(a => a.id === slug);
        const lastmod = (article && article.updatedAt instanceof Date)
            ? article.updatedAt.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
        return `  <url>
    <loc>${escapeXml(SITE_URL)}/${escapeXml(slug)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(SITE_URL)}/</loc>
  </url>
${urls}
</urlset>
`;
}

// ================= JALANKAN =================
async function main() {
    const articles = await fetchPublishedArticles();

    const currentSlugs = [];
    let skippedReserved = 0;

    for (const article of articles) {
        const slug = article.id;

        if (RESERVED_SLUGS.has(slug)) {
            console.warn(`Lewati slug "${slug}" — bentrok dengan nama folder/file sistem.`);
            skippedReserved++;
            continue;
        }

        currentSlugs.push(slug);
        const dir = path.join(process.cwd(), slug);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.html'), renderPage(article, slug));
    }

    // Hapus file artikel yang statusnya sudah bukan "published" lagi (atau dihapus)
    let previousSlugs = [];
    if (fs.existsSync(MANIFEST_PATH)) {
        previousSlugs = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    }
    const removed = previousSlugs.filter(s => !currentSlugs.includes(s));
    for (const slug of removed) {
        const dir = path.join(process.cwd(), slug);
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    }

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(currentSlugs, null, 2));

    // Tulis sitemap.xml di root, mencakup semua artikel yang published
    fs.writeFileSync(path.join(process.cwd(), 'sitemap.xml'), renderSitemap(articles, currentSlugs));

    console.log(`Selesai. Dibuat/diperbarui: ${currentSlugs.length} artikel. Dihapus: ${removed.length}. Dilewati (reserved): ${skippedReserved}.`);
}

main().catch(err => {
    console.error('Gagal generate artikel:', err);
    process.exit(1);
});
