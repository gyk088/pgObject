const __PgQuery = require('./__PgQuery');
const __MySqlQuery = require('./__MySqlQuery');

class PgObject {
    f = {};
    selected = false;

    static __primaryKeys = [];
    static __requiredFields = [];

    static __client;
    static __types = {
        postgresql: __PgQuery,
        mysql: __MySqlQuery,
    }

    static __queryClass = PgObject.__types.postgresql;

    static __log = false;
    static __logger = console;
    static __isSetStaticFields = false;

    static mode = {
        serializable: 'SERIALIZABLE',
        repeatableRead: 'REPEATABLE READ',
        readCommitted: 'READ COMMITTED',
        readUncommitted: 'READ UNCOMMITTED',
    }

    constructor(data) {
        this.constructor.__setStaticFields();
        this.__createSchema();
        if (data) {
            this.__setValues(data);
        }
    }

    static get schema() {}
    static get table() {}
    static get notValidateSchema() { return false }

    static setClient(client, type) {
        PgObject.__client = client;
        PgObject.__queryClass = type ? PgObject.__types[type] : PgObject.__queryClass;
        if (!PgObject.__queryClass) {
            throw `Error, please set corret type of database ${Object.keys(PgObject.__types).join(', ')}. By default ${Object.keys(PgObject.__types)[0]}`;
        }
    }

    static setLog(log) {
        PgObject.__log = log;
    }

    static setLogger(logger) {
        PgObject.__logger = logger;
    }

    static __setStaticFields() {
        if (this.__isSetStaticFields) return;

        for (const key in this.schema) {
            if (!this.schema[key]) continue;

            if (this.schema[key].pk) {
                this.__primaryKeys.push(key);
            }
            if (this.schema[key].required) {
                this.__requiredFields.push(key);
            }
        }

        if (!this.__primaryKeys.length) {
            throw `Error, please set the PRIMARY KEY in the ${this.name} class`;
        }

        this.__isSetStaticFields = true;
    }

    static query(queryStr, values, classObj) {
        return PgObject.__queryClass.query.call(this, queryStr, values, classObj);
    }

    static select(whereString, values) {
        return PgObject.__queryClass.select.call(this, whereString, values);
    }

    async insert() {
        return PgObject.__queryClass.insert.call(this);
    }

    async update() {
        return PgObject.__queryClass.update.call(this);
    }

    async delete() {
        return PgObject.__queryClass.delete.call(this);
    }

    async save() {
        if (this.selected) {
            await this.update();
        } else {
            await this.insert();
        }

        return this;
    }

    __setValues(data) {
        for (const key in data) {
            this.__validateSchema(key);
            if (this.constructor.schema[key]) {
                this.f[key] = data[key];
            }
        }
    }

    __keysValues() {
        const keyVal = {
            keys: [],
            counts: [],
            values: [],
        }

        let i = 1;
        for (const key in this.f) {
            if (this.f[key] === undefined) continue;
            if (this.constructor.schema[key].primaryKey) continue;
            if (this.constructor.schema[key].computed) continue;

            keyVal.keys.push(key);
            keyVal.values.push(this.f[key]);
            keyVal.counts.push(`\$${i}`);
            i++;
        }

        return keyVal;
    }

    __validateSchema(key) {
        if (this.constructor.notValidateSchema) {
            return true;
        }
        if (key in this.constructor.schema) {
            return true;
        }
        throw `Error, ${key} is not in the schema, check your schema getter, or notValidateSchema should return true`;
    }

    __validateRequiredFields() {
        let errorString = '';
        for (const key of this.constructor.__requiredFields) {
            if (!this.f[key]) {
                errorString += `${key} field in ${this.constructor.name} object is required; `;
            }
        }

        if (errorString) {
            throw "Error: " + errorString;
        }
    }

    __createSchema() {

        if (!this.constructor.schema) {
            throw "Error: please define your schema getter";
        }

        this.f = new Proxy(this.constructor.schema, {
            get: (target, name) => {
                this.__validateSchema(name);

                if (!target[name]) {
                    target[name] = {
                        value: undefined
                    }
                }

                if (target[name].default && typeof target[name].get === 'function') {
                    return target[name].get(target[name].value, this.f, name) === undefined
                        ? target[name].default
                        : target[name].get(target[name].value, this.f, name);
                }

                if (target[name].default) {
                    return target[name].value === undefined
                        ? target[name].default
                        : target[name].value;
                }

                if (typeof target[name].get === 'function') {
                    return target[name].get(target[name].value, this.f, name);
                }

                return target[name].value;
            },
            set: (target, name, value) => {
                this.__validateSchema(name);

                if (!target[name]) {
                    target[name] = {
                        value: undefined
                    }
                }
                if (target[name].set) {
                    target[name].value = target[name].set(value, this.f, name);
                } else {
                    target[name].value = value;
                }

                return true;
            }
        });
    }

    static async startTransaction(mode) {
        await PgObject.__queryClass.startTransaction.call(this, mode);
    }

    static async commit() {
        await PgObject.__queryClass.commit.call(this);
    }

    static async rollback() {
        await PgObject.__queryClass.rollback.call(this);
    }

    static async createTransaction(cb, mode) {
        await this.startTransaction(mode);
        try {
            await cb();
            await this.commit();
        } catch (e) {
            await this.rollback();
            this.__logger.log('TRANSACTION ERROR: ', e);
        }
    }

    toJSON() {
        const objToJson = {};
        for (const key in this.f) {
            objToJson[key] = this.f[key];
        }

        return JSON.stringify(objToJson);
    }
}

module.exports = PgObject;