import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import masterRoutes from './routes/masterRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import { startBot } from './bot.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/master', masterRoutes);
app.use('/api', publicRoutes);
app.use('/api/appointments', appointmentRoutes);

app.get('/', (req, res) => {
  res.send('MasterBookBot API is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  startBot();
});

