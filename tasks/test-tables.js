var Sequelize = require('sequelize');

var sequelize = new Sequelize(
  'testing',
  'root',
  'root',
  {
    host: '127.0.0.1'
  }
);

var models = require('../models').define(sequelize);

sequelize.sync({force: true}).complete(function (err) {
  if (err) { throw err; }
  process.exit(0);
});