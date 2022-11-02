# pgObject - simple ORM for PostgreSQL and MySql

## For PostgreSQL orm is used with [PG][pg]
## For MySQL orm is used with [mysql][mysql] or [mysql2][mysql2]

## [Exaple][example]

### Quick Example (PostgreSQL). For MySql it works the same.

### Quick Example (PostgreSQL). For MySql it works the same.
#### 1. Create a table in the database:
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
const PgObject = require('pgobject');

class UserExample extends PgObject {
    static get schema() {
        return {
            id: {
                pk: true,
            },
            name: {},
            surname: {},
            email: {
                required: true,
            },
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
##### PostgreSQL:
```js
const { Client } = require('pg');
const PgObject = require('pgobject');

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
##### MySQl:
```js
const mysql = require('mysql2');
const PgObject = require('pgobject');

const client = mysql.createConnection({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});

PgObject.setClient(client, 'mysql');
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

const users1 = await UserExample.select("WHERE name = $1 LIMIT 1", ['nameExample']);
// OR await PgObject
//    .query("SELECT * FROM userExample WHERE name = $1 LIMIT 1", ['nameExample'], UserExample);

console.log(users1[0].f.name); // "nameExample"
console.log(users1[0].f.surname); // "surnameExample"

users1[0].f.surname = "newSurname";
await users1[0].save(); // OR await users1[0].update();

const users2 = await UserExample.select("WHERE name = $1 LIMIT 1", ['nameExample']);
console.log(users1[0].f.name); // "nameExample"
console.log(users1[0].f.surname); // "newSurname"

await users2[0].delete();
```
## Query to DB
#### 1. Static method `select`:
```js
const users = await UserExample.select("WHERE name = $1 LIMIT 1", ['nameExample']);
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
const users = await UserExample.select("WHERE name = $1 LIMIT 1", ["nameExample"]);
users[0].f.name = "newName";

await users[0].update();
```
-`update()` - update this object in the database

#### 5. Method `delete`
```js
const users = await UserExample.select("WHERE name = $1 LIMIT 1", ["nameExample"]);


await users[0].delete();
```
-`delete()` - delete this object from the database

## PgObject class extension
For the PgObject class extension we must define `static get schema()` and `static get table()`
```js
const PgObject = require('pgobject');

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
                required: true,
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
- `required: true` - This fied is required
- `default: new Date()` - Default value
- `get (val, target, name)` - val: current value, target: all fields, name: name of this field
- `set (val, target, name)` - val: new value, target: all fields, name: name of this field

`pk: true`:
You should define at least one field as the primary key.
If your schema doesn't have a primary key you will see an error.
```console
Error, please set the PRIMARY KEY in the UserExample class
```
`computed: true`:
If you want to have a field that does not exist in the database table and will not participate in an insert or update, you must set a computed property.
Example: fullName is computed field
```js
class UserExample extends PgObject {
    static get schema() {
        return {
           ...
            fullName: {
                computed: true
            }
        }
    }
    ...
}

const user = new UserExample({
    fullName: 'Test Tets',
    ...
});

console.log(user.f.fullName); // 'Test Tets';

// fullName will not save in the database
await user.save();
```
`required: true`:
If you try to save your UserExample object to the database without values of the required fields  - you will see an error.
Example: email is required field
```js
class UserExample extends PgObject {
    static get schema() {
        return {
           ...
            email: {
               required: true,
            }
        }
    }
    ...
}

const user = new UserExample({
    name: "nameExample",
    surname: "surnameExample",
});

await user.save();
// console:
// Error: email field in UserExample object is required;
```
`default: someDefaultValue`
You can set default values for fields
```js
class UserExample extends PgObject {
    static get schema() {
        return {
           ...
            name: {
               default: 'Test',
            }
        }
    }
    ...
}

const user = new UserExample();
console.log(user.f.name); // 'Test';
// the name field will save with the default value ('Test');
await user.save();

user.f.name = 'newValue';
// the name field will save with the new value ('newValue');
await user.save();
```

`get (val, target, name)` - is like standart getter
`val` - the current value of this field
`target` - all fields of this object (this.f)
`name` - string, name of this field
Example:
```js
class UserExample extends PgObject {
    static get schema() {
        return {
            id: {
                pk: true,
            },
            name: {
                default: 'TEST NAME',
            },
            surname: {
                 get(val, target, name) {
                    console.log('val:', val);
                    console.log('target:', target);
                    console.log('field name:', name);
                    console.log('full name:', target.name, val);
                    return `Surname - ${val}`;
                }
            },
            ...
    }
    ...
}

const user = new UserExample();
user.f.surname = 'SURNAME'
const surname = user.f.surname;
console.log(surname);
// console:
// val: SURNAME
// target: {
//  id: { pk: true },
//  name: { default: 'TEST NAME' },
//  surname: { get: [Function: get], value: 'SURNAME' },
//  ...
// }
// field name: surname
// full name: TEST NAME SURNAME
// Surname - SURNAME
```

`set (val, target, name)` - is like standart setter
`val` - new value of this field
`target` - all fields of this object (this.f)
`name` - string, name of this field
Example:
```js
class UserExample extends PgObject {
    static get schema() {
        return {
            id: {
                pk: true,
            },
            name: {
                default: 'TEST NAME',
            },
            surname: {
                 set(val, target, name) {
                    console.log('val:', val);
                    console.log('target:', target);
                    console.log('field name:', name);
                    console.log('full name:', target.name, val);
                    return `Surname - ${val}`;
                }
            },
            ...
    }
    ...
}

const user = new UserExample();
user.f.surname = 'NEW SURNAME';
// console:
// val: NEW SURNAME
// target: {
//  id: { pk: true },
//  name: { default: 'TEST NAME' },
//  surname: { set: [Function: set] },
//  ...
// }
// name: surname
// full name: TEST NAME NEW SURNAME

// the surname field will save with the 'Surname - NEW SURNAME'  value ('newValue');
await user.save();
// console:
// QueryLog:  INSERT INTO userExample ( name, surname ) VALUES ( $1, $2 ) RETURNING *
// Values:  [ 'TEST NAME', 'Surname - NEW SURNAME' ]
```

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
const users = await UserExample.select("WHERE name = $1 LIMIT 1", ['newName']);
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

const users = await UserExample.select("WHERE name = $1 LIMIT 1", ['newName']);
// console:
// MyLogger [Arguments] {
//  '0': 'QueryLog: ',
//  '1': 'SELECT * FROM admin WHERE name = $1 LIMIT 1',
//  '2': '\nValues: ',
//  '3': [ 'newName' ]
// }
```

## TO JSON
If you want to serialize your object to JSON you can override `toJSON()` method;
By default we serialize all fields in schema.
Example:
```js
const users = await UserExample.select("WHERE name = $1 LIMIT 1", ['newName']);
console.log(JSON.stringify(users));
// console:
// ["{\"id\":437,\"name\":\"TEST NAME\",\"createdDate\":\"2022-09-29T22:20:59.740Z\" ...]
```

## Transaction
#### Quick Example
```js
PgObject.setLog(true);

await PgObject.createTransaction(async () => {
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
- `READ UNCOMMITTED` - PgObject.mode.readUncommitted (by default)
- `READ COMMITTED` - PgObject.mode.readCommitted
- `REPEATABLE READ` - PgObject.mode.repeatableRead
- `SERIALIZABLE` - PgObject.mode.serializable

example:
```js
PgObject.setLog(true);

await PgObject.create(async () => {
    const user1 = new UserExample();
    user1.f.name = 'user1';
    const user2 = new UserExample();
    user2.f.name = 'user2';
    await user1.save();
    await user2.save();
}, PgObject.mode.serializable);
// console:
// QueryLog:  START TRANSACTION ISOLATION LEVEL SERIALIZABLE
// QueryLog:  INSERT INTO admin ( name, ctime ) VALUES ( $1, $2 ) RETURNING *
// Values:  [ 'user1', 2022-09-29T13:45:20.620Z ]
// QueryLog:  INSERT INTO admin ( name, ctime ) VALUES ( $1, $2 ) RETURNING *
// Values:  [ 'user2', 2022-09-29T13:45:20.620Z ]
// QueryLog:  COMMIT
```
#### PgObject public methods:
- `.insert()` - insert data.
- `.update()` - update data.
- `.delete()` - delete data.
- `.save()` - insert or update data.
#### PgObject static methods:
- `PgObject.setClient(Object client, String type)` - set db client. client - db client, type - 'mysql' or 'postgresql', by default 'postgresql'.
- `PgObject.setLog(Boolean log)` - if true, write a log to the console.
- `PgObject.setLogger(Object logger)` - install your own logger.
- `PgObject.query(String query, Array values, Class classObj)` - create a db query
- `PgObject.select(String whereString, Array values)` - select data from db
- `PgObject.createTransaction(Function cb, PgObject.mode mode)` - create a transaction. cb - function, mode - isolation level
- `PgObject.startTransaction(PgObject.mode mode)` - start transaction. mode - isolation level
- `PgObject.commit()` - commit transaction.
- `PgObject.rollback()` - rollback transaction.

#### PgObject override methods:
- `static get schema() {}`
- `static get table() {}`
- `static get notValidateSchema() { }`
- `toJSON() {}`

## License
MIT


[pg]: https://node-postgres.com/
[mysql]: https://www.npmjs.com/package/mysql
[mysql2]: https://www.npmjs.com/package/mysql2
[pgQuery]: https://node-postgres.com/features/queries
[example]: https://github.com/gyk088/pgObject/blob/main/example.js