// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import { Faker, ro, faker as origFaker } from '@faker-js/faker';
import init from '../oracle.ts';
import { faraDiacritice } from './helpers.ts';
import CliProgress from './progress.ts';

export interface ClientOut {
	id_client: number;
	nume: string;
	prenume: string;
	email: string;
	telefon: string;
}

const faker = new Faker({ locale: [ro] });
const nrClienti = 100;

export default async function insertClient() {
	const connection = await init();
	const sql = `
        INSERT INTO client (
            nume, prenume, email, telefon
        ) VALUES (
            :nume,
            :prenume,
            :email,
            :telefon
        )
        RETURNING id_client INTO :id_client`;
	const progress = new CliProgress('Clienti');
	progress.start(nrClienti, 0);
	const result: ClientOut[] = [];
	for (let i = 0; i < nrClienti; i++) {
		const sex = origFaker.person.sexType();
		const nume = faraDiacritice(faker.person.lastName(sex));
		const prenume = faraDiacritice(faker.person.firstName(sex));
		const binds = {
			nume,
			prenume,
			email: faker.internet
				.email({
					firstName: prenume,
					lastName: nume,
					allowSpecialCharacters: false,
				})
				.toLowerCase(),
			telefon: faker.phone.number({ style: 'international' }).slice(2),
			id_client: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
		};
		try {
			const { outBinds } = (await connection.execute(sql, binds, {
				autoCommit: true,
			})) as { outBinds: { id_client: number[] } };
			result.push({
				id_client: outBinds.id_client[0],
				nume,
				prenume,
				email: binds.email,
				telefon: binds.telefon,
			});
		} catch (error) {
			console.error(error);
		} finally {
			progress.increment();
		}
	}

	progress.stop();
	return result;
}
