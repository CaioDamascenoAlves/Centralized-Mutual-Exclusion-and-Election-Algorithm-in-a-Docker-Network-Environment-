// __tests__/client.int.test.js
const Client = require('socket.io-client');

let clientSocket;

// Substitua estes valores pelas configurações reais do seu coordenador
const COORDINATOR_HOST = '[172.25.0.3]';
const COORDINATOR_PORT = '[3000]';

beforeEach((done) => {
  // Construir a URL do coordenador a partir das variáveis de host e porta
  const coordinatorUrl = `http://${COORDINATOR_HOST}:${COORDINATOR_PORT}`;

  // Inicializa o socket do cliente e tenta conectar ao coordenador
  clientSocket = new Client(coordinatorUrl);

  // O evento 'connect' é emitido quando a conexão é estabelecida com sucesso
  clientSocket.on('connect', done);

  // Tratamento de erro de conexão, para evitar falhas silenciosas nos testes
  clientSocket.on('connect_error', (err) => {
    console.error('Erro de conexão:', err);
    done(err);
  });
});

afterEach(() => {
  // Fecha a conexão do socket após cada teste
  if (clientSocket.connected) {
    clientSocket.close();
  }
});

test("should connect and communicate with the real coordinator", (done) => {
    // Define um timeout para o teste. Ajuste este valor conforme necessário.
    jest.setTimeout(10000);
  
    // Mensagem que será enviada para o coordenador
    const mensagemEnviada = "Olá, coordenador!";
  
    // Esperada resposta do coordenador. Modifique conforme a lógica do seu coordenador.
    const respostaEsperada = "Resposta esperada do coordenador";
  
    // Configura um ouvinte para receber a resposta do coordenador
    clientSocket.on("resposta-especifica", (msg) => {
      try {
        // Verifica se a mensagem recebida é a esperada
        expect(msg).toBe(respostaEsperada);
        done(); // Finaliza o teste com sucesso
      } catch (error) {
        done(error); // Finaliza o teste com erro se a expectativa falhar
      }
    });
  
    // Configura um ouvinte para erros de comunicação
    clientSocket.on("error", (err) => {
      done(err); // Finaliza o teste com erro em caso de problemas de comunicação
    });
  
    // Envia a mensagem para o coordenador
    clientSocket.emit("message", mensagemEnviada);
  });
  