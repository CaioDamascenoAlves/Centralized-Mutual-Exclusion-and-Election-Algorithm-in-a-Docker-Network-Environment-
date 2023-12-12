// __tests__/client.test.js
const http = require("http");
const { Server } = require("socket.io");
const Client = require("socket.io-client");

let io, serverSocket, clientSocket;

beforeEach((done) => {
  const httpServer = http.createServer();
  io = new Server(httpServer);
  httpServer.listen(() => {
    const port = httpServer.address().port;
    clientSocket = new Client(`http://localhost:${port}`);
    io.on("connection", (socket) => {
      serverSocket = socket;
      socket.on("message", (msg) => {
        // Quando o servidor recebe uma mensagem, ele a envia de volta
        socket.emit("message", msg);
      });
    });
    clientSocket.on("connect", done);
  });
});

afterEach(() => {
  io.close();
  clientSocket.close();
});

test("should connect and communicate with the server", (done) => {
  // O cliente envia uma mensagem para o servidor
  clientSocket.emit("message", "Olá, coordenador!");

  // O cliente espera receber a mesma mensagem de volta
  clientSocket.on("message", (msg) => {
    expect(msg).toBe("Olá, coordenador!");
    done();
  });
});
