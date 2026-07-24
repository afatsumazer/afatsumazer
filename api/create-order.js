import { Dana } from 'dana-node';

const danaClient = new Dana({
  partnerId: process.env.X_PARTNER_ID,
  privateKey: process.env.PRIVATE_KEY,
  origin: process.env.ORIGIN,
});

const { PaymentGatewayApi } = danaClient;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { amount, orderTitle } = req.body;

    // Nomor referensi unik untuk tiap transaksi (wajib unik per hari)
    const partnerReferenceNo = `ORDER-${Date.now()}`;

    const request = {
      partnerReferenceNo,
      merchantId: process.env.X_PARTNER_ID, // ganti sesuai merchantId dari dashboard DANA
      amount: {
        value: amount.toFixed(2), // contoh: "10000.00"
        currency: 'IDR',
      },
      urlParams: [
        {
          url: `${process.env.ORIGIN}/api/webhook/payment`,
          type: 'NOTIFICATION',
        },
        {
          url: `${process.env.ORIGIN}/api/webhook/finish`,
          type: 'PAY_RETURN',
        },
      ],
      additionalInfo: {
        order: {
          scenario: 'REDIRECT',
        },
      },
    };

    const response = await PaymentGatewayApi.createOrder(request);

    res.status(200).json({
      webRedirectUrl: response.webRedirectUrl,
      referenceNo: response.referenceNo,
    });
  } catch (error) {
    console.error('Gagal membuat order:', error);
    res.status(500).json({ message: 'Gagal membuat order', error: error.message });
  }
}
