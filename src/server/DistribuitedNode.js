const http = require("http");
const socketIo = require("socket.io");
const socketClient = require("socket.io-client");

class DistributedNode {
  constructor() {
    // Variáveis de ambiente específicas de cada nó
    this.hostId = process.env.HOSTID;
    this.hostname = process.env.HOSTNAME;
    this.processId = process.env.PROCESS_ID;
    this.ipList = process.env.IP_LIST.split(","); // Convertendo a string em array
    this.successorIp = process.env.SUCCESSOR_IP;
    this.localIp = process.env.IP_LOCAL;
    this.listPorts = process.env.LIST_PORTS.split(",").map(Number); // Convertendo a string em array e em números

    // Configurações de rede do nó
    this.server = null;
    this.io = null;
    this.port = parseInt(process.env.NODE_PORT) || 3000; // Usando a porta padrão 3000 se não estiver definida
  }

  initServer() {
    this.server = http.createServer();
    this.io = socketIo(this.server, {
      cors: {
        origin: "*", // Defina as políticas de CORS conforme necessário
        methods: ["GET", "POST"],
      },
    });

    this.io.on("connection", (socket) => {
      console.log(`Node connected: ${socket.id}`);

      // Tratar eventos específicos aqui
      socket.on("event_name", (data) => {
        // Lógica de manipulação do evento
      });

      // ...
    });

    this.server.listen(this.port, () => {
      console.log(`Node server running on port ${this.port}`);
    });
  }

  connectToOtherNodes() {
    this.ipList.forEach((ip) => {
      const client = ioClient(`http://${ip}`, {
        // Opções adicionais, se necessário
      });

      client.on("connect", () => {
        console.log(`Connected to node at ${ip}`);
        // Enviar informações ou sincronizar estado, se necessário
      });

      // Tratar eventos específicos aqui
      client.on("event_name", (data) => {
        // Lógica de manipulação do evento
      });

      this.clients.set(ip, client);
    });
  }

  // Conecta ao nó sucessor
  connectToSuccessor() {
    const client = ioClient(`http://${this.successorIp}:${this.port}`);
    this.clients.set(this.successorIp, client);

    client.on("connect", () => {
      console.log(`Connected to successor at ${this.successorIp}`);
    });

    // ... outros manipuladores de eventos ...
  }

  // Inicia a eleição
  startElection() {
    const message = {
      type: "ELECTION",
      processIds: [this.processId],
    };
    this.sendMessageToSuccessor(message);
  }

  // Envia uma mensagem para o nó sucessor
  sendMessageToSuccessor(message) {
    const successorClient = this.clients.get(this.successorIp);
    if (successorClient && successorClient.connected) {
      successorClient.emit("message", message);
    } else {
      console.log("Erro: Não conectado ao nó sucessor.");
    }
  }

  // Lida com a recepção de uma mensagem de eleição
  onElectionMessageReceived(message) {
    if (message.type === "ELECTION") {
      if (message.processIds.includes(this.processId)) {
        // A mensagem retornou ao iniciador
        const maxProcessId = Math.max(...message.processIds);
        this.announceCoordinator(maxProcessId);
      } else {
        // Adiciona o próprio process_id e passa a mensagem adiante
        message.processIds.push(this.processId);
        this.sendMessageToSuccessor(message);
      }
    }
  }

  // Anuncia o coordenador
  announceCoordinator(coordinatorId) {
    const coordinatorMessage = {
      type: "COORDINATOR",
      coordinatorId: coordinatorId,
    };
    this.broadcastMessage(coordinatorMessage);
  }

  // Envia uma mensagem para todos os nós conectados
  broadcastMessage(message) {
    this.clients.forEach((client) => {
      if (client.connected) {
        client.emit("message", message);
      }
    });
  }
}

module.exports = DistributedNode;
