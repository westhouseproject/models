var Sequelize = require('sequelize');
var fs = require('fs');
var expect = require('expect.js');
var validator = require('validator');
var uuid = require('node-uuid');

var settings = {};
try {
  settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
} catch (e) {}

describe('integration tests', function () {
  var sequelize;
  var models;
  beforeEach(function (done) {
    sequelize = new Sequelize(
      settings.database || 'testing',
      settings.username || 'root',
      settings.password || 'root',
      settings.sequelizeSettings || {
        host: '127.0.0.1'
      }
    );
    models = require('./models').define(sequelize);
    done();
  });

  describe('ALISDevice', function () {
    var ALISDevice;
    var User;
    var user;

    beforeEach(function (done) {
      sequelize
        .sync({ force: true })
        .success(function () {
          ALISDevice = models.ALISDevice;
          User = models.User;
          User
            .create({
              google_open_id: 'asldjflksajf',
              full_name: 'Jane Smith',
              email_address: 'jane@example.ca'
            })
            .success(function (u) {
              user = u;
              done();
            })
            .error(function (err) {
              throw err;
            });
        })
        .error(function (err) {
          console.error(err);
          throw err;
        });
    });
    describe('creation', function () {

      it('should create a new ALIS device, with a UUID token and "client secret"', function (done) {
        ALISDevice
          .create({})
          .success(function (alisDevice) {
            expect(validator.isUUID(alisDevice.values.uuid_token, 4)).to.be(true);
            expect(typeof alisDevice.values.client_secret).to.be('string');
            user
              .addALISDevice(alisDevice)
              .success(function () {
                user
                  .hasALISDevice(alisDevice)
                  .success(function (result) {
                    expect(result).to.be(true);
                    done();
                  })
                  .failure(function (err) {
                    throw err;
                  });
              })
              .error(function (err) {
                throw err;
              });
          })
          .error(function (err) {
            throw err;
          });
      });
    });

    describe('modification', function () {
      it('should not allow the modification of the UUID', function (done) {
        ALISDevice.create({})
          .complete(function (err, alisDevice) {
            if (err) {
              throw err;
            }

            alisDevice.updateAttributes({
              uuid_token: uuid.v4()
            }).complete(function (err) {
              expect(typeof err.message).to.be('string');
              done();
            })
          });
      });
    });
  });
});
