const http = require("http");
const socketIo = require("socket.io");
const { Pool } = require("pg");

const printEnvironmentVariables = require("./utils/PrintEnvironmentVariables");
const ipsToObjectSorted = require("./utils/IpsToObjectSorted");
const connecToNode = require("./utils/ConnecToNode");
const getClientIp = require("./utils/GetClientIp");
const getClientPort = require("./utils/GetClientPort");

const MIN_INTERVAL = 5000; // 5 segundos
const MAX_INTERVAL = 15000; // 15 segundos
const TIMEOUT_LIMIT = 7000; // 7 segundos para timeout

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

    this.requestQueue = []; // Fila de requisições
    this.queueLimit = 10; // Limite máximo da fila
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

        this.coordinatorIp = data.coordinator;
        if(this.coordinatorIp == this.localIp) {
          this.isCoordinator = true;
        }
        else {
          this.isCoordinator = false;
        }
        
        printEnvironmentVariables(this);
      });
    });
    

    // SIMULAÇÃO
    await this.startElection([]);

    setTimeout(async() => {
      if(this.isCoordinator) {
        await this.setupCoordinatorServer();
      }
      else {
        await this.setupRegularNodeServer();
      }
    }, 20000);

    /*
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

    */

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
  async setupRegularNodeServer() {

    let coordinatorPort = getClientPort(this.coordinatorIp);
    let coordinatorSocket = await connecToNode(`${this.coordinatorIp}:${coordinatorPort}`);

    if(coordinatorSocket && coordinatorSocket.connected) {
      
      this.coordinatorSocket.on("connect", () => {
        console.log(`Conectado ao coordenador no endereço ${this.coordinatorIp}:${coordinatorPort}`);
        this.initiateRandomRequests(coordinatorSocket);
      });
    }
  }

  // Configuração e conexão com banco
  async connectToDatabase() {
    // Configuração do banco de dados
    const dbConfig = {
      host: "172.25.0.2",
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

  // Configurar servidor do coordenador
  async setupCoordinatorServer() {
    await this.connectToDatabase();

    this.io.on("connection", (socket) => {
      console.log("Nó conectado:", socket.id);

      socket.on("log_request", (requestData) => {
        console.log("Recebida solicitação de log:", requestData);
        this.addToQueue(requestData, socket);
      });
    });
  }

  // Inicia um ciclo de solicitações aleatórias ao coordenador
  async initiateRandomRequests(coordinatorSocket) {
    const sendRequest = () => {
      const requestData = {
        type: "log_request",
        hostname: this.hostname,
        timestamp: Date.now(),
        requestId: `req-${Date.now()}-${Math.random()}`,
      };

      const timeout = setTimeout(async () => {
        console.log(
          `Tempo de resposta excedido para ${requestData.requestId}.`
        );
        coordinatorSocket.off(`log_response-${requestData.requestId}`);

        // Desconectar do coordenador
        await this.removeCoordinator();

        // Iniciar o processo de eleição
        await this.startElection([]);
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
    };

    setInterval(() => {
      const randomDelay = Math.random() * MAX_INTERVAL;
      setTimeout(sendRequest, randomDelay);
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
