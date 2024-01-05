const DistributedNode = require('./DistributedNode');

const nodeId = '1';
const port = 3000; // Substitua pela porta apropriada

const node = new DistributedNode(nodeId, port);
node.start();
