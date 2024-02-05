function printEnvironmentVariables(allInfos) {
    console.log(`
        Status ${allInfos.hostname}:
        IP Local: ${allInfos.localIp}
        Porta: ${allInfos.port}
        IP sucessor: ${allInfos.successorIp}
        IP coodenador: ${allInfos.coordinatorIp}
        É o coodenador: ${allInfos.isCoordinator}
    `);
    console.table(allInfos.ipList)
}

module.exports = printEnvironmentVariables;