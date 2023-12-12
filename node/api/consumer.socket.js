// client.js (Consumidor)
const io = require("socket.io-client");
const socket = io("http://172.25.0.3:3000"); // Endereço IP do coordenador

socket.on("connect", () => {
  console.log("Conectado ao coordenador");
});

socket.on("message", (data) => {
  console.log(`Mensagem recebida do coordenador: ${data}`);
});

// Enviar mensagem para o coordenador
socket.emit("message", "Olá, coordenador!");

// Tratamento de desconexão
socket.on("disconnect", () => {
  console.log("Desconectado do coordenador");
});
