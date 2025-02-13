// @ts-types="@types/oracledb"
import oracledb, { Connection } from 'oracledb';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let connection: Connection | null = null;

export default async function init() {
	if (!connection) {
		connection = await oracledb.getConnection({
			user: Deno.env.get('DENO_DB_ORACLE_USER_OLTP') ?? 'proiect',
			password: Deno.env.get('DENO_DB_ORACLE_PASSWORD_OLTP') ?? 'parola',
			connectString: Deno.env.get('DENO_DB_ORACLE_URL_OLTP') ?? 'localhost:1522/ORCLCDB',
		});
	}
	return connection;
}
