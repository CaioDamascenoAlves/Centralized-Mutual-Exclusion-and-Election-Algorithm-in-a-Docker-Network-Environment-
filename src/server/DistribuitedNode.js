const http = require("http");
const socketIo = require("socket.io");
const { Pool } = require("pg");

const printEnvironmentVariables = require("./utils/PrintEnvironmentVariables");
const ipsToObjectSorted = require("./utils/IpsToObjectSorted");
const connecToNode = require("./utils/ConnecToNode");
const getClientIp = require("./utils/GetClientIp");
const getClientPort = require("./utils/GetClientPort");
const { copyFileSync } = require("fs");

const MIN_INTERVAL = 15000; // 15 segundos
const MAX_INTERVAL = 25000; // 25 segundos
const TIMEOUT_LIMIT = 10000; // 10 segundos para timeout

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

    this.successorSocket = null;

    this.requestSent = false;
    this.inElection = false;
    this.electionList = [];

    this.requestQueue = []; // Fila de requisições
    this.queueLimit = 6; // Limite máximo da fila
    this.isProcessing = false; // Flag para indicar se uma requisição está sendo processada

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
        await new Promise((resolve) => setTimeout(resolve, 15000));
        this.coordinatorIp = data.coordinator;
        this.inElection = false;
        this.electionList = [];
        if(this.coordinatorIp == this.localIp) {
          this.isCoordinator = true;
          await this.setupCoordinatorServer();
        }
        else {
          this.isCoordinator = false;
          await this.setupRegularNodeServer();
        }
        
        printEnvironmentVariables(this);
      });

      // Evento - Ouvir máquina se conectando ao anel
      socket.on("reconnect", async (data) => {
        await this.reconnect(data.port);
        printEnvironmentVariables(this);
      });

      // Evento - Remove o coorndenador e se conecta de novo ao anel
      socket.on("Disconnect", async () => {

        socket.off("log_request", (requestData) => {
          console.log("Recebida solicitação de log:", requestData);
          this.addToQueue(requestData, socket);
        });
        
        await this.removeCoordinator();
        await new Promise((resolve) => setTimeout(resolve, 80000));
        await this.connectToRing();
      });

      // Evento - Ouve requests dos nós regulares
      if(this.isCoordinator && !this.inElection) {
        console.log("Nó conectado:", getClientIp(socket));

        socket.on("log_request", (requestData) => {
          console.log("Recebida solicitação de log:", requestData);
          this.addToQueue(requestData, socket);
        });
      }
    });
    
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await this.startElection([]);

  }

  // Conecta com nó sucessor
  async electSuccessor() {

    this.successorIp = null;
    this.successorSocket = null;

    let clientSocket = null;

    for(const clientIp of Object.values(this.ipList)) {
      
      const clientPort = getClientPort(clientIp)

      if(clientPort > this.port) {
        
        clientSocket = await connecToNode(`${clientIp}:${clientPort}`);
        if(clientSocket && clientSocket.connected) {
          this.successorIp = clientIp;
          this.successorSocket = clientSocket;
          return clientSocket
        }
      }
    }

    if(!clientSocket) {
      const clientIp = Object.values(this.ipList)[0];
      const clientPort = getClientPort(clientIp);
      clientSocket = await connecToNode(`${clientIp}:${clientPort}`);
      if(clientSocket && clientSocket.connected) {
        this.successorIp = clientIp;
        this.successorSocket = clientSocket;
        return clientSocket
      }

      return await this.electSuccessor();
    }
  }

  // Disconecta do nó Sucessor 
  async removeSuccessor() {

    if(this.successorSocket && this.successorSocket.connected) {
      await this.successorSocket.disconnect(true);
    }

    this.successorSocket = null; 
    this.successorIp = null;
  }

  // Confere se à nó sucessor e o retorna
  async getSuccessor() {

    if(this.successorSocket && this.successorSocket.connected) {
      return this.successorSocket;
    }

    await this.removeSuccessor();
    const successorSocket = await this.electSuccessor();
    return successorSocket;
  }

  // Disconecta do nó Coordenador
  async removeCoordinator() {

    if(this.coordinatorIp && this.localIp !== this.coordinatorIp) {
      Object.keys(this.ipList).forEach(id => {
        if (this.ipList[id] === this.coordinatorIp) {
            delete this.ipList[id];
        }
      });
    }

    if(this.coordinatorIp && this.coordinatorIp == this.successorIp) {
      await this.removeSuccessor();
      await this.electSuccessor();
    }

    if(this.isCoordinator) {
      this.isCoordinator = false;
      this.requestQueue = [];
    }

    this.coordinatorIp = null;
  }

  // Reconecta máquina que estava inativa
  async reconnect(portSee) {
    if (!this.ipList.hasOwnProperty(portSee)) {
      
      let lastPart = portSee % 3000;
      const ipSee = `172.25.0.${lastPart}`;
      
      this.ipList = {
        ...this.ipList,
        [portSee]: ipSee
      }

      this.ipList = ipsToObjectSorted(this.ipList);
      
      if(this.port + 1 == portSee) {
        const successorSocket = await this.electSuccessor();
        successorSocket.emit('COORDENADOR', {coordinator: this.coordinatorIp});
      }

      console.log(`Nó ${ipSee}:${portSee} Entrou na rede!`);
    }
  }

  async connectToRing() {
    for(const clientIp of Object.values(this.ipList)) {

      if(this.localIp !== clientIp) {

        let clientPort = getClientPort(clientIp)
        let clientSocket = await connecToNode(`${clientIp}:${clientPort}`)

        if(clientSocket && clientSocket.connected) {
          clientSocket.emit('reconnect', {port: this.port});
          clientSocket.disconnect(true);
        }
      }
    }
  }

  // Inicia Eleição
  async startElection(electionList) {
    for(const clientPort of electionList) {
      await this.reconnect(clientPort);
    }

    if(!electionList.includes(this.port) && ( electionList.length === 0 || electionList[0] > this.port ) ) {
      this.inElection = true;
      await this.removeCoordinator();
      const successorSocket = await this.getSuccessor()

      electionList.push(this.port);
      this.electionList = electionList;
      console.log(`Lista de Processos da Eleição: [${electionList}]`);

      if(successorSocket) {
        successorSocket.emit('ELEICAO', electionList);
      }
    }
    else if(!this.inElection && !electionList.includes(this.port) && electionList[0] < this.port) {
      this.inElection = true;
      await this.removeCoordinator();
      const successorSocket = await this.getSuccessor()

      electionList = [];
      electionList.push(this.port);
      this.electionList = electionList;
      console.log(`Lista de Processos da Eleição: [${electionList}]`);

      if(successorSocket) {
        successorSocket.emit('ELEICAO', electionList);
      }
    }
    else if(electionList[0] == this.port){
      const coordinatorPort = Math.max(...electionList);
      const coordinatorIp = this.ipList[coordinatorPort];

      this.coordinatorIp = coordinatorIp;
      this.inElection = false;
      this.electionList = [];
      if(this.coordinatorIp == this.localIp) {
        this.isCoordinator = true;
        await this.setupCoordinatorServer();
      }
      printEnvironmentVariables(this);

      const successorSocket = await this.getSuccessor()
      await successorSocket.emit('COORDENADOR', {
        coordinator: coordinatorIp,
        processList: electionList
      });

      for(const clientIp of Object.values(this.ipList)) {

        if(this.localIp !== clientIp && this.successorIp !== clientIp) {

          let clientPort = getClientPort(clientIp)
          let clientSocket = await connecToNode(`${clientIp}:${clientPort}`)

          if(clientSocket && clientSocket.connected) {
            clientSocket.emit('COORDENADOR', {
              coordinator: coordinatorIp,
              processList: electionList
            });
            clientSocket.disconnect(true);
          }
        }
      }
    }
  }

  // Configurar servidor do coordenador
  async setupCoordinatorServer() {
    await this.connectToDatabase();
  }

  // Exemplo de requisição ao Coordenador
  async setupRegularNodeServer() {
    if(!this.isCoordinator && !this.inElection) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      let coordinatorPort = getClientPort(this.coordinatorIp);
      let coordinatorSocket = await connecToNode(`${this.coordinatorIp}:${coordinatorPort}`);

      if(coordinatorSocket && coordinatorSocket.connected) {
        console.log(`Conectado ao coordenador no endereço ${this.coordinatorIp}:${coordinatorPort}`);
        await this.initiateRandomRequests(coordinatorSocket);
      }
    }
  }

  // Configuração e conexão com banco
  async connectToDatabase() {
    // Configuração do banco de dados
    const dbConfig = {
      host: "172.25.0.6",
      port: 5432,
      user: "user",
      password: "password",
      database: "distributed_systems_db",
    };

    this.dbPool = new Pool(dbConfig);

    await this.dbPool.connect((error) => {
      if (error) {
        console.error("Erro ao conectar no banco de dados:", error);
        return;
      }

      console.log("Conectado ao banco de dados PostgreSQL com sucesso.");
    });
  }

  async disconnectFromDatabase() {
    // Verifica se a pool de conexões existe e está conectada
    if (this.dbPool) {
      await this.dbPool
        .end()
        .then(() =>
          console.log("Desconectado do banco de dados PostgreSQL com sucesso.")
        )
        .catch((error) =>
          console.error("Erro ao desconectar do banco de dados:", error)
        );
    }
  }

  // Inicia um ciclo de solicitações aleatórias ao coordenador
  async initiateRandomRequests(coordinatorSocket) {
    let tookTimeout = false;
    let called = null;
    const sendRequest = () => {
      if(!this.inElection && !this.isCoordinator && !tookTimeout) {
        const requestData = {
          type: "log_request",
          hostname: this.hostname,
          timestamp: Date.now(),
          requestId: `req-${Date.now()}-${Math.random()}`,
        };

        const timeout = setTimeout(async () => {
          console.log(`Tempo de resposta excedido para ${requestData.requestId}.`);
          coordinatorSocket.off(`log_response-${requestData.requestId}`);
          tookTimeout = true;
          clearTimeout(timeout);
          clearTimeout(called);
        }, TIMEOUT_LIMIT);
        
        coordinatorSocket.once(
          `log_response-${requestData.requestId}`,
          (response) => {
            clearTimeout(timeout);
            console.log("Resposta recebida do coordenador:", response);
            coordinatorSocket.off(`log_response-${requestData.requestId}`);
          }
        );

        coordinatorSocket.emit("log_request", requestData);
      }
    }

    let engine = setInterval(async () => {
      if(tookTimeout && !this.inElection && this.electionList.length == 0) {
        clearTimeout(called);
        clearInterval(engine);
        await coordinatorSocket.emit("Disconnect");
        //await coordinatorSocket.disconnect(true);
        this.inElection = true;
        await this.startElection([]);
        return
      }
      
      if(this.inElection) {
        clearTimeout(called);
        clearInterval(engine);
        tookTimeout = true;
        return
      }

      if(!tookTimeout && !this.inElection && !this.isCoordinator) {
        const randomDelay = Math.random() * MAX_INTERVAL;
        called = setTimeout(sendRequest, randomDelay);
      }

    }, MIN_INTERVAL);


  }

  // Adiciona na fila
  addToQueue(requestData, socket) {
      if (this.requestQueue.length < this.queueLimit) {
        this.requestQueue.push({ requestData, socket });
        console.log("Requisição adicionada à fila:", requestData);
      } else {
        // Opção de tratamento quando a fila está cheia
        console.log("Tamanho máximo da fila atingido. ");
      }
      if (!this.isProcessing) {
        this.processNextInQueue();
    }
  }

  // Processa o próximo item na fila
  processNextInQueue() {
      if (this.requestQueue.length > 0) {
        this.isProcessing = true;
        const { requestData, socket } = this.requestQueue.shift();
        this.processRequest(requestData, socket);
      } else {
        this.isProcessing = false;
    }
  }

  // Processa uma requisição específica
  processRequest(request, socket) {
      console.log("Processando requisição:", request);

      const queryText =
        "INSERT INTO log_entries(hostname, timestamp) VALUES($1, $2)";
      const values = [request.hostname, new Date(request.timestamp)];

      this.dbPool.query(queryText, values, (err, res) => {
        if (err) {
          console.error("Erro ao gravar no banco de dados:", err.stack);
          // Envia a resposta através do socket especificado
          socket.emit(`log_response-${request.requestId}`, {
            status: "Failure",
            error: err.message,
          });
        } else {
          console.log("Gravação no banco de dados bem-sucedida:", res.rows[0]);
          // Envia a resposta através do socket especificado
          socket.emit(`log_response-${request.requestId}`, {
            status: "Success",
            data: res.rows[0],
          });
        }

        // Após processar, processar a próxima requisição na fila
        setTimeout(() => {
          this.isProcessing = false;
          this.processNextInQueue();
        }, 5000); // Delay para simular o processamento e garantir exclusão mútua
      });
  }

}

module.exports = DistributedNode;
