import express from 'express';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8000;

// parse application/json
app.use(express.json());

// root route
app.get('/', (_req, res) => {
  res.json({ message: 'Live Sport Dash API — hello!' });
});

const server = app.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`Server listening at ${url}`);
});

export default app;
