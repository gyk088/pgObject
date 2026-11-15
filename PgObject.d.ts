// Type definitions for pgobject (CommonJS entry: `const PgObject = require('pgobject')`).
// The ES module entry (index.d.mts) re-exports these types.

declare namespace PgObject {
    type DatabaseType = 'postgresql' | 'mysql';

    type TransactionMode = 'SERIALIZABLE' | 'REPEATABLE READ' | 'READ COMMITTED' | 'READ UNCOMMITTED';

    /** Description of one field in `static get schema()`. */
    interface FieldDefinition<V = any, F extends object = any> {
        /** PRIMARY KEY. At least one field must have it. */
        pk?: boolean;
        /** insert()/update() throw if the value is undefined, null or ''. */
        required?: boolean;
        /** The field does not exist in the table and is never saved. */
        computed?: boolean;
        /** The field is ignored in constructor data (`new Model(req.body)`); it can still be set in code. */
        guarded?: boolean;
        /** The field is not included in toJSON(). */
        hidden?: boolean;
        /** Value for new objects when the field is not set. */
        default?: V;
        /** Getter: value - stored value, fields - all fields (obj.f), name - field name. */
        get?(value: V, fields: F, name: string): V;
        /** Setter: returns the value to store. */
        set?(value: V, fields: F, name: string): V;
    }

    /** Model schema. Pass the fields type to check field names and default/get/set types. */
    type Schema<F extends object = Record<string, any>> = {
        [K in keyof F]?: FieldDefinition<F[K], F> | null;
    };

    interface QueryResult<R = any> {
        rows: R[];
        [key: string]: any;
    }

    interface Logger {
        log(...args: any[]): void;
    }

    /** pg Client/Pool, mysql/mysql2 connection/pool. */
    interface Client {
        query(...args: any[]): any;
    }

    type ModelClass<M extends PgObject<any>> = new (data?: any, force?: boolean) => M;
}

/**
 * Base class for models.
 *
 * @example
 * interface UserFields { id: number; email: string }
 *
 * class User extends PgObject<UserFields> {
 *     static get schema(): PgObject.Schema<UserFields> {
 *         return { id: { pk: true }, email: { required: true } };
 *     }
 *     static get table() { return 'users'; }
 * }
 */
declare class PgObject<F extends object = Record<string, any>> {
    /**
     * @param data field values
     * @param force true when the data comes from the database: setters are skipped and fields are not marked as changed
     */
    constructor(data?: Partial<F>, force?: boolean);

    /** Field values. */
    f: F;
    /** true if the object was loaded from or saved to the database; save() then does update(). */
    selected: boolean;

    static readonly mode: {
        readonly serializable: 'SERIALIZABLE';
        readonly repeatableRead: 'REPEATABLE READ';
        readonly readCommitted: 'READ COMMITTED';
        readonly readUncommitted: 'READ UNCOMMITTED';
    };

    /** Override in a model: description of the fields. */
    static get schema(): PgObject.Schema<any> | undefined;
    /** Override in a model: table name. */
    static get table(): string | undefined;
    /** Override and return true to allow fields that are not in the schema. */
    static get notValidateSchema(): boolean;

    /** Sets the database client: pg Client/Pool, or mysql/mysql2 connection/pool with type 'mysql'. */
    static setClient(client: PgObject.Client, type?: PgObject.DatabaseType): void;
    /** Logs every query with its values. Do not enable in production. */
    static setLog(log: boolean): void;
    static setLogger(logger: PgObject.Logger): void;

    /** Runs a query and returns model objects made from the rows. */
    static query<M extends PgObject<any>>(query: string, values: readonly unknown[] | undefined, classObj: PgObject.ModelClass<M>): Promise<M[]>;
    /** Runs a query and returns the driver result. */
    static query<R = any>(query: string, values?: readonly unknown[]): Promise<PgObject.QueryResult<R>>;

    /**
     * `SELECT * FROM <table> <where>`. `where` is raw SQL: pass user input only through `$1, $2, ...` and `values`.
     */
    static select<M extends PgObject<any>>(this: PgObject.ModelClass<M>, where?: string, values?: readonly unknown[]): Promise<M[]>;

    /**
     * Runs cb in a transaction: commits if it succeeds, otherwise rolls back and throws the error again.
     * Returns what cb returns.
     */
    static createTransaction<T>(cb: () => T | Promise<T>, mode?: PgObject.TransactionMode): Promise<T>;
    /** Low-level, not safe with concurrent requests and not allowed with a pool. Prefer createTransaction(). */
    static startTransaction(mode?: PgObject.TransactionMode): Promise<void>;
    static commit(): Promise<void>;
    static rollback(): Promise<void>;

    insert(): Promise<this>;
    update(): Promise<this>;
    delete(): Promise<this>;
    /** insert() for a new object, update() for one loaded from the database. */
    save(): Promise<this>;
    /** All schema fields except `hidden` ones. */
    toJSON(): Partial<F>;
}

export = PgObject;
