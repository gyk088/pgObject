// Methods of this class are called with `this` bound to a model class (static methods)
// or to a model instance (insert/update/delete).
class __IPgObjectQuery {
    static toObjects(rows, classObj) {
        const arr = [];
        for (const row of rows || []) {
            const obj = new classObj(row, true);
            obj.__markPersisted();
            arr.push(obj);
        }

        return arr;
    }

    static async select(whereString, values) {
        const data = await this.query(`SELECT * FROM ${this.table} ${whereString || '' }`, values);
        if (!data) return [];

        return __IPgObjectQuery.toObjects(data.rows, this);
    }

    static async delete() {
        const pk = this.__pkCondition(0);
        const deleteStr = `DELETE FROM ${this.constructor.table} WHERE ${pk.where}`;
        await this.constructor.query(deleteStr, pk.values);
        this.selected = false;
        this.__pk = null;
        return this;
    }

    static query(client, queryStr, values, classObj) {};
    static insert() {};
    static update() {};

    static startTransaction() {};
    static async commit() {
        await this.query('COMMIT');
    }

    static async rollback() {
        await this.query('ROLLBACK');
    }

    static isolationLevel(mode) {
        // only the predefined levels can get into SQL
        return Object.values(this.mode).includes(mode) ? mode : this.mode.readCommitted;
    }
}

module.exports = __IPgObjectQuery;
