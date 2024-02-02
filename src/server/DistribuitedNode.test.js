const DistributedNode = require("./DistributedNode");

describe("DistributedNode Environment Variables", () => {
  const testConfigs = [
    {
      env: {
        HOSTID: "1",
        HOSTNAME: "ubuntu-node-1",
        PROCESS_ID: "1",
        IP_LIST: "172.25.0.4,172.25.0.5,172.25.0.6",
        SUCCESSOR_IP: "172.25.0.4",
        IP_LOCAL: "172.25.0.3",
        LIST_PORTS: "3001,3002,3003",
        NODE_PORT: "3000",
      },
      expected: {
        hostId: "1",
        hostname: "ubuntu-node-1",
        processId: "1",
        ipList: ["172.25.0.4", "172.25.0.5", "172.25.0.6"],
        successorIp: "172.25.0.4",
        localIp: "172.25.0.3",
        listPorts: [3001, 3002, 3003],
        port: 3000,
      },
    },

    // Configurações para ubuntu-node-2
    {
      env: {
        HOSTID: "2",
        HOSTNAME: "ubuntu-node-2",
        PROCESS_ID: "2",
        IP_LIST: "172.25.0.3,172.25.0.5,172.25.0.6",
        SUCCESSOR_IP: "172.25.0.4",
        IP_LOCAL: "172.25.0.6",
        LIST_PORTS: "3000,3002,3003",
        NODE_PORT: "3001",
      },
      expected: {
        hostId: "2",
        hostname: "ubuntu-node-2",
        processId: "2",
        ipList: ["172.25.0.3", "172.25.0.5", "172.25.0.6"],
        successorIp: "172.25.0.4",
        localIp: "172.25.0.6",
        listPorts: [3000, 3002, 3003],
        port: 3001,
      },
    },

    // Configurações para ubuntu-node-3
    {
      env: {
        HOSTID: "3",
        HOSTNAME: "ubuntu-node-3",
        PROCESS_ID: "3",
        IP_LIST: "172.25.0.3,172.25.0.4,172.25.0.6",
        SUCCESSOR_IP: "172.25.0.6",
        IP_LOCAL: "172.25.0.53",
        LIST_PORTS: "3000,3001,3003",
        NODE_PORT: "3002",
      },
      expected: {
        hostId: "3",
        hostname: "ubuntu-node-3",
        processId: "3",
        ipList: ["172.25.0.3", "172.25.0.4", "172.25.0.6"],
        successorIp: "172.25.0.6",
        localIp: "172.25.0.53",
        listPorts: [3000, 3001, 3003],
        port: 3002,
      },
    },

    // Configurações para ubuntu-node-4
    {
      env: {
        HOSTID: "4",
        HOSTNAME: "ubuntu-node-4",
        PROCESS_ID: "4",
        IP_LIST: "172.25.0.3,172.25.0.4,172.25.0.5",
        SUCCESSOR_IP: "172.25.0.3",
        IP_LOCAL: "172.25.0.6",
        LIST_PORTS: "3000,3001,3002",
        NODE_PORT: "3003",
      },
      expected: {
        hostId: "4",
        hostname: "ubuntu-node-4",
        processId: "4",
        ipList: ["172.25.0.3", "172.25.0.4", "172.25.0.5"],
        successorIp: "172.25.0.3",
        localIp: "172.25.0.6",
        listPorts: [3000, 3001, 3002],
        port: 3003,
      },
    },
  ];

  testConfigs.forEach(({ env, expected }, index) => {
    it(`should correctly load environment variables for ubuntu-node-${
      index + 1
    }`, () => {
      // Configura as variáveis de ambiente
      for (const key in env) {
        process.env[key] = env[key];
      }

      const node = new DistributedNode();

      // Verifica se os valores correspondem ao esperado
      expected(node.hostId).toBe(expected.hostId);
      expected(node.hostname).toBe(expected.hostname);
      expected(node.processId).toBe(expected.processId);
      expected(node.ipList).toEqual(expected.ipList);
      expected(node.successorIp).toBe(expected.successorIp);
      expected(node.localIp).toBe(expected.localIp);
      expected(node.listPorts).toEqual(expected.listPorts);
      expected(node.port).toBe(expected.port);
    });
  });
});
