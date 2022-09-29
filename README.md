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
## License

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
    }
```
#### 1. `static get schema()` - return object:
- `pk: true` - PRIMARY KEY
- `computed: true` - This is a calculated field - it does not exist in the database
- `default: new Date()` - Default value
- `get (val, target, name)` - val: current value, target: all fields, name: name of this field
- `set (val, target, name)` - val: new value, target: all fields, name: name of this field

#### 2. `static get table()` - return string with table name


MIT


[pg]: https://node-postgres.com/
[pgQuery]: https://node-postgres.com/features/queries