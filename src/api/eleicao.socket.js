const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const electionPort = 3000;
const coordinatorPort = 4000;
const consumerPort = 5000;

class ElectionProcess {
  constructor(id, successorIP, successorPort, coordinatorIPs, coordinatorPorts) {
    this.id = id;
    this.successorIP = successorIP;
    this.successorPort = successorPort;
    this.coordinatorIPs = coordinatorIPs.split(',');
    this.coordinatorPorts = coordinatorPorts.split(',');
    this.leader = null;
    this.processList = [];
  }

  start() {
    io.on('connection', (socket) => {
      socket.on('election', (data) => {
        console.log(`Process ${this.id} received election message from Process ${data.sender}`);
        this.processList.push(data.sender);

        if (this.leader === null || data.sender > this.leader) {
          this.leader = data.sender;
        }

        if (this.successorIP) {
          console.log(`Forwarding election message to successor Process ${this.successorIP}:${this.successorPort}`);
          socket.broadcast.to(`${this.successorIP}:${this.successorPort}`).emit('election', {
            sender: this.id,
          });
        } else {
          console.log(`Election completed. Leader is Process ${this.leader}`);
          this.announceCoordinator();
        }
      });

      socket.on('coordinator', (data) => {
        console.log(`Process ${this.id} received coordinator message from Process ${data.sender}`);
        this.leader = data.sender;
        this.processList = data.processList;

        console.log(`Current leader is Process ${this.leader}`);
      });

      socket.on('disconnect', () => {
        // Handle process disconnection here
      });
    });

    if (this.id === 1) {
      // Simulate coordinator failure and start election on Process 1
      setTimeout(() => {
        this.startElection();
      }, 5000);
    }
  }

  startElection() {
    if (this.coordinatorIPs.length === 0) {
      // No coordinators are available
      return;
    }

    console.log(`Process ${this.id} detected coordinator failure. Starting election.`);
    this.processList.push(this.id);

    const coordinatorIP = this.coordinatorIPs.shift();
    const coordinatorPort = this.coordinatorPorts.shift();

    console.log(`Sending election message to coordinator Process ${coordinatorIP}:${coordinatorPort}`);
    io.sockets.to(`${coordinatorIP}:${coordinatorPort}`).emit('election', {
      sender: this.id,
    });
  }

  announceCoordinator() {
    console.log(`Process ${this.id} announcing new coordinator - Process ${this.leader}`);
    this.processList.push(this.leader);

    io.sockets.emit('coordinator', {
      sender: this.leader,
      processList: this.processList,
    });
  }
}

// Define as variáveis de ambiente para cada processo
const id = parseInt(process.env.HOSTID);
const successorIP = process.env.SUCCESSOR_IP;
const successorPort = electionPort;
const coordinatorIPs = process.env.ELECTION_DEST_IPS;
const coordinatorPorts = process.env.ELECTION_DEST_PORT;

const electionProcess = new ElectionProcess(id, successorIP, successorPort, coordinatorIPs, coordinatorPorts);
electionProcess.start();

http.listen(electionPort, () => {
  console.log(`Process ${id} started on port ${electionPort}`);
});
