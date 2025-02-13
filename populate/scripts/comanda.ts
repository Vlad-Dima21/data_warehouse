// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import { Faker, ro } from '@faker-js/faker';
import init from '../oracle.ts';
import { ClientOut } from './client.ts';
import { LocatieOut } from './locatie.ts';
import { SoferLivrariOut } from './angajat.ts';
import { AngajatOut } from './angajat.ts';
import CliProgress from './progress.ts';
import { ProdusOut } from './produs.ts';
import { PromotieOut } from './promotie.ts';

export interface ComandaOut {
	id_comanda: number;
	id_client: number;
	suma: number;
	data_onorare: Date;
	id_locatie: number;
	id_sofer: number;
	produseComanda: { produs: ProdusOut; cantitate: number }[];
}

const faker = new Faker({ locale: [ro] });
const nrComenzi = parseInt(Deno.env.get('DENO_PROIECT_NR_COMENZI') ?? '100000');
const nrBatch = 10_000;

export default async function insertComanda(
	clienti: ClientOut[],
	locatii: LocatieOut[],
	soferi: AngajatOut[],
	produse: ProdusOut[],
	promotii: PromotieOut[]
) {
	const connection = await init();
	const sql = `
        INSERT INTO comanda (id_client, suma, data_onorare, id_locatie, id_sofer)
        VALUES (:id_client, :suma, :data_onorare, :id_locatie, :id_sofer)
        RETURNING id_comanda INTO :id_comanda`;
	const progress = new CliProgress('Comenzi');
	progress.start(nrComenzi, 0);
	const comenzi: ComandaOut[] = [];
	await Promise.all(
		Array.from({ length: nrComenzi / nrBatch }).map(async () => {
			const comenziToInsert = Array.from({ length: nrBatch }).map(() => {
				const client = faker.helpers.arrayElement(clienti);
				const dataSpeciala =
					faker.helpers.rangeToNumber({ min: 0, max: 100 }) < 20;
				const promotie = dataSpeciala
					? faker.helpers.arrayElement(promotii)
					: null;
				const promotieRandomIdx = faker.helpers.rangeToNumber({
					min: 0,
					max: promotii.length - 2,
				});
				const data_onorare = dataSpeciala
					? faker.date.between({
							from: promotie!.perioada_start,
							to: promotie!.perioada_final,
					  })
					: faker.date.between({
							from: promotii[promotieRandomIdx].perioada_final,
							to: promotii[promotieRandomIdx + 1].perioada_start,
					  });
				const locatie = faker.helpers.arrayElement(locatii);
				const sofer = faker.helpers.arrayElement(soferi);
				const produseComanda = faker.helpers
					.shuffle(
						faker.helpers
							.arrayElements(
								produse.filter(
									(p) => p.id_produs != promotie?.id_produs
								),
								{ min: 1, max: 5 }
							)
							.concat(
								dataSpeciala
									? produse.find(
											(p) =>
												p.id_produs ==
												promotie!.id_produs
									  )!
									: []
							)
					)
					.map((produs, idx) => ({
						produs,
						cantitate: faker.number.int({
							min: 1,
							max: Math.max(
								idx,
								Math.ceil(1 / (promotie?.discount ?? 1))
							),
						}),
					}));
				return {
					id_client: client.id_client,
					suma: produseComanda.reduce(
						(acc, { produs, cantitate }) =>
							acc +
							produs.pret *
								cantitate *
								(promotie?.id_produs == produs.id_produs
									? 1 - promotie!.discount
									: 1),
						0
					),
					data_onorare: new Date(data_onorare),
					id_locatie: locatie.id_locatie,
					id_sofer: sofer.id_angajat,
					produseComanda,
				};
			});
			try {
				const { outBinds } = (await connection.executeMany(
					sql,
					comenziToInsert.map(({ produseComanda, ...rest }) => rest),
					{
						autoCommit: true,
						bindDefs: {
							id_client: { type: oracledb.NUMBER },
							suma: { type: oracledb.NUMBER },
							data_onorare: { type: oracledb.DATE },
							id_locatie: { type: oracledb.NUMBER },
							id_sofer: { type: oracledb.NUMBER },
							id_comanda: {
								dir: oracledb.BIND_OUT,
								type: oracledb.NUMBER,
							},
						},
					}
				)) as { outBinds: { id_comanda: number[] }[] };

				comenzi.push(
					...outBinds.map((bind, i) => ({
						id_comanda: bind.id_comanda[0],
						...comenziToInsert[i],
					}))
				);
			} catch (err) {
				console.error(err);
			} finally {
				progress.increment(nrBatch);
			}
		})
	);

	progress.stop();
	return comenzi;
}
