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
      },
      getOwner: function () {
        var def = bluebird.defer();
        UserALISDevice.find({
          where: [ 'alis_device_id = ? AND privilege = ?', this.id, 'owner' ]
        }).complete(function (err, join) {
          if (err) { def.reject(err); }
          if (!join) {
            return def.resolve(null);
          }
          User.find(join.user_id).complete(function (err, user) {
            if (err) {
              return def.reject(err);
            }
            def.resolve(user);
          });
        });
        return def.promise;
      },

      isAdmin: function (user) {
        var def = bluebird.defer();
        UserALISDevice.find({
          where: [
            'alis_device_id = ? AND user_id = ? AND privilege = ? OR privilege = ?',
            this.id,
            user.id,
            'admin',
            'owner'
          ]
        }).complete(function (err, user) {
          if (err) { return def.reject(err); }
          def.resolve(!!user);
        });
        return def.promise;
      },

      hasAccess: function (user) {
        var def = bluebird.defer();
        UserALISDevice.find({
          where: [
            'alis_device_id = ? AND user_id = ?',
            this.id,
            user.id
          ]
        }).complete(function (err, user) {
          if (err) { return def.reject(err); }
          def.resolve(!!user);
        });
        return def.promise;
      },

      /*
       * Will give limited access to the specified user.
       */

      grantAccessTo: function (admin, user) {
        var def = bluebird.defer();
        var self = this;
        this.isAdmin(admin).then(function (result) {
          if (!result) {
            def.reject(new Error('The user is not an admin.'));
          }
          UserALISDevice.create({
            user_id: user.id,
            alis_device_id: self.id,
            adminUserID: admin.id
          }).complete(function (err, join) {
            if (err) { def.reject(err); }
            def.resolve(user);
          });
        }).catch(function (err) {
          def.reject(err);
        });
        return def.promise;
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
          callback(null);
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
          }).complete(function (err, user) {
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
    privilege: {
      type: Sequelize.ENUM,
      values: [ 'owner', 'admin', 'limited' ],
      defaultValue: 'limited',
      allowNull: false
    }
  }, {
    hooks: {
      beforeValidate: function (join, callback) {

        async.waterfall([
          // First, check to see whether or not the device already have a set of
          // users.
          function (callback) {
            // Find the device associated with this join.
            ALISDevice.find(join.alis_device_id).complete(function (err, device) {
              if (err) { return callback(err); }

              // TODO: check to see why a device will be null.
              if (!device) { return callback(null); }

              // Check to see whether or not the device already has users
              // associated with it.
              device.getUser().complete(function (err, users) {
                // No users? Then this join record is new.
                if (!users.length) { return callback(null); }

                // If there are users, then check to see if the current `join`
                // instance has a `adminUserID` property set, and if it does,
                // get the user associated to the ID, and check to see if that
                // user is an admin.

                // In this case, we'll grab that one admin user from the above
                // `users` variable. No need to send an extra roundtrip to the
                // database.
                var user = users.filter(function (user) {
                  return user.id === join.dataValues.adminUserID;
                })[0];

                if (!user) {
                  return callback(new Error('Only admins can give access.'));
                }

                device.isAdmin(user).then(function (result) {
                  if (!result) {
                    return callback(new Error('Only admins can give access.'));
                  }

                  callback(null);
                }).catch(callback);
              });
            });
          }
        ], callback);

      },
      beforeCreate: function (join, callback) {
        this.findAll({
          where: ['alis_device_id', join.alis_device_id]
        }).complete(function (err, joins) {
          if (err) { return callback(err); }
          // This means that at the time of creating this join, the ALIS device
          // was an orphan, and therefore, the user associated to this join will
          // become an owner.
          if (!joins.length) {
            join.privilege = 'owner';
          }
          callback(null, join)
        });
      }
    }
  });

  // Establish the many-to-many relationships.

  User.hasMany(ALISDevice, {
    as: 'ALISDevice',
    through: UserALISDevice,
    foreignKey: 'alis_device_id'
  });

  ALISDevice.hasMany(User, {
    as: 'User',
    through: UserALISDevice,
    foreignKey: 'user_id'
  });

  return retval;
};
