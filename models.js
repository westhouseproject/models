var Sequelize = require('sequelize');
var crypto = require('crypto');
var uuid = require('node-uuid');

module.exports.define = function (sequelize) {
  var retval = {};

  /*
   * Represents an ALIS device.
   */

  var ALISDevice = retval.ALISDevice = sequelize.define('alis_device', {
    uuid_token: {
      type: Sequelize.STRING,
      notNull: true,
      validation: {
        isUUID: 4
      }
    },
    client_secret: Sequelize.STRING
  }, {
    instanceMethods: {
      resetClientSecret: function () {
        this.client_secret = crypto.randomBytes(20).toString('hex');
      }
    },
    hooks: {
      beforeValidate: function (device, callback) {
        if (device.isNewRecord) {
          device.uuid_token = uuid.v4();
          device.resetClientSecret()
        } else if (device.changed('uuid_token')) {
          return callback(new Error('uuid_token should not change'));
        }

        process.nextTick(function () {
          callback();
        });
      }
    }
  });

  /*
   * Represents a user.
   */

  var User = retval.User = sequelize.define('user', {
    google_open_id_token: Sequelize.STRING,
    full_name: Sequelize.STRING,
    email_address: Sequelize.STRING
  });

  User.hasMany(ALISDevice, { as: 'ALISDevices' })

  return retval;
};