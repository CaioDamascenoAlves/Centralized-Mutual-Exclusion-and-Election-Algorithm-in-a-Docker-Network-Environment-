function getClientPort(ip) {

    let parts = ip.split('.');
    let id = parseInt(parts[parts.length - 1]);
    return parseInt(3000+id)
}

module.exports = getClientPort;
