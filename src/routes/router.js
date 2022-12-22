// router.js
// Version 0.0.1

const express = require('express');

module.exports = function Router(agentController) {
  const agentRouter = express.Router();

  // get configuration data from data2mqtt
  agentRouter.get('/', agentController.getAgents);

  // create data2mqtt agent
  agentRouter.post('/', agentController.createAgent);

  // reconfigure data2mqtt agent
  agentRouter.put('/:dataSource', agentController.reconfigureAgent);

  // delete data2mqtt agent
  agentRouter.delete('/:dataSource', agentController.deleteAgent);
  return agentRouter;
};
