// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import { Faker, ro } from '@faker-js/faker';
import init from '../oracle.ts';
import { LocatieOut } from './locatie.ts';
import CliProgress from './progress.ts';
import { faraDiacritice } from './helpers.ts';

export interface CofetarieOut {
	id_cofetarie: number;
	locatie: LocatieOut;
}

export default async function (locatii: LocatieOut[]): Promise<CofetarieOut[]> {
	const connection = await init();
	const totalSize = 20;
	const sql = `
        INSERT INTO cofetarie (id_locatie, tip, nume)
        VALUES (:id_locatie, :tip, :nume)
        RETURNING id_cofetarie INTO :id_cofetarie`;
	const faker = new Faker({ locale: [ro] });

	const orase = [
		'Bucuresti',
		'Cluj-Napoca',
		'Timisoara',
		'Iasi',
		'Brasov',
		'Craiova',
		'Constanta',
		'Onesti',
	];

	locatii = locatii.filter((locatie) =>
		orase.includes(locatie.oras.nume_oras)
	);

	const progress = new CliProgress('Cofetarii');
	const cofetarii = [];
	progress.start(totalSize, 0);
	for (const _ of Array.from({ length: totalSize })) {
		const locatie = faker.helpers.arrayElement(locatii);
		const binds = {
			id_locatie: locatie.id_locatie,
			tip: faker.helpers.arrayElement(['fara-servire', 'cu-servire']),
			nume: `${faraDiacritice(
				faker.person.firstName('female')
			)} ${faker.helpers.arrayElement([
				'Cakes',
				'Sweets',
				'Bakery',
				'Patiserie',
			])}`,
			id_cofetarie: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
		};
		try {
			const { outBinds } = (await connection.execute(sql, binds, {
				autoCommit: true,
			})) as { outBinds: { id_cofetarie: number[] } };
			cofetarii.push({ id_cofetarie: outBinds.id_cofetarie[0], locatie });
		} catch (err) {
			console.error(err);
		} finally {
			progress.increment();
		}
	}

	progress.stop();
	return cofetarii;
}
