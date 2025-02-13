// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import { initOltp, initWh } from './oracle.ts';
import CliProgress from './progress.ts';
import { CLIENT } from './wh-types.ts';

async function getClientOltp(lastMigrationTimestamp: Date) {
	const oltpConnection = await initOltp();
	const sql = `SELECT id_client, nume, prenume FROM client WHERE modificat > :lastMigrationTimestamp`;
	return (await oltpConnection
		.execute(sql, { lastMigrationTimestamp })
		.then((result: any) => result.rows)) as CLIENT[];
}

export default async function migrateClient(lastMigrationTimestamp: Date) {
	const clienti = await getClientOltp(lastMigrationTimestamp);

	if (clienti.length === 0) {
		return;
	}

	const sql = `
        merge into client cl
        using (select :ID_CLIENT as id_client, :NUME as nume, :PRENUME as prenume from dual) new_cl
        on (cl.id_client = new_cl.id_client)
        when matched then
            update set cl.nume = new_cl.nume, cl.prenume = new_cl.prenume
        when not matched then
            insert (id_client, nume, prenume) values (new_cl.id_client, new_cl.nume, new_cl.prenume)
    `;
	const progress = new CliProgress('Migrare clienti');
	progress.start(clienti.length, 0);

	const whConnection = await initWh();

	for (const client of clienti) {
		try {
			await whConnection.execute(sql, client, { autoCommit: true });
		} catch (e) {
			console.error(e);
		} finally {
			progress.increment();
		}
	}

	progress.stop();
	return clienti;
}
