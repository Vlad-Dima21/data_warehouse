import oracledb, { Connection } from 'oracledb';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let oltpConnection: Connection | null = null,
	whConnection: Connection | null = null;

const connectionTimeout = Number(Deno.env.get('DENO_DB_TIMEOUT') ?? 1000); // 1 second

export function initOltp() {
	if (!oltpConnection) {
		// deno-lint-ignore no-async-promise-executor
		return new Promise(async (resolve) => {
			try {
				oltpConnection = await oracledb.getConnection({
					user: Deno.env.get('DENO_DB_ORACLE_USER_OLTP') ?? 'proiect',
					password:
						Deno.env.get('DENO_DB_ORACLE_PASSWORD_OLTP') ??
						'parola',
					connectString:
						Deno.env.get('DENO_DB_ORACLE_URL_OLTP') ??
						'localhost:1522/ORCLCDB',
				});
				resolve(oltpConnection);
			} catch {
				console.log(
					`Connection to oltp failed, trying again in ${connectionTimeout}ms...`
				);
				setTimeout(() => resolve(initOltp()), connectionTimeout);
			}
		});
	}
	return oltpConnection;
}

export function initWh() {
	if (!whConnection) {
		// deno-lint-ignore no-async-promise-executor
		return new Promise(async (resolve) => {
			try {
				whConnection = await oracledb.getConnection({
					user:
						Deno.env.get('DENO_DB_ORACLE_USER_OLAP') ??
						'proiect_warehouse',
					password:
						Deno.env.get('DENO_DB_ORACLE_PASSWORD_OLAP') ??
						'parola',
					connectString:
						Deno.env.get('DENO_DB_ORACLE_URL_OLAP') ??
						'localhost:1522/ORCLCDB',
				});
				resolve(whConnection);
			} catch {
				console.log(
					`Connection to wh failed, trying again in ${connectionTimeout}ms...`
				);
				setTimeout(() => resolve(initWh()), connectionTimeout);
			}
		});
	}
	return whConnection;
}

export async function getMigrationTimestamp() {
	const conn = await initWh();
	const sql = `SELECT MAX(data_migrare) AS timestamp FROM migrare`;

	console.log('Getting migration timestamp...');

	const result = await conn.execute(sql);
	return result.rows[0].TIMESTAMP ?? new Date('1970-01-01');
}

export async function saveMigrationInfo(tables: string[]) {
	const conn = await initWh();
	const sql = `INSERT INTO migrare (tabele_migrate) VALUES (:tables)`;

	console.log('Saving migration info...');

	await conn.execute(
		sql,
		{
			tables: tables.toSorted().join(','),
		},
		{ autoCommit: true }
	);
}

export async function enableConstraints() {
	const conn = await initWh();
	const sql = `call enable_constraints()`;
	await conn.execute(sql);
}

export async function disableConstraints() {
	const conn = await initWh();
	const sql = `call disable_constraints()`;
	await conn.execute(sql);
}

export async function initPartitions() {
	const conn = await initWh();
	const sql = `call init_partitions()`;
	await conn.execute(sql);
}
