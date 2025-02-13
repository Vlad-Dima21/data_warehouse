// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import { initWh } from './oracle.ts';
import CliProgress from './progress.ts';
import { TIMP } from './wh-types.ts';

const zileSaptamana = {
	0: 'Duminica',
	1: 'Luni',
	2: 'Marti',
	3: 'Miercuri',
	4: 'Joi',
	5: 'Vineri',
	6: 'Sambata',
} as Record<number, string>;

const getDayOfYear = (date: Date) => {
	const start = new Date(date.getFullYear(), 0, 0);
	const diff = date.getTime() - start.getTime();
	const oneDay = 1000 * 60 * 60 * 24;
	return Math.floor(diff / oneDay);
};

async function checkTimpExists() {
	const connection = await initWh();
	const sql = `SELECT COUNT(*) AS count FROM timp`;
	const result = await connection.execute(sql);
	return result.rows[0].COUNT > 0;
}

export default async function initTimp() {
	if (await checkTimpExists()) {
		return;
	}

	const connection = await initWh();
	const dates = [new Date('2022-12-01T00:00:00')];
	while (dates.at(-1)! < new Date('2025-12-31T23:59:59')) {
		const latestDate = new Date(dates.at(-1)!);
		latestDate.setDate(latestDate.getDate() + 1);
		dates.push(latestDate);
	}

	const sql = `
        INSERT INTO timp (id_timp, zi_nume, zi_luna, zi_an, este_weekend, saptamana_luna, luna, luna_nume, semestru, an, zi_saptamana_luna_semestru_an, saptamana_luna_semestru_an, luna_semestru_an, semestru_an)
        VALUES (:id_timp, :zi_nume, :zi_luna, :zi_an, :este_weekend, :saptamana_luna, :luna, :luna_nume, :semestru, :an, :zi_saptamana_luna_semestru_an, :saptamana_luna_semestru_an, :luna_semestru_an, :semestru_an)`;

	const progress = new CliProgress('Inserare Timp');
	progress.start(dates.length, 0);

	const binds = dates.map((date) => {
		const extendedDate = {
			id_timp: date.getTime(),
			zi_nume: zileSaptamana[date.getDay()],
			zi_luna: date.getDate(),
			zi_an: getDayOfYear(date),
			este_weekend: date.getDay() === 0 || date.getDay() === 6 ? 1 : 0,
			saptamana_luna: Math.ceil(date.getDate() / 7),
			luna: date.getMonth() + 1,
			luna_nume: date.toLocaleString('ro', { month: 'long' }),
			semestru: date.getMonth() < 6 ? 1 : 2,
			an: date.getFullYear(),
		};
		return {
			...extendedDate,
			zi_saptamana_luna_semestru_an: `${extendedDate.zi_nume}-${extendedDate.saptamana_luna}-${extendedDate.luna}-${extendedDate.semestru}-${extendedDate.an}`,
			saptamana_luna_semestru_an: `${extendedDate.saptamana_luna}-${extendedDate.luna}-${extendedDate.semestru}-${extendedDate.an}`,
			luna_semestru_an: `${extendedDate.luna}-${extendedDate.semestru}-${extendedDate.an}`,
			semestru_an: `${extendedDate.semestru}-${extendedDate.an}`,
		};
	});

	for (const bind of binds) {
		try {
			await connection.execute(sql, bind, { autoCommit: true });
		} catch (err) {
			console.error(err);
		} finally {
			progress.increment();
		}
	}

	progress.stop();
	return binds;
}
