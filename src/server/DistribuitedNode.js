const http = require("http");
const socketIo = require("socket.io");

const printEnvironmentVariables = require("./utils/PrintEnvironmentVariables");
const ipsToObjectSorted = require("./utils/IpsToObjectSorted");
const connecToNode = require("./utils/ConnecToNode");
const getClientIp = require("./utils/GetClientIp");
const getClientPort = require("./utils/GetClientPort");

class DistributedNode {
  constructor() {
    // Variáveis de ambiente específicas de cada nó
    this.hostname = process.env.HOSTNAME;
    this.localIp = process.env.IP_LOCAL;
    this.port = parseInt(process.env.NODE_PORT);
    
    this.io = null;
    this.server = null;
    this.ipList = null;
    this.successorIp = null;
    this.coordinatorIp = null;
    this.isCoordinator = false;

    this.InElection = false;
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

    this.io.on("connection", (socket) => {

      // Evento - Ouvir iniciar eleição
      socket.on("ELEICAO", async(data) => {
        await this.startElection(data);
      });

      // Evento - Ouvir coodenador eleito
      socket.on("COORDENADOR", async (data) => {

        this.coordinatorIp = data.coordinator;
        if(this.coordinatorIp == this.localIp) {
          this.isCoordinator = true;
        }
        else {
          this.isCoordinator = false;
        }
        
        printEnvironmentVariables(this);
      });

      // Evento - Requisição em processamento
      socket.on("RequestInProcessing", (data) => {
        this.requestSent = true;
      });

      // Evento - Coordenador - resposta de requisição GET
      socket.on("RequestGet", async (data) => {
        if(this.isCoordinator) {
          const clientIp = getClientIp(socket);
          const clientPort = getClientPort(clientIp);
          const clientSocket = await connecToNode(`${clientIp}:${clientPort}`);
          clientSocket.emit('RequestInProcessing', { mensagem: 'Response Teste 1' });
          //Entra na Fila
        }
      });
    });
    

    // SIMULAÇÃO
    await this.startElection([]);
    
    setTimeout(async() => {
      if(this.isCoordinator) {
        console.log("Teste Desconexão")
        this.isCoordinator = false;
        this.coordinatorIp = 'Disconnect';
        this.successorIp = 'Disconnect';
      }
      if(this.coordinatorIp !== 'Disconnect' && !this.isCoordinator){
        await this.requestExemple();
      }
    }, 20000);

    setTimeout(async() => {
      if(this.coordinatorIp == 'Disconnect') {
        console.log("Teste Conexão")
        await this.startElection([]);
        printEnvironmentVariables(this);
      }
    }, 50000);

    setTimeout(async() => {
      if(!this.isCoordinator) {
        await this.requestExemple();
      }
    }, 80000);

  }

  // Verifica conexão com nó sucessor 
  async verifySuccessor() {
    if(this.successorIp) {
      const successorPort = getClientPort(this.successorIp);
      let successorSocket = await connecToNode(`${this.successorIp}:${successorPort}`);
  
      if(successorSocket && successorSocket.connected) {
        return successorSocket;
      }
    }
    else {
      return await this.electSuccessor();
    }
  }

  // Conecta com nó sucessor
  async electSuccessor() {

    if(this.successorIp) {
      this.successorIp = null;
    }

    for(const clientIp of Object.values(this.ipList)) {
      
      const clientPort = getClientPort(clientIp)

      if(clientPort > this.port) {
        
        const clientSocket = await connecToNode(`${clientIp}:${clientPort}`);
        if(clientSocket && clientSocket.connected) {
          this.successorIp = clientIp;
          return clientSocket
        }
      }
    }

    const clientIp = Object.values(this.ipList)[0];
    const clientPort = getClientPort(clientIp);
    const clientSocket = await connecToNode(`${clientIp}:${clientPort}`);
    if(clientSocket && clientSocket.connected) {
      this.successorIp = clientIp;
      return clientSocket
    }

    return null;
  }

  // Disconecta do nó Coordenador
  async removeCoordinator() {

    Object.keys(this.ipList).forEach(id => {
      if (this.ipList[id] === this.coordinatorIp) {
          delete this.ipList[id];
      }
    });

    if(this.coordinatorIp && this.coordinatorIp == this.successorIp) {
      await this.electSuccessor()
    }

    this.coordinatorIp = null;
  }

  // Inicia Eleição
  async startElection(electionList) {

    if( !electionList.includes(this.port) && ( electionList.length === 0 || electionList[0] > this.port ) ) {

      for(const clientPort of electionList) {
        if (!this.ipList.hasOwnProperty(clientPort)) {
          
          let lastPart = clientPort % 3000;
          const clientIp = `172.25.0.${lastPart}`;
          
          this.ipList = {
            ...this.ipList,
            [clientPort]: clientIp
          }
  
          this.ipList = ipsToObjectSorted(this.ipList);
        }
      }

      const successorSocket = await this.electSuccessor();

      electionList.push(this.port);
      console.log(`Lista de Processos da Eleição: [${electionList}]`);

      if(successorSocket) {
        successorSocket.emit('ELEICAO', electionList);
        successorSocket.disconnect();
      }

    }
    else if(electionList[0] == this.port){

      const coordinatorPort = Math.max(...electionList);
      const coordinatorIp = this.ipList[coordinatorPort];

      this.coordinatorIp = coordinatorIp;
      if(this.coordinatorIp == this.localIp) {
        this.isCoordinator = true;
      }
      printEnvironmentVariables(this);

      for(const clientIp of Object.values(this.ipList)) {

        if(this.localIp !== clientIp) {

          let clientPort = getClientPort(clientIp)
          let clientSocket = await connecToNode(`${clientIp}:${clientPort}`)

          if(clientSocket && clientSocket.connected) {
            clientSocket.emit('COORDENADOR', {
              coordinator: coordinatorIp,
              processList: electionList
            });
            clientSocket.disconnect();
          }
        }
      }
    }
  }

  // Exemplo de requisição ao Coordenador
  async requestExemple() {

    let coordinatorPort = getClientPort(this.coordinatorIp);
    let coordinatorSocket = await connecToNode(`${this.coordinatorIp}:${coordinatorPort}`);

    if(coordinatorSocket && coordinatorSocket.connected) {
      coordinatorSocket.emit('RequestGet', { mensagem: 'Request Teste 1' });
      this.requestSent = false;

      setTimeout(async() => {
        if(this.requestSent) {
          console.log(`Requisição em processamento!`);
        }
        else{
          console.log(`Requisição sem resposta!`);
          await this.removeCoordinator();
          await this.startElection([]);
        }
      }, 5000);
    }
    else{
      await this.startElection([]);
    }
    
  }
}

module.exports = DistributedNode;
