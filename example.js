/**
 * This file contain examples to use this ORM.
 * If you want to run this examples on your localhost execute this commands:
 * 1. git clone git@github.com:gyk088/pgObject.git
 * 2. cd pgObject/
 * 3. docker-compose up -d
 * 4. npm install
 * 5. node example.js
 */

const { Client } = require('pg');
var mysql = require('mysql2');
const PgObject  = require('./PgObject');

(async function run () {
    await postgreSqlExample();
    await mySqlExample();
    process.exit(1);
})();

class Admin extends PgObject {
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
            },
            fullName: {
                computed: true,
                get (val, target, name) {
                    return `${target['name']} ${target['surname']}`;
                },
                set (val, target, name) {
                    console.log("you cannot define this field")
                    return target[name];
                }
            },
        }
    }

    static get table() {
        return 'exapmleAdmin';
    }

    static get notValidateSchema() { return true }
}

// Example for PostgreSQL
async function postgreSqlExample () {
    // Config
    const client = new Client({
        user: 'pgobject',
        database: 'pgobject',
        password: 'pgobject',
        host: '127.0.0.1',
        port: '5432',
    });

    await client.connect();
    PgObject.setClient(client);
    PgObject.setLog(true);

    await PgObject.query(`
        BEGIN;

        DROP TABLE IF EXISTS exapmleAdmin;

        CREATE TABLE exapmleAdmin (
            id      SERIAL,
            name    VARCHAR(40),
            surname VARCHAR(40),
            ctime   timestamp(6) with time zone,

            PRIMARY KEY (id)
        );

        COMMIT;`
    );

    // Create a new Object in the Database
    const admin1 = new Admin({
        name: 'TestName1',
        surname: 'TestSurname1'
    });
    await admin1.save(); // or admin2.insert();

    const admin2 = new Admin();
    admin2.f.surname = 'TestSurname1'
    await admin2.insert(); // or admin2.save();

    // Update object
    const admins1 = await Admin.select("WHERE name = $1 LIMIT 1", ['TestName1']);
    admins1[0].f.name = 'newValue1';
    await admins1[0].save() // or admins1[0].update();

    const admins2 = await Admin.select("WHERE name = $1 LIMIT 1", ['TEST NAME']);
    admins2[0].f.name = 'newValue2';
    await admins2[0].update() // or admins2[0].save();

    // SELECT
    const admins3 = await Admin.select("WHERE name = $1 LIMIT 1", ['TEST NAME']);

    // Query
    const admins4 = await PgObject.query("SELECT * FROM exapmleAdmin WHERE name = $1 LIMIT 1", ['TEST NAME'], Admin);
    const admins5 = await Admin.query("SELECT * FROM exapmleAdmin WHERE name = $1 LIMIT 1", ['TEST NAME'], Admin);
    const data1 = await Admin.query("SELECT * FROM exapmleAdmin WHERE name = $1 LIMIT 1", ['TEST NAME']);
    const data2 = await PgObject.query("SELECT * FROM exapmleAdmin WHERE name = $1 LIMIT 1", ['TEST NAME']);

    // Transaction
    await PgObject.startTransaction();
        const admin3 = new Admin({
            name: 'TestName1',
            surname: 'TestSurname1'
        });
        await admin3.save();
    await PgObject.commit();

    await PgObject.startTransaction(PgObject.mode.repeatableRead);
        const admin4 = new Admin({
            name: 'TestName1',
            surname: 'TestSurname1'
        });
        await admin4.save();
    await PgObject.rollback();

    PgObject.createTransaction(async () => {
        const admin1 = new Admin({
            name: 'TestName1',
            surname: 'TestSurname1'
        });
        await admin1.save();
    })

    PgObject.createTransaction(async () => {
        const admin = new Admin({
            name: 'TestName1',
            surname: 'TestSurname1'
        });
        await admin.save();
    }, PgObject.mode.serializable);


    // DELETE
    const admins6 = await Admin.select();
    for (const adm of admins6) {
        await adm.delete();
    }

    // Close connection
    await client.end();
}

// Example for MySql
async function mySqlExample () {
    // Config
    var client = mysql.createConnection({
        user: 'pgobject',
        password: 'pgobject',
        database: 'pgobject',
    });

    PgObject.setClient(client, 'mysql');
    PgObject.setLog(true);

    await PgObject.query(`BEGIN`);
    await PgObject.query(`DROP TABLE IF EXISTS exapmleAdmin`);
    await PgObject.query(`CREATE TABLE exapmleAdmin (
        id      INT AUTO_INCREMENT,
        name    VARCHAR(40),
        surname VARCHAR(40),
        ctime   DATETIME,

        PRIMARY KEY (id)
    )`);
    await PgObject.query(`COMMIT`);

    // Create a new Object in the Database
    const admin1 = new Admin({
        name: 'TestName1',
        surname: 'TestSurname1'
    });
    await admin1.save(); // or admin2.insert();

    const admin2 = new Admin();
    admin2.f.surname = 'TestSurname1'
    await admin2.insert(); // or admin2.save();

    // Update object
    const admins1 = await Admin.select("WHERE name = $1 LIMIT 1", ['TestName1']);
    admins1[0].f.name = 'newValue1';
    await admins1[0].save() // or admins1[0].update();

    const admins2 = await Admin.select("WHERE name = $1 LIMIT 1", ['TEST NAME']);
    admins2[0].f.name = 'newValue2';
    await admins2[0].update() // or admins2[0].save();

    // SELECT
    const admins3 = await Admin.select("WHERE name = $1 LIMIT 1", ['TEST NAME']);

    // Query
    const admins4 = await PgObject.query("SELECT * FROM exapmleAdmin WHERE name = $1 LIMIT 1", ['TEST NAME'], Admin);
    const admins5 = await Admin.query("SELECT * FROM exapmleAdmin WHERE name = $1 LIMIT 1", ['TEST NAME'], Admin);
    const data1 = await Admin.query("SELECT * FROM exapmleAdmin WHERE name = $1 LIMIT 1", ['TEST NAME']);
    const data2 = await PgObject.query("SELECT * FROM exapmleAdmin WHERE name = $1 LIMIT 1", ['TEST NAME']);

    // Transaction
    PgObject.createTransaction(async () => {
        const admin1 = new Admin({
            name: 'TestName1',
            surname: 'TestSurname1'
        });
        await admin1.save();
    })

    PgObject.createTransaction(async () => {
        const admin = new Admin({
            name: 'TestName1',
            surname: 'TestSurname1'
        });
        await admin.save();
    }, PgObject.mode.serializable);

    await PgObject.startTransaction();
        const admin3 = new Admin({
            name: 'TestName1',
            surname: 'TestSurname1'
        });
        await admin3.save();
    await PgObject.commit();

    await PgObject.startTransaction(PgObject.mode.repeatableRead);
        const admin4 = new Admin({
            name: 'TestName1',
            surname: 'TestSurname1'
        });
        await admin4.save();
    await PgObject.rollback();

    // DELETE
    const admins6 = await Admin.select();
    for (const adm of admins6) {
        await adm.delete();
    }

    // Close connection
    await client.end();
}