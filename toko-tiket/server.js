const express = require('express');
const crypto = require('crypto');
const db = require('./database');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public')); // Membuka folder frontend

const SECRET_KEY = "kunci_rahasia_negara_indonesia"; // Jaga kerahasiaan ini

// API 1: MEMBUAT TIKET & SIMPAN KE DATABASE
app.post('/api/generate-ticket', (req, res) => {
    const { nama, event } = req.body;
    const idTiket = 'TK-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    
    // Buat tanda tangan digital (Signature Kriptografi)
    const signature = crypto.createHmac('sha256', SECRET_KEY).update(idTiket).digest('hex');

    // Simpan ke database dengan status belum digunakan (is_used = 0)
    const query = `INSERT INTO tiket (id, nama, event, is_used) VALUES (?, ?, ?, 0)`;
    db.run(query, [idTiket, nama, event], (err) => {
        if (err) return res.status(500).json({ error: "Gagal menyimpan tiket" });
        
        // Kirim data ke frontend untuk dijadikan QR Code
        res.json({ id: idTiket, nama, event, sig: signature });
    });
});

// API 2: SCANNER MEMVERIFIKASI TIKET (ANTI-DUPLIKASI ONLINE)
app.post('/api/verify-ticket', (req, res) => {
    const { id, sig } = req.body;

    // Langkah A: Cek Keaslian Kriptografi secara instan
    const checkSig = crypto.createHmac('sha256', SECRET_KEY).update(id).digest('hex');
    if (sig !== checkSig) {
        return res.json({ valid: false, message: "TIKET PALSU / MODIFIKASI" });
    }

    // Langkah B: Cek ke Database (Apakah sudah pernah dipakai?)
    db.get(`SELECT * FROM tiket WHERE id = ?`, [id], (err, row) => {
        if (err || !row) {
            return res.json({ valid: false, message: "TIKET TIDAK TERDAFTAR DI SERVER" });
        }

        if (row.is_used === 1) {
            return res.json({ 
                valid: false, 
                message: `TIKET SUDAH DIGUNAKAN pada ${row.waktu_scan}`,
                data: row 
            });
        }

        // Langkah C: Jika asli & belum dipakai, ubah status jadi 'Sudah Digunakan'
        const waktuSekarang = new Date().toLocaleString('id-ID');
        db.run(`UPDATE tiket SET is_used = 1, waktu_scan = ? WHERE id = ?`, [waktuSekarang, id], (err) => {
            res.json({ 
                valid: true, 
                message: "✓ TIKET VALID & SILAKAN MASUK", 
                data: row 
            });
        });
    });
});

app.listen(3000, () => console.log('Server berjalan di http://localhost:3000'));
