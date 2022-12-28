# starService

Service that publishes night sky data

services are
  GET / -> all active sessions
  GET /sessionId -> session config
  GET /sessionId/constellations -> all available constellations
  GET /sessionId/star -> all stars within constellation
  GET /sessionId/find -> star nearest to x/y point
  POST / -> create new session
  PUT /sessionId -> change session parameters
  DELETE /sessionId -> delete session
  
