import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import DefaultPgObject, { PgObject } from 'pgobject';

const require = createRequire(import.meta.url);

test('default and named imports give the same class', () => {
    assert.equal(typeof DefaultPgObject, 'function');
    assert.equal(PgObject, DefaultPgObject);
});

test('import and require share one class and its settings', () => {
    const RequiredPgObject = require('pgobject');
    assert.equal(RequiredPgObject, PgObject);

    const client = { query: async () => ({ rows: [] }) };
    PgObject.setClient(client);
    assert.equal(RequiredPgObject.__client, client);
});

test('models extend the imported class', () => {
    class User extends PgObject {
        static get schema() { return { id: { pk: true }, name: {} }; }
        static get table() { return 'users'; }
    }
    const user = new User({ name: 'a' });
    assert.equal(user.f.name, 'a');
    assert.ok(user instanceof require('pgobject'));
});
