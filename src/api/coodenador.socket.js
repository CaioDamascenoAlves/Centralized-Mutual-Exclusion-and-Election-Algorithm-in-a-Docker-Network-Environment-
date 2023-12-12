// server.js (Coordenador)
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

io.on("connection", (socket) => {
  console.log(`Novo cliente conectado: ${socket.id}`);

  socket.on("message", (data) => {
    console.log(`Mensagem recebida: ${data}`);
    // Encaminha a mensagem para todos os consumidores conectados
    io.emit("message", data);
  });

  socket.on("disconnect", () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

server.listen(3000, () => {
  console.log("Servidor de socket rodando na porta 3000");
});
