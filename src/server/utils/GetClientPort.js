function getClientPort(ip) {

    //if(typeof ip == 'string') {

        let parts = ip.split('.');
        let id = parseInt(parts[parts.length - 1]);
        return parseInt(3000+id)
    //}
    //return null;
}

module.exports = getClientPort;
