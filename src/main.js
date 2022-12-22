// eslint-disable-next-line no-unused-vars
const { startApp, stopApp } = require('./app');

const port = process.env.PORT || 3000;

startApp(port, null);

// setTimeout(() => {
//   stopApp();
// }, 3000);
