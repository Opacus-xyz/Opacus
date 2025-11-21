import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { logger } from './logger';
import { getSession } from './redis';

interface ClientConnection {
  ws: WebSocket;
  clientId: string;
  authenticated: boolean;
}

const clients = new Map<string, ClientConnection>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    logger.info('New WebSocket connection');

    let connection: ClientConnection = {
      ws,
      clientId: '',
      authenticated: false,
    };

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'auth':
            await handleAuth(connection, message);
            break;
          case 'message':
            await handleMessage(connection, message);
            break;
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
          default:
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Unknown message type' 
            }));
        }
      } catch (error) {
        logger.error('Error processing WebSocket message:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format' 
        }));
      }
    });

    ws.on('close', () => {
      if (connection.clientId) {
        clients.delete(connection.clientId);
        logger.info(`Client disconnected: ${connection.clientId}`);
      }
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });
  });

  logger.info('WebSocket server initialized');
  return wss;
}

async function handleAuth(connection: ClientConnection, message: any) {
  const { clientId, sessionKey } = message;

  if (!clientId || !sessionKey) {
    connection.ws.send(JSON.stringify({
      type: 'auth_error',
      message: 'Missing clientId or sessionKey',
    }));
    return;
  }

  // Verify session exists
  const storedSessionKey = await getSession(clientId);
  if (!storedSessionKey || storedSessionKey !== sessionKey) {
    connection.ws.send(JSON.stringify({
      type: 'auth_error',
      message: 'Invalid session',
    }));
    return;
  }

  // Update connection
  connection.clientId = clientId;
  connection.authenticated = true;
  clients.set(clientId, connection);

  connection.ws.send(JSON.stringify({
    type: 'auth_success',
    clientId,
    timestamp: Date.now(),
  }));

  logger.info(`Client authenticated via WebSocket: ${clientId}`);
}

async function handleMessage(connection: ClientConnection, message: any) {
  if (!connection.authenticated) {
    connection.ws.send(JSON.stringify({
      type: 'error',
      message: 'Not authenticated',
    }));
    return;
  }

  const { to, content, encrypted } = message;

  if (!to || !content) {
    connection.ws.send(JSON.stringify({
      type: 'error',
      message: 'Missing required fields (to, content)',
    }));
    return;
  }

  // Find recipient
  const recipient = clients.get(to);
  
  if (!recipient || !recipient.authenticated) {
    connection.ws.send(JSON.stringify({
      type: 'message_error',
      message: 'Recipient not connected',
    }));
    return;
  }

  // Forward message to recipient
  recipient.ws.send(JSON.stringify({
    type: 'message',
    from: connection.clientId,
    content,
    encrypted: encrypted || false,
    timestamp: Date.now(),
  }));

  // Send acknowledgment to sender
  connection.ws.send(JSON.stringify({
    type: 'message_sent',
    to,
    timestamp: Date.now(),
  }));

  logger.info(`Message forwarded: ${connection.clientId} -> ${to}`);
}

export function broadcastToAll(message: any) {
  const payload = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.authenticated) {
      client.ws.send(payload);
    }
  });
}

export function sendToClient(clientId: string, message: any) {
  const client = clients.get(clientId);
  if (client && client.authenticated) {
    client.ws.send(JSON.stringify(message));
    return true;
  }
  return false;
}
