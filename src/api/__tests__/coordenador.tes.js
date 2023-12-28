// __tests__/coordenador.test.js
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
    });
    clientSocket.on("connect", done);
  });
});

afterEach(() => {
  io.close();
  clientSocket.close();
});

test("should communicate", (done) => {
  clientSocket.emit("message", "Olá, coordenador!");
  serverSocket.on("message", (msg) => {
    expect(msg).toBe("Olá, coordenador!");
    done();
  });
});
