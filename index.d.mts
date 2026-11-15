// Type definitions for the ES module entry: `import PgObject, { PgObject } from 'pgobject'`.
import PgObject from './PgObject.js';

export { PgObject };
export default PgObject;

export type DatabaseType = PgObject.DatabaseType;
export type TransactionMode = PgObject.TransactionMode;
export type FieldDefinition<V = any, F extends object = any> = PgObject.FieldDefinition<V, F>;
export type Schema<F extends object = Record<string, any>> = PgObject.Schema<F>;
export type QueryResult<R = any> = PgObject.QueryResult<R>;
export type Logger = PgObject.Logger;
export type Client = PgObject.Client;
export type ModelClass<M extends PgObject<any>> = PgObject.ModelClass<M>;
export type FieldsOf<M> = PgObject.FieldsOf<M>;
export type InsertManyOptions = PgObject.InsertManyOptions;
