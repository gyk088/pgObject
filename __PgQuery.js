const __IPgObjectQuery = require('./__IPgObjectQuery');

class __PgQuery extends __IPgObjectQuery {
    static async query(client, queryStr, values, classObj) {
        const data = await client.query(queryStr, values);

        if (classObj) {
            return __IPgObjectQuery.toObjects(data.rows, classObj);
        }

        return data;
    }

    static async insert() {
        this.__validateRequiredFields();

        const keyVal = this.__keysValues(false);
        const table = this.constructor.table;
        const insertStr = keyVal.keys.length
            ? `INSERT INTO ${table} ( ${keyVal.keys.join(', ')} ) VALUES ( ${keyVal.counts.join(', ')} ) RETURNING *`
            : `INSERT INTO ${table} DEFAULT VALUES RETURNING *`;

        const data = await this.constructor.query(insertStr, keyVal.values);
        if (data && data.rows && data.rows[0]) {
            this.__setValues(data.rows[0], true);
        }
        this.__markPersisted();

        return this;
    }

    static async update() {
        this.__validateRequiredFields();

        // primary keys are never changed by update()
        const keyVal = this.__keysValues(true);
        if (!keyVal.keys.length) return this;

        const updateArr = keyVal.keys.map((k, i) => `${k} = ${keyVal.counts[i]}`);
        const pk = this.__pkCondition(keyVal.keys.length);

        const updateStr = `UPDATE ${this.constructor.table} SET ${updateArr.join(', ')} WHERE ${pk.where} RETURNING *`;
        const data = await this.constructor.query(updateStr, [...keyVal.values, ...pk.values]);
        if (data && data.rows && data.rows[0]) {
            this.__setValues(data.rows[0], true);
        }

        return this;
    }

    static async startTransaction(mode) {
        await this.query(`START TRANSACTION ISOLATION LEVEL ${__IPgObjectQuery.isolationLevel.call(this, mode)}`);
    }
}


module.exports = __PgQuery;
