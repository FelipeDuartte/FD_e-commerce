export function createServiceError(name) {
  return class extends Error {
    constructor(message, cause) {
      super(message);
      this.name = name;
      this.cause = cause;
    }
  };
}
