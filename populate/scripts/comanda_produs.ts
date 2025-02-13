// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import { ComandaOut } from './comanda.ts';
import init from '../oracle.ts';
import CliProgress from './progress.ts';

const batchSize = 10_000;

export default async function insertComandaProdus(comenzi: ComandaOut[]) {
	const connection = await init();
	const sql = `INSERT INTO comanda_produs (id_comanda, id_produs, cantitate)
        VALUES (:id_comanda, :id_produs, :cantitate)`;
	const progress = new CliProgress('Comenzi Produse');
	progress.start(
		comenzi.reduce((acc, c) => acc + c.produseComanda.length, 0),
		0
	);
	const binds = [];
	for (const comanda of comenzi) {
		for (const produsComanda of comanda.produseComanda) {
			binds.push({
				id_comanda: comanda.id_comanda,
				id_produs: produsComanda.produs.id_produs,
				cantitate: produsComanda.cantitate,
			});
		}
	}

	for (let i = 0; i < binds.length; i += batchSize) {
		const batch = binds.slice(i, i + batchSize);
		await connection.executeMany(sql, batch, {
			autoCommit: true,
			bindDefs: {
				id_comanda: { type: oracledb.NUMBER },
				id_produs: { type: oracledb.NUMBER },
				cantitate: { type: oracledb.NUMBER },
			},
		});
		progress.increment(batch.length);
	}

	progress.stop();
}
