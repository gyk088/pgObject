const PgObject = require('./PgObject');
class __IPgObjectQuery {
    static async select(whereString, values) {
        const data = await this.query(`SELECT * FROM ${this.table} ${whereString}`, values);
        const arr = [];

        if (!data) return arr;
        for (const row of data.rows) {
            const obj = new this(row, true);
            obj.selected = true;
            arr.push(obj);
        }

        return arr;
    }

    static async delete() {
        const where = []
        const values = []
        let i = 0;
        this.constructor.__primaryKeys.forEach(pk => {
            i++;
            where.push(`${pk} = \$${i}`);
            values.push(this.f[pk]);
        });

        const deleteStr = `DELETE FROM ${this.constructor.table} WHERE ${where.join(' AND ')}`;
        await this.constructor.query(deleteStr, values);
        this.selected = false;
        return this;
    }

    static query(queryStr, values, classObj) {};
    static insert() {};
    static update() {};

    static startTransaction() {};
    static async commit() {
        await this.query('COMMIT');
    }

    static async rollback() {
        await this.query('ROLLBACK');
    }
}

module.exports = __IPgObjectQuery;