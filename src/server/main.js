require('dotenv').config();
const DistributedNode = require('./DistribuitedNode');

const node = new DistributedNode();
node.initServer();