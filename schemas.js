module.exports.schemas = {
  User: [
    'user',
    {
      google_open_id_token: Sequelize.STRING,
      full_name: Sequelize.STRING,
      email_address: Sequelize.STRING
    }
  ],

  ALISDevice: [
    'alis_device',
    {
      uuid_token: Sequelize.STRING,
      client_secret: Sequelize.STRING
    },
    {
      hooks: {
        beforeValidate: function (device, callback) {
          if 
        }
      }
    }
  ],
};

module.exports.define = function (sequelize) {
  Object.keys(module.exports.schemas).forEach(function (key) {
    sequelize.define.apply(sequelize, module.exports.schemas[key]);
  });
};