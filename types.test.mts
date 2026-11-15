// Type tests for the ES module entry. Checked by `tsc -p tsconfig.json`, not executed.
import PgObject, { PgObject as Named, type Schema, type TransactionMode } from 'pgobject';

interface UserFields {
    id: number;
    email: string;
    role: 'user' | 'admin';
    password: string;
    fullName: string;
}

class User extends PgObject<UserFields> {
    static get schema(): Schema<UserFields> {
        return {
            id: { pk: true, guarded: true },
            email: { required: true },
            role: { guarded: true, default: 'user' },
            password: { hidden: true },
            fullName: { computed: true, get: (_value, fields) => fields.email },
        };
    }

    static get table() {
        return 'users';
    }

    async update() {
        return super.update();
    }
}

export const sameClass: typeof PgObject = Named;

export async function typedModel() {
    const users: User[] = await User.select('WHERE email = $1', ['a@b.c']);
    const id: number = users[0].f.id;
    users[0].f.role = 'admin';
    // @ts-expect-error wrong value type
    users[0].f.role = 'root';
    // @ts-expect-error unknown field
    users[0].f.unknown;

    const saved: User = await users[0].save();
    const json: Partial<UserFields> = saved.toJSON();

    new User({ email: 'a@b.c' });
    // @ts-expect-error wrong field type in constructor data
    new User({ email: 1 });

    const fromQuery: User[] = await PgObject.query('SELECT * FROM users', [], User);
    const raw = await PgObject.query<{ n: number }>('SELECT 1 AS n');
    const n: number = raw.rows[0].n;

    return { id, json, fromQuery, n };
}

export async function transactions() {
    const total: number = await PgObject.createTransaction(async () => 42, PgObject.mode.serializable);
    const mode: TransactionMode = PgObject.mode.readCommitted;
    // @ts-expect-error unknown isolation level
    await PgObject.createTransaction(async () => 1, 'READ SOMETHING');
    return { total, mode };
}

export function setup() {
    PgObject.setClient({ query: async () => ({ rows: [] }) });
    PgObject.setClient({ query: () => undefined }, 'mysql');
    // @ts-expect-error unknown database type
    PgObject.setClient({ query: () => undefined }, 'oracle');
    PgObject.setLog(false);
    PgObject.setLogger(console);
}

// @ts-expect-error schema field types must match the model fields
export const badSchema: Schema<UserFields> = { role: { default: 'root' } };

// Untyped model, like in the JavaScript projects: fields are any.
class Loose extends PgObject {
    static get schema() {
        return { id: { pk: true }, name: {} };
    }

    static get table() {
        return 'loose';
    }
}

export const looseValue: string = new Loose().f.anything;
export const looseRows: Promise<Loose[]> = Loose.select();
