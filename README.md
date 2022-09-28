# pgObject - simple ORM for PostgreSQL

## Usage

### Quick Example
- Create a table in database:
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
- Create a class:
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

- pgObject configuration:
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

    PgObject.setClient(client);
```

- Use this class:
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
## License

MIT


