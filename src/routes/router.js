// router.js
// Version 0.0.1

const express = require('express');

module.exports = function Router(sessionController) {
  const sessionRouter = express.Router();

  // get configuration data from starService
  sessionRouter.get('/', sessionController.getSessions);

  // get constellations from starService
  sessionRouter.get('/:session/con', sessionController.getConstellations);

  // get session configuration data from starService
  sessionRouter.get('/:session', sessionController.getSession);

  // get star data from starService
  sessionRouter.get('/:session/star', sessionController.getStar);
  
  // // create session
  sessionRouter.post('/', sessionController.createSession);

  // // reconfigure session
  sessionRouter.put('/:session', sessionController.reconfigureSession);

  // // delete session
  sessionRouter.delete('/:session', sessionController.deleteSession);
  return sessionRouter;
};
