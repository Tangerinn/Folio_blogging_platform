/**
 * Operational application error carrying HTTP status and machine-readable code.
 */
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = AppError;

