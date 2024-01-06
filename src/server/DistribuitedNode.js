const http = require("http");
const socketIo = require("socket.io");
const socketClient = require("socket.io-client");

const ipsToObjectSorted = require("./utils/IpsToObjectSorted")

class DistributedNode {
  constructor() {
    // Variáveis de ambiente específicas de cada nó
    this.hostname = process.env.HOSTNAME;
    this.localIp = process.env.IP_LOCAL;
    this.port = parseInt(process.env.NODE_PORT) || 3000;
    
    this.id = null;
    this.io = null;
    this.server = null;
    this.ipList = null;
    this.successorIp = null;
  }

  initServer() {
    this.server = http.createServer();

    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    this.server.listen(this.port, () => {
      console.log(`Node server running on port ${this.port}`); 
    });
  
    this.ipList = ipsToObjectSorted(process.env.IP_LIST);

    let parts = this.localIp.split('.');
    this.id = parseInt(parts[parts.length - 1]);
    this.successorIp = this.ipList[this.id + 1];

    console.log(`Variáveis de ambiente:`);
    console.log(`Hostname: ${this.hostname}`);
    console.log(`IP Local: ${this.localIp}`);
    console.log(`Porta: ${this.port}`);
    console.log(`ID: ${this.id}`);
    console.log(`IP sucessor: ${this.successorIp}`);
    console.log('Lista de IPs:');
    console.table(this.ipList);

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
  }

  // Conecta ao nó sucessor
  connectToSuccessor() {
    // Estabelece conexão com nó sucessor
    let client = socketClient(`http://${this.successorIp}:3000`);

    setTimeout(() => {
      if(client.on().connected){
        console.log(`Conectado ao sucessor ${this.successorIp}`);
      }
      else{
        var ids = Object.keys(this.ipList);

        for (const id of ids) {
          if(parseInt(id) > this.id) {
            
            let client = socketClient(`http://${this.ipList[id]}:3000`);

            setTimeout(() => {
              if(client.on().connected){
                this.successorIp = this.ipList[id];
                console.log(`Conectado ao sucessor ${this.successorIp}`);
                return
              }
            }, 3000);
          }
        }

        let client = socketClient(`http://${this.ipList[ids[0]]}:3000`);
        
        setTimeout(() => {
          if(client.on().connected){
            this.successorIp = this.ipList[ids[0]];
            console.log(`Conectado ao sucessor ${this.successorIp}`);
            return
          }
          console.log(`Erro ao conectar-se a ${this.successorIp}`);
          this.successorIp = null;
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
