const http = require("http");
const socketIo = require("socket.io");
const socketClient = require("socket.io-client");
const { Pool } = require("pg");

const MIN_INTERVAL = 5000; // 5 segundos
const MAX_INTERVAL = 15000; // 15 segundos
const TIMEOUT_LIMIT = 7000; // 7 segundos para timeout

class DistributedNode {
  constructor() {
    // Variáveis de ambiente específicas de cada nó
    this.hostname = process.env.HOSTNAME;
    this.localIp = process.env.IP_LOCAL;
    this.port = parseInt(process.env.NODE_PORT);
    const ipListString = process.env.IP_LIST;

    if (ipListString) {
      this.ipList = ipListString.split(",").map((ip) => ip.trim());
    } else {
      console.error("IP_LIST não definido ou inválido");
      this.ipList = [];
    }

    // Mapeamento de IP para Porta
    this.ipToPortMap = {
      "172.25.0.3": 3000,
      "172.25.0.4": 3001,
      "172.25.0.5": 3002,
      "172.25.0.6": 3003,
      // Adicione os mapeamentos para todos os IPs e portas relevantes
    };

    console.log("IP_LIST:", this.ipList);

    this.io = null;
    this.server = null;
    this.client = null;

    this.isCoordinator = false; // Flag para indicar se este nó é o coordenador

    this.requestQueue = []; // Fila de requisições
    this.queueLimit = 10; // Limite máximo da fila
    this.isProcessing = false; // Flag para indicar se uma requisição está sendo processada

    this.isInElection = false; // Flag para indicar se uma eleição está em andamento
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

    this.io.on("connection", (socket) => {
      let clientIp = socket.request.connection.remoteAddress;
      if (clientIp.substr(0, 7) === "::ffff:") {
        clientIp = clientIp.substr(7);
      }
      console.log(`IP ${clientIp} estabeleceu conexão!`);
      socket.emit("conexaoConfirmada", { mensagem: "Conexão bem-sucedida!" });
      socket.on("disconnect", () => {
        console.log(`IP ${clientIp} desconectou.`);
      });

      // Configurar ouvintes para eventos relacionados à eleição
      socket.on("election_message", (message) => {
        this.onElectionMessageReceived(message);
      });
    });
    // Iniciar eleição assim que o servidor estiver ativo
    this.startElection();
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

      // socket.on("simple_request", (data) => {
      //   console.log("Recebida solicitação simples:", data);
      //   socket.emit("simple_response", { message: "Hello from coordinator" });
      // });

      socket.on("log_request", (requestData) => {
        console.log("Recebida solicitação de log:", requestData);
        this.addToQueue(requestData, socket);
      });

      // Adiciona tratamento para quando o coordenador atual for substituído
      socket.on("new_coordinator", (newCoordinatorPort) => {
        if (newCoordinatorPort !== this.port) {
          console.log(`Novo coordenador eleito: ${newCoordinatorPort}`);
          this.becomeRegularNode(newCoordinatorPort);
        }
      });
    });
  }

  // Adiciona uma requisição à fila
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

  // Transforma o coordenador atual em um nó regular
  becomeRegularNode(newCoordinatorPort) {
    console.log(`Transformando o nó atual em um nó regular.`);
    this.isCoordinator = false;
    this.coordinatorPort = newCoordinatorPort;

    // Desconectar de quaisquer serviços específicos do coordenador,
    // como banco de dados ou outros recursos.
    this.disconnectFromDatabase(); // Exemplo, substituir pela sua lógica real

    // Remover os ouvintes de eventos de socket que são específicos do coordenador
    this.io.removeAllListeners("connection");

    // Reconectar ao novo coordenador
    this.setupRegularNodeServer();
  }

  // Desconectar do banco de dados
  disconnectFromDatabase() {
    // Verifica se a pool de conexões existe e está conectada
    if (this.dbPool) {
      this.dbPool
        .end()
        .then(() =>
          console.log("Desconectado do banco de dados PostgreSQL com sucesso.")
        )
        .catch((error) =>
          console.error("Erro ao desconectar do banco de dados:", error)
        );
    }
  }

  // Configura o servidor em um nó regular
  setupRegularNodeServer() {
    console.log("Configurando servidor para nó regular.");

    // Estabelece conexão com o servidor do coordenador
    this.connectToCoordinator();

    // Configurar ouvintes para eventos relacionados à eleição
    this.io.on("coordinator_changed", (newCoordinatorId) => {
      this.updateCoordinator(newCoordinatorId);
    });
  }

  // Estabelece conexão com o coordenador
  connectToCoordinator() {
    const coordinatorUrl = `http://${this.ipList[this.coordinatorPort]}:3000`;
    this.coordinatorClient = socketClient(coordinatorUrl);

    this.coordinatorClient.on("connect", () => {
      console.log(`Conectado ao coordenador no endereço ${coordinatorUrl}`);
      this.initiateRandomRequests();
    });

    this.coordinatorClient.on("coordinator_message", (data) => {
      console.log(
        "Mensagem de novo coordenador recebida:",
        data.newCoordinatorId
      );
      this.updateCoordinator(data.newCoordinatorId);
    });

    this.coordinatorClient.on("disconnect", () => {
      console.log("Desconectado do coordenador.");
      // Implemente lógica de reconexão ou tratamento conforme necessário
    });
  }

  // Atualiza as informações do coordenador
  updateCoordinator(newCoordinatorPort) {
    if (newCoordinatorPort !== this.coordinatorPort) {
      this.coordinatorPort = newCoordinatorPort;
      console.log(`Novo coordenador eleito: ${newCoordinatorPort}`);

      // Desconectar do coordenador atual se estiver conectado
      if (this.coordinatorClient && this.coordinatorClient.connected) {
        this.coordinatorClient.disconnect();
      }

      // Reconectar ao novo coordenador
      this.connectToCoordinator();
    }
  }

  // Inicia um ciclo de solicitações aleatórias ao coordenador
  initiateRandomRequests() {
    const sendRequest = () => {
      const requestData = {
        type: "log_request",
        hostname: this.hostname,
        timestamp: Date.now(),
        requestId: `req-${Date.now()}-${Math.random()}`,
      };

      const timeout = setTimeout(() => {
        console.log(
          `Tempo de resposta excedido para ${requestData.requestId}.`
        );
        this.coordinatorClient.off(`log_response-${requestData.requestId}`);

        // Desconectar do coordenador
        this.coordinatorClient.disconnect();

        // Iniciar o processo de eleição
        this.startElection();
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

  // Inicia o processo de Eleição
  startElection() {
    if (this.isInElection) {
      console.log("Uma eleição já está em andamento.");
      return;
    }

    console.log("Iniciando uma nova eleição.");
    this.isInElection = true;

    const electionMessage = {
      type: "ELECTION",
      originPort: this.port,
      ports: [this.port],
    };

    // Enviar a mensagem de eleição para o próximo nó no anel
    this.sendElectionMessageToSuccessor(electionMessage);
  }

  onElectionMessageReceived(message) {
    if (message.type === "ELECTION") {
      // Adicionar o número do próprio nó à lista na mensagem
      if (!message.ports.includes(this.port)) {
        message.ports.push(this.port);
      }

      // Verificar se a mensagem retornou ao nó que iniciou a eleição
      if (message.originPort === this.port) {
        // Eleição concluída, determinar o coordenador
        const highestPort = Math.max(...message.ports);
        this.coordinatorPort = highestPort;
        this.isCoordinator = this.port === highestPort;

        if (this.isCoordinator) {
          this.becomeCoordinator();
        } else {
          this.setupRegularNodeServer();
        }
      } else {
        // Passar a mensagem para o sucessor
        this.sendElectionMessageToSuccessor(message);
      }
    }
  }

  sendElectionMessageToSuccessor(electionMessage) {
    if (!Array.isArray(this.ipList) || this.ipList.length === 0) {
      console.error("this.ipList não está definido ou é vazio");
      return;
    }

    const successorIndex = this.ipList.indexOf(this.localIp) + 1;
    const successorIp = this.ipList[successorIndex % this.ipList.length];
    const successorPort = this.ipToPortMap[successorIp];

    // Função para lidar com sucesso no envio da mensagem
    const onSuccess = () => {
      console.log(
        `Mensagem enviada com sucesso para ${successorIp}:${successorPort}`
      );
    };

    // Função para lidar com falha no envio da mensagem
    const onFail = () => {
      const nextSuccessorIndex = (successorIndex + 1) % this.ipList.length;
      const nextSuccessorIp = this.ipList[nextSuccessorIndex];
      const nextSuccessorPort = this.ipToPortMap[nextSuccessorIp];

      if (nextSuccessorIp === this.localIp) {
        console.error(
          "Falha ao enviar mensagem para ambos os sucessores. Enviando de volta ao originador."
        );
        if (electionMessage.originPort !== this.port) {
          const originatorPort = this.ipToPortMap[this.localIp]; // Assumindo que this.localIp é o IP do originador
          this.trySendMessage(
            this.localIp,
            originatorPort,
            electionMessage,
            onSuccess,
            () => {
              console.error(
                "Falha ao enviar mensagem de volta para o originador."
              );
            }
          );
        }
      } else {
        this.trySendMessage(
          nextSuccessorIp,
          nextSuccessorPort,
          electionMessage,
          onSuccess,
          () => {
            console.error("Falha ao enviar mensagem para ambos os sucessores.");
          }
        );
      }
    };

    this.trySendMessage(
      successorIp,
      successorPort,
      electionMessage,
      onSuccess,
      onFail
    );
  }

  trySendMessage(ip, port, message, onSuccess, onFailure) {
    const socketUrl = `http://${ip}:${port}`;
    const client = socketClient(socketUrl);

    client.on("connect", () => {
      console.log(`Conectado com sucesso ao IP: ${ip} na porta: ${port}`);
      client.emit("election_message", message);

      // Aguardar confirmação de recebimento
      client.once("acknowledgement", () => {
        console.log(`Mensagem confirmada por ${ip}:${port}`);
        onSuccess(); // Chamar o callback de sucesso
        client.disconnect();
      });
    });

    client.on("connect_error", () => {
      console.error(`Falha ao conectar ao IP: ${ip} na porta: ${port}`);
      if (typeof onFailure === "function") {
        onFailure();
      }
      client.disconnect();
    });

    // Semelhantemente para o timeout:
    setTimeout(() => {
      if (!client.connected) {
        console.error(
          `Timeout ao tentar conectar ao IP: ${ip} na porta: ${port}`
        );
        if (typeof onFailure === "function") {
          onFailure();
        }
        client.disconnect();
      }
    }, 5000);
  }

  // Método chamado quando o nó se torna o coordenador
  becomeCoordinator() {
    console.log(`Este nó (${this.port}) é agora o coordenador.`);
    this.isCoordinator = true;
    this.coordinatorPort = this.port;

    this.setupCoordinatorServer();
    this.broadcastNewCoordinator();
  }

  // Envia uma mensagem para todos os outros nós para informá-los sobre o novo coordenador
  broadcastNewCoordinator() {
    const coordinatorMessage = {
      type: "COORDINATOR",
      newCoordinatorPort: this.port,
    };

    this.ipList.forEach((ip) => {
      if (ip !== this.localIp) {
        this.trySendMessage(ip, coordinatorMessage, () => {
          console.error(`Falha ao enviar mensagem de coordenador para ${ip}`);
        });
      }
    });
  }
}

module.exports = DistributedNode;
