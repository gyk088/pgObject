const PgObject  = require('./PgObject');

class MockAdmin extends PgObject {
    static get schema() {
        return {
            id: {
                pk: true,
            },
            name: {
                default: 'TEST NAME',
            },
            surname: {},
            ctime: {
                default: new Date(),
            }
        }
    }

    static get table() {
        return 'admin';
    }
}

describe('Test for PostgreSQL', () => {
    let query;
    beforeEach(() => {
        query = jest.fn();
        query.mockReturnValue({rows:[{id:1, name: 'TestName', surname: 'TestSurname'}]});
        PgObject.setClient({ query });
        PgObject.setLog(false);
    });

    test("insert", async () => {
        const adm = new MockAdmin({
            name: 'TestName',
            surname: 'TestSurname'
        });

        await adm.save();

        expect(query.mock.calls[0][0]).toMatch('INSERT INTO admin ( name, surname, ctime ) VALUES ( $1, $2, $3 ) RETURNING *');
        expect(query.mock.calls[0][1]).toContain('TestName');
        expect(query.mock.calls[0][1]).toContain('TestSurname');
    });

    test("update", async () => {
        const admins = await MockAdmin.select('WHERE name = $1 LIMIT 1', ['TestName']);
        admins[0].f.name = "NewValue";
        await admins[0].save();

        expect(query.mock.calls[0][0]).toMatch('SELECT * FROM admin WHERE name = $1 LIMIT 1');
        expect(query.mock.calls[0][1]).toContain('TestName');

        expect(query.mock.calls[1][0]).toMatch('UPDATE admin SET name = $1 WHERE id = $2 RETURNING *');
        expect(query.mock.calls[1][1]).toContain(1);
        expect(query.mock.calls[1][1]).toContain('NewValue');
    });

    test("delete", async () => {
        const admins = await MockAdmin.select('WHERE surname = $1 LIMIT 1', ['TestSurname']);
        await admins[0].delete();

        expect(query.mock.calls[0][0]).toMatch('SELECT * FROM admin WHERE surname = $1 LIMIT 1');
        expect(query.mock.calls[0][1]).toContain('TestSurname');

        expect(query.mock.calls[1][0]).toMatch('DELETE FROM admin WHERE id = $1');
        expect(query.mock.calls[1][1]).toContain(1);
    });

    test("select", async () => {
        const admins1 = await MockAdmin.select('WHERE surname = $1 LIMIT 1', ['TestSurname']);
        const admins2 = await PgObject.query('SELECT * FROM admin WHERE surname = $1 LIMIT 1', ['TestSurname'], MockAdmin);
        const data = await PgObject.query('SELECT * FROM admin WHERE surname = $1 LIMIT 1', ['TestSurname']);

        expect(admins1).not.toBeUndefined();
        expect(admins2).not.toBeUndefined();
        expect(data).not.toBeUndefined();

        expect(query.mock.calls[0][0]).toMatch('SELECT * FROM admin WHERE surname = $1 LIMIT 1');
        expect(query.mock.calls[1][0]).toMatch('SELECT * FROM admin WHERE surname = $1 LIMIT 1');
        expect(query.mock.calls[2][0]).toMatch('SELECT * FROM admin WHERE surname = $1 LIMIT 1');
    })

    test("Transaction", async () => {
        await PgObject.createTransaction(async () => {
            const admin1 = new MockAdmin();
            admin1.f.name = 'Test1';
            const admin2 = new MockAdmin();
            admin2.f.surname = 'Test2';
            await admin1.save();
            await admin2.save();
        }, PgObject.mode.serializable);

        expect(query.mock.calls[0][0]).toMatch('START TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        expect(query.mock.calls[1][0]).toMatch('INSERT INTO admin ( name, ctime ) VALUES ( $1, $2 ) RETURNING *');
        expect(query.mock.calls[2][0]).toMatch('INSERT INTO admin ( name, surname, ctime ) VALUES ( $1, $2, $3 ) RETURNING *');
        expect(query.mock.calls[3][0]).toMatch('COMMIT');

        await PgObject.startTransaction();
        const admin1 = new MockAdmin();
        admin1.f.surname = 'Test2';
        await admin1.save();
        await PgObject.commit();

        expect(query.mock.calls[4][0]).toMatch('START TRANSACTION ISOLATION LEVEL READ COMMITTED');
        expect(query.mock.calls[5][0]).toMatch('INSERT INTO admin ( name, surname, ctime ) VALUES ( $1, $2, $3 ) RETURNING *');
        expect(query.mock.calls[6][0]).toMatch('COMMIT');

        await PgObject.startTransaction();
        const admin2 = new MockAdmin();
        admin2.f.surname = 'Test2';
        await admin2.save();
        await PgObject.rollback();

        expect(query.mock.calls[7][0]).toMatch('START TRANSACTION ISOLATION LEVEL READ COMMITTED');
        expect(query.mock.calls[8][0]).toMatch('INSERT INTO admin ( name, surname, ctime ) VALUES ( $1, $2, $3 ) RETURNING *');
        expect(query.mock.calls[9][0]).toMatch('ROLLBACK');
    })
})

describe('Test for MySql', () => {
    let query;
    beforeEach(() => {
        query = jest.fn((queryStr, values, cb) => {
            cb(null, [{id:1, name: 'TestName', surname: 'TestSurname'}]);
        });
        PgObject.setClient({ query }, 'mysql');
        PgObject.setLog(false);
    });

    test("insert", async () => {
        const query = jest.fn((queryStr, values, cb) => {
            cb(null, {
                insertId: 1,
                rows: [{id:1, name: 'TestName', surname: 'TestSurname'}]
            });
        });

        PgObject.setClient({ query }, 'mysql');

        const adm = new MockAdmin({
            name: 'TestName',
            surname: 'TestSurname'
        });

        await adm.save();

        expect(query.mock.calls[0][0]).toMatch('INSERT INTO admin ( name, surname, ctime ) VALUES ( ?, ?, ? )');
        expect(query.mock.calls[0][1]).toContain('TestName');
        expect(query.mock.calls[0][1]).toContain('TestSurname');
    });

    test("update", async () => {
        const admins = await MockAdmin.select('WHERE name = $1 LIMIT 1', ['TestName']);
        admins[0].f.name = "NewValue";
        await admins[0].save();

        expect(query.mock.calls[0][0]).toMatch('SELECT * FROM admin WHERE name = ? LIMIT 1');
        expect(query.mock.calls[0][1]).toContain('TestName');

        expect(query.mock.calls[1][0]).toMatch('UPDATE admin SET name = ? WHERE id = ?');
        expect(query.mock.calls[1][1]).toContain(1);
        expect(query.mock.calls[1][1]).toContain('NewValue');
    });

    test("delete", async () => {
        const admins = await MockAdmin.select('WHERE surname = $1 LIMIT 1', ['TestSurname']);
        await admins[0].delete();

        expect(query.mock.calls[0][0]).toMatch('SELECT * FROM admin WHERE surname = ? LIMIT 1');
        expect(query.mock.calls[0][1]).toContain('TestSurname');

        expect(query.mock.calls[1][0]).toMatch('DELETE FROM admin WHERE id = ?');
        expect(query.mock.calls[1][1]).toContain(1);
    });

    test("select", async () => {
        const admins1 = await MockAdmin.select('WHERE surname = $1 LIMIT 1', ['TestSurname']);
        const admins2 = await PgObject.query('SELECT * FROM admin WHERE surname = $1 LIMIT 1', ['TestSurname'], MockAdmin);
        const data = await PgObject.query('SELECT * FROM admin WHERE surname = $1 LIMIT 1', ['TestSurname']);

        expect(admins1).not.toBeUndefined();
        expect(admins2).not.toBeUndefined();
        expect(data).not.toBeUndefined();

        expect(query.mock.calls[0][0]).toMatch('SELECT * FROM admin WHERE surname = ? LIMIT 1');
        expect(query.mock.calls[1][0]).toMatch('SELECT * FROM admin WHERE surname = ? LIMIT 1');
        expect(query.mock.calls[2][0]).toMatch('SELECT * FROM admin WHERE surname = ? LIMIT 1');
    })

    test("Transaction", async () => {
        await PgObject.createTransaction(async () => {
            const admin1 = new MockAdmin();
            admin1.f.name = 'Test1';
            const admin2 = new MockAdmin();
            admin2.f.surname = 'Test2';
            await admin1.save();
            await admin2.save();
        }, PgObject.mode.serializable);

        expect(query.mock.calls[0][0]).toBe('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        expect(query.mock.calls[1][0]).toBe('START TRANSACTION');
        expect(query.mock.calls[2][0]).toMatch('INSERT INTO admin ( name, ctime ) VALUES ( ?, ? )');
        expect(query.mock.calls[3][0]).toMatch('INSERT INTO admin ( name, surname, ctime ) VALUES ( ?, ?, ? )');
        expect(query.mock.calls[4][0]).toBe('COMMIT');

        await PgObject.startTransaction();
        const admin1 = new MockAdmin();
        admin1.f.surname = 'Test2';
        await admin1.save();
        await PgObject.commit();

        expect(query.mock.calls[5][0]).toBe('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        expect(query.mock.calls[6][0]).toBe('START TRANSACTION');
        expect(query.mock.calls[7][0]).toMatch('INSERT INTO admin ( name, surname, ctime ) VALUES ( ?, ?, ? )');
        expect(query.mock.calls[8][0]).toBe('COMMIT');

        await PgObject.startTransaction();
        const admin2 = new MockAdmin();
        admin2.f.surname = 'Test2';
        await admin2.save();
        await PgObject.rollback();

        expect(query.mock.calls[11][0]).toMatch('INSERT INTO admin ( name, surname, ctime ) VALUES ( ?, ?, ? )');
        expect(query.mock.calls[12][0]).toBe('ROLLBACK');
    })
})


describe('Security', () => {
    class User extends PgObject {
        static get schema() {
            return {
                id: { pk: true },
                email: { required: true },
                role: { guarded: true, default: 'user' },
                password: { hidden: true },
                name: {},
            };
        }
        static get table() { return 'users'; }
    }

    let query;
    beforeEach(() => {
        query = jest.fn(async () => ({ rows: [{ id: 1, email: 'a@b.c', role: 'user', name: 'old' }] }));
        PgObject.setClient({ query }, 'postgresql');
        PgObject.setLog(false);
        PgObject.setLogger(console);
    });

    afterEach(() => {
        delete Object.prototype.value;
        delete Object.prototype.pwned;
    });

    test.each([
        '{"email":"a@b.c","__proto__":"admin"}',
        '{"email":"a@b.c","__proto__":{"pwned":1}}',
        '{"email":"a@b.c","constructor":{"prototype":{"pwned":1}}}',
    ])('prototype pollution is blocked: %s', (json) => {
        expect(() => new User(JSON.parse(json))).toThrow();
        expect(({}).value).toBeUndefined();
        expect(({}).pwned).toBeUndefined();
        expect(Object.value).toBeUndefined();
        const user = new User({ email: 'x@y.z' });
        expect(user.f.name).toBeUndefined();
        expect(user.f.role).toBe('user');
    });

    test('instances do not share values even with a static schema object', () => {
        class Shared extends PgObject {
            static schema = { id: { pk: true }, name: {} };
            static get table() { return 'shared'; }
        }
        const a = new Shared({ name: 'a' });
        const b = new Shared({ name: 'b' });
        expect(a.f.name).toBe('a');
        expect(b.f.name).toBe('b');
        expect(Shared.schema.name.value).toBeUndefined();
    });

    test('guarded fields are not mass-assigned, hidden fields are not serialized', () => {
        const user = new User({ email: 'a@b.c', role: 'admin', password: 'hash' });
        expect(user.f.role).toBe('user');
        user.f.role = 'admin'; // explicit assignment in code still works
        expect(user.f.role).toBe('admin');
        expect(JSON.parse(JSON.stringify(user))).toEqual({ email: 'a@b.c', role: 'admin' });
    });

    test('update never changes the primary key and targets the loaded row', async () => {
        const [user] = await User.select('WHERE id = $1', [1]);
        user.f.id = 2; // e.g. Object.assign(user.f, req.body)
        user.f.name = 'new';
        await user.save();
        const [sql, values] = query.mock.calls[1];
        expect(sql).toBe('UPDATE users SET name = $1 WHERE id = $2 RETURNING *');
        expect(values).toEqual(['new', 1]);

        await user.delete();
        expect(query.mock.calls[2]).toEqual(['DELETE FROM users WHERE id = $1', [1]]);
    });

    test('update sends only fields changed since the last save', async () => {
        const [user] = await User.select('WHERE id = $1', [1]);
        user.f.name = 'first';
        await user.save();
        user.f.email = 'new@b.c';
        await user.save();
        expect(query.mock.calls[2][0]).toBe('UPDATE users SET email = $1 WHERE id = $2 RETURNING *');
    });

    test('rows loaded without some columns do not get defaults written on save', async () => {
        query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'a@b.c' }] }); // no role column
        const [user] = await PgObject.query('SELECT id, email FROM users', [], User);
        expect(user.f.role).toBeUndefined();
        user.f.email = 'new@b.c';
        await user.save();
        expect(query.mock.calls[1][0]).toBe('UPDATE users SET email = $1 WHERE id = $2 RETURNING *');
    });

    test('dynamic field names can not inject SQL', async () => {
        class Loose extends PgObject {
            static get schema() { return { id: { pk: true }, name: {} }; }
            static get table() { return 'loose'; }
            static get notValidateSchema() { return true; }
        }
        const obj = new Loose({ name: 'x' });
        obj.f['name) VALUES (1); DROP TABLE loose; --'] = 1;
        await expect(obj.insert()).rejects.toThrow('invalid field name');
        expect(query).not.toHaveBeenCalled();
    });

    test('model inheriting another model uses its own primary keys', () => {
        class Base extends PgObject {
            static get schema() { return { id: { pk: true } }; }
            static get table() { return 'base'; }
        }
        class Child extends Base {
            static get schema() { return { uuid: { pk: true } }; }
            static get table() { return 'child'; }
        }
        new Base();
        new Child();
        expect(Child.__primaryKeys).toEqual(['uuid']);
    });

    test('setClient rejects unknown database types', () => {
        expect(() => PgObject.setClient({ query }, '__proto__')).toThrow();
        expect(() => PgObject.setClient({ query }, 'constructor')).toThrow();
    });

    test('values are not logged on SQL errors when log is disabled', async () => {
        const logger = { log: jest.fn() };
        PgObject.setLogger(logger);
        query.mockRejectedValueOnce(new Error('duplicate key'));
        await expect(PgObject.query('INSERT INTO users (password) VALUES ($1)', ['secret'])).rejects.toThrow();
        expect(JSON.stringify(logger.log.mock.calls)).not.toContain('secret');
    });

    test('createTransaction rolls back and rethrows', async () => {
        await expect(PgObject.createTransaction(async () => {
            await new User({ email: 'a@b.c' }).save();
            throw new Error('payment failed');
        })).rejects.toThrow('payment failed');
        expect(query.mock.calls.map(c => c[0])).toEqual([
            'START TRANSACTION ISOLATION LEVEL READ COMMITTED',
            'INSERT INTO users ( email, role ) VALUES ( $1, $2 ) RETURNING *',
            'ROLLBACK',
        ]);
    });

    test('createTransaction returns the callback result; invalid modes fall back to READ COMMITTED', async () => {
        const result = await PgObject.createTransaction(async () => 42, 'READ COMMITTED; DROP TABLE users');
        expect(result).toBe(42);
        expect(query.mock.calls[0][0]).toBe('START TRANSACTION ISOLATION LEVEL READ COMMITTED');
    });

    test('single connection: other queries wait until the transaction ends', async () => {
        let release;
        const gate = new Promise(r => { release = r; });
        const tx = PgObject.createTransaction(async () => {
            await PgObject.query('SELECT 1');
            await gate;
            await PgObject.query('SELECT 2');
        });
        await new Promise(r => setImmediate(r));
        const outside = PgObject.query('SELECT outside');
        await new Promise(r => setImmediate(r));
        release();
        await Promise.all([tx, outside]);
        expect(query.mock.calls.map(c => c[0])).toEqual([
            'START TRANSACTION ISOLATION LEVEL READ COMMITTED',
            'SELECT 1',
            'SELECT 2',
            'COMMIT',
            'SELECT outside',
        ]);
    });

    test('pool: each transaction gets its own connection, released afterwards', async () => {
        const makeConn = (name) => ({
            name,
            query: jest.fn(async () => ({ rows: [] })),
            release: jest.fn(),
        });
        const conns = [makeConn('c1'), makeConn('c2')];
        const pool = { totalCount: 0, connect: jest.fn(async () => conns.shift()), query: jest.fn() };
        PgObject.setClient(pool);
        const c1 = conns[0], c2 = conns[1];

        await Promise.all([
            PgObject.createTransaction(async () => { await PgObject.query('A'); }),
            PgObject.createTransaction(async () => { await PgObject.query('B'); throw new Error('x'); }).catch(() => {}),
        ]);

        expect(c1.query.mock.calls.map(c => c[0])).toEqual(['START TRANSACTION ISOLATION LEVEL READ COMMITTED', 'A', 'COMMIT']);
        expect(c2.query.mock.calls.map(c => c[0])).toEqual(['START TRANSACTION ISOLATION LEVEL READ COMMITTED', 'B', 'ROLLBACK']);
        expect(c1.release).toHaveBeenCalledTimes(1);
        expect(c2.release).toHaveBeenCalledTimes(1);
        expect(pool.query).not.toHaveBeenCalled();
        await expect(PgObject.startTransaction()).rejects.toThrow('connection pool');
    });
});

describe('Security (MySQL)', () => {
    const { convertPlaceholders, sanitizeValue } = require('./__MySqlQuery');
    const { format } = require('sqlstring');

    test('objects can not turn into SQL fragments', () => {
        const values = ['a@b.c', { password: 1 }].map(sanitizeValue);
        const sql = format('SELECT * FROM users WHERE email = ? AND password = ?', values);
        expect(sql).toBe(`SELECT * FROM users WHERE email = 'a@b.c' AND password = '{\\"password\\":1}'`);
        expect(format('id IN (?)', [sanitizeValue([1, { a: 1 }])])).toBe(`id IN (1, '{\\"a\\":1}')`);
    });

    test('$N placeholders keep their order and literals stay untouched', () => {
        const res = convertPlaceholders("SELECT '$1 ?' AS s, `a$1` FROM t WHERE b = $2 AND a = $1 -- $3\n/* $3 */", ['A', 'B']);
        expect(res.sql).toBe("SELECT '$1 ?' AS s, `a$1` FROM t WHERE b = ? AND a = ? -- $3\n/* $3 */");
        expect(res.values).toEqual(['B', 'A']);
        expect(() => convertPlaceholders('a = $2', ['A'])).toThrow();
        expect(() => convertPlaceholders('a = $1 AND b = ?', ['A', 'B'])).toThrow();
        expect(convertPlaceholders('a = ?', ['A'])).toEqual({ sql: 'a = ?', values: ['A'] });
    });
});

describe('Unknown database columns', () => {
    let query;
    let logger;
    beforeEach(() => {
        query = jest.fn(async () => ({ rows: [{ id: 1, name: 'a', new_col: 5 }, { id: 2, name: 'b', new_col: 6 }] }));
        logger = { log: jest.fn(), warn: jest.fn() };
        PgObject.setClient({ query }, 'postgresql');
        PgObject.setLog(false);
        PgObject.setLogger(logger);
    });

    afterAll(() => {
        PgObject.setLogger(console);
    });

    const makeModel = () => class Product extends PgObject {
        static get schema() { return { id: { pk: true }, name: {} }; }
        static get table() { return 'product'; }
    };

    test('are skipped with one warning per column that names it', async () => {
        const Product = makeModel();
        const rows = await Product.select();
        await Product.select();

        expect(rows.map(r => r.f.name)).toEqual(['a', 'b']);
        expect(logger.warn).toHaveBeenCalledTimes(1);
        const message = logger.warn.mock.calls[0][0];
        expect(message).toContain('"new_col"');
        expect(message).toContain('"product"');
        expect(message).toContain('Product');
        expect(message).not.toContain('5');
        expect(JSON.stringify(rows[0])).toBe('{"id":1,"name":"a"}');

        rows[0].f.name = 'c';
        await rows[0].save();
        expect(query.mock.calls[2][0]).toBe('UPDATE product SET name = $1 WHERE id = $2 RETURNING *');
    });

    test('are skipped in PgObject.query with a model and after insert', async () => {
        const Product = makeModel();
        await PgObject.query('SELECT * FROM product', [], Product);
        const p = new Product({ name: 'x' });
        await p.insert();
        expect(p.f.id).toBe(1);
        expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    test('a logger without warn() gets the message through log()', async () => {
        PgObject.setLogger({ log: logger.log });
        await makeModel().select();
        expect(logger.log.mock.calls[0][0]).toContain('"new_col"');
    });

    test('models with notValidateSchema stay silent', async () => {
        class Loose extends PgObject {
            static get schema() { return { id: { pk: true }, name: {} }; }
            static get table() { return 'loose'; }
            static get notValidateSchema() { return true; }
        }
        const [row] = await Loose.select();
        expect(row.f.name).toBe('a');
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.log).not.toHaveBeenCalled();
    });

    test('unknown fields in data from code still throw', () => {
        const Product = makeModel();
        expect(() => new Product({ name: 'a', new_col: 1 })).toThrow('new_col is not in the schema');
        const p = new Product();
        expect(() => { p.f.new_col = 1; }).toThrow();
    });

    test('dangerous column names from the database are skipped too', async () => {
        query.mockResolvedValueOnce({ rows: [JSON.parse('{"id":1,"__proto__":{"pwned":1},"constructor":2}')] });
        const [row] = await makeModel().select();
        expect(row.f.id).toBe(1);
        expect(({}).pwned).toBeUndefined();
        expect(logger.warn).toHaveBeenCalledTimes(2);
    });
});

describe('insertMany', () => {
    class Item extends PgObject {
        static get schema() {
            return {
                id: { pk: true, guarded: true },
                name: { required: true, set: (v) => v.trim() },
                price: {},
                status: { default: 'new' },
                label: { computed: true },
            };
        }
        static get table() { return 'item'; }
    }

    let query;
    beforeEach(() => {
        // PostgreSQL mock: INSERT ... RETURNING returns one row per VALUES tuple with generated ids
        let nextId = 1;
        query = jest.fn(async (sql, values) => {
            const tuples = (sql.match(/\( [^()]* \)/g) || []).slice(1);
            return { rows: sql.startsWith('INSERT') ? tuples.map(() => ({ id: nextId++, name: 'db', status: 'new' })) : [] };
        });
        PgObject.setClient({ query }, 'postgresql');
        PgObject.setLog(false);
    });

    test('inserts all rows with one query and returns saved objects', async () => {
        const items = await Item.insertMany([
            { id: 99, name: ' a ', price: 10, label: 'x' },
            { name: 'b' },
        ]);

        expect(query).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0][0]).toBe(
            'INSERT INTO item ( name, price, status ) VALUES ( $1, $2, $3 ), ( $4, DEFAULT, $5 ) RETURNING *'
        );
        expect(query.mock.calls[0][1]).toEqual(['a', 10, 'new', 'b', 'new']);
        expect(items.map(i => i.f.id)).toEqual([1, 2]);
        expect(items.every(i => i.selected && i instanceof Item)).toBe(true);

        items[1].f.price = 5;
        await items[1].save();
        expect(query.mock.calls[1][0]).toBe('UPDATE item SET price = $1 WHERE id = $2 RETURNING *');
        expect(query.mock.calls[1][1]).toEqual([5, 2]);
    });

    test('accepts unsaved model objects and rejects saved ones', async () => {
        const fresh = new Item({ name: 'c' });
        const [saved] = await Item.insertMany([fresh]);
        expect(saved).toBe(fresh);
        expect(fresh.selected).toBe(true);
        await expect(Item.insertMany([fresh])).rejects.toThrow('row 0 is already saved');
    });

    test('validates all rows before the first query', async () => {
        await expect(Item.insertMany([{ name: 'ok' }, { price: 1 }])).rejects.toThrow('name field in Item object is required');
        await expect(Item.insertMany([{ name: 'ok' }, { nope: 1 }])).rejects.toThrow('nope is not in the schema');
        expect(query).not.toHaveBeenCalled();
    });

    test('splits big inputs into chunks inside one transaction', async () => {
        const rows = Array.from({ length: 5 }, (_, i) => ({ name: `n${i}` }));
        const items = await Item.insertMany(rows, { chunkSize: 2 });
        const sqls = query.mock.calls.map(c => c[0]);
        expect(sqls[0]).toBe('START TRANSACTION ISOLATION LEVEL READ COMMITTED');
        expect(sqls.filter(s => s.startsWith('INSERT'))).toHaveLength(3);
        expect(sqls[sqls.length - 1]).toBe('COMMIT');
        expect(items.map(i => i.f.id)).toEqual([1, 2, 3, 4, 5]);
    });

    test('a failing chunk rolls back the whole insert', async () => {
        let inserts = 0;
        query.mockImplementation(async (sql) => {
            if (sql.startsWith('INSERT') && ++inserts === 2) throw new Error('duplicate key');
            return { rows: [] };
        });
        const rows = Array.from({ length: 4 }, (_, i) => ({ name: `n${i}` }));
        await expect(Item.insertMany(rows, { chunkSize: 2 })).rejects.toThrow('duplicate key');
        expect(query.mock.calls.map(c => c[0]).pop()).toBe('ROLLBACK');
    });

    test('keeps the PostgreSQL parameter limit', async () => {
        const rows = Array.from({ length: 30000 }, (_, i) => ({ name: `n${i}`, price: i }));
        await Item.insertMany(rows, { chunkSize: 100000 });
        const inserts = query.mock.calls.filter(c => c[0].startsWith('INSERT'));
        expect(inserts.length).toBeGreaterThan(1);
        expect(Math.max(...inserts.map(c => c[1].length))).toBeLessThanOrEqual(65535);
    });

    test('empty input sends no queries', async () => {
        expect(await Item.insertMany([])).toEqual([]);
        expect(query).not.toHaveBeenCalled();
        await expect(Item.insertMany('x')).rejects.toThrow('expects an array');
    });

    test('MySQL: ? placeholders, DEFAULT, no RETURNING; ids are unknown so update() throws', async () => {
        const mysqlQuery = jest.fn((sql, values, cb) => cb(null, { insertId: 10, affectedRows: 2 }));
        PgObject.setClient({ query: mysqlQuery }, 'mysql');
        try {
            const items = await Item.insertMany([{ name: 'a', price: 1 }, { name: 'b' }]);
            expect(mysqlQuery.mock.calls[0][0]).toBe('INSERT INTO item ( name, price, status ) VALUES ( ?, ?, ? ), ( ?, DEFAULT, ? )');
            expect(mysqlQuery.mock.calls[0][1]).toEqual(['a', 1, 'new', 'b', 'new']);
            expect(items[0].selected).toBe(true);
            items[0].f.price = 2;
            await expect(items[0].save()).rejects.toThrow('primary key id of Item object is not set');
        } finally {
            PgObject.setClient({ query }, 'postgresql');
        }
    });
});

describe('updateMany', () => {
    class Item extends PgObject {
        static get schema() {
            return { id: { pk: true }, name: { required: true }, price: {}, status: {} };
        }
        static get table() { return 'item_u'; }
    }

    let query;
    const typeRows = [
        { name: 'id', type: 'integer' }, { name: 'name', type: 'character varying' },
        { name: 'price', type: 'numeric' }, { name: 'status', type: 'text' },
    ];
    beforeEach(() => {
        delete Item.__pgColumnTypes;
        query = jest.fn(async (sql, values) => {
            if (sql.includes('pg_attribute')) return { rows: typeRows };
            if (sql.startsWith('SELECT')) {
                return { rows: [1, 2, 3].map(id => ({ id, name: `n${id}`, price: id * 10, status: 'old' })) };
            }
            if (sql.startsWith('UPDATE')) {
                // return rows in reverse order: matching must go by primary key
                const n = (sql.match(/\( \$/g) || []).length;
                const width = values.length / n;
                const rows = [];
                for (let r = 0; r < n; r++) rows.push({ id: values[r * width], name: 'from db', price: 0, status: 'db' });
                return { rows: rows.reverse() };
            }
            return { rows: [] };
        });
        PgObject.setClient({ query }, 'postgresql');
        PgObject.setLog(false);
    });

    test('one query per set of changed columns, typed VALUES, matched by primary key', async () => {
        const items = await Item.select();
        items[0].f.price = 11;
        items[1].f.price = 22;
        items[2].f.name = 'renamed';
        items[2].f.price = 33;

        const result = await Item.updateMany(items);
        expect(result).toBe(items);

        const sqls = query.mock.calls.map(c => c[0]);
        expect(sqls[1]).toBe('START TRANSACTION ISOLATION LEVEL READ COMMITTED');
        expect(sqls[2]).toContain('pg_attribute');
        expect(sqls[3]).toBe(
            'UPDATE item_u AS t SET price = v.price FROM (VALUES ( $1::integer, $2::numeric ), ( $3::integer, $4::numeric )) AS v (id, price) WHERE t.id = v.id RETURNING t.*'
        );
        expect(query.mock.calls[3][1]).toEqual([1, 11, 2, 22]);
        expect(sqls[4]).toBe(
            'UPDATE item_u AS t SET name = v.name, price = v.price FROM (VALUES ( $1::integer, $2::character varying, $3::numeric )) AS v (id, name, price) WHERE t.id = v.id RETURNING t.*'
        );
        expect(sqls[5]).toBe('COMMIT');

        expect(items.map(i => [i.f.id, i.f.status])).toEqual([[1, 'db'], [2, 'db'], [3, 'db']]);

        // changes are saved: nothing left to update
        query.mockClear();
        await Item.updateMany(items);
        await items[0].save();
        expect(query).not.toHaveBeenCalled();
    });

    test('a single group runs without a transaction; column types are read once', async () => {
        const items = await Item.select();
        items.forEach(i => { i.f.status = 'new'; });
        await Item.updateMany(items);
        items.forEach(i => { i.f.status = 'newer'; });
        await Item.updateMany(items);
        const sqls = query.mock.calls.map(c => c[0]);
        expect(sqls.filter(s => s.includes('pg_attribute'))).toHaveLength(1);
        expect(sqls.some(s => s.startsWith('START'))).toBe(false);
    });

    test('uses the primary key the object was loaded with', async () => {
        const [item] = await Item.select();
        item.f.id = 999;
        item.f.price = 5;
        await Item.updateMany([item]);
        const call = query.mock.calls.find(c => c[0].startsWith('UPDATE'));
        expect(call[1]).toEqual([1, 5]);
    });

    test('validates everything before the first query', async () => {
        const items = await Item.select();
        query.mockClear();
        items[0].f.price = 1;
        items[1].f.name = '';
        await expect(Item.updateMany(items)).rejects.toThrow('name field in Item object is required');
        await expect(Item.updateMany([new Item({ name: 'x' })])).rejects.toThrow('row 0 is not saved yet');
        const dup = await Item.select();
        dup[0].f.price = 7;
        items[1].f.name = 'ok';
        await expect(Item.updateMany([dup[0], items[0]])).rejects.toThrow('same primary key');
        expect(query.mock.calls.filter(c => c[0].startsWith('UPDATE'))).toHaveLength(0);
    });

    test('nothing changed: no queries; empty array is fine', async () => {
        const items = await Item.select();
        query.mockClear();
        expect(await Item.updateMany(items)).toBe(items);
        expect(await Item.updateMany([])).toEqual([]);
        expect(query).not.toHaveBeenCalled();
    });

    test('a failing chunk rolls back everything and keeps objects dirty', async () => {
        const items = await Item.select();
        items.forEach(i => { i.f.price = 1; });
        query.mockImplementation(async (sql) => {
            if (sql.includes('pg_attribute')) return { rows: typeRows };
            if (sql.startsWith('UPDATE') && sql.includes('$3')) throw new Error('deadlock');
            return { rows: [] };
        });
        await expect(Item.updateMany(items, { chunkSize: 2 })).rejects.toThrow('deadlock');
        expect(query.mock.calls.map(c => c[0]).pop()).toBe('ROLLBACK');
        expect(items[0].__updatedFields.has('price')).toBe(true);
    });

    test('MySQL: UPDATE ... JOIN (SELECT ... UNION ALL ...)', async () => {
        const mysqlQuery = jest.fn((sql, values, cb) => cb(null, sql.startsWith('SELECT')
            ? [{ id: 1, name: 'a', price: 1, status: 's' }, { id: 2, name: 'b', price: 2, status: 's' }]
            : { affectedRows: 2 }));
        PgObject.setClient({ query: mysqlQuery }, 'mysql');
        try {
            const items = await Item.select();
            items[0].f.price = 10;
            items[1].f.price = 20;
            await Item.updateMany(items);
            expect(mysqlQuery.mock.calls[1][0]).toBe(
                'UPDATE item_u AS t JOIN (SELECT ? AS id, ? AS price UNION ALL SELECT ?, ?) AS v ON t.id = v.id SET t.price = v.price'
            );
            expect(mysqlQuery.mock.calls[1][1]).toEqual([1, 10, 2, 20]);
        } finally {
            PgObject.setClient({ query }, 'postgresql');
        }
    });
});
