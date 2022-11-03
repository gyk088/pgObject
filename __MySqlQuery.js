const __IPgObjectQuery = require('./__IPgObjectQuery');

class __MySqlQuery extends __IPgObjectQuery {
    static query(queryStr, values, classObj) {
        queryStr = queryStr.replace(/\$\d*/g, '?');
        queryStr = queryStr.replace('RETURNING *', '');
        return new Promise((resolve, reject) => {
            this.__client.query(queryStr, values, (error, results, fields) => {
                if (error) {
                    reject(error);
                } else {
                    if (classObj) {
                        const arr = [];
                        for (const row of results) {
                            const obj = new classObj(row);
                            obj.selected = true;
                            arr.push(obj);
                        }

                        resolve(arr);
                    } else {
                        resolve({rows: results, fields});
                    }
                }
            });
        });
    }

    static async insert() {
        this.__validateRequiredFields();

        const keyVal = this.__keysValues();
        const insertStr = `INSERT INTO ${this.constructor.table} ( ${keyVal.keys.join(', ')} ) VALUES ( ${keyVal.counts.join(', ')} )`

        const data = await this.constructor.query(insertStr, keyVal.values);

        if (this.constructor.schema.id && data.rows.insertId) {
            this.f.id = data.rows.insertId;
        } else if (this.constructor.__primaryKeys.length === 1 && data.rows.insertId) {
            this.f[this.constructor.__primaryKeys[0]] = data.rows.insertId;
        }

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

        const updateStr = `UPDATE ${this.constructor.table} SET ${updateArr.join(', ')} WHERE ${where.join(' AND ')}`;
        await this.constructor.query(updateStr, keyVal.values);

        return this;
    }

    static async startTransaction(mode) {
        if (Object.values(this.mode).indexOf(mode) === -1) {
            mode = this.mode.readUncommitted;
        }

        await this.query(`SET SESSION TRANSACTION ISOLATION LEVEL ${mode}`);
    }
}

module.exports = __MySqlQuery;