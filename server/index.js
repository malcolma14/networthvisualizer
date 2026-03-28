import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { analyseRoute } from './routes/analyse.js';
import { chatRoute } from './routes/chat.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/analyse', analyseRoute);
app.use('/api/chat', chatRoute);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
