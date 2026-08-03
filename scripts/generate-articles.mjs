// scripts/generate-articles.mjs
//
// Dijalankan otomatis oleh GitHub Actions (lihat .github/workflows/generate-articles.yml).
// Tugasnya: baca semua artikel berstatus "published" dari Firestore, lalu buat file
// HTML ASLI (bukan lewat JavaScript) untuk tiap artikel di /{slug}/index.html â€”
// lengkap dengan meta tag Open Graph (og:title, og:image, dst) supaya preview link
// di WhatsApp/Facebook/Twitter akurat sesuai artikelnya (crawler medsos tidak
// menjalankan JavaScript, jadi datanya wajib sudah ada di HTML mentah).
//
// Artikel yang statusnya berubah jadi bukan "published" lagi (draft/pending/rejected/
// dihapus) otomatis dihapus juga file statisnya lewat pengecekan manifest.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// ============ GANTI SESUAI DOMAIN ASLI KAMU ============
const SITE_URL = 'https://app.afatsumazer.eu.org';
const SITE_NAME = 'AppSaya';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`; // opsional: siapkan gambar default 1200x630px

const MANIFEST_PATH = '.generated-articles.json';

// Nama-nama ini TIDAK BOLEH dipakai sebagai slug artikel karena akan menimpa
// folder/file asli di repo. Kalau ketemu, artikel itu dilewati (tidak dibuat).
const RESERVED_SLUGS = new Set([
    'admin', 'dashboard', 'login', 'index', 'js', 'css', 'images', 'assets',
    'tulis-artikel', 'daftar-artikel', '404', 'p', 'scripts', '.github'
]);

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

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
    const updatedLabel = (article.updatedAt && article.updatedAt.toDate)
        ? 'Diperbarui ' + article.updatedAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeAttr(title)} â€” ${SITE_NAME}</title>
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
  <a href="/" class="back">â† Kembali ke beranda</a>
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

async function main() {
    const snapshot = await db.collection('articles').where('status', '==', 'published').get();

    const currentSlugs = [];
    let skippedReserved = 0;

    for (const docSnap of snapshot.docs) {
        const slug = docSnap.id;

        if (RESERVED_SLUGS.has(slug)) {
            console.warn(`Lewati slug "${slug}" â€” bentrok dengan nama folder/file sistem.`);
            skippedReserved++;
            continue;
        }

        const data = docSnap.data();
        currentSlugs.push(slug);

        const dir = path.join(process.cwd(), slug);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.html'), renderPage(data, slug));
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

    console.log(`Selesai. Dibuat/diperbarui: ${currentSlugs.length} artikel. Dihapus: ${removed.length}. Dilewati (reserved): ${skippedReserved}.`);
}

main().catch(err => {
    console.error('Gagal generate artikel:', err);
    process.exit(1);
});
