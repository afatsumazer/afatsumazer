const express = require('express');
const router = express.Router();

// Endpoint untuk menerima notifikasi dari provider e-money
router.post('/webhook/payment', (req, res) => {
  const notification = req.body;
  
  console.log('Notifikasi diterima:', notification);
  
  // TODO: proses status pembayaran di sini
  // contoh: cek status, update database, dll
  
  res.status(200).json({ message: 'OK' });
});

module.exports = router;
