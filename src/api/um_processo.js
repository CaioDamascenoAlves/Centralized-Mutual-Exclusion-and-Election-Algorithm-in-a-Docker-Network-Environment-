class Process {
  constructor() {
    this.hostId = process.env.HOSTID;
    this.processId = process.env.PROCESS_ID;
    this.ipList = process.env.IP_LIST.split(",").map((ip) => ip.trim());
    this.localIp = process.env.IP_LOCAL;
    this.successorIp = process.env.SUCCESSOR_IP;
    this.isCoordinator = false;
    this.leaderId = null;
    this.electionInProgress = false;
    this.electionMessage = {
      senderId: null,
      processIds: [],
    };
    this.io = null; // O objeto io será definido posteriormente
    this.startElection = this.startElection.bind(this);
    this.setSuccessor = this.setSuccessor.bind(this);
  }

  setIo(io) {
    this.io = io;
  }

  setSuccessor() {
    const localIpIndex = this.ipList.indexOf(this.localIp);
    const successorIndex = (localIpIndex + 1) % this.ipList.length;
    this.successorIp = this.ipList[successorIndex];
  }

  startElection() {
    if (!this.electionInProgress) {
      this.electionInProgress = true;
      this.electionMessage = {
        senderId: this.processId,
        processIds: [this.processId],
      };

      this.sendElectionMessage(this.electionMessage);
    }
  }

  sendElectionMessage(message) {
    // Enviar mensagem de eleição para o sucessor
    const nextProcessIndex = (this.ipList.indexOf(this.localIp) + 1) % this.ipList.length;
    const nextProcessIp = this.ipList[nextProcessIndex];

    // Implemente a lógica de envio da mensagem ao próximo processo aqui
    // Use o 'nextProcessIp' para enviar a mensagem
    // Lembre-se de adicionar o seu próprio processId à lista antes de enviar
  }
}

module.exports = Process;
