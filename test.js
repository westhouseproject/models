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
  var ALISDevice;
  var User;
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
    ALISDevice = models.ALISDevice;
    User = models.User;
    done();
  });

  describe('User', function () {
    beforeEach(function (done) {
      sequelize
        .sync({ force: true })
        .complete(function (err) {
          if (err) {
             throw err;
          }
          done();
        })
    });

    describe('creation', function () {
      it('should create a new user, given only a google_open_id_token', function (done) {
        var token = 'asldkjflksadjf'
        models.User
          .create({
            google_open_id_token: token
          })
          .complete(function (err, user) {
            if (err) { throw err; }
            expect(user.get('google_open_id_token')).to.be(token);
            done();
          });
      });
    });

    describe('modification', function () {
      it('should allow for the modification of valid full name', function (done) {
        var token = 'asldkjflksadjf';
        models.User
          .create({
            google_open_id_token: token,
            full_name: 'Jane Smith'
          })
          .complete(function (err, user) {
            if (err) { throw err; }
            expect(user.get('google_open_id_token')).to.be(token);
            user
              .updateAttributes({
                full_name: 'John Smith'
              })
              .complete(function (err, user) {
                if (err) {
                  throw err;
                }

                expect(user.get('full_name')).to.be('John Smith');
                done();
              });
          });


      });

      it('should not allow for the downgrade to something invalid', function (done) {
        var token = 'asldkjflksadjf';
        models.User
          .create({
            google_open_id_token: token,
            email_address: 'jane@something.com'
          })
          .complete(function (err, user) {
            if (err) { throw err; }
            expect(user.get('google_open_id_token')).to.be(token);
            user
              .updateAttributes({
                email_address: 'whatevs'
              })
              .complete(function (err, user) {
                expect(err == null).to.be(false);
                done();
              });
          });
      });
    });
  });

  describe('ALISDevice', function () {
    var user;

    beforeEach(function (done) {
      sequelize
        .sync({ force: true })
        .success(function () {
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
