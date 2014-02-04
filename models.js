var Sequelize = require('sequelize');
var crypto = require('crypto');
var uuid = require('node-uuid');
var validator = require('validator');

module.exports.define = function (sequelize) {

  // This is where we will be storing our model classes.
  var retval = {};

  /*
   * Represents an ALIS device.
   */

  var ALISDevice = retval.ALISDevice = sequelize.define('alis_device', {
    uuid_token: {
      type: Sequelize.STRING,
      allowNull: false,
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
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    },
    username: {
      type: Sequelize.STRING,
      unique: true
    },
    chosen_username: {
      type: Sequelize.STRING,
      unique: true
    },
    full_name: Sequelize.STRING,
    email_address: Sequelize.STRING,
    verification_code: Sequelize.STRING
  }, {
    instanceMethods: {
      normalizeUsername: function () {
        if (this.changed('username')) {
          this.chosen_username = this.username;
          this.username = this.chosen_username.toLowerCase();
        }
      }
    },
    hooks: {
      beforeValidate: function (user, callback) {
        user.normalizeUsername();

        // TODO: move these callback calls elsewhere.
        if (
          user.previous('username') != null &&
          !/^[a-z0-9_-]{1,35}$/.test(user.get('username'))
        ) {
          return callback(new Error('A username can only contain letters, numbers, underscores, and hyphens.'));
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
      }
    }
  });

  /*
   * A join table to aid with many-to-many relationship with users and ALIS
   * devices.
   */

  var UserALISDevice = retval.UserALISDevice = sequelize.define('user_alis_device', {
    is_admin: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  });

  // Establish the many-to-many relationships.

  User.hasMany(ALISDevice, {
    as: 'ALISDevice',
    through: UserALISDevice
  });

  ALISDevice.hasMany(User, {
    as: 'User',
    through: UserALISDevice
  });

  return retval;
};
