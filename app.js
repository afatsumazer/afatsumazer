const webhookRoutes = require('./routes/webhook');
app.use('/api', webhookRoutes);
const express = require('express');
const app = express();

// Middleware supaya bisa baca JSON dari body request
app.use(express.json());

// Sambungkan route webhook
const webhookRoutes = require('./routes/webhook');
app.use('/api', webhookRoutes);

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});
