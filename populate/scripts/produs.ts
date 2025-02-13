// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import { Faker, ro } from '@faker-js/faker';
import init from '../oracle.ts';
import CliProgress from './progress.ts';

export interface ProdusOut {
	id_produs: number;
	nume: string;
	pret: number;
	tip: TipPrajitura;
	gramaj: number;
}

enum TipPrajitura {
	PRAJITURA = 'prajitura',
	TORT = 'tort',
	SUC = 'suc',
}

const faker = new Faker({ locale: [ro] });

export default async function insertProdus() {
	const connection = await init();
	const sql = `
    INSERT INTO produs (nume, pret, tip, gramaj)
    VALUES(:nume, :pret, :tip, :gramaj)
    RETURNING id_produs INTO :id_produs`;
	const progress = new CliProgress('Produse');
	const tipPrajitura = [
		'prajitura',
		'ecler',
		'tarta',
		'cheesecake',
		'macaron',
		'placinta',
		'clatite',
		'corn',
		'croissant',
		'briosa',
		'bezea',
		'meringa',
		'tiramisu',
		'panna cotta',
		'budinca',
		'mousse',
		'parfait',
		'papanasi',
		'tort',
		'savarina',
	];
	const sortimentPrajitura = [
		'cu ciocolata',
		'cu fructe',
		'cu vanilie',
		'cu caramel',
		'cu cafea',
		'cu lamaie',
		'cu portocale',
		'cu capsuni',
		'cu zmeura',
		'cu mure',
		'cu afine',
		'cu cirese',
		'cu visine',
		'cu piersici',
		'cu mere',
		'cu pere',
		'cu banane',
		'cu kiwi',
		'cu mango',
		'cu ananas',
		'cu pepene',
		'cu nuci',
		'cu alune',
		'cu migdale',
		'cu fistic',
		'cu mac',
		'cu susan',
		'cu dovleac',
		'cu morcovi',
		'cu dovlecei',
		'cu dovlecel',
		'cu caise',
		'cu prune',
		'cu struguri',
	];
	const sortimentSuc = [
		'suc cu portocale',
		'suc cu mere',
		'suc cu pere',
		'suc cu banane',
		'suc cu kiwi',
		'suc cu mango',
		'suc cu ananas',
		'suc cu pepene',
		'suc cu fructe de padure',
	];
	const numeProduse = tipPrajitura
		.flatMap((tip) =>
			sortimentPrajitura.reduce(
				(acc, sortiment) => [
					...acc,
					{
						nume: `${tip} ${sortiment}`,
						tip:
							tip != 'tort'
								? TipPrajitura.PRAJITURA
								: TipPrajitura.TORT,
					},
				],
				[] as { nume: string; tip: TipPrajitura }[]
			)
		)
		.concat(sortimentSuc.map((nume) => ({ nume, tip: TipPrajitura.SUC })));
	progress.start(numeProduse.length, 0);
	const binds = numeProduse.map(({ nume, tip }) => ({
		nume,
		pret: faker.helpers.rangeToNumber({ min: 5, max: 100 }),
		tip,
		gramaj: faker.helpers.rangeToNumber({ min: 50, max: 500 }),
	}));

	try {
		const { outBinds } = (await connection.executeMany(sql, binds, {
			autoCommit: true,
			bindDefs: {
				id_produs: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
				nume: { type: oracledb.STRING, maxSize: 100 },
				pret: { type: oracledb.NUMBER },
				tip: { type: oracledb.STRING, maxSize: 12 },
				gramaj: { type: oracledb.NUMBER },
			},
		})) as { outBinds: { id_produs: number[] }[] };
		return outBinds.map((bind, i) => ({
			id_produs: bind.id_produs[0],
			nume: binds[i].nume,
			pret: binds[i].pret,
			tip: binds[i].tip,
			gramaj: binds[i].gramaj,
		}));
	} catch (err) {
		console.error(err);
	} finally {
		progress.increment(numeProduse.length);
		progress.stop();
	}

	return [];
}
