import { ro, Faker } from '@faker-js/faker';
import { AngajatOut } from './angajat.ts';
import init from '../oracle.ts';
import CliProgress from './progress.ts';

const faker = new Faker({ locale: [ro] });

const randomPick = faker.helpers.arrayElement;

export default async function insertIstoric(angajati: AngajatOut[]) {
	const connection = await init();
	const sql = `
        INSERT INTO istoric (
            id_angajat, data_angajare_start, data_angajare_end, id_cofetarie, tip_angajat, salariu
        )
        VALUES(:id_angajat, :data_angajare_start, :data_angajare_end, :id_cofetarie, :tip_angajat, :salariu)`;
	const angajtiRandom = angajati.map((angajat) => ({
		angajat,
		nrPozitii: faker.helpers.rangeToNumber({ min: 1, max: 3 }),
	}));
	const progress = new CliProgress('Istoric angajati');
	progress.start(
		angajtiRandom.reduce((acc, { nrPozitii }) => acc + nrPozitii, 0),
		0
	);
	for (const { angajat, nrPozitii } of angajtiRandom) {
		const istorice = Array.from({ length: nrPozitii })
			.map((_, idx) => idx)
			.reduce((acc, idx) => {
				const data_angajare = faker.date.between({
					from: '2023-01-01',
					to: '2024-10-31',
				});
				const data_terminare =
					nrPozitii > 1
						? faker.date.between({
								from: new Date(
									Math.min(
										data_angajare.getTime() +
											1000 * 60 * 60 * 24 * 90,
										new Date('2024-12-31').getTime()
									)
								),
								to: new Date('2024-12-31'),
						  })
						: null;
				const id_cofetarie =
					randomPick(angajati).cofetarie.id_cofetarie;
				const tip_angajat =
					angajat.tip != 'chelner' && idx != nrPozitii - 1
						? randomPick(['chelner', 'sofer_livrator'])
						: angajat.tip;
				const salariu =
					nrPozitii > 1
						? faker.number.int({
								min: acc.at(-1)?.salariu ?? 2000,
								max: 5000,
						  })
						: angajat.salariu;
				acc.push({
					id_angajat: angajat.id_angajat,
					data_angajare_start: data_angajare,
					data_angajare_end: data_terminare,
					id_cofetarie,
					tip_angajat,
					salariu,
				});
				return acc;
			}, [] as { id_angajat: number; data_angajare_start: Date; data_angajare_end: Date | null; id_cofetarie: number; tip_angajat: string; salariu: number }[]);
		for (const istoric of istorice) {
			try {
				await connection.execute(sql, istoric, { autoCommit: true });
			} catch (error) {
				console.error(error);
			} finally {
				progress.increment();
			}
		}
	}
	progress.stop();
}
