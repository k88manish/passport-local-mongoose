const scmp = require('scmp');

const pbkdf2 = require('./pbkdf2');
const errors = require('./errors');
const bcrypt = require('./bcrypt');

// authenticate function needs refactoring - to avoid bugs we wrapped a bit dirty
module.exports = function (user, password, options, cb) {
  if (cb) {
    return authenticate(user, password, options, cb);
  }

  return new Promise((resolve, reject) => {
    authenticate(user, password, options, (err, user, error) => (err ? reject(err) : resolve({ user, error })));
  });
};

function authenticate(user, password, options, cb) {
  if (options.limitAttempts) {
    const attemptsInterval = Math.pow(options.interval, Math.log(user.get(options.attemptsField) + 1));
    const calculatedInterval = attemptsInterval < options.maxInterval ? attemptsInterval : options.maxInterval;

    if (Date.now() - user.get(options.lastLoginField) < calculatedInterval) {
      user.set(options.lastLoginField, Date.now());
      user.save(function (saveErr) {
        if (saveErr) {
          return cb(saveErr);
        }
        return cb(null, false, new errors.AttemptTooSoonError(options.errorMessages.AttemptTooSoonError));
      });
      return;
    }

    if (user.get(options.attemptsField) >= options.maxAttempts) {
      if (options.unlockInterval && Date.now() - user.get(options.lastLoginField) > options.unlockInterval) {
        user.set(options.lastLoginField, Date.now());
        user.set(options.attemptsField, 0);
        user.save();
      } else {
        return cb(null, false, new errors.TooManyAttemptsError(options.errorMessages.TooManyAttemptsError));
      }
    }
  }

  if (options.hashingAlgo === 'bcrypt') {
    comparePassword_bcrypt(user, password, options, cb, (passwordMatched) => {
      if (passwordMatched) {
        if (options.limitAttempts) {
          user.set(options.lastLoginField, Date.now());
          user.set(options.attemptsField, 0);
          user.save(function (saveErr, user) {
            console.log(saveErr, user);
            if (saveErr) {
              return cb(saveErr);
            }
            return cb(null, user);
          });
        } else {
          return cb(null, user);
        }
      } else {
        if (options.limitAttempts) {
          user.set(options.lastLoginField, Date.now());
          user.set(options.attemptsField, user.get(options.attemptsField) + 1);
          user.save(function (saveErr) {
            if (saveErr) {
              return cb(saveErr);
            }
            if (user.get(options.attemptsField) >= options.maxAttempts) {
              return cb(null, false, new errors.TooManyAttemptsError(options.errorMessages.TooManyAttemptsError));
            } else {
              return cb(null, false, new errors.IncorrectPasswordError(options.errorMessages.IncorrectPasswordError));
            }
          });
        } else {
          return cb(null, false, new errors.IncorrectPasswordError(options.errorMessages.IncorrectPasswordError));
        }
      }
    });
  } else {
    comparePassword_pbkdf2(user, password, options, cb, (passwordMatched) => {
      if (passwordMatched) {
        if (options.limitAttempts) {
          user.set(options.lastLoginField, Date.now());
          user.set(options.attemptsField, 0);
          user.save(function (saveErr, user) {
            if (saveErr) {
              return cb(saveErr);
            }
            return cb(null, user);
          });
        } else {
          return cb(null, user);
        }
      } else {
        if (options.limitAttempts) {
          user.set(options.lastLoginField, Date.now());
          user.set(options.attemptsField, user.get(options.attemptsField) + 1);
          user.save(function (saveErr) {
            if (saveErr) {
              return cb(saveErr);
            }
            if (user.get(options.attemptsField) >= options.maxAttempts) {
              return cb(null, false, new errors.TooManyAttemptsError(options.errorMessages.TooManyAttemptsError));
            } else {
              return cb(null, false, new errors.IncorrectPasswordError(options.errorMessages.IncorrectPasswordError));
            }
          });
        } else {
          return cb(null, false, new errors.IncorrectPasswordError(options.errorMessages.IncorrectPasswordError));
        }
      }
    });
  }
}

function comparePassword_pbkdf2(user, password, options, cb, compareCb) {
  if (!user.get(options.saltField)) {
    return cb(null, false, new errors.NoSaltValueStoredError(options.errorMessages.NoSaltValueStoredError));
  }

  pbkdf2(password, user.get(options.saltField), options, function (err, hashBuffer) {
    if (err) {
      return cb(err);
    }

    compareCb(scmp(hashBuffer, Buffer.from(user.get(options.hashField), options.encoding)));
  });
}

function comparePassword_bcrypt(user, password, options, cb, compareCb) {
  bcrypt.compareHash(password, user.get(options.hashField), (err, same) => compareCb(same));
}
