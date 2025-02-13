import { disableConstraints, enableConstraints, getMigrationTimestamp, initOltp, initPartitions, initWh } from './oracle.ts';
import initTimp from './timp.ts';
import istoric from './istoric.ts';
import migrateLocatii from './locatie.ts';
import migrateCofetarie from './cofetarie.ts';
import migrateProdus from './produs.ts';
import migrateClient from './client.ts';
import migrateComandaIncasarePlata from './comanda_incasare_plata.ts';
import migrateComandaFinalizata from './comanda_finalizata.ts';
import { saveMigrationInfo } from "./oracle.ts";

if (import.meta.main) {
	const [connOltp, connWh] = await Promise.all([initOltp(), initWh()]);
	
	const lastMigrationTimestamp = await getMigrationTimestamp();
	console.log('Last migration timestamp:', lastMigrationTimestamp);
	const migratedTables: string[] = [];
	try {
		// await disableConstraints();
		const timpi = await initTimp();
		const locatii = await migrateLocatii(lastMigrationTimestamp);
		const clienti = await migrateClient(lastMigrationTimestamp);
		const cofetarii = await migrateCofetarie(lastMigrationTimestamp);
		const produse = await migrateProdus(lastMigrationTimestamp);
		const istorice = await istoric(lastMigrationTimestamp);
		const { comenzi, incasari, plati } = (await migrateComandaIncasarePlata(
			lastMigrationTimestamp
		)) ?? { comenzi: [], incasari: [], plati: [] };
		const comenziFinalizate = await migrateComandaFinalizata(
			lastMigrationTimestamp
		);

		await initPartitions();

		if (timpi?.length) {
			migratedTables.push('TIMP');
		}
		if (locatii?.length) {
			migratedTables.push('LOCATIE');
		}
		if (istorice?.length) {
			migratedTables.push(...['ISTORIC_ANGAJAT', 'INFORMATII_ANGAJAT']);
		}
		if (cofetarii?.length) {
			migratedTables.push('COFETARIE');
		}
		if (produse?.length) {
			migratedTables.push('PRODUS');
		}
		if (clienti?.length) {
			migratedTables.push('CLIENT');
		}
		if (comenzi.length) {
			migratedTables.push('COMANDA');
		}
		if (incasari.length) {
			migratedTables.push('INCASARE');
		}
		if (plati.length) {
			migratedTables.push('PLATA');
		}
		if (comenziFinalizate?.length) {
			migratedTables.push('COMANDA_FINALIZATA');
		}

		if (migratedTables.length === 0) {
			console.log('No data to migrate.');
		} else {
			console.log('Migration successful!');
			await saveMigrationInfo(migratedTables);
		}
	} catch (error) {
		console.error('Error:', error);
	} finally {
		// await enableConstraints();
		console.log('Closing connections...');
		await Promise.all([connOltp.close(), connWh.close()]);
		Deno.exit(1);
	}
}
