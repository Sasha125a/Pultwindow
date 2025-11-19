const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(bodyParser.json());

// Хранилище подключенных клиентов
const connectedClients = new Map();

// REST API для получения статуса
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'online', 
    connectedClients: connectedClients.size,
    timestamp: new Date().toISOString()
  });
});

// REST API для отправки команд
app.post('/api/command', (req, res) => {
  const { clientId, command, parameters } = req.body;
  
  if (!clientId || !command) {
    return res.status(400).json({ error: 'clientId and command are required' });
  }

  const client = connectedClients.get(clientId);
  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  // Отправка команды через WebSocket
  client.emit('command', { command, parameters });
  res.json({ status: 'command sent', clientId, command });
});

// WebSocket соединения
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Регистрация клиента
  socket.on('register', (data) => {
    const { clientId, computerName, os } = data;
    connectedClients.set(clientId, socket);
    
    console.log(`Client registered: ${clientId} (${computerName})`);
    socket.emit('registered', { status: 'success' });
  });

  // Отправка результата выполнения команды
  socket.on('command_result', (data) => {
    console.log('Command result:', data);
    // Здесь можно сохранять результаты в базу данных
  });

  // Отслеживание статуса
  socket.on('heartbeat', (data) => {
    socket.emit('heartbeat_ack', { timestamp: Date.now() });
  });

  socket.on('disconnect', () => {
    // Удаляем клиента из списка
    for (let [clientId, clientSocket] of connectedClients.entries()) {
      if (clientSocket === socket) {
        connectedClients.delete(clientId);
        console.log(`Client disconnected: ${clientId}`);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
