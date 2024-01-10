function printEnvironmentVariables(allInfos) {
    console.log(`
        Variáveis de ambiente:
        ID: ${allInfos.id}
        Hostname: ${allInfos.hostname}
        IP Local: ${allInfos.localIp}
        Porta: ${allInfos.port}
        IP sucessor: ${allInfos.successorIp}
        IP coodenador: ${allInfos.coordinatorIp}
        É o coodenador: ${allInfos.isCoordinator}
        Lista de IPs:
    `);
    //console.table(allInfos.ipList)
}

module.exports = printEnvironmentVariables;