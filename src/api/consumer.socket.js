// client.js (Consumidor)
const io = require("socket.io-client");
const socket = io("http://172.25.0.3:3000"); // Endere  o IP do coordenador

socket.on("connect", () => {
  console.log("Conectado ao coordenador");
});

socket.on("message", (data) => {
  console.log(`Mensagem recebida do coordenador: ${data}`);
});

// Enviar mensagem para o coordenador
socket.emit("message", "Ol  , coordenador!");

// Tratamento de desconex  o
socket.on("disconnect", () => {
  console.log("Desconectado do coordenador");
});
