const mongoose = require('mongoose');

/**
 * Prevents Mongoose operation buffering in unit tests where optional models are not stubbed
 * and MongoDB is disconnected.
 */
function canQueryModel(Model, methodName) {
  if (mongoose.connection && mongoose.connection.readyState === 1) return true;
  return Model[methodName] !== mongoose.Model[methodName];
}

module.exports = { canQueryModel };

