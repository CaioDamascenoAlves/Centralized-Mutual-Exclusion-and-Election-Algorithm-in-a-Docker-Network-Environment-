function getClientIp(socket) {

    let clientIp = null;

    if(socket.request) {
        clientIp = socket.request.connection.remoteAddress;
        if (clientIp.substr(0, 7) === "::ffff:") {
            clientIp = clientIp.substr(7)
        }
    }
    else {
        clientIp = socket.io.opts.hostname;
    }

    return clientIp
}

module.exports = getClientIp;
