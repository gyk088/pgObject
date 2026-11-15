const __IPgObjectQuery = require('./__IPgObjectQuery');

class __PgQuery extends __IPgObjectQuery {
    static supportsReturning = true;

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

    // Column types of the model's table, read once from the catalog. They are used to cast
    // VALUES parameters in updateMany(): without casts PostgreSQL treats them as text.
    // Types are taken without length/precision ("character varying", not "varchar(60)"),
    // because an explicit cast to varchar(60) would silently cut long strings.
    static async columnTypes() {
        if (Object.prototype.hasOwnProperty.call(this, '__pgColumnTypes')) {
            return this.__pgColumnTypes;
        }
        const data = await this.query(
            'SELECT a.attname AS name, format_type(a.atttypid, NULL) AS type FROM pg_attribute a '
            + 'WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped',
            [this.table]
        );
        this.__pgColumnTypes = new Map(data.rows.map(row => [row.name, row.type]));
        return this.__pgColumnTypes;
    }

    // this = model class. items: [{ pk: [...], values: [...] }], all changing `columns`.
    static async updateManyChunk(primaryKeys, columns, items) {
        const types = await __PgQuery.columnTypes.call(this);
        const all = [...primaryKeys, ...columns];
        const typeOf = all.map(column => {
            const type = types.get(column) || types.get(column.toLowerCase());
            if (!type) {
                throw new Error(`Error: column ${column} is not found in table ${this.table}`);
            }
            return type;
        });

        const params = [];
        const tuples = items.map(item => {
            const cells = [...item.pk, ...item.values].map((value, i) => {
                params.push(value);
                return `\$${params.length}::${typeOf[i]}`;
            });
            return `( ${cells.join(', ')} )`;
        });

        const set = columns.map(column => `${column} = v.${column}`).join(', ');
        const where = primaryKeys.map(pk => `t.${pk} = v.${pk}`).join(' AND ');
        const sql = `UPDATE ${this.table} AS t SET ${set} FROM (VALUES ${tuples.join(', ')}) AS v (${all.join(', ')}) WHERE ${where} RETURNING t.*`;

        const data = await this.query(sql, params);
        return data && data.rows;
    }

    static async startTransaction(mode) {
        await this.query(`START TRANSACTION ISOLATION LEVEL ${__IPgObjectQuery.isolationLevel.call(this, mode)}`);
    }
}


module.exports = __PgQuery;
