// Type tests for the CommonJS entry. Checked by `tsc -p tsconfig.json`, not executed.
import PgObject = require('pgobject');

interface ItemFields {
    id: number;
    title: string;
}

class Item extends PgObject<ItemFields> {
    static get schema(): PgObject.Schema<ItemFields> {
        return { id: { pk: true }, title: {} };
    }

    static get table() {
        return 'item';
    }
}

export async function commonjs() {
    const items: Item[] = await Item.select();
    const title: string = items[0].f.title;
    // named export exists only for `import`; require() returns the class itself
    // @ts-expect-error
    PgObject.PgObject;
    return title;
}
