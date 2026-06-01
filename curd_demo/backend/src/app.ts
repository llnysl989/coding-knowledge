import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorMiddleware } from './middleware/errorMiddleware';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
});
