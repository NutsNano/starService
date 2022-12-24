const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const { createLogger, format, transports } = require('winston');

const cors = require('cors');

console.log( 'start app.js ');

const Router = require('./routes/router');
const Controller = require('./controller/controller');

const {
  combine, timestamp, printf,
} = format;

let server;
let log;

function initializeFallbackLogger() {
  const myFormat = printf((info) => `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`);

  const logger = createLogger({
    level: 'info',
    defaultMeta: { service: 'application-service' },
    transports: [
      new transports.Console({
        format: combine(
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          myFormat,
        ),
      }),
    ],
  });
  return logger;
}

/**
 * Starting data2mqtt service for cyclic publishing of JSON data sources
 * @param {*} port Port of service
 * @param {*} options Options, e.g. for adding custom logger.
 * Logger must implement functions 'info' & 'error'. Example: options: { logger: myCustomLogger }.
 * If logger is not set, default winston logger to console is used.
 */
function startApp(port, options) {
  if (options && options.logger) {
    log = options.logger;
  } else {
    log = initializeFallbackLogger();
  }

  const sessionController = new Controller(log);
  
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  app.use('/starService', Router(sessionController));

  server = http.createServer(app);

  server.listen(port || 3000, () => {
    log.info(`data2mqtt Service started on port ${server.address().port}`);
  });
}

/**
 * Stopping data2mqtt service.
 * @param {*} options Options, e.g. for adding custom logger.
 * Logger must implement functions 'info' & 'error'. Example: options: { logger: myCustomLogger }.
 * If logger is not set, default winston logger to console is used.
 */
function stopApp(options) {
  if (options && options.logger) {
    log = options.logger;
  } else {
    log = initializeFallbackLogger();
  }
  if (server !== null) {
    server.close(() => { log.info('Server closed!'); });
  }
}

module.exports = {
  startApp,
  stopApp,
};
