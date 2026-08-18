/**
 * Code.gs — Apps Script Web App untuk Afatsumazer.
 * Menerima data absensi langsung dari browser (fetch dari admin.js / absensi.js)
 * setiap kali ada absen baru/berubah, lalu menyimpan/mengupdate baris di Sheet ini.
 * GRATIS — tidak butuh Firebase Cloud Functions atau paket berbayar apa pun.
 *
 * ================= CARA PASANG =================
 * 1. Buka Google Sheet tujuan (boleh bikin baru, boleh yang sudah ada).
 * 2. Menu Extensions -> Apps Script.
 * 3. Hapus isi default (Code.gs kosong), tempel SEMUA kode di file ini.
 * 4. Di toolbar Apps Script, pilih fungsi "setupHeader" dari dropdown, klik Run sekali
 *    (untuk bikin header kolom otomatis). Kalau diminta izin, klik Allow / Izinkan.
 * 5. Klik "Deploy" (kanan atas) -> "New deployment".
 *    - Klik ikon gerigi di sebelah "Select type" -> pilih "Web app".
 *    - Description: bebas (mis. "Sync Absensi Afatsumazer").
 *    - Execute as: Me (akun Google kamu).
 *    - Who has access: Anyone.
 *    - Klik Deploy.
 * 6. Salin "Web app URL" yang muncul (diakhiri .../exec).
 * 7. Tempel URL itu ke Panel Admin -> tab "Lokasi & Divisi" -> bagian
 *    "Integrasi Google Sheets" -> Simpan.
 *
 * Kalau nanti kode Code.gs ini diedit lagi, harus "New deployment" ulang (atau
 * "Manage deployments" -> edit -> versi baru) supaya perubahan kepakai oleh Web App.
 */

const SHEET_NAME = 'Absensi';
const HEADER = ['Doc ID (kunci)', 'Tanggal', 'Nama Karyawan', 'UID', 'Jam Masuk', 'Jam Pulang', 'Status', 'Sumber', 'Terakhir Diupdate'];

function setupHeader() {
  const sheet = getOrCreateSheet();
  sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
  sheet.setFrozenRows(1);
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Dipanggil otomatis oleh Google tiap ada request POST ke URL Web App ini.
// Payload yang dikirim dari aplikasi (lihat admin.js / absensi.js): docId, tanggal,
// nama, uid, jamMasuk, jamPulang, status, sumber ('Scan' atau 'Manual').
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet();

    const docId = data.docId || '';
    const row = [
      docId,
      data.tanggal || '',
      data.nama || '',
      data.uid || '',
      data.jamMasuk || '',
      data.jamPulang || '',
      data.status || '',
      data.sumber || '',
      new Date()
    ];

    // Upsert berdasarkan docId (kolom A): kalau sudah ada barisnya, update baris itu
    // (supaya scan pulang melengkapi baris scan masuk yang sama, bukan bikin baris baru).
    const lastRow = sheet.getLastRow();
    let baris = -1;
    if (lastRow > 1 && docId) {
      const kolomKunci = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < kolomKunci.length; i++) {
        if (kolomKunci[i][0] === docId) { baris = i + 2; break; }
      }
    }

    if (baris > 0) {
      sheet.getRange(baris, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}
