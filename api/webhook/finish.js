export default function handler(req, res) {
  const { status, originalReferenceNo } = req.query;

  res.status(200).send(`
    <html>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>${status === 'SUCCESS' ? '✅ Pembayaran Berhasil' : '❌ Pembayaran Gagal'}</h2>
        <p>Nomor referensi: ${originalReferenceNo || '-'}</p>
      </body>
    </html>
  `);
}
