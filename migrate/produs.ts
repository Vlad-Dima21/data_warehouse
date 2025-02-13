// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import { initOltp, initWh } from './oracle.ts';
import CliProgress from './progress.ts';
import { PRODUS } from './wh-types.ts';

async function getProdusOltp(lastMigrationTimestamp: Date) {
	const oltpConnection = await initOltp();
	const sql = `select id_produs, nume, pret pret_curent, tip, gramaj from produs where modificat > :lastMigrationTimestamp`;
	return (await oltpConnection
		.execute(sql, { lastMigrationTimestamp })
		.then((result: any) => result.rows)) as PRODUS[];
}

export default async function migrateProdus(lastMigrationTimestamp: Date) {
	const produse = await getProdusOltp(lastMigrationTimestamp);

	if (!produse.length) {
		return;
	}

	const sql = `
		merge into produs p
		using (select :ID_PRODUS as id_produs, :NUME as nume, :PRET_CURENT as pret_curent, :TIP as tip, :GRAMAJ as gramaj from dual) new_p
		on (p.id_produs = new_p.id_produs)
		when matched then
			update set p.nume = new_p.nume, p.pret_curent = new_p.pret_curent, p.tip = new_p.tip, p.gramaj = new_p.gramaj
		when not matched then
			insert (id_produs, nume, pret_curent, tip, gramaj) values (new_p.id_produs, new_p.nume, new_p.pret_curent, new_p.tip, new_p.gramaj)
	`;
	const progress = new CliProgress('Migrare produse');
	progress.start(produse.length, 0);

	const whConnection = await initWh();

	await whConnection.executeMany(sql, produse, {
		autoCommit: true,
		bindDefs: {
			ID_PRODUS: { type: oracledb.NUMBER },
			NUME: { type: oracledb.STRING, maxSize: 25 },
			PRET_CURENT: { type: oracledb.NUMBER },
			TIP: { type: oracledb.STRING, maxSize: 12 },
			GRAMAJ: { type: oracledb.NUMBER },
		},
	});

	progress.increment(produse.length);
    progress.stop();
    return produse;
}
