export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://app.afatsumazer.eu.org');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!process.env.X_PARTNER_ID || !process.env.PRIVATE_KEY) {
    return res.status(500).json({ message: 'Kredensial DANA belum lengkap di server' });
  }

  try {
    const { Dana } = await import('dana-node');

    const danaClient = new Dana({
      partnerId: process.env.X_PARTNER_ID,
      privateKey: process.env.PRIVATE_KEY,
      origin: process.env.ORIGIN,
      env: 'sandbox',
    });

    const { paymentGatewayApi } = danaClient;

    const { amount, orderTitle } = req.body;
    const partnerReferenceNo = `ORDER-${Date.now()}`;

    const request = {
      partnerReferenceNo,
      merchantId: process.env.X_PARTNER_ID,
      amount: { value: amount.toFixed(2), currency: 'IDR' },
      urlParams: [
        { url: `${process.env.ORIGIN}/api/webhook/payment`, type: 'Notification' },
        { url: `${process.env.ORIGIN}/api/webhook/finish`, type: 'PayReturn' },
      ],
      additionalInfo: { order: { scenario: 'Redirect' } },
    };

    const response = await paymentGatewayApi.createOrder(request);

    res.status(200).json({
      webRedirectUrl: response.webRedirectUrl,
      referenceNo: response.referenceNo,
    });
  } catch (error) {
    console.error('Gagal membuat order:', error);
    res.status(500).json({ message: 'Gagal membuat order', error: error.message });
  }
}
