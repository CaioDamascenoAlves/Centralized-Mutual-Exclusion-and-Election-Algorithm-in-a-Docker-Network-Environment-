function getClientIp(socket) {
    let clientIp = socket.request.connection.remoteAddress;
    if (clientIp.substr(0, 7) === "::ffff:") {
        clientIp = clientIp.substr(7)
    }
    return clientIp
}

module.exports = getClientIp;
