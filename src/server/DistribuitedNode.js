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
    this.electing = null;
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

      // Evento - Ouvir competição para iniciar eleição
      socket.on("Competition", async(data) => {
        this.electing = data.electing;
        await this.competition(data.electing);
      });

      // Evento - Ouvir iniciar eleição
      socket.on("StartElection", async(data) => {
        this.electing = null;
        await this.processElection(data.id);
      });

      // Evento - Ouvir coodenador eleito
      socket.on("EndOfElection", async (data) => {
        if(data && data.isCoordinator) {
          this.coordinatorIp = await getClientIp(socket);
        }
      });

      // Evento - Requisição em processamento
      socket.on("RequestInProcessing", (data) => {
        this.requestSent = true;
      });

      // Evento - Coordenador - resposta de requisição GET
      socket.on("RequestGet", (data) => {
        if(this.isCoordinator) {
          let clientId = getClientID(getClientIp(socket));
          let client = this.allNodes[clientId];

          client.emit('RequestInProcessing', { mensagem: 'Response Teste 1' });
          //Entra na Fila
        }
      });
    });
    
    await this.connectAllNodes();
    let connectedSuccessor = await this.verifySuccessor(Object.values(this.allNodes).length);
    if(connectedSuccessor) {
      await this.startElection(this.id);
    }

    
    // SIMULAÇÃO
    setTimeout(async() => {
      printEnvironmentVariables(this);
      if(this.isCoordinator) {
        this.isCoordinator = false;
        this.coordinatorIp = 'Disconnect';
        this.successorIp = 'Disconnect';
      }
    }, 5000);

    setTimeout(async() => {
      if(this.coordinatorIp !== 'Disconnect' && !this.isCoordinator){
        await this.requestExemple();
      }
    }, 10000);


    setTimeout(async() => {
      printEnvironmentVariables(this);
    }, 30000);

    /*
    setTimeout(async() => {
      if(this.coordinatorIp !== 'Disconnect' && !this.isCoordinator) {
        await this.requestExemple();
      }
    }, 30000);

    */

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
  async verifySuccessor(numberOfNodes) {
    if(this.successorIp) {
      let successorId = getClientID(this.successorIp)
      let successor = this.allNodes[successorId]
  
      if(successor && successor.connected) {
        return true
      }
    }

    if(numberOfNodes && numberOfNodes > 0){
      await this.electSuccessor();
      return await this.verifySuccessor(numberOfNodes - 1);
    }
    else {
      return null;
    }
  }

  // Conecta com nó sucessor
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

  // Anuncia que está iniciando uma eleição
  async announceElection() {
    await this.competition();

    setTimeout(async() => {
      if(this.electing == this.id) {
        await this.startElection(this.id);
      }
    }, 10000);
  }

  // Disconecta do nó Coordenador
  async disconnectCoordinator() {
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
  }

  // Competição entre quem realizará a eleição
  async competition() {

    await this.disconnectCoordinator();

    let successorId = getClientID(this.successorIp)
    let successor = this.allNodes[successorId]

    if(this.electing == this.id) {
      return true
    }
    else if(!this.electing || this.electing < this.id) {
      successor.emit('Competition', {electing: this.id});
    }
    else if(this.electing > this.id) {
      successor.emit('Competition', {electing: this.electing});
    }

  }

  // Inicia Eleição
  async startElection(id) {
    let connectedSuccessor = await this.verifySuccessor();

    if(connectedSuccessor) {
      let successorId = getClientID(this.successorIp)
      let successor = this.allNodes[successorId]
      successor.emit('StartElection', {id: id});
    }
  }

  // Processa Eleição 
  async processElection(id) {

    if(id > this.id) {
      await this.startElection(id)
    }
    else if(id < this.id) {
      await this.startElection(this.id)
    }
    else if(id == this.id) {
      this.coordinatorIp = this.localIp
      this.isCoordinator = true

      for (const [_, socket] of Object.entries(this.allNodes)) {
        if(socket.connected) {
          socket.emit('EndOfElection', { isCoordinator: this.isCoordinator });
        }
      }
    }
  }

  // Exemplo de requisição ao Coordenador
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
          await this.announceElection();
        }
      }, 5000);
    }
    else{
      await this.startElection(this.id);
    }
    
  }
}

module.exports = DistributedNode;
