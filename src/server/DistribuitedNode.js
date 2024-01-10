const http = require("http");
const socketIo = require("socket.io");

const printEnvironmentVariables = require("./utils/PrintEnvironmentVariables");
const ipsToObjectSorted = require("./utils/IpsToObjectSorted");
const connecToNode = require("./utils/ConnecToNode");
const getClientIp = require("./utils/GetClientIp");
const getClientID = require("./utils/GetClientID");

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
    this.coordinatorIp = null;
    this.isCoordinator = false;
    this.allNodes = {}

    this.requestSent = false;
  }

  async initServer() {
    this.server = http.createServer();

    this.io = await socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    this.server.listen(this.port, () => {
      console.log(`Node server running on port ${this.port}`); 
    });
  
    this.ipList = ipsToObjectSorted(process.env.IP_LIST);
    this.id = getClientID(this.localIp)

    this.io.on("connection", (socket) => {

      // Evento - Resposta se é coordenador
      socket.on("AreYouCoordinator", async(data) => {
        let clientId = getClientID(getClientIp(socket))
        let client = this.allNodes[clientId]
        client.emit('IamCoordinator', { isCoordinator: this.isCoordinator });
      });

      // Evento - Requisição quem é o coodenador
      socket.on("IamCoordinator", async (data) => {
        if(data && data.isCoordinator) {
          this.coordinatorIp = await getClientIp(socket);
        }
      });

      // Evento - Requisição quem é o coodenador
      socket.on("YouAreCoordinator", (data) => {
        this.coordinatorIp = this.localIp;
        this.isCoordinator = true;
      });

      // Evento - Requisição em processamento
      socket.on("RequestInProcessing", (data) => {
        console.log(data)
        this.requestSent = true;
      });

      // Evento - Coordenador - resposta de requisição GET
      socket.on("RequestGet", (data) => {
        if(this.isCoordinator) {
          let clientId = getClientID(getClientIp(socket))
          let client = this.allNodes[clientId]

          client.emit('RequestInProcessing', { mensagem: 'Response Teste 1' });
          //Entra na Fila
        }
      });
    });
    
    await this.connectAllNodes();
    await this.electSuccessor();
    await this.electCoordinator();


    // SIMULAÇÃO
    setTimeout(async() => {
      printEnvironmentVariables(this);
      if(this.isCoordinator) {
        this.isCoordinator = false;
        this.coordinatorIp = 'Disconnect';
        this.successorIp = 'Disconnect';
      }
    }, 15000);

    setTimeout(async() => {
      if(this.coordinatorIp !== 'Disconnect'){
        await this.requestExemple();
      }
    }, 20000);

    setTimeout(async() => {
      printEnvironmentVariables(this);
    }, 35000);

    setTimeout(async() => {
      if(this.coordinatorIp !== 'Disconnect') {
        await this.requestExemple();
      }
    }, 40000);
  }
  
  // Conecta com todos os nós
  async connectAllNodes() {
    let ids = Object.keys(this.ipList);

    for (const id of ids) {
      if(parseInt(id) !== this.id) {
        
        //let client = await connecToNode('127.0.0.1:3003');
        let client = await connecToNode(this.ipList[id]);

        if(client && client.on().connected){ 
          this.allNodes = {
            ...this.allNodes,
            [id]: client,
            //3: client,
          }
        }
      }
    }
  }

  // Verifica conexão com nó sucessor
  async electSuccessor() {

    if(this.successorIp) {
      let successorId = getClientID(this.successorIp)
      let successor = this.allNodes[successorId]

      if(successor && successor.connected) {
        await successor.disconnect();
        delete this.allNodes[successorId];
      }

      this.successorIp = null;
    }

    for (const [id, socket] of Object.entries(this.allNodes)) {
      if(id > this.id && socket.connected) {
        let successorIp = getClientIp(this.allNodes[id]);
        this.successorIp = successorIp;
        return
      }
    }

    let sucessor = Object.values(this.allNodes)[0];
    let successorIp = getClientIp(sucessor);
    this.successorIp = successorIp;
  }

  // Verifica conexão com nó coordenador
  async electCoordinator() {

    if(this.coordinatorIp) {
      let coordinatorId = getClientID(this.coordinatorIp)
      let coordinator = this.allNodes[coordinatorId]

      if(coordinator && coordinator.connected) {
        await coordinator.disconnect();
        delete this.allNodes[coordinatorId];
      }

      if(this.coordinatorIp == this.successorIp) {
        await this.electSuccessor()
      }

      this.coordinatorIp = null;
    }

    const ids = Object.keys(this.allNodes);
    const lastId = ids[ids.length - 1];

    if(lastId < this.id) {
      this.coordinatorIp = this.localIp
      this.isCoordinator = true
      this.io.emit('IamCoordinator', { isCoordinator: this.isCoordinator });
      return this.coordinatorIp;
    }

    for (const [_, socket] of Object.entries(this.allNodes)) {
      if(socket.connected) {
        socket.emit('AreYouCoordinator', { mensagem: 'Você é o coordenador?' });

        setTimeout(async() => {
          if(this.coordinatorIp) {
            return this.coordinatorIp;
          }
          else{
            return await this.startElection()
          }
        }, 5000);
      }
    
    }

  }

  // Inicia eleição
  async startElection(decrement = 1) {
    if(this.coordinatorIp) {
      return this.coordinatorIp;
    }

    const ids = Object.values(this.allNodes);
    const index = ids.length - decrement;
  
    if (index < 0) {
      return this.coordinatorIp;
    }
  
    const coordinator = ids[index];

    if (coordinator && coordinator.connected) {

      coordinator.emit('YouAreCoordinator', { mensagem: 'Você é o coordenador!' });
      let coordinatorIp = getClientIp(coordinator);
      this.coordinatorIp = coordinatorIp;
      return coordinatorIp;
    } else {

      return this.startElection(decrement + 1);
    }
  }

  async requestExemple() {

    let coordinatorId = getClientID(this.coordinatorIp)
    let coordinator = this.allNodes[coordinatorId]

    if(coordinator && coordinator.connected) {
      coordinator.emit('RequestGet', { mensagem: 'Request Teste 1' });
      this.requestSent = false;

      setTimeout(async() => {
        if(this.requestSent) {
          console.log(`Requisição em processamento!`);
        }
        else{
          console.log(`Requisição sem resposta!`);
          await this.electCoordinator();
        }
      }, 5000);
    }
    else{
      await this.electCoordinator();
    }
    
  }
}

module.exports = DistributedNode;
