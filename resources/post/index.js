'use strict';
const api = require('./api');
const Controller = require('./controller');

module.exports = () => ({
  api, controller: new Controller()
});
