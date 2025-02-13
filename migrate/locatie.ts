// @ts-types="@types/oracledb"
import oracledb, { autoCommit, connectionClass } from 'oracledb';
import { initOltp, initWh } from './oracle.ts';
import CliProgress from './progress.ts';
import { LOCATIE } from './wh-types.ts';

export default async function migrateLocatie(lastMigrationTimestamp: Date) {
	const oltpConnection = await initOltp();
	const whConnection = await initWh();
	const batchSize = 10_000;

	const oltpSql = `
        SELECT l.ID_LOCATIE, l.NUME_STRADA, l.NR, o.nume as nume_oras, 
            o.SECTOR as nume_sector, j.NUME as nume_judet, 
            z.NUME as nume_zona, z.ISO as iso_zona, o.nume || '-' || j.NUME as nume_oras_judet
        FROM zona z
            JOIN judet j ON j.id_zona = z.id_zona
            JOIN oras o ON o.id_judet = j.id_judet
            JOIN LOCATIE l ON l.id_oras = o.ID_ORAS
		WHERE l.modificat > :lastMigrationTimestamp`;

	const whSql = `
		merge into locatie l
		using (select :id_locatie as id_locatie, :nume_strada as nume_strada, :nr as nr, :nume_oras as nume_oras, :nume_sector as nume_sector, :nume_judet as nume_judet, :nume_zona as nume_zona, :iso_zona as iso_zona, :nume_oras_judet as nume_oras_judet from dual) new_l
		on (l.id_locatie = new_l.id_locatie)
		when matched then
			update set l.nume_strada = new_l.nume_strada, l.nr = new_l.nr, l.nume_oras = new_l.nume_oras, l.nume_sector = new_l.nume_sector, l.nume_judet = new_l.nume_judet, l.nume_zona = new_l.nume_zona, l.iso_zona = new_l.iso_zona, l.nume_oras_judet = new_l.nume_oras_judet
		when not matched then
			insert (id_locatie, nume_strada, nr, nume_oras, nume_sector, nume_judet, nume_zona, iso_zona, nume_oras_judet) values (new_l.id_locatie, new_l.nume_strada, new_l.nr, new_l.nume_oras, new_l.nume_sector, new_l.nume_judet, new_l.nume_zona, new_l.iso_zona, new_l.nume_oras_judet)
	`;

	const locatii = (await oltpConnection
		.execute(oltpSql, { lastMigrationTimestamp })
		.then((result: any) => result.rows)) as LOCATIE[];

	if (locatii.length === 0) {
		return;
	}
	const progress = new CliProgress('Migrare locatii');
	progress.start(locatii.length, 0);

	for (let i = 0; i < locatii.length; i += batchSize) {
		const batch = locatii.slice(i, i + batchSize);

		await whConnection.executeMany(
			whSql,
			batch.map((locatie) => ({
				id_locatie: locatie.ID_LOCATIE,
				nume_strada: locatie.NUME_STRADA,
				nr: locatie.NR,
				nume_oras: locatie.NUME_ORAS,
				nume_sector: locatie.NUME_SECTOR ? `${locatie.NUME_SECTOR}` : null,
				nume_judet: locatie.NUME_JUDET,
				nume_zona: locatie.NUME_ZONA,
				iso_zona: locatie.ISO_ZONA,
				nume_oras_judet: locatie.NUME_ORAS_JUDET,
			})),
			{
				autoCommit: true,
				bindDefs: {
					id_locatie: { type: oracledb.NUMBER },
					nume_strada: { type: oracledb.STRING, maxSize: 255 },
					nr: { type: oracledb.NUMBER },
					nume_oras: { type: oracledb.STRING, maxSize: 60 },
					nume_sector: { type: oracledb.STRING, maxSize: 1 },
					nume_judet: { type: oracledb.STRING, maxSize: 30 },
					nume_zona: { type: oracledb.STRING, maxSize: 20 },
					iso_zona: { type: oracledb.STRING, maxSize: 10 },
					nume_oras_judet: { type: oracledb.STRING, maxSize: 100 },
				},
			}
		);
		progress.increment(batch.length);
	}

	progress.stop();

	return locatii;
}
