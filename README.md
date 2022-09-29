# pgObject - simple ORM for PostgreSQL
## This orm is used with [PG][pg]

### Quick Example
#### 1. Create a table in database:
```SQL
CREATE TABLE userExample (
    id           SERIAL,
    name         VARCHAR(60),
    surname      VARCHAR(60),
    email        VARCHAR(60),
    token        VARCHAR(64),
    createdDate  timestamp(6) with time zone,

    PRIMARY KEY (id)
);
```
#### 2. Create a class:
```js
const { PgObject } = require('pgobject');

class UserExample extends PgObject {
    static get schema() {
        return {
            id: {
                pk: true,
            },
            name: {},
            surname: {},
            email: {},
            token: {},
            createdDate: {
                default: new Date(),
            }
        }
    }

    static get table() {
        return 'userExample';
    }
}
```

#### 3. pgObject configuration:
```js
const { Client } = require('pg');
const { PgObject } = require('pgobject');

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});

await client.connect();

PgObject.setClient(client);
```

#### 4. Use this class:
```js
const userExample = new UserExample({
    name: "nameExample",
    surname: "surnameExample",
});

console.log(userExample.f.name); // "nameExample"
console.log(userExample.f.surname); // "surnameExample"

await userExample.save(); // OR await userExample.insert();

const users1 = await UserExample.select("name = $1 LIMIT 1", ['nameExample']);
// OR await PgObject
//    .query("SELECT * FROM userExample WHERE name = $1 LIMIT 1", ['nameExample'], UserExample);

console.log(users1[0].f.name); // "nameExample"
console.log(users1[0].f.surname); // "surnameExample"

users1[0].f.surname = "newSurname";
await users1[0].save(); // OR await users1[0].update();

const users2 = await UserExample.select("name = $1 LIMIT 1", ['nameExample']);
console.log(users1[0].f.name); // "nameExample"
console.log(users1[0].f.surname); // "newSurname"
```
## Query to PostgreSQL
#### 1. Static method `select`:
```js
const users = await UserExample.select("name = $1 LIMIT 1", ['nameExample']);
```
- `static select(String where, Array values)` - return array of UserExample objects;
#### 2. Static method `query`:
```js
const users = await PgObject.query("SELECT * FROM userExample WHERE name = $1 LIMIT 1", ['nameExample'], UserExample);
// OR
 const users = await UserExample.query("SELECT * FROM userExample WHERE name = $1 LIMIT 1", ['nameExample'], UserExample);
```
- `static query(String query, Array values, class PgObjecExtension)` - return array of UserExample objects;

```js
const users = await PgObject.query("SELECT * FROM userExample WHERE name = $1 LIMIT 1", ['nameExample']);
// OR
const users = await UserExample.query("SELECT * FROM userExample WHERE name = $1 LIMIT 1", ['nameExample']);
```
- `static query(String query, Array values)` - see [pg query documentation][pgQuery]

#### 3. Method `save`
```js
 const user = new UserExample({
    name: "nameExample",
    surname: "surnameExample",
});

// in this case there will be an insert
await user.save();
user.f.name = "newName";
// in this case there will be an update
await user.save();
```
-`save()` - depending on we saved this object in the database will be an `insert` or an `update`

#### 4. Method `insert`
```js
const user = new UserExample({
    name: "nameExample",
    surname: "surnameExample",
});

await user.insert();
```
-`insert()` - save this object to the database

#### 5. Method `update`
```js
const users = await UserExample.select("name = $1 LIMIT 1", ["nameExample"]);
users[0].f.name = "newName";

await user.update();
```
-`update()` - update this object in the database

## PgObject class extension
For the PgObject class extension we must define `static get schema()` and `static get table()`
```js
const { PgObject } = require('pgobject');

class UserExample extends PgObject {
    static get schema() {
        return {
            id: {
                pk: true,
            },
            name: {},
            surname: {},
            email: {
                set (val, target, name) {
                    if (target[name]) {
                        return target[name];
                    }
                    return val;
                },
            },
            token: {
                get (val, target, name) {
                    if (!val) {
                         Math.random().toString(36).substr(2);
                    }
                    return val;
                },
            },
            createdDate: {
                default: new Date(),
            },
            fullName: {
                computed: true,
                get (val, target, name) {
                    return `${target['name']} ${target['surname']}`;
                },
            }
        }
    }

    static get table() {
        return 'userExample';
    }

    static get notValidateSchema() {
        // default return false
        return true;
    }
}
```
#### 1. `static get schema()` - return object:
- `pk: true` - PRIMARY KEY
- `computed: true` - This is a calculated field - it does not exist in the database
- `default: new Date()` - Default value
- `get (val, target, name)` - val: current value, target: all fields, name: name of this field
- `set (val, target, name)` - val: new value, target: all fields, name: name of this field

#### 2. `static get table()` - return string with table name
#### 3. `static get notValidateSchema()` - if return true - schema will be not validated
By default you can't dynamically add fields. But be careful, if you add a field outside of your schema, you may have problems saving the object in the database.
Example:
```js
const userExample = new UserExample();
userExample.f.newfield = 'test';
// console: if static get notValidateSchema() { return false } (by default)
// Error, newfield is not in the schema, check your schema getter, or notValidateSchema should return true
```

## Display logs
#### 1. `PgObject.setLog(true)` - enable the log
If you want to see your queries to the database enable the log.
```js
PgObject.setLog(true);
```
And after that, you will see log in your console.
Example:
```js
PgObject.setLog(true);
const users = await UserExample.select("name = $1 LIMIT 1", ['newName']);
// console:
// QueryLog:  SELECT * FROM admin WHERE name = $1 LIMIT 1
// Values:  [ 'newName' ]

const user = new UserExample({
    name: "nameExample",
    surname: "surnameExample",
});

await user.save();
// console:
// QueryLog:  INSERT INTO admin ( name, surname, ctime ) VALUES ( $1, $2, $3 ) RETURNING *
// Values:  [ 'nameExample', 'surnameExample', 2022-09-29T13:04:34.257Z ]
```

#### 2. `PgObject.setLogger(console)` - enable the log
If you want use your own logger you can set yor logger.
By default we use console.
Example:
```js
const logger = {
    log() {
        console.log("MyLogger", arguments)
    }
};

PgObject.setLog(true);
PgObject.setLogger(logger);

const users = await UserExample.select("name = $1 LIMIT 1", ['newName']);
// console:
//MyLogger [Arguments] {
//  '0': 'QueryLog: ',
//  '1': 'SELECT * FROM admin WHERE name = $1 LIMIT 1',
//  '2': '\nValues: ',
//  '3': [ 'newName' ]
//}
```

## Transaction `PgTransaction`
For transaction you can use `PgTransaction` class
#### Quick Example
```js
PgObject.setLog(true);

await PgTransaction.create(async () => {
    const user1 = new UserExample();
    user1.f.name = 'user1';
    const user2 = new UserExample();
    user2.f.name = 'user2';
    await user1.save();
    await user2.save();
});
// console:
// QueryLog:  START TRANSACTION ISOLATION LEVEL READ UNCOMMITTED
// QueryLog:  INSERT INTO admin ( name, ctime ) VALUES ( $1, $2 ) RETURNING *
// Values:  [ 'user1', 2022-09-29T13:45:20.620Z ]
// QueryLog:  INSERT INTO admin ( name, ctime ) VALUES ( $1, $2 ) RETURNING *
// Values:  [ 'user2', 2022-09-29T13:45:20.620Z ]
// QueryLog:  COMMIT
```

#### Transaction Isolation
- `READ UNCOMMITTED` - PgTransaction.mode.readUncommitted (by default)
- `READ COMMITTED` - PgTransaction.mode.readCommitted
- `REPEATABLE READ` - PgTransaction.mode.repeatableRead
- `SERIALIZABLE` - PgTransaction.mode.serializable

example:
```js
PgObject.setLog(true);
await PgTransaction.create(async () => {
    const user1 = new UserExample();
    user1.f.name = 'user1';
    const user2 = new UserExample();
    user2.f.name = 'user2';
    await user1.save();
    await user2.save();
}, PgTransaction.mode.serializable);
// console:
// QueryLog:  START TRANSACTION ISOLATION LEVEL SERIALIZABLE
// QueryLog:  INSERT INTO admin ( name, ctime ) VALUES ( $1, $2 ) RETURNING *
// Values:  [ 'user1', 2022-09-29T13:45:20.620Z ]
// QueryLog:  INSERT INTO admin ( name, ctime ) VALUES ( $1, $2 ) RETURNING *
// Values:  [ 'user2', 2022-09-29T13:45:20.620Z ]
// QueryLog:  COMMIT
```
#### PgTransaction methods
- `PgTransaction.create(cb, mode)` - create a transaction. cb - function, mode - isolation level
- `PgTransaction.start(mode)` - start transaction. mode - isolation level
- `PgTransaction.commit()` - commit transaction.
- `PgTransaction.rollback()` - rollback transaction.

## License
MIT


[pg]: https://node-postgres.com/
[pgQuery]: https://node-postgres.com/features/queries