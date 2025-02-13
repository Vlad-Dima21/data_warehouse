import { Faker, ro } from '@faker-js/faker';
import init from '../oracle.ts';
import { ProdusOut } from './produs.ts';
import CliProgress from './progress.ts';

export interface PromotieOut {
	id_produs: number;
	perioada_start: Date;
	perioada_final: Date;
	discount: number;
}

const faker = new Faker({ locale: [ro] });

export const sarbatoriRomanestiUTC = [
	'2023-01-01T00:00:00Z', // Anul Nou
	'2023-01-24T00:00:00Z', // Ziua Unirii Principatelor Române
	'2023-04-06T00:00:00Z', // Paștele (Ortodox)
	'2023-05-01T00:00:00Z', // Ziua Muncii
	'2023-06-08T00:00:00Z', // Rusaliile (Duminica Pogorârii Duhului Sfânt)
	'2023-08-15T00:00:00Z', // Adormirea Maicii Domnului
	'2023-11-30T00:00:00Z', // Sfântul Andrei
	'2023-12-01T00:00:00Z', // Ziua Națională a României
	'2023-12-25T00:00:00Z', // Crăciunul
	'2023-12-26T00:00:00Z', // A doua zi de Crăciun
	'2023-03-09T00:00:00Z', // Mărțișorul (Ziua de 1 martie este sărbătoare)
	'2023-08-06T00:00:00Z', // Schimbarea la Față (specifică în unele tradiții)
	'2024-01-01T00:00:00Z', // Anul Nou
	'2024-01-24T00:00:00Z', // Ziua Unirii Principatelor Române
	'2024-04-06T00:00:00Z', // Paștele (Ortodox)
	'2024-05-01T00:00:00Z', // Ziua Muncii
	'2024-06-08T00:00:00Z', // Rusaliile (Duminica Pogorârii Duhului Sfânt)
	'2024-08-15T00:00:00Z', // Adormirea Maicii Domnului
	'2024-11-30T00:00:00Z', // Sfântul Andrei
	'2024-12-01T00:00:00Z', // Ziua Națională a României
	'2024-12-25T00:00:00Z', // Crăciunul
	'2024-12-26T00:00:00Z', // A doua zi de Crăciun
	'2024-03-09T00:00:00Z', // Mărțișorul (Ziua de 1 martie este sărbătoare)
	'2024-08-06T00:00:00Z', // Schimbarea la Față (specifică în unele tradiții)
];

const extraPromotiiCount = 40;

export default async function insertPromotie(produse: ProdusOut[]) {
	const connection = await init();
	const sql = `
        INSERT INTO promotie (id_produs, perioada_start, perioada_final, discount)
        VALUES (:id_produs, :perioada_start, :perioada_final, :discount)`;

	const progress = new CliProgress('Promotii');
	const promotionLength = sarbatoriRomanestiUTC.length + extraPromotiiCount;
	const promotiiDates = [...sarbatoriRomanestiUTC];

	while (promotiiDates.length < promotionLength) {
		const randomDate = faker.date
			.between({
				from: '2023-01-01T00:00:00Z',
				to: '2024-12-31T00:00:00Z',
			})
			.toISOString();
		if (!promotiiDates.includes(randomDate)) {
			promotiiDates.push(randomDate);
		}
	}
	const result = [];
	promotiiDates.sort();
	progress.start(promotiiDates.length / 2, 0);
	for (let i = 0; i < promotiiDates.length - 1; i += 2) {
		const perioada_start = new Date(promotiiDates[i]);
		const perioada_final = new Date(promotiiDates[i + 1]);
		const discount =
			faker.helpers.rangeToNumber({ min: 10, max: 50 }) / 100;

		result.push({
			id_produs: faker.helpers.arrayElement(produse).id_produs,
			perioada_start,
			perioada_final,
			discount,
		});
		await connection.execute(sql, result.at(-1)!, { autoCommit: true });
		progress.increment(1);
	}

	progress.stop();
	return result;
}
