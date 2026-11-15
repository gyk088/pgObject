# pgObject

A small ORM for PostgreSQL and MySQL. You describe a table as a class, then load, create, change and delete rows as objects. For anything more complex you write plain SQL.

- Works with [pg](https://node-postgres.com/) (PostgreSQL) and [mysql2](https://www.npmjs.com/package/mysql2) / [mysql](https://www.npmjs.com/package/mysql) (MySQL)
- Saves only the fields you changed
- Transactions that are safe with connection pools and concurrent requests
- TypeScript types, ES modules and CommonJS

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Defining a model](#defining-a-model)
- [Working with objects](#working-with-objects)
- [Queries](#queries)
- [Transactions](#transactions)
- [JSON](#json)
- [Logging](#logging)
- [TypeScript](#typescript)
- [MySQL notes](#mysql-notes)
- [API reference](#api-reference)
- [Migration from 2.x to 3.0](#migration-from-2x-to-30)

## Installation

Install pgObject together with the driver for your database:

```bash
npm install pgobject pg        # PostgreSQL
npm install pgobject mysql2    # MySQL
```

Requires Node.js 16 or newer. Both import styles work and give the same class:

```js
import PgObject from 'pgobject';       // or: import { PgObject } from 'pgobject';
const PgObject = require('pgobject');
```

## Quick start

**1. A table:**

```sql
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(60),
    email       VARCHAR(60) NOT NULL,
    created_at  TIMESTAMPTZ
);
```

**2. A model for it:**

```js
import PgObject from 'pgobject';

class User extends PgObject {
    static get schema() {
        return {
            id: { pk: true },
            name: {},
            email: { required: true },
            created_at: { default: new Date() },
        };
    }

    static get table() {
        return 'users';
    }
}
```

**3. Connect once at startup:**

```js
import pg from 'pg';

const pool = new pg.Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
});

PgObject.setClient(pool);
```

For MySQL, pass the connection or pool and `'mysql'`:

```js
import mysql from 'mysql2';

PgObject.setClient(mysql.createPool({ /* same options */ }), 'mysql');
```

**4. Use it:**

```js
// create
const user = new User({ name: 'Ann', email: 'ann@example.com' });
await user.save();                  // INSERT, user.f.id is now set

// read
const [found] = await User.select('WHERE email = $1', ['ann@example.com']);
console.log(found.f.name);          // 'Ann'

// update
found.f.name = 'Anna';
await found.save();                 // UPDATE users SET name = $1 WHERE id = $2

// delete
await found.delete();
```

Field values live in `obj.f`. Read and assign them like normal properties.

## Defining a model

A model is a class that extends `PgObject` and defines two static getters:

- `schema` returns an object with one entry per table column.
- `table` returns the table name.

```js
class User extends PgObject {
    static get schema() {
        return {
            id:         { pk: true, guarded: true },
            email:      { required: true, set: (value) => value.trim().toLowerCase() },
            name:       {},
            role:       { guarded: true, default: 'user' },
            password:   { hidden: true },
            created_at: { default: new Date() },
            label:      { computed: true, get: (value, f) => `${f.name} <${f.email}>` },
        };
    }

    static get table() {
        return 'users';
    }
}
```

**List every column the table has.** `SELECT *` returns all of them, and a column that is not in the schema causes an error (`Error, extra is not in the schema ...`). To allow extra columns, see `notValidateSchema` below.

### Field options

| Option | What it does |
|---|---|
| `pk: true` | Primary key. Required on at least one field; several fields make a composite key. `update()` and `delete()` find the row by it. |
| `required: true` | `insert()` and `update()` throw if the value is `undefined`, `null` or `''`. `0` and `false` are valid values. |
| `default: value` | Value for **new** objects when the field is not given. Objects loaded from the database never get defaults. |
| `computed: true` | The field does not exist in the table: it is never saved, but it is included in JSON. Usually combined with `get`. |
| `guarded: true` | The field is ignored in constructor data. Use it for fields that users must not set themselves, like `id`, `role` or `is_admin`. Code can still assign them: `user.f.role = 'admin'`. |
| `hidden: true` | The field is left out of `toJSON()`, for example password hashes and tokens. |
| `get(value, f, name)` | Runs on every read. `value` is the stored value, `f` is all fields of the object, `name` is the field name. Returns what the reader gets. |
| `set(value, f, name)` | Runs when you assign a value or pass it to the constructor, and returns the value to store. It does **not** run for data loaded from the database. |

`default: new Date()` is evaluated each time an object is created, because the `schema` getter runs once per object. This holds only while `schema` is a getter. With `static schema = { ... }` the date would be computed once, when the class is defined.

### Model settings

```js
class Log extends PgObject {
    static get schema() { /* ... */ }
    static get table() { return 'logs'; }          // can include a schema: 'audit.logs'
    static get notValidateSchema() { return true; } // allow fields that are not in the schema
}
```

With `notValidateSchema`:
- columns returned by the database that are not in the schema are ignored instead of throwing;
- you can assign new fields in code (`log.f.extra = 1`), and they are saved too.

Table and field names are put into SQL as written, so they must be plain identifiers (letters, digits, `_`, `$`). Other names throw an error.

## Working with objects

```js
const user = new User({ name: 'Ann', email: 'ann@example.com' });
```

- `save()` runs `insert()` for a new object and `update()` for one loaded from the database. `obj.selected` is `true` once the object exists in the database.
- `insert()`:
  - inserts the fields that have values;
  - on PostgreSQL, reloads the row from the database (`RETURNING *`), so generated ids and database defaults appear in `obj.f`;
  - on MySQL, sets the auto-increment id only.
- `update()`:
  - sends **only the fields changed** since the object was loaded or last saved; if nothing changed, no query is sent;
  - never changes the primary key, and always targets the row the object was loaded from, even if `obj.f.id` was reassigned.
- `delete()` deletes the row by primary key. It throws if the primary key is empty.

Constructor data usually comes from a request:

```js
const user = new User(req.body);  // guarded fields (id, role) are ignored
await user.save();
```

Keys that are not in the schema throw an error unless the model has `notValidateSchema`. Keys like `__proto__` always throw.

You can add your own methods and override the built-in ones:

```js
class Article extends PgObject {
    // ...
    static async getPublished() {
        return Article.select('WHERE published_at IS NOT NULL ORDER BY published_at DESC');
    }

    async update() {
        this.f.updated_at = new Date();
        return super.update();
    }
}
```

## Queries

### `Model.select(where, values)`

Runs `SELECT * FROM <table> <where>` and returns an array of model objects:

```js
const all = await User.select();
const admins = await User.select('WHERE role = $1 ORDER BY name LIMIT $2', ['admin', 10]);
```

> ⚠️ `where` is raw SQL. Never build it from user input. Pass input as `$1, $2, ...` placeholders and values:
> ```js
> await User.select(`WHERE name = '${req.query.name}'`);       // SQL injection
> await User.select('WHERE name = $1', [req.query.name]);      // safe
> ```

### `PgObject.query(sql, values, Model)`

Runs any SQL. With a model class as the third argument, the rows become model objects:

```js
const users = await PgObject.query(
    'SELECT u.* FROM users u JOIN orders o ON o.user_id = u.id WHERE o.total > $1',
    [100],
    User
);
```

Without a model it returns the driver result. For pg that is the [query result](https://node-postgres.com/apis/result), with rows in `.rows`:

```js
const { rows } = await PgObject.query('SELECT count(*) AS n FROM users');
```

Objects loaded from a query that selects only some columns can be changed and saved safely. The missing fields stay `undefined` and are not written.

## Transactions

```js
const order = await PgObject.createTransaction(async () => {
    const order = new Order({ user_id: user.f.id, total: 100 });
    await order.save();
    user.f.balance -= 100;
    await user.save();
    return order;
});
```

- Every query inside the callback runs in the transaction, including queries in functions it calls.
- If the callback finishes, the transaction is committed and `createTransaction` returns the callback's result.
- If the callback throws, the transaction is rolled back and **the error is thrown again**. Catch it where you handle errors:

```js
try {
    await PgObject.createTransaction(async () => { /* ... */ });
} catch (e) {
    // nothing was saved
}
```

How queries are isolated from other requests:
- **With a pool** (`pg.Pool`, `mysql2.createPool`), each transaction gets its own connection, and concurrent requests do not interfere. A pool is the recommended setup for servers.
- **With a single connection**, transactions run one at a time, and queries from outside wait until the current transaction ends.
- A `createTransaction` inside another one becomes part of the outer transaction.

Isolation level is the second argument. The default is `READ COMMITTED`:

```js
await PgObject.createTransaction(async () => { /* ... */ }, PgObject.mode.serializable);
```

| Level | Constant |
|---|---|
| `READ UNCOMMITTED` | `PgObject.mode.readUncommitted` |
| `READ COMMITTED` (default) | `PgObject.mode.readCommitted` |
| `REPEATABLE READ` | `PgObject.mode.repeatableRead` |
| `SERIALIZABLE` | `PgObject.mode.serializable` |

`PgObject.startTransaction()`, `commit()` and `rollback()` also exist, but they are low-level. They run on the shared connection with no protection from concurrent requests, and they throw when the client is a pool. Prefer `createTransaction`.

## JSON

`JSON.stringify(obj)` and `res.json(obj)` output all schema fields, including computed ones, except `hidden` fields:

```js
JSON.stringify(user); // {"id":1,"email":"ann@example.com","name":"Ann","role":"user",...}
```

To change the output, override `toJSON()` in the model.

## Logging

```js
PgObject.setLog(true);
await User.select('WHERE id = $1', [1]);
// Query:  SELECT * FROM users WHERE id = $1
// Values:  [ 1 ]
// Execution time: 1 ms
```

> ⚠️ The log includes query values, so passwords and tokens end up in it. Use it for development only.

When logging is off, nothing is logged at all: SQL errors are only thrown. To send logs somewhere other than the console, pass any object with a `log(...args)` method:

```js
PgObject.setLogger({ log: (...args) => myLogger.debug(...args) });
```

## TypeScript

Types are included. Pass the field types to the model to get checked field access:

```ts
import { PgObject, type Schema } from 'pgobject';

interface UserFields {
    id: number;
    email: string;
    role: 'user' | 'admin';
}

class User extends PgObject<UserFields> {
    static get schema(): Schema<UserFields> {
        return {
            id: { pk: true },
            email: { required: true },
            role: { default: 'user' },
        };
    }

    static get table() {
        return 'users';
    }
}

const users = await User.select('WHERE role = $1', ['admin']); // User[]
users[0].f.role = 'root';   // error: not 'user' | 'admin'
```

Without the type parameter (`extends PgObject`) all fields are `any`. In a TypeScript project compiled to CommonJS, use the default import: `import PgObject from 'pgobject'`.

## MySQL notes

- Write placeholders as `$1, $2, ...`, the same as for PostgreSQL. They are converted to `?` with the values in the right order, and `$` inside string literals and comments is left alone. Plain `?` also works, but not mixed with `$N` in one query.
- Object values are sent as JSON strings, so a request field like `{ "password": 1 }` can not turn into SQL.
- `insert()` does not reload the row: only the auto-increment id is set on the object.
- Use mysql2 3.24.6 or newer. Older versions have known critical vulnerabilities.

## API reference

**Setup**

| Method | Description |
|---|---|
| `PgObject.setClient(client, type?)` | Database client: pg `Client`/`Pool`, or mysql/mysql2 connection/pool with type `'mysql'`. The default type is `'postgresql'`. |
| `PgObject.setLog(enabled)` | Log every query with its values. |
| `PgObject.setLogger(logger)` | Object with a `log(...args)` method. The default is `console`. |

**Queries and transactions**

| Method | Returns |
|---|---|
| `Model.select(where?, values?)` | `Promise<Model[]>` |
| `PgObject.query(sql, values?, Model?)` | `Promise<Model[]>` with a model, otherwise the driver result |
| `PgObject.createTransaction(cb, mode?)` | `Promise` of the callback's result |
| `PgObject.startTransaction(mode?)`, `commit()`, `rollback()` | Low-level, see [Transactions](#transactions) |

**Object methods**

| Method | Description |
|---|---|
| `new Model(data?)` | Create an object. `data` is the field values. |
| `obj.f` | Field values |
| `obj.selected` | `true` if the object exists in the database |
| `obj.save()` | `insert()` or `update()` |
| `obj.insert()` / `obj.update()` / `obj.delete()` | Write to the database. Each returns the object. |
| `obj.toJSON()` | Fields for JSON |

**Overridable in a model:** `static get schema()`, `static get table()`, `static get notValidateSchema()`, `toJSON()`, and any instance method (`save`, `update`, ...).

A full working example is in [example.js](https://github.com/gyk088/pgObject/blob/main/example.js).

## Migration from 2.x to 3.0

- `createTransaction` throws the callback's error after rolling back (2.x only logged it), and returns the callback's result.
- The default isolation level is `READ COMMITTED` (it was `READ UNCOMMITTED`).
- MySQL transactions now actually start a transaction, so `rollback` works.
- `update()` never changes primary keys, and targets the row the object was loaded from.
- Objects loaded from the database do not get `default` values. In 2.x a missing column got its default, and `save()` wrote it over the real value.
- `default: 0` and `default: false` now work (2.x ignored falsy defaults). `required` accepts `0` and `false`.
- SQL errors are not logged when logging is off.
- `pg` and `mysql2` are no longer installed with pgObject: install the driver yourself.
- Field names `__proto__`, `constructor` and `prototype` are not allowed, and data with such keys throws.
- `import { PgObject } from 'pgobject'` works, but deep imports like `require('pgobject/PgObject.js')` do not.

## License

MIT
