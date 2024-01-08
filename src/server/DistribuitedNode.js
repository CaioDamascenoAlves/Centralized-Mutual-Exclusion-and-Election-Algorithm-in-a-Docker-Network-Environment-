const http = require("http");
const socketIo = require("socket.io");

const ipsToObjectSorted = require("./utils/IpsToObjectSorted");
const connecToNode = require("./utils/ConnecToNode");
const getClientIp = require("./utils/GetClientIp");

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

      // Evento - Resposta se é coordenador
      socket.on("AreYouCoordinator", async(data) => {
        console.log(data)
        //let client = await connecToNode(`${clientIp}`);
        let client = await connecToNode(`${clientIp}:3002`);
        client.emit('IamCoordinator', { isCoordinator: this.isCoordinator });
      });

      // Evento - Requisição quem é o coodenador
      socket.on("IamCoordinator", async (data) => {
        if(data && data.isCoordinator) {
          this.coordinatorIp = await getClientIp(socket);
        }
        console.log("aaaa");
        console.log(socket.request.connection.remoteAddress);
        console.log(getClientIp(socket));
        console.log(this.coordinatorIp);
      });

    });

    //await this.verifyCoordinator();

    await this.connectAllNodes();
    console.log(this.allNodes) 
  }
  
  // Conecta com todos os nós
  async connectAllNodes() {
    let ids = Object.keys(this.ipList);

    for (const id of ids) {
      if(parseInt(id) !== this.id) {
        
        let client = await connecToNode('127.0.0.1:3003');
        //let client = await connecToNode(this.ipList[id]);

        if(client && client.on().connected){ 
          this.allNodes = {
            ...this.allNodes,
            [id]: client,
          }
        }
      }
    }
  }

  // Conecta ao nó sucessor
  async connectToSuccessor() {

    // Estabelece conexão com nó sucessor
    //let client = await connecToNode(this.successorIp);
    let client = await connecToNode('127.0.0.1:3003');

    if(client && client.on().connected){
      console.log(`Conectado ao sucessor ${this.successorIp}`);
      return client
    }
    else{
      var ids = Object.keys(this.ipList);

      for (const id of ids) {
        if(parseInt(id) > this.id) {
          
          let client = await connecToNode(this.ipList[id]);

          if(client && client.on().connected){
            this.successorIp = this.ipList[id];
            console.log(`Conectado ao sucessor ${this.successorIp}`);
            return client;
          }
        }
      }

      let client = await connecToNode(this.ipList[ids[0]]);
      
      if(client && client.on().connected){
        this.successorIp = this.ipList[ids[0]];
        console.log(`Conectado ao sucessor ${this.successorIp}`);
        return client;
      }
      console.log(`Erro ao conectar-se a ${this.successorIp}`);
      this.successorIp = null;
      return null;
    }
  }

  async verifyCoordinator() {
    if(this.coordinatorIp) {
      return this.coordinatorIp;
    }

    let ids = Object.keys(this.ipList);

    for (const id of ids) {
      if(parseInt(id) !== this.id) {
        
        //let client = await connecToNode(this.ipList[id]);
        let client = await connecToNode('127.0.0.1:3003');

        if(client && client.on().connected){ 
          this.successorIp = this.ipList[id];
          client.emit('AreYouCoordinator', { mensagem: 'Você é o coordenador?' });
          return null;
        }
      } 
    }
  }

}

module.exports = DistributedNode;
