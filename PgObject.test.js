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
        PgObject.setLog(true);
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

        expect(query.mock.calls[1][0]).toMatch('UPDATE admin SET name = $1, ctime = $2 WHERE id = $3 RETURNING *');
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

        PgObject.startTransaction();
        const admin1 = new MockAdmin();
        admin1.f.surname = 'Test2';
        await admin1.save();
        PgObject.commit();

        expect(query.mock.calls[4][0]).toMatch('START TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
        expect(query.mock.calls[5][0]).toMatch('INSERT INTO admin ( name, surname, ctime ) VALUES ( $1, $2, $3 ) RETURNING *');
        expect(query.mock.calls[6][0]).toMatch('COMMIT');

        PgObject.startTransaction();
        const admin2 = new MockAdmin();
        admin2.f.surname = 'Test2';
        await admin2.save();
        PgObject.rollback();

        expect(query.mock.calls[7][0]).toMatch('START TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
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
        PgObject.setLog(true);
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

        expect(query.mock.calls[1][0]).toMatch('UPDATE admin SET name = ?, ctime = ? WHERE id = ?');
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

        expect(query.mock.calls[0][0]).toMatch('SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        expect(query.mock.calls[1][0]).toMatch('INSERT INTO admin ( name, ctime ) VALUES ( ?, ? )');
        expect(query.mock.calls[2][0]).toMatch('INSERT INTO admin ( name, surname, ctime ) VALUES ( ?, ?, ? )');
        expect(query.mock.calls[3][0]).toMatch('COMMIT');

        PgObject.startTransaction();
        const admin1 = new MockAdmin();
        admin1.f.surname = 'Test2';
        await admin1.save();
        PgObject.commit();

        expect(query.mock.calls[4][0]).toMatch('SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
        expect(query.mock.calls[5][0]).toMatch('INSERT INTO admin ( name, surname, ctime ) VALUES ( ?, ?, ? )');
        expect(query.mock.calls[6][0]).toMatch('COMMIT');

        PgObject.startTransaction();
        const admin2 = new MockAdmin();
        admin2.f.surname = 'Test2';
        await admin2.save();
        PgObject.rollback();

        expect(query.mock.calls[7][0]).toMatch('SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
        expect(query.mock.calls[8][0]).toMatch('INSERT INTO admin ( name, surname, ctime ) VALUES ( ?, ?, ? )');
        expect(query.mock.calls[9][0]).toMatch('ROLLBACK');
    })
})


