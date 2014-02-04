var Sequelize = require('sequelize');
var crypto = require('crypto');
var uuid = require('node-uuid');
var validator = require('validator');

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
          device.resetClientSecret();
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
    google_open_id_token: {
      type: Sequelize.STRING

    },
    username: Sequelize.STRING,
    normalized_username: Sequelize.STRING,
    full_name: Sequelize.STRING,
    email_address: Sequelize.STRING
  }, {
    instanceMethods: {
      normalizeUsername: function () {
        if (this.get('username') != null) {
          this.normalized_username = username.toLowerCase();
        }
      }
    },
    hooks: {
      beforeValidate: function (user, callback) {
        // TODO: move these callback calls elsewhere.
        if (
          user.previous('username') != null &&
          !/^[a-z0-9_-]{1,35}$/.test(user.get('username'))
        ) {
          return callback(new Error('A username can contain letters, numbers and'));
        } else if (
          user.previous('full_name') != null &&
          user.get('full_name').length > 200
        ) {
          return callback(new Error('For now, names can\'t be any larger than 200 characters'));
        } else if (
          user.previous('email_address') != null &&
          !validator.isEmail(user.get('email_address'))
        ) {
          return callback(new Error('Please provide a valid email address'));
        }

        process.nextTick(function () {
          callback(null);
        })
      },

      beforeCreate: function (user, callback) {
        user.normalizeUsername();
        process.nextTick(function () {
          callback(null);
        })
      }
    }
  });

  User.hasMany(ALISDevice, { as: 'ALISDevices' });

  return retval;
};
