const socketClient = require("socket.io-client");
async function connecToNode(ipString) {

  if(ipString){
    const ipAddress = ipString.includes(":") ? ipString : ipString + ":3000";

    let socket = null;

    const nodeConnection = await new Promise((resolve, reject) => {
      socket = socketClient(`http://${ipAddress}`);
      setTimeout(() => {
        resolve(socket);
      }, 3000);
    });

    return nodeConnection;
  }
  return null;

}

module.exports = connecToNode;
