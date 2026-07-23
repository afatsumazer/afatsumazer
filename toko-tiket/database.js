const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./tiket.db');

// Buat tabel tiket jika belum ada
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS tiket (
            id TEXT PRIMARY KEY,
            nama TEXT,
            event TEXT,
            is_used INTEGER DEFAULT 0,
            waktu_scan TEXT
        )
    `);
});

module.exports = db;
