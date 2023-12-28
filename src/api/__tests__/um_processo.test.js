const Process = require("../um_processo");

describe("Integration Tests", () => {
  let processInstance;
  let mockEmit;
  let io;

  beforeEach(() => {
    // Configurar um novo objeto io e Process antes de cada teste
    mockEmit = jest.fn();
    io = {
      emit: mockEmit,
    };

    // Configurar um novo objeto Process antes de cada teste
    processInstance = new Process(1, 1, '172.25.0.4,172.25.0.5,172.25.0.6', '172.25.0.3', io);

    processInstance.setIo(io);
  });

  it("should set the successor IP correctly", () => {
    // Arrange (Preparação): Já foi configurado no beforeEach

    // Act (Ação): Chamada do método setSuccessor
    processInstance.setSuccessor();

    // Assert (Verificação): Verifica se o successorIp foi definido corretamente
    expect(processInstance.successorIp).toBe("172.25.0.4"); // Ajuste o IP de acordo com o contêiner
  });

//   it("should start an election correctly", () => {
//     // Arrange (Preparação): Já foi configurado no beforeEach
//     const mockEmit = jest.fn();
//     const io = {
//       emit: mockEmit,
//     };

//     processInstance.setIo(io);

//     // Act (Ação): Chamada do método startElection
//     processInstance.startElection();

//     // Assert (Verificação): Implemente os testes para a comunicação entre os contêineres
//     // Certifique-se de que os contêineres estão se comunicando corretamente
//   });


  it("should start an election correctly", () => {
    processInstance.sendElectionMessage = jest.fn();
    
    processInstance.startElection();

    expect(processInstance.electionInProgress).toBe(true);
    expect(mockEmit).toHaveBeenCalledWith("start-election", {
      senderId: 1,
      processIds: [1],
    });
  });
});
