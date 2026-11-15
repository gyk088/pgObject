// ESM entry point. Re-exports the CommonJS module, so `import` and `require`
// share one PgObject class (one client, one log setting).
import PgObject from './PgObject.js';

export { PgObject };
export default PgObject;
