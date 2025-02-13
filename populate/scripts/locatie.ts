// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import { Faker, ro } from '@faker-js/faker';
import init from '../oracle.ts';
import { OrasOut } from './oras.ts';
import CliProgress from './progress.ts';

export interface LocatieOut {
	id_locatie: number;
	oras: OrasOut;
}

export default async function (orase: OrasOut[]): Promise<LocatieOut[]> {
	const connection = await init();
	const sql = `
        INSERT INTO locatie(id_oras, nume_strada, nr)
        VALUES (:id_oras, :nume_strada, :nr)
        RETURNING id_locatie INTO :id_locatie`;
	const faker = new Faker({ locale: [ro] });
	const locatii = [];
	const progress = new CliProgress('Locatii');
	const batchSize = 10_000;
	const totalSize = 100_000;
	progress.start(totalSize, 0);
	for (const _ of Array.from({ length: totalSize / batchSize })) {
		const fakeOrase = faker.helpers.arrayElements(orase, batchSize);
		const binds = fakeOrase.map((oras) => ({
			id_oras: oras.id_oras,
			nume_strada: faker.location.street().slice(0, 255),
			nr: faker.number.int({ min: 1, max: 999 }),
		}));
		try {
			const { outBinds } = (await connection.executeMany(sql, binds, {
				autoCommit: true,
				bindDefs: {
					id_oras: { type: oracledb.NUMBER },
					nume_strada: { type: oracledb.STRING, maxSize: 255 },
					nr: { type: oracledb.NUMBER },
					id_locatie: {
						dir: oracledb.BIND_OUT,
						type: oracledb.NUMBER,
					},
				},
			})) as { outBinds: { id_locatie: number[] }[] };

			locatii.push(
				...outBinds.map((bind, i) => ({
					id_locatie: bind.id_locatie[0],
					oras: fakeOrase[i],
				}))
			);
		} catch (err) {
			console.error(err);
		} finally {
			progress.increment(batchSize);
		}
	}

	progress.stop();
	return locatii;
}
