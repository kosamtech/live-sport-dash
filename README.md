# Live Sport Dash — TypeScript Express server

This is a minimal TypeScript Express server that listens on port 8000, uses JSON middleware, and exposes a root GET route returning a short message.

Quick start

1. Install dependencies:

```bash
npm install
npm install --save-dev typescript ts-node @types/node @types/express
```

2. Run in development (no build, using ts-node):

```bash
npm run dev
```

3. Build and run:

```bash
npm run build
npm start
```

The server will log the URL when it starts and responds to GET / with a JSON message.
