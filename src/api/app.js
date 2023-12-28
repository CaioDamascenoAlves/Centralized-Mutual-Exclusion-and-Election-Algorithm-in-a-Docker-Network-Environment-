const http = require('http');
const Process = require('./um_processo'); // Substitua pelo caminho correto para a classe Process

const processInstance = new Process();

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/start-election') {
    // Exemplo de endpoint para iniciar uma eleição
    processInstance.startElection();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Election started.\n');
  } else if (req.method === 'GET' && req.url === '/set-successor') {
    // Exemplo de endpoint para definir o sucessor
    processInstance.setSuccessor();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Successor set.\n');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n');
  }
});

const port = 3000;
const ipLocal = process.env.IP_LOCAL;

server.listen(port, ipLocal, () => {
  console.log(`Server is running at http://${ipLocal}:${port}`);
});
