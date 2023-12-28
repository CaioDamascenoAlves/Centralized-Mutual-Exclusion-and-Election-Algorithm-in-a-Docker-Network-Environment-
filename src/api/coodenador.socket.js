// server.js (Coordenador)
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);

// Configurando o Socket.io com op    es CORS para aceitar conex  es de qualquer origem
const io = socketIo(server, {
  cors: {
    origin: "*" // Permite conex  es de qualquer origem
  }
});


io.on("connection", (socket) => {
  console.log(`Novo cliente conectado: ${socket.id}`);

  socket.on("message", (data) => {
    console.log(`Mensagem recebida: ${data}`);

    // Resposta espec  fica para o teste de integra    o
    if (data === "Ol  , coordenador!") {
      socket.emit("resposta-especifica", "Resposta esperada do coordenador");
    }

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