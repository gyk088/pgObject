# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

pgobject is a small ORM for PostgreSQL and MySQL, published to npm. It is plain CommonJS JavaScript with hand-written TypeScript declarations. There is no build step and no linter.

## Commands

```bash
npm test                         # jest + ESM import tests + type check (all three must pass)
npx jest -t "update never"       # one jest test by name
npx jest -t "Security"           # one describe block
node --test esm.test.mjs         # import/require interop tests
npx tsc -p tsconfig.json         # type tests only (types.test.mts / types.test.cts, never executed)
npm pack --dry-run               # see what will be published
```

Tests need no database: the clients are mocks. The PG mock is `query(sql, values)` returning `{rows}`. The MySQL mock uses the callback signature `query(sql, values, cb)`. `docker-compose.yml` starts real Postgres and MySQL (user, password and database are all `pgobject`) for `example.js` only.

## Architecture

**Core and drivers.** `PgObject.js` is the model base class. `__PgQuery.js` and `__MySqlQuery.js` extend `__IPgObjectQuery.js` and are selected by `PgObject.setClient(client, type)` into `PgObject.__queryClass`. Driver methods are never used as normal classes. They are invoked with `.call(this)`, where `this` is the model class (`select`, `query`, `startTransaction`) or a model instance (`insert`, `update`, `delete`).

**Every SQL statement goes through `PgObject.query`.** It picks the connection and passes it as the first argument to the driver's `query(client, sql, values, classObj)`:
- Inside `createTransaction` the connection comes from an `AsyncLocalStorage` store.
- Otherwise it is `PgObject.__client`. If a transaction currently owns that shared connection, the query first waits on `__activeTransaction`.

**Placeholders.** SQL is always written with `$N` placeholders, including in the MySQL driver's own queries. `__MySqlQuery` converts them to `?` and reorders the values (`convertPlaceholders` skips string literals and comments). It also JSON-stringifies object values (`sanitizeValue`), because mysql/mysql2 would otherwise expand an object into `` `key` = value `` inside the SQL.

**Instance state.**
- `__schema` is the result of the `schema` getter, called once per instance. The getter returns a fresh object each time, so `default: new Date()` is evaluated per instance. Users rely on this, so do not cache the schema per class without handling it.
- `__values` is an `Object.create(null)` store. Values are never written into the schema object.
- `f` is a Proxy over `__values`. It applies the schema `get`/`set` functions and records changed fields in `__updatedFields`, except while `__force` is set.
- `force = true` in the constructor means the data comes from the database. Columns from the database that are not in the schema are skipped with a once-per-column warning (`__warnUnknownColumn`: names only, logged even when `setLog` is off); unknown keys in data from code still throw. Such objects also get no `default` values: a row loaded without some columns would otherwise overwrite them on `save()`.
- `__markPersisted()` snapshots the primary key into `__pk`. `UPDATE`/`DELETE` use that snapshot in `WHERE`, and `UPDATE` never puts primary keys into `SET`.

**Per-class settings.** `__setStaticFields` caches primary, required and default fields on each model class. It checks `hasOwnProperty`, so a model that extends another model computes its own.

**`insertMany`** lives in `PgObject.js`, not in the drivers: it builds model objects (constructor semantics), validates all of them before any query, then sends one `INSERT ... VALUES (...), (...)` per chunk, with `DEFAULT` for missing columns and at most 65535 parameters. More than one chunk runs inside `createTransaction`. Drivers declare `supportsReturning`; on PostgreSQL rows from `RETURNING *` are applied in VALUES order, on MySQL no ids come back.

**`updateMany`** also lives in `PgObject.js`: it validates all objects, groups them by the set of changed columns, chunks by the 65535-parameter limit, and calls the driver's `updateManyChunk`. PostgreSQL builds `UPDATE ... FROM (VALUES ($1::type, ...)) AS v (...)`: the casts are required (VALUES parameters are otherwise text) and the types come from `pg_attribute` via `format_type(atttypid, NULL)`, cached per model as `__pgColumnTypes`. The type is taken without length on purpose: `::varchar(10)` would silently truncate. `RETURNING` rows are matched back by primary key, since UPDATE does not keep order. MySQL uses `UPDATE ... JOIN (SELECT ... UNION ALL ...)` and returns nothing; it has not been run against a real MySQL server. Overridden instance `update()` methods are not called.

**Transactions.**
- `createTransaction` with a pool (detected by `__isPool`: `getConnection`, or `connect` plus `totalCount`) takes a dedicated connection.
- With a single connection, transactions run one at a time and other queries wait.
- A nested call joins the outer transaction.
- On error it rolls back and rethrows.
- `startTransaction`/`commit`/`rollback` are the old low-level API: they throw when the client is a pool.

## Security invariants

These came from a security audit. The `Security` describe blocks in `PgObject.test.js` cover each one, so keep those tests passing:
- Field names `__proto__`, `constructor` and `prototype` are rejected. Schema membership is checked with `hasOwnProperty`, never with `in` (prototype pollution).
- Table and field names are put into SQL unescaped. They must pass the `TABLE_NAME`/`COLUMN_NAME` regexes.
- Isolation levels are whitelisted (`isolationLevel`) before being put into SQL.
- Query values are logged only when `setLog(true)` is on, including on errors.
- `guarded` fields are skipped in constructor data unless `force` is set. `hidden` fields are left out of `toJSON`.

## Packaging

- `index.mjs` re-exports the CommonJS class, so `import` and `require` share one class and one client. Do not add a separate ESM build.
- `exports` in `package.json` closes deep imports.
- `files` is a whitelist: add any new runtime file to it.
- Public API changes must update `PgObject.d.ts` (CommonJS: `export =` plus a namespace for the types), `index.d.mts` (ESM re-exports), the type tests and `README.md`.
- `pg` and `mysql2` are optional peer dependencies. The library never `require`s a driver; the user passes in the client.
- Version 3.0.0 has breaking changes against 2.x, listed under "Migration from 2.x to 3.0" in `README.md`. Sibling projects in `~/myprojects` (for example `NUTRI/NUTRIFLOW_BACKEND`) use the 2.x version from npm.

Code comments and README are in English.
