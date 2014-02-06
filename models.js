var Sequelize = require('sequelize');
var crypto = require('crypto');
var uuid = require('node-uuid');
var validator = require('validator');
var async = require('async');
var bcrypt = require('bcrypt');
var bluebird = require('bluebird');

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
    username: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false,
      validate: {
        is: [ '^[a-z0-9_-]{1,35}$', '' ]
      }
    },
    chosen_username: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false,
      validate: {
        is: [ '^[A-Za-z0-9_-]{1,35}$', '' ]
      }
    },
    full_name: {
      type: Sequelize.STRING,
      validate: {
        len: [0, 200]
      }
    },
    email_address: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: Sequelize.STRING,
      allowNull: false
    },
    verification_code: Sequelize.STRING,
    is_verified: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    instanceMethods: {
      normalizeUsername: function () {
        // TODO: check for changes in the `chosen_username` column.

        if (this.changed('username')) {
          this.chosen_username = this.username;
          this.username = this.chosen_username.toLowerCase();
        }
      }
    },
    classMethods: {
      authenticate: function (username, password) {
        var def = bluebird.defer();

        this
          .find({
            where: [ 'username = ? OR email_address = ?', username, username ]
          })
          .complete(function (err, user) {
            if (err) { return def.reject(err); }
            if (!user) {
              return def.reject(new Error('User not found'));
            }
            bcrypt.compare(password, user.password, function (err, res) {
              if (err) {
                return def.reject(err);
              }
              if (!res) {
                return def.reject(new Error('Password does not match'));
              }

              def.resolve(user);
            });
          });

        return def.promise;
      }
    },
    hooks: {
      beforeValidate: function (user, callback) {
        async.parallel([
          function (callback) {
            if (user.isNewRecord) {
              user.verification_code = uuid.v4();
            }
            process.nextTick(function () {
              callback(null);
            });
          },
          function (callback) {
            user.normalizeUsername();
            process.nextTick(function () {
              callback(null);
            });
          },
          function (callback) {
            // 6 is a hard limit unfortunately.
            if (
              !user.password ||
              (user.changed('password') && user.password.length < 6)
            ) {
              return process.nextTick(function () {
                callback(new Error('Password is too short'));
              });
            }

            if (user.changed('password')) {
              return bcrypt.hash(user.password, 12, function (err, hash) {
                if (err) { return callback(err); }
                user.password = hash;
                callback(null);
              });
            }

            callback(null);
          }
        ], function (err) {
          if (err) {
            return callback(err);
          }

          callback(null);
        });
      }
    }
  });

  /*
   * A join table to aid with many-to-many relationship with users and ALIS
   * devices.
   */

  var UserALISDevice = retval.UserALISDevice = sequelize.define('user_alis_device', {
    is_owner: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
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
