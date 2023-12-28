const Client = require('socket.io-client');

let clientSocket;

// Substitua estes valores pelas configura    es reais do seu coordenador
const COORDINATOR_HOST = '172.25.0.3'; // Remova os colchetes
const COORDINATOR_PORT = '3000'; // Remova os colchetes

beforeEach((done) => {
  // Construir a URL do coordenador a partir das vari  veis de host e porta
  const coordinatorUrl = `http://${COORDINATOR_HOST}:${COORDINATOR_PORT}`;

  // Inicializa o socket do cliente e tenta conectar ao coordenador
  clientSocket = new Client(coordinatorUrl);

  // O evento 'connect'    emitido quando a conex  o    estabelecida com sucesso
  clientSocket.on('connect', done);

  // Tratamento de erro de conex  o, para evitar falhas silenciosas nos testes
  clientSocket.on('connect_error', (err) => {
    console.error('Erro de conex  o:', err);
    done(err);
  });
});

afterEach(() => {
  // Fecha a conex  o do socket ap  s cada teste
  if (clientSocket.connected) {
    clientSocket.close();
  }
});

// Definindo um timeout mais longo para todos os testes neste arquivo
jest.setTimeout(10000);

test("should connect and communicate with the real coordinator", (done) => {
  // Mensagem que ser   enviada para o coordenador
  const mensagemEnviada = "Ol  , coordenador!";
  const respostaEsperada = "Resposta esperada do coordenador"; // Substitua pela resposta esperada do servidor

  // Ouvinte para a resposta do coordenador
  clientSocket.on("resposta-especifica", (msg) => {
    try {
      expect(msg).toBe(respostaEsperada);
      done(); // Finaliza o teste com sucesso
    } catch (error) {
      done(error); // Finaliza o teste com erro se a expectativa falhar
    }
  });

  // Envia a mensagem para o coordenador
  clientSocket.emit("message", mensagemEnviada);
});