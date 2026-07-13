
/**
 * Cria uma classe de erro nomeada, com suporte a `cause` (erro original).
 * @param {string} name - usado em `error.name` e no `instanceof` da classe gerada
 * @returns {ErrorConstructor}
 */
export function createServiceError(name) {
  return class extends Error {
    constructor(message, cause) {
      super(message);
      this.name = name;
      this.cause = cause;
    }
  };
}
