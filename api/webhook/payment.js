export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const notification = req.body;
  console.log('Notifikasi diterima:', notification);

  // TODO: proses status pembayaran di sini

  res.status(200).json({ message: 'OK' });
}
