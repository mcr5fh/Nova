import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { SessionManager } from './session';
import { WebSocketHandler } from './websocket';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize session manager and websocket handler
const sessionManager = new SessionManager();
const wsHandler = new WebSocketHandler(wss, sessionManager);

const PORT = process.env.PORT || 3001;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, server, wss, sessionManager, wsHandler };
