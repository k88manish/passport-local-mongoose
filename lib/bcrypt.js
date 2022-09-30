const bcrypt = require('bcrypt');

function bcryptHash(password, salt, options, callback) {
  return bcrypt.hash(password, options.saltlen || 10, callback);
}

function compareHash(password, hash, callback) {
  bcrypt.compare(password, hash, callback);
}

module.exports = {
  bcryptHash,
  compareHash,
};
