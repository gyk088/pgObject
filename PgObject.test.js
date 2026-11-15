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
