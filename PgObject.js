class PgObject {
    f = {};
    selected = false;


    static __primaryKeys = [];
    static __client;
    static __log = false;
    static __logger = console;

    constructor(data) {
        this.__createSchema();
        if (data) {
            this.__setValues(data);
        }
    }

    static get schema() {}
    static get table() {}
    static get notValidateSchema() { return false }

    static setClient(client) {
        PgObject.__client = client;
    }

    static setLog(log) {
        PgObject.__log = log;
        PgTransaction.__log = log;
    }

    static setLogger(logger) {
        PgObject.__logger = logger;
        PgTransaction.__logger = __logger;
    }

    static async query(queryStr, values, classObj) {
        try {
            if (PgObject.__log) {
                PgObject.__logger.log('QueryLog: ', queryStr, '\nValues: ', values);
            }

            const data = await PgObject.__client.query(queryStr, values);

            if (classObj) {
                const arr = [];
                for (const row of data.rows) {
                    const obj = new classObj(row);
                    obj.selected = true;
                    arr.push(obj);
                }

                return arr;
            }

            return data;
        } catch (e) {
            PgObject.__logger.log('Query error', e);
            return null;
        }
    }

    static async select(whereString, values) {
        whereString = whereString ? 'WHERE ' + whereString : '';
        const data = await PgObject.query(`SELECT * FROM ${this.table} ${whereString}`, values);
        const arr = [];
        if (!data) return arr;
        for (const row of data.rows) {
            const obj = new this(row);
            obj.selected = true;
            arr.push(obj);
        }

        return arr;
    }

    async insert() {
        const keyVal = this.__keysValues();

        const insertStr = `INSERT INTO ${this.constructor.table} ( ${keyVal.keys.join(', ')} ) VALUES ( ${keyVal.counts.join(', ')} ) RETURNING *`

        const data = await PgObject.query(insertStr, keyVal.values);
        this.__setValues(data.rows[0]);
        this.selected = true;

        return this;
    }

    async update() {
        const keyVal = this.__keysValues();

        const updateArr = keyVal.keys.map((k, i) => `${k} = ${keyVal.counts[i]}`);

        let i = keyVal.counts.length;
        const where = []
        this.constructor.__primaryKeys.forEach(pk => {
            i++;
            where.push(`${pk} = \$${i}`);
            keyVal.values.push(this.f[pk]);
        });

        const insertStr = `UPDATE ${this.constructor.table} SET ${updateArr.join(', ')} WHERE ${where.join(' AND ')} RETURNING *`;
        const data = await PgObject.query(insertStr, keyVal.values);
        this.__setValues(data.rows[0]);

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

    __setValues(data) {
        for (const key in data) {
            this.__validateSchema(key);
            this.f[key] = data[key];
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

    __createSchema() {
        for (const key in this.constructor.schema) {
            if (this.constructor.schema[key] && this.constructor.schema[key].pk) {
                this.constructor.__primaryKeys.push(key);
            }
        }

        if (!this.constructor.__primaryKeys.length) {
            throw `Error, please set the PRIMARY KEY in the ${this.constructor.name} class`;
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

    toJSON() {
        const objToJson = {};
        for (const key in this.f) {
            objToJson[key] = this.f[key];
        }

        return JSON.stringify(objToJson);
    }
}

class PgTransaction {
    static __client = PgObject.__client;
    static __logger = PgObject.__logger;
    static log = PgObject.__log;

    static mode = {
        serializable: 'SERIALIZABLE',
        repeatableRead: 'REPEATABLE READ',
        readCommitted: 'READ COMMITTED',
        readUncommitted: 'READ UNCOMMITTED',
    }

    static setClient(client) {
        PgTransaction.__client = client;
    }

    static setLog(log) {
        PgTransaction.__log = log;
    }

    static setLogger(logger) {
        PgTransaction.__logger = logger;
    }

    static async query(queryStr) {
        if (PgTransaction.__log) {
            PgTransaction.__logger.log('QueryLog: ', queryStr);
        }

        if (!PgTransaction.__client) {
            PgTransaction.__client = PgObject.__client;
        }

        try {
            await PgTransaction.__client.query(queryStr);
        } catch (e) {
            PgTransaction.__logger.log('Transaction error', e);
        }
    }

    static async start(mode) {
        mode = PgTransaction.mode[mode] ? PgTransaction.mode[mode] : PgTransaction.mode.readUncommitted;
        await PgTransaction.query(`START TRANSACTION ISOLATION LEVEL ${mode}`);
    }

    static async commit() {
        await PgTransaction.query('COMMIT');
    }

    static async rollback() {
        await PgTransaction.query('ROLLBACK');
    }

    static async create(cb, mode) {
        await PgTransaction.start(mode);
        try {
            await cb();
            await PgTransaction.commit();
        } catch (e) {
            await PgTransaction.rollback();
            PgTransaction.__logger.log('TRANSACTION ERROR: ', e);
        }
    }
}

module.exports = { PgObject, PgTransaction }