const __IPgObjectQuery = require('./__IPgObjectQuery');

class __PgQuery extends __IPgObjectQuery {
    static async query(queryStr, values, classObj) {
        try {
            const data = await this.__client.query(queryStr, values);

            if (classObj) {
                const arr = [];
                for (const row of data.rows) {
                    const obj = new classObj(row, true);
                    obj.selected = true;
                    arr.push(obj);
                }

                return arr;
            }

            return data;
        } catch (e) {
            throw e;
        }
    }

    static async insert() {
        this.__validateRequiredFields();

        const keyVal = this.__keysValues();
        const insertStr = `INSERT INTO ${this.constructor.table} ( ${keyVal.keys.join(', ')} ) VALUES ( ${keyVal.counts.join(', ')} ) RETURNING *`

        const data = await this.constructor.query(insertStr, keyVal.values);
        this.__setValues(data.rows[0], true);
        this.selected = true;

        return this;
    }

    static async update() {
        this.__validateRequiredFields();

        const keyVal = this.__keysValues();
        const updateArr = keyVal.keys.map((k, i) => `${k} = ${keyVal.counts[i]}`);

        let i = keyVal.counts.length;
        const where = []
        this.constructor.__primaryKeys.forEach(pk => {
            i++;
            where.push(`${pk} = \$${i}`);
            keyVal.values.push(this.f[pk]);
        });

        const updateStr = `UPDATE ${this.constructor.table} SET ${updateArr.join(', ')} WHERE ${where.join(' AND ')} RETURNING *`;
        const data = await this.constructor.query(updateStr, keyVal.values);
        this.__setValues(data.rows[0], true);

        return this;
    }

    static async startTransaction(mode) {
        if (Object.values(this.mode).indexOf(mode) === -1) {
            mode = this.mode.readUncommitted;
        }

        await this.query(`START TRANSACTION ISOLATION LEVEL ${mode}`);
    }
}


module.exports = __PgQuery;