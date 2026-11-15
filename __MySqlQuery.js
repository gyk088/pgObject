const __IPgObjectQuery = require('./__IPgObjectQuery');

// Converts PostgreSQL-style $N placeholders to MySQL "?" and puts the values in the
// order the placeholders appear. String literals, quoted identifiers and comments are skipped.
function convertPlaceholders(queryStr, values) {
    let sql = '';
    const ordered = [];
    let numbered = false;
    let questionMarks = false;
    const n = queryStr.length;
    let i = 0;

    while (i < n) {
        const ch = queryStr[i];
        const next = queryStr[i + 1];

        if (ch === "'" || ch === '"' || ch === '`') {
            let j = i + 1;
            while (j < n) {
                if (queryStr[j] === '\\' && ch !== '`') { j += 2; continue; }
                if (queryStr[j] === ch) {
                    if (queryStr[j + 1] === ch) { j += 2; continue; }
                    break;
                }
                j++;
            }
            sql += queryStr.slice(i, j + 1);
            i = j + 1;
            continue;
        }

        if (ch === '#' || (ch === '-' && next === '-' && (i + 2 >= n || /\s/.test(queryStr[i + 2])))) {
            let j = queryStr.indexOf('\n', i);
            if (j === -1) j = n;
            sql += queryStr.slice(i, j);
            i = j;
            continue;
        }

        if (ch === '/' && next === '*') {
            let j = queryStr.indexOf('*/', i + 2);
            j = j === -1 ? n : j + 2;
            sql += queryStr.slice(i, j);
            i = j;
            continue;
        }

        if (ch === '$') {
            const match = /^\$(\d+)/.exec(queryStr.slice(i, i + 12));
            if (match) {
                const index = Number(match[1]) - 1;
                if (!Array.isArray(values) || index < 0 || index >= values.length) {
                    throw new Error(`Error: no value for placeholder ${match[0]}`);
                }
                numbered = true;
                ordered.push(values[index]);
                sql += '?';
                i += match[0].length;
                continue;
            }
        }

        if (ch === '?') {
            questionMarks = true;
        }

        sql += ch;
        i++;
    }

    if (numbered && questionMarks) {
        throw new Error('Error: do not mix $N and ? placeholders in one query');
    }

    return { sql, values: numbered ? ordered : values };
}

// mysql/mysql2 turn an object value into "`key` = value" pairs right inside the SQL,
// so {password: 1} in "password = ?" gives "password = `password` = 1" (always true).
// Objects are passed as JSON strings instead, like the pg driver does.
function sanitizeValue(value) {
    if (value === null || typeof value !== 'object') return value;
    if (value instanceof Date || Buffer.isBuffer(value)) return value;
    // raw SQL made in code with mysql.raw(); JSON input can not contain functions
    if (typeof value.toSqlString === 'function') return value;
    if (Array.isArray(value)) return value.map(sanitizeValue);

    return JSON.stringify(value);
}

class __MySqlQuery extends __IPgObjectQuery {
    // no RETURNING: insertMany() can not read generated ids back
    static supportsReturning = false;

    static query(client, queryStr, values, classObj) {
        // RETURNING is not supported by MySQL
        const prepared = convertPlaceholders(queryStr.replace(/\s+RETURNING\s+\*\s*;?\s*$/i, ''), values);
        const safeValues = Array.isArray(prepared.values) ? prepared.values.map(sanitizeValue) : prepared.values;

        return new Promise((resolve, reject) => {
            client.query(prepared.sql, safeValues, (error, results, fields) => {
                if (error) {
                    reject(error);
                } else if (classObj) {
                    resolve(__IPgObjectQuery.toObjects(results, classObj));
                } else {
                    resolve({rows: results, fields});
                }
            });
        });
    }

    static async insert() {
        this.__validateRequiredFields();

        const keyVal = this.__keysValues(false);
        const table = this.constructor.table;
        const insertStr = keyVal.keys.length
            ? `INSERT INTO ${table} ( ${keyVal.keys.join(', ')} ) VALUES ( ${keyVal.counts.join(', ')} )`
            : `INSERT INTO ${table} () VALUES ()`;

        const data = await this.constructor.query(insertStr, keyVal.values);
        const insertId = data && data.rows && data.rows.insertId;

        if (insertId) {
            if (Object.prototype.hasOwnProperty.call(this.__schema, 'id')) {
                this.__values.id = insertId;
            } else if (this.constructor.__primaryKeys.length === 1) {
                this.__values[this.constructor.__primaryKeys[0]] = insertId;
            }
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

        const updateStr = `UPDATE ${this.constructor.table} SET ${updateArr.join(', ')} WHERE ${pk.where}`;
        await this.constructor.query(updateStr, [...keyVal.values, ...pk.values]);

        return this;
    }

    // this = model class. items: [{ pk: [...], values: [...] }], all changing `columns`.
    // The first SELECT names the columns of the derived table; MySQL has no RETURNING.
    static async updateManyChunk(primaryKeys, columns, items) {
        const all = [...primaryKeys, ...columns];
        const params = [];
        const selects = items.map((item, row) => {
            const cells = [...item.pk, ...item.values].map((value, i) => {
                params.push(value);
                return row === 0 ? `\$${params.length} AS ${all[i]}` : `\$${params.length}`;
            });
            return `SELECT ${cells.join(', ')}`;
        });

        const on = primaryKeys.map(pk => `t.${pk} = v.${pk}`).join(' AND ');
        const set = columns.map(column => `t.${column} = v.${column}`).join(', ');
        await this.query(`UPDATE ${this.table} AS t JOIN (${selects.join(' UNION ALL ')}) AS v ON ${on} SET ${set}`, params);
        return [];
    }

    static async startTransaction(mode) {
        // SET TRANSACTION applies to the next transaction only;
        // START TRANSACTION actually opens it (SET SESSION alone does not).
        await this.query(`SET TRANSACTION ISOLATION LEVEL ${__IPgObjectQuery.isolationLevel.call(this, mode)}`);
        await this.query('START TRANSACTION');
    }
}

__MySqlQuery.convertPlaceholders = convertPlaceholders;
__MySqlQuery.sanitizeValue = sanitizeValue;

module.exports = __MySqlQuery;
