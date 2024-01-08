const http = require("http");
const socketIo = require("socket.io");
const socketClient = require("socket.io-client");
const { Pool } = require("pg");

const ipsToObjectSorted = require("./utils/IpsToObjectSorted");

const MIN_INTERVAL = 5000; // 5 segundos
const MAX_INTERVAL = 15000; // 15 segundos
const TIMEOUT_LIMIT = 7000; // 7 segundos para timeout

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

    // Processar IP_LIST para extrair os IDs
    this.ipList = process.env.IP_LIST.split(",").map((ip) => ip.trim());
    this.id = parseInt(this.localIp.split(".").pop());

    // Determinar o coordenador baseado no maior ID
    this.coordinatorId = Math.max(
      ...this.ipList.map((ip) => parseInt(ip.split(".").pop()))
    );
    this.isCoordinator = this.id === this.coordinatorId;

    this.requestQueue = []; // Fila de requisições
    this.queueLimit = 10; // Limite máximo da fila
    this.isProcessing = false; // Flag para indicar se uma requisição está sendo processada
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

    let parts = this.localIp.split(".");
    this.id = parseInt(parts[parts.length - 1]);
    this.successorIp = this.ipList[this.id + 1];

    // console.log(`Variáveis de ambiente:`);
    // console.log(`Hostname: ${this.hostname}`);
    // console.log(`IP Local: ${this.localIp}`);
    // console.log(`Porta: ${this.port}`);
    // console.log(`ID: ${this.id}`);
    // console.log(`IP sucessor: ${this.successorIp}`);
    // console.log("Lista de IPs:");
    // console.table(this.ipList);

    this.io.on("connection", (socket) => {
      let clientIp = socket.request.connection.remoteAddress;
      if (clientIp.substr(0, 7) === "::ffff:") {
        clientIp = clientIp.substr(7);
      }
      console.log(`IP ${clientIp} estabeleceu conexão!`);
      socket.emit("conexaoConfirmada", { mensagem: "Conexão bem-sucedida!" });

      // Tratar eventos específicos aqui
      socket.on("event_name", (data) => {
        // Lógica de manipulação do evento
      });
    });

    if (this.isCoordinator) {
      console.log(`SOU O COORDENADOR INICIAL: ${this.coordinatorId}`);
      this.setupCoordinatorServer();
    } else {
      this.setupRegularNodeServer();
      console.log("Não é o coordenador");
    }
  }

  // Conectar ao banco de dados
  connectToDatabase() {
    // Configuração do banco de dados
    const dbConfig = {
      host: "172.25.0.2",
      port: 5432,
      user: "user",
      password: "password",
      database: "distributed_systems_db",
    };

    this.dbPool = new Pool(dbConfig);

    this.dbPool.connect((error) => {
      if (error) {
        console.error("Erro ao conectar no banco de dados:", error);
        return;
      }

      console.log("Conectado ao banco de dados PostgreSQL com sucesso.");
    });
  }

  // Configurar servidor do coordenador
  setupCoordinatorServer() {
    this.connectToDatabase();

    this.io.on("connection", (socket) => {
      console.log("Nó conectado:", socket.id);

      socket.on("simple_request", (data) => {
        console.log("Recebida solicitação simples:", data);
        socket.emit("simple_response", { message: "Hello from coordinator" });
      });

      socket.on("log_request", (requestData) => {
        console.log("Recebida solicitação de log:", requestData);
        this.addToQueue(requestData, socket);
      });
    });

    // this.io.on("log_request", (data) => {
    //   console.log("Recebida solicitação de log:", data);
    //   this.processRequest(data);
    // });

    // // Iniciar o processamento da fila
    // this.initQueueProcessing();
  }
  // Adiciona uma requisição à fila
  addToQueue(requestData, socket) {
    if (this.requestQueue.length < this.queueLimit) {
      this.requestQueue.push({ requestData, socket });
      console.log("Requisição adicionada à fila:", requestData);
    } else {
      // Opção de tratamento quando a fila está cheia
      console.log("Fila cheia. Requisição descartada:", requestData);
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

  const queryText = "INSERT INTO log_entries(hostname, timestamp) VALUES($1, $2)";
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
    }, 1000); // Delay para simular o processamento e garantir exclusão mútua
  });
}


  // Conecta ao nó sucessor
  connectToSuccessor() {
    // Estabelece conexão com nó sucessor
    let client = socketClient(`http://${this.successorIp}:3000`);

    setTimeout(() => {
      if (client.on().connected) {
        console.log(`Conectado ao sucessor ${this.successorIp}`);
      } else {
        var ids = Object.keys(this.ipList);

        for (const id of ids) {
          if (parseInt(id) > this.id) {
            let client = socketClient(`http://${this.ipList[id]}:3000`);

            setTimeout(() => {
              if (client.on().connected) {
                this.successorIp = this.ipList[id];
                console.log(`Conectado ao sucessor ${this.successorIp}`);
                return;
              }
            }, 3000);
          }
        }

        let client = socketClient(`http://${this.ipList[ids[0]]}:3000`);

        setTimeout(() => {
          if (client.on().connected) {
            this.successorIp = this.ipList[ids[0]];
            console.log(`Conectado ao sucessor ${this.successorIp}`);
            return;
          }
          console.log(`Erro ao conectar-se a ${this.successorIp}`);
          this.successorIp = null;
          return;
        }, 3000);
      }
    }, 3000);
  }

  // Configura o servidor em um nó regular
  setupRegularNodeServer() {
    console.log("Configurando servidor para nó regular.");

    // Estabelece conexão com o servidor do coordenador
    this.connectToCoordinator();

    // Configuração adicional necessária para um nó regular
    // Por exemplo, pode ser necessário configurar ouvintes de eventos,
    // agendar tarefas periódicas, etc.
    this.setupRegularNodeTasks();

    // Configurar ouvintes para eventos relacionados à eleição
    this.io.on("coordinator_changed", (newCoordinatorId) => {
      this.updateCoordinator(newCoordinatorId);
    });
  }

  // Estabelece conexão com o coordenador
connectToCoordinator() {
  const coordinatorUrl = `http://${this.ipList[this.coordinatorId]}:3000`;
  this.coordinatorClient = socketClient(coordinatorUrl);

  this.coordinatorClient.on("connect", () => {
    console.log(`Conectado ao coordenador no endereço ${coordinatorUrl}`);
    // Inicia o ciclo de solicitações aleatórias ao coordenador
    this.initiateRandomRequests();
  });

  this.coordinatorClient.on("simple_response", (data) => {
    console.log("Resposta recebida do coordenador:", data.message);
    // Manter a conexão aberta para comunicação contínua
  });

  this.coordinatorClient.on("disconnect", () => {
    console.log("Desconectado do coordenador.");
    // Reconectar ou tratar a desconexão conforme necessário
  });

  // Tratar outros eventos ou enviar mensagens conforme necessário
}

  // Atualiza as informações do coordenador e reconecta
  updateCoordinator(newCoordinatorId) {
    if (newCoordinatorId !== this.coordinatorId) {
      this.coordinatorId = newCoordinatorId;
      console.log(`Novo coordenador eleito: ${newCoordinatorId}`);

      // Desconectar do coordenador antigo, se necessário
      if (this.coordinatorClient && this.coordinatorClient.connected) {
        this.coordinatorClient.disconnect();
      }

      // Estabelecer nova conexão com o coordenador
      this.connectToCoordinator();
    }
  }

  // Inicia um ciclo de solicitações aleatórias ao coordenador
  initiateRandomRequests() {
    const sendRequest = () => {
      const requestData = {
        type: "log_request", // Tipo de solicitação
        hostname: this.hostname,
        timestamp: Date.now(),
        requestId: `req-${Date.now()}-${Math.random()}`, // Identificador único
      };

      const timeout = setTimeout(() => {
        console.log(
          `Tempo de resposta excedido para ${requestData.requestId}.`
        );
        this.coordinatorClient.off(`log_response-${requestData.requestId}`);
      }, TIMEOUT_LIMIT);

      this.coordinatorClient.once(
        `log_response-${requestData.requestId}`,
        (response) => {
          clearTimeout(timeout);
          console.log("Resposta recebida do coordenador:", response);
          this.coordinatorClient.off(`log_response-${requestData.requestId}`);
        }
      );

      this.coordinatorClient.emit("log_request", requestData);
    };

    setInterval(() => {
      const randomDelay = Math.random() * MAX_INTERVAL;
      setTimeout(sendRequest, randomDelay);
    }, MIN_INTERVAL);
  }

  // Configura tarefas específicas para um nó regular
  setupRegularNodeTasks() {
    // Aqui você pode configurar tarefas que os nós regulares precisam executar
    // Por exemplo, enviar dados periodicamente para o coordenador,
    // ou realizar tarefas internas
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
      localIp: process.env.IP_LOCAL,
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
