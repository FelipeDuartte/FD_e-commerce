export class AdminServiceError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "AdminServiceError";
    this.cause = cause;
  }
}
