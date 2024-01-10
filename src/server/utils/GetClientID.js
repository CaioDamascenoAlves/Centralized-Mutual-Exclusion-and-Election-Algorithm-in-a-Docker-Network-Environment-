const getClientIp = require("./GetClientIp");
function getClientID(ip) {

    let parts = ip.split('.');
    let id = parseInt(parts[parts.length - 1]);
    return id
}

module.exports = getClientID;
