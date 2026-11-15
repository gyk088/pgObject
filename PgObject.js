const { AsyncLocalStorage } = require('async_hooks');
const __PgQuery = require('./__PgQuery');
const __MySqlQuery = require('./__MySqlQuery');

// Keys that must never be used as field names: assigning them can reach
// Object.prototype (prototype pollution).
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// Column and table names are put into SQL as is, so only plain identifiers are allowed.
const COLUMN_NAME = /^[A-Za-z_][A-Za-z0-9_$]*$/;
const TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_$]*(\.[A-Za-z_][A-Za-z0-9_$]*)?$/;

const hasOwn = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);

// Connection of the transaction that the current async context runs in.
const transactionStorage = new AsyncLocalStorage();

class PgObject {
    f = {};
    selected = false;
    __updatedFields = new Set();
    __force = false;
    __schema = null;
    __values = null;
    // Primary key values as they are in the database; used in UPDATE/DELETE WHERE.
    __pk = null;

    static __primaryKeys = [];
    static __requiredFields = [];
    static __defaultFields = [];

    static __client;
    static __types = {
        postgresql: __PgQuery,
        mysql: __MySqlQuery,
    }

    static __queryClass = PgObject.__types.postgresql;

    static __log = false;
    static __logger = console;
    static __isSetStaticFields = false;
    // Promise of the transaction that currently owns the shared (non-pool) connection.
    static __activeTransaction = null;

    static mode = {
        serializable: 'SERIALIZABLE',
        repeatableRead: 'REPEATABLE READ',
        readCommitted: 'READ COMMITTED',
        readUncommitted: 'READ UNCOMMITTED',
    }

    constructor(data, force) {
        this.constructor.__setStaticFields();
        this.__createSchema();
        this.__setValues(data || {}, force);
        // Defaults are for new objects only. A row loaded without some columns
        // must not get defaults: save() would write them over the real values.
        if (!force) {
            this.__setDefaultValues();
        }
    }

    static get schema() {}
    static get table() {}
    static get notValidateSchema() { return false }

    static setClient(client, type) {
        if (type !== undefined && !hasOwn(PgObject.__types, type)) {
            throw new Error(`Error, please set corret type of database ${Object.keys(PgObject.__types).join(', ')}. By default ${Object.keys(PgObject.__types)[0]}`);
        }
        PgObject.__client = client;
        if (type) {
            PgObject.__queryClass = PgObject.__types[type];
        }
    }

    static setLog(log) {
        PgObject.__log = log;
    }

    static setLogger(logger) {
        PgObject.__logger = logger;
    }

    static __setStaticFields() {
        // hasOwn: a model that extends another model must not reuse its parent's settings
        if (hasOwn(this, '__isSetStaticFields') && this.__isSetStaticFields) return;

        const schema = this.schema;
        if (!schema || typeof schema !== 'object') {
            throw new Error(`Error: please define your schema getter in the ${this.name} class`);
        }
        if (typeof this.table !== 'string' || !TABLE_NAME.test(this.table)) {
            throw new Error(`Error: invalid table name "${this.table}" in the ${this.name} class`);
        }

        const primaryKeys = [];
        const requiredFields = [];
        const defaultFields = [];

        for (const key of Object.keys(schema)) {
            if (FORBIDDEN_KEYS.has(key)) {
                throw new Error(`Error: "${key}" can not be used as a field name in the ${this.name} class`);
            }
            const def = schema[key];
            if (!def) continue;

            if (!def.computed && !COLUMN_NAME.test(key)) {
                throw new Error(`Error: invalid field name "${key}" in the ${this.name} class`);
            }
            if (def.pk) {
                primaryKeys.push(key);
            }
            if (def.required) {
                requiredFields.push(key);
            }
            if (def.default !== undefined) {
                defaultFields.push(key);
            }
        }

        if (!primaryKeys.length) {
            throw new Error(`Error, please set the PRIMARY KEY in the ${this.name} class`);
        }

        this.__primaryKeys = primaryKeys;
        this.__requiredFields = requiredFields;
        this.__defaultFields = defaultFields;
        this.__isSetStaticFields = true;
    }

    static async query(queryStr, values, classObj) {
        const transaction = transactionStorage.getStore();
        let client;
        if (transaction) {
            client = transaction.client;
        } else {
            // A transaction owns the shared connection: wait, otherwise this query
            // would silently become a part of someone else's transaction.
            while (PgObject.__activeTransaction) {
                await PgObject.__activeTransaction;
            }
            client = PgObject.__client;
        }

        if (!client) {
            throw new Error('Error: database client is not set, call PgObject.setClient()');
        }

        const start = Date.now();
        try {
            const data = await PgObject.__queryClass.query.call(this, client, queryStr, values, classObj);
            if (this.__log) {
                this.__logger.log(
                    '\x1b[32m', 'Query: ', queryStr, "\x1b[0m",
                    '\nValues: ', values,
                    '\nExecution time:', Date.now() - start, 'ms'
                );
            }
            return data;
        } catch (e) {
            // Values may contain passwords and tokens, so they are logged only in debug mode.
            if (this.__log) {
                this.__logger.log("\x1b[31m", `SQL ERROR: ${queryStr}`, '\nValues: ', values, "\x1b[0m", e);
            }
            throw e;
        }
    }

    static select(whereString, values) {
        if (whereString != null && typeof whereString !== 'string') {
            throw new Error('Error: the where argument of select() must be a string');
        }
        this.__setStaticFields();
        return PgObject.__queryClass.select.call(this, whereString, values);
    }

    async insert() {
        await PgObject.__queryClass.insert.call(this);
        this.__updatedFields.clear();
        return this;
    }

    async update() {
        await PgObject.__queryClass.update.call(this);
        this.__updatedFields.clear();
        return this;
    }

    async delete() {
        await PgObject.__queryClass.delete.call(this);
        return this;
    }

    async save() {
        if (this.selected) {
            await this.update();
        } else {
            await this.insert();
        }

        return this;
    }

    // Called after the object was loaded from or written to the database.
    __markPersisted() {
        this.selected = true;
        this.__pk = {};
        for (const pk of this.constructor.__primaryKeys) {
            this.__pk[pk] = this.__values[pk];
        }
    }

    // WHERE condition by primary keys. Uses the values loaded from the database,
    // so changing obj.f.id can not redirect UPDATE/DELETE to another row.
    __pkCondition(offset) {
        const where = [];
        const values = [];
        this.constructor.__primaryKeys.forEach((pk, i) => {
            const value = this.__pk && this.__pk[pk] != null ? this.__pk[pk] : this.__values[pk];
            if (value === undefined || value === null) {
                throw new Error(`Error: primary key ${pk} of ${this.constructor.name} object is not set`);
            }
            where.push(`${pk} = \$${offset + i + 1}`);
            values.push(value);
        });

        return { where: where.join(' AND '), values };
    }

    __fieldDef(key) {
        return hasOwn(this.__schema, key) ? this.__schema[key] : undefined;
    }

    __fieldNames() {
        const names = Object.keys(this.__schema).filter(key => !FORBIDDEN_KEYS.has(key));
        for (const key of Object.keys(this.__values)) {
            if (!hasOwn(this.__schema, key)) names.push(key);
        }
        return names;
    }

    __setValues(data, force) {
        if (typeof data !== 'object') {
            throw new Error(`Error: data for ${this.constructor.name} object must be an object`);
        }
        this.__force = !!force;
        try {
            for (const key of Object.keys(data)) {
                this.__validateSchema(key);
                const def = this.__fieldDef(key);
                if (!def) continue;
                // guarded fields can not be filled from user data (mass assignment)
                if (!force && def.guarded) continue;
                this.f[key] = data[key];
            }
        } finally {
            this.__force = false;
        }
    }

    __setDefaultValues() {
        this.__force = true;
        try {
            for (const key of this.constructor.__defaultFields) {
                const def = this.__fieldDef(key);
                if (def && this.__values[key] === undefined) {
                    this.f[key] = def.default;
                    this.__updatedFields.add(key);
                }
            }
        } finally {
            this.__force = false;
        }
    }

    __keysValues(skipPrimaryKeys) {
        const keyVal = {
            keys: [],
            counts: [],
            values: [],
        }

        let i = 1;
        for (const key of this.__fieldNames()) {
            if (!this.__updatedFields.has(key)) continue;
            const def = this.__fieldDef(key) || {};
            if (def.computed) continue;
            if (skipPrimaryKeys && def.pk) continue;

            const value = this.f[key];
            if (value === undefined) continue;

            if (!COLUMN_NAME.test(key)) {
                throw new Error(`Error: invalid field name "${key}" in ${this.constructor.name} object`);
            }

            keyVal.keys.push(key);
            keyVal.values.push(value);
            keyVal.counts.push(`\$${i}`);
            i++;
        }

        return keyVal;
    }

    __validateSchema(key) {
        if (typeof key !== 'string' || FORBIDDEN_KEYS.has(key)) {
            throw new Error(`Error, ${String(key)} can not be used as a field name`);
        }
        if (this.constructor.notValidateSchema) {
            return true;
        }
        if (hasOwn(this.__schema, key)) {
            return true;
        }
        throw new Error(`Error, ${key} is not in the schema, check your schema getter, or notValidateSchema should return true`);
    }

    __validateRequiredFields() {
        let errorString = '';
        for (const key of this.constructor.__requiredFields) {
            const value = this.f[key];
            if (value === undefined || value === null || value === '') {
                errorString += `${key} field in ${this.constructor.name} object is required; `;
            }
        }

        if (errorString) {
            throw new Error("Error: " + errorString);
        }
    }

    __createSchema() {
        const schema = this.constructor.schema;
        if (!schema || typeof schema !== 'object') {
            throw new Error("Error: please define your schema getter");
        }

        this.__schema = schema;
        // Values live in a prototype-less object, separately from the schema:
        // instances never share values, and no key can reach Object.prototype.
        this.__values = Object.create(null);

        const self = this;
        const isField = (target, name) => typeof name === 'string'
            && !FORBIDDEN_KEYS.has(name)
            && (hasOwn(self.__schema, name) || hasOwn(target, name));

        this.f = new Proxy(this.__values, {
            get(target, name) {
                if (typeof name !== 'string' || FORBIDDEN_KEYS.has(name)) {
                    return undefined;
                }
                self.__validateSchema(name);

                const def = self.__fieldDef(name);
                if (def && typeof def.get === 'function') {
                    return def.get(target[name], self.f, name);
                }

                return target[name];
            },
            set(target, name, value) {
                self.__validateSchema(name);

                const def = self.__fieldDef(name);
                if (def && typeof def.set === 'function' && !self.__force) {
                    target[name] = def.set(value, self.f, name);
                } else {
                    target[name] = value;
                }

                if (!self.__force) {
                    self.__updatedFields.add(name);
                }

                return true;
            },
            has(target, name) {
                return isField(target, name);
            },
            ownKeys() {
                return self.__fieldNames();
            },
            getOwnPropertyDescriptor(target, name) {
                if (!isField(target, name)) return undefined;
                return { value: self.f[name], writable: true, enumerable: true, configurable: true };
            },
            defineProperty() {
                // only plain assignment is supported, it goes through the set trap
                return false;
            },
        });
    }

    static __isPool(client) {
        return !!client && (
            typeof client.getConnection === 'function' // mysql / mysql2 pool
            || (typeof client.connect === 'function' && 'totalCount' in client) // pg Pool
        );
    }

    static async __acquireConnection(pool) {
        if (typeof pool.getConnection === 'function') {
            const connection = await new Promise((resolve, reject) => {
                pool.getConnection((error, conn) => error ? reject(error) : resolve(conn));
            });
            return {
                client: connection,
                release: (broken) => broken ? connection.destroy() : connection.release(),
            };
        }

        const connection = await pool.connect();
        return {
            client: connection,
            release: (broken) => connection.release(broken),
        };
    }

    static __assertNotPool(method) {
        if (PgObject.__isPool(PgObject.__client)) {
            throw new Error(`Error: ${method}() can not be used with a connection pool, every query may go to a different connection. Use PgObject.createTransaction()`);
        }
    }

    static async __runTransaction(cb, mode, onBroken) {
        await PgObject.__queryClass.startTransaction.call(this, mode);
        try {
            const result = await cb();
            await PgObject.__queryClass.commit.call(this);
            return result;
        } catch (e) {
            try {
                await PgObject.__queryClass.rollback.call(this);
            } catch (rollbackError) {
                if (onBroken) onBroken();
                if (e && typeof e === 'object') e.rollbackError = rollbackError;
            }
            throw e;
        }
    }

    // Low-level API: the transaction runs on the shared connection without any isolation
    // from concurrent requests. Prefer createTransaction().
    static async startTransaction(mode) {
        PgObject.__assertNotPool('startTransaction');
        await PgObject.__queryClass.startTransaction.call(this, mode);
    }

    static async commit() {
        PgObject.__assertNotPool('commit');
        await PgObject.__queryClass.commit.call(this);
    }

    static async rollback() {
        PgObject.__assertNotPool('rollback');
        await PgObject.__queryClass.rollback.call(this);
    }

    // Runs cb in a transaction. Commits if cb succeeds; rolls back and rethrows the error otherwise.
    // With a pool the transaction gets its own connection; with a single connection
    // transactions run one by one and other queries wait for them.
    static async createTransaction(cb, mode) {
        if (transactionStorage.getStore()) {
            // nested call: join the outer transaction
            return cb();
        }

        const client = PgObject.__client;
        if (!client) {
            throw new Error('Error: database client is not set, call PgObject.setClient()');
        }

        if (PgObject.__isPool(client)) {
            const connection = await PgObject.__acquireConnection(client);
            let broken = false;
            try {
                return await transactionStorage.run(
                    { client: connection.client },
                    () => this.__runTransaction(cb, mode, () => { broken = true; })
                );
            } finally {
                connection.release(broken);
            }
        }

        while (PgObject.__activeTransaction) {
            await PgObject.__activeTransaction;
        }
        let finish;
        PgObject.__activeTransaction = new Promise(resolve => { finish = resolve; });
        try {
            return await transactionStorage.run({ client }, () => this.__runTransaction(cb, mode));
        } finally {
            PgObject.__activeTransaction = null;
            finish();
        }
    }

    toJSON() {
        const objToJson = {};
        for (const key of this.__fieldNames()) {
            const def = this.__fieldDef(key);
            if (def && def.hidden) continue;
            objToJson[key] = this.f[key];
        }

        return objToJson;
    }
}

module.exports = PgObject;
