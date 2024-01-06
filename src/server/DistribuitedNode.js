const http = require("http");
const socketIo = require("socket.io");
const socketClient = require("socket.io-client");

class DistributedNode {
  constructor() {
    // Variáveis de ambiente específicas de cada nó
    this.hostId = process.env.HOSTID;
    this.hostname = process.env.HOSTNAME;
    this.processId = process.env.PROCESS_ID;
    this.localIp = process.env.IP_LOCAL;
    this.port = parseInt(`300${process.env.HOSTID}`) || 3000; // parseInt(process.env.NODE_PORT) || 3000;
    this.ipList = process.env.IP_LIST.split(","); // Convertendo a string em array
    
    this.io = null;
    this.server = null;
    this.successorIp = null
  }

  initServer() {
    this.server =  http.createServer();

    this.io =  socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

     this.io.on("connection", (socket) => {
      
      let clientIp = socket.request.connection.remoteAddress;
      if (clientIp.substr(0, 7) === "::ffff:") {
        clientIp = clientIp.substr(7)
      }
      console.log(`IP ${clientIp} estabeleceu conexão!`);
      socket.emit('conexaoConfirmada', { mensagem: 'Conexão bem-sucedida!' });

      // Tratar eventos específicos aqui
      socket.on("event_name", (data) => {
        // Lógica de manipulação do evento
      });

    });

     this.server.listen(this.port, () => {
      console.log(`Node server running on port ${this.port}`); 
    });
  }

  // Conecta ao nó sucessor
  connectToSuccessor() {
    // Define o IP do nó sucessor
    let ipAddress = this.localIp;
    let parts = ipAddress.split('.');
    let lastNumber = Math.min(parseInt(parts[parts.length - 1], 10) + 1, 255);
    parts[parts.length - 1] = lastNumber.toString();
    let successorIp = parts.join('.');
    this.successorIp = successorIp

    // Estabelece conexão com nó sucessor
    let client = socketClient(`http://127.0.0.1:3002`); //socketClient(`http://${this.successorIp}:3000`);

    setTimeout(() => {
      if(client.on().connected){
        console.log(`Conectado ao sucessor ${this.successorIp}`);
      }
      else{
        let parts = ipAddress.split('.');
        parts[parts.length - 1] = 3;
        let successorIp =  parts.join('.');
        this.successorIp = successorIp
  
        let client = socketClient(`http://127.0.0.1:3001`); //socketClient(`http://172.25.0.3:3000`);
        
        setTimeout(() => {
          if(!client.on().connected){
            console.log(`Erro ao conectar-se a ${this.successorIp}`);
            return
          }
    
          console.log(`Conectado ao sucessor ${this.successorIp}`);
          return
        }, 3000);
      }
    }, 3000);
  }

  connectToOtherNodes() {
    this.ipList.forEach((ip) => {
      const client = socketClient(`http://${ip}:`, {
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
      localIp: process.env.IP_LOCAL
      
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

  // Lida com a recepção de uma mensagem de coordenador
  onCoordinatorMessageReceived(message) {
    if (message.type === "COORDINATOR") {
      console.log(`New coordinator: ${message.coordinatorId}`);
    }

    

  }
}

module.exports = DistributedNode;
