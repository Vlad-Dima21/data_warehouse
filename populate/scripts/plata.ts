// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import { Faker, ro } from '@faker-js/faker';
import init from '../oracle.ts';
import { AngajatOut } from './angajat.ts';
import { ComandaOut } from './comanda.ts';
import CliProgress from './progress.ts';

const faker = new Faker({ locale: [ro] });

enum TipPlata {
	CHITANTA = 'chitanta',
	FACTURA = 'factura',
	AVANS = 'avans',
	REST = 'rest',
}

enum NrPlati {
	UNICA,
	MULTIPLE,
}

const batchSize = 10_000;

export default async function insertPlata(
	comenzi: ComandaOut[],
	angajati: AngajatOut[]
) {
	const connection = await init();
	const sql = `
    INSERT INTO plata(id_angajat, id_comanda, tip, suma, data_plata)
    VALUES(:id_angajat, :id_comanda, :tip, :suma, :data_plata)`;

	const cofetarieSofer = angajati.reduce((acc, angajat) => {
		if (angajat.tip == 'sofer_livrator') {
			acc.set(angajat.id_angajat, angajat.cofetarie.id_cofetarie);
		}
		return acc;
	}, new Map<number, number>());

	const progress = new CliProgress('Plati');
	const plati = comenzi
		.map((comanda) => {
			const nrPlati = faker.helpers.arrayElement([
				NrPlati.UNICA,
				NrPlati.MULTIPLE,
			]);
			const chelneriEligibili = angajati.filter(
				(angajat) =>
					angajat.tip == 'chelner' &&
					angajat.cofetarie.id_cofetarie ==
						cofetarieSofer.get(comanda.id_sofer)
			);
			if (nrPlati == NrPlati.UNICA) {
				return {
					id_angajat:
						faker.helpers.arrayElement(chelneriEligibili)
							.id_angajat,
					id_comanda: comanda.id_comanda,
					tip: faker.helpers.arrayElement([
						TipPlata.CHITANTA,
						TipPlata.FACTURA,
					]),
					suma: comanda.suma,
					data_plata: faker.date.between({
						from: new Date(
							comanda.data_onorare.getTime() -
								1000 * 60 * 60 * 24 * 14
						), // 14 zile inainte de data onorare
						to: comanda.data_onorare,
					}),
				};
			} else {
				const avans =
						faker.helpers.arrayElement([1 / 10, 1 / 15, 1 / 20]) *
						comanda.suma,
					dataAvans = faker.date.between({
						from: new Date(
							comanda.data_onorare.getTime() -
								1000 * 60 * 60 * 24 * 14
						), // 14 zile inainte de data onorare
						to: new Date(
							comanda.data_onorare.getTime() - 1000 * 60 * 60 * 24
						),
					}),
					rest = comanda.suma - avans,
					dataRest = faker.date.between({
						from: new Date(dataAvans.getTime() + 1000),
						to: comanda.data_onorare,
					});
				return [
					{
						id_angajat:
							faker.helpers.arrayElement(chelneriEligibili)
								.id_angajat,
						id_comanda: comanda.id_comanda,
						tip: TipPlata.AVANS,
						suma: avans,
						data_plata: dataAvans,
					},
					{
						id_angajat:
							faker.helpers.arrayElement(chelneriEligibili)
								.id_angajat,
						id_comanda: comanda.id_comanda,
						tip: TipPlata.REST,
						suma: rest,
						data_plata: dataRest,
					},
				];
			}
		})
		.flat();
	progress.start(plati.length, 0);

	await Promise.all(
		Array.from({ length: Math.ceil(plati.length / batchSize) }).map(
			async (_, batchNum) => {
				const platiToInsert = plati.slice(
					batchNum * batchSize,
					(batchNum + 1) * batchSize
				);
				await connection.executeMany(sql, platiToInsert, {
					autoCommit: true,
					bindDefs: {
						id_angajat: { type: oracledb.NUMBER },
						id_comanda: { type: oracledb.NUMBER },
						tip: { type: oracledb.STRING, maxSize: 20 },
						suma: { type: oracledb.NUMBER },
						data_plata: { type: oracledb.DATE },
					},
				});
				progress.increment(platiToInsert.length);
			}
		)
	);

	progress.stop();
}
