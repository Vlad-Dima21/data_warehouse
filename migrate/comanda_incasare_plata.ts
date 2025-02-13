// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import { initOltp, initWh } from './oracle.ts';
import CliProgress from './progress.ts';

async function getOltpInfo(lastMigrationTimestamp: Date) {
	const oltpConnection = await initOltp();
	const sql = `
select cmd.id_comanda, trunc(cmd.data_onorare) data_onorare, cmd.suma, cmd.modificat, count(plt.id_plata) nr_plati,
    JSON_ARRAYAGG(
        JSON_OBJECT(
            KEY 'id_plata' VALUE plt.id_plata,
            KEY 'tip' VALUE plt.tip,
            KEY 'id_comanda' VALUE plt.id_comanda,
            KEY 'id_client' VALUE cmd.id_client,
            KEY 'id_timp' VALUE trunc(plt.data_plata),
            KEY 'id_locatie' VALUE cmd.ID_LOCATIE,
            KEY 'id_cofetarie' VALUE ang.id_cofetarie,
            KEY 'suma_incasare' VALUE plt.suma,
			KEY 'modificat' VALUE plt.modificat
        )
    ) incasari
from comanda cmd
    join angajat ang on ang.id_angajat = cmd.id_sofer
    join plata plt on plt.id_comanda = cmd.id_comanda
where cmd.modificat > :lastMigrationTimestamp or plt.modificat > :lastMigrationTimestamp
group by cmd.id_comanda, cmd.data_onorare, cmd.suma, cmd.modificat`;
	const result = (
		(await oltpConnection
			.execute(sql, { lastMigrationTimestamp })
			.then((result: any) => result.rows)) as {
			ID_COMANDA: number;
			DATA_ONORARE: string;
			SUMA: number;
			NR_PLATI: number;
			MODIFICAT: string;
			INCASARI: string;
		}[]
	)
		.filter(
			(comanda) => new Date(comanda.MODIFICAT) > lastMigrationTimestamp
		)
		.map((comanda) => {
			const incasari = JSON.parse(comanda.INCASARI);
			return {
				comanda: {
					id_comanda: comanda.ID_COMANDA,
					data_onorare: new Date(comanda.DATA_ONORARE).getTime(),
					nr_plati: comanda.NR_PLATI,
				},
				incasari: incasari
					.filter(
						(incasare: any) =>
							new Date(incasare.modificat) >
							lastMigrationTimestamp
					)
					.map((incasare: any) => ({
						id_incasare: incasare.id_plata,
						id_comanda: incasare.id_comanda,
						id_client: incasare.id_client,
						id_timp: new Date(incasare.id_timp).getTime(),
						id_locatie: incasare.id_locatie,
						id_cofetarie: incasare.id_cofetarie,
						suma_incasare: incasare.suma_incasare,
						suma_total_comanda: comanda.SUMA,
					})) as {
					id_incasare: number;
					id_comanda: number;
					id_client: number;
					id_timp: number;
					id_locatie: number;
					id_cofetarie: number;
					suma_incasare: number;
					suma_total_plata: number;
				}[],
				plati: incasari
					.filter(
						(incasare: any) =>
							new Date(incasare.modificat) >
							lastMigrationTimestamp
					)
					.map((incasare: any) => ({
						id_plata: incasare.id_plata,
						tip: incasare.tip,
					})) as {
					id_plata: number;
					tip: string;
				}[],
			};
		});

	return {
		comenzi: result.map((r) => r.comanda),
		incasari: result.flatMap((r) => r.incasari),
		plati: result.flatMap((r) => r.plati),
	};
}

const batchSize = 10_000;

export default async function migrateComandaIncasarePlata(
	lastMigrationTimestamp: Date
) {
	const { comenzi, incasari, plati } = await getOltpInfo(
		lastMigrationTimestamp
	);

	if (comenzi.length === 0 && incasari.length === 0 && plati.length === 0) {
		return;
	}

	const whConnection = await initWh();

	const runBatches = async (
		name: string,
		sql: string,
		data: any[],
		options: any
	) => {
		const progress = new CliProgress(`Migrare ${name}`);
		progress.start(data.length, 0);
		for (let i = 0; i < data.length; i += batchSize) {
			const batch = data.slice(i, i + batchSize);
			await whConnection.executeMany(sql, batch, options);
			progress.increment(batch.length);
		}
		progress.stop();
	};

	await runBatches(
		'comenzi',
		`merge into comanda cmd
			using (select :id_comanda as id_comanda, :data_onorare as data_onorare, :nr_plati as nr_plati from dual) new_cmd
		on (cmd.id_comanda = new_cmd.id_comanda)
		when matched then
			update set cmd.data_onorare = new_cmd.data_onorare, cmd.nr_plati = new_cmd.nr_plati
		when not matched then
			insert (id_comanda, data_onorare, nr_plati) values (new_cmd.id_comanda, new_cmd.data_onorare, new_cmd.nr_plati)`,
		comenzi,
		{
			autoCommit: true,
			bindDefs: {
				id_comanda: { type: oracledb.NUMBER },
				data_onorare: { type: oracledb.NUMBER },
				nr_plati: { type: oracledb.NUMBER },
			},
		}
	);
	await runBatches(
		'plati',
		`merge into plata plt
		using (select :id_plata as id_plata, :tip as tip from dual) new_plt
		on (plt.id_plata = new_plt.id_plata)
		when matched then
			update set plt.tip = new_plt.tip
		when not matched then
			insert (id_plata, tip) values (new_plt.id_plata, new_plt.tip)`,
		plati,
		{
			autoCommit: true,
			bindDefs: {
				id_plata: { type: oracledb.NUMBER },
				tip: { type: oracledb.STRING, maxSize: 20 },
			},
		}
	);
	await runBatches(
		'incasari',
		`merge into incasare inc
		using (select :id_incasare as id_incasare, :id_comanda as id_comanda, :id_client as id_client, :id_timp as id_timp, :id_locatie as id_locatie, :id_cofetarie as id_cofetarie, :suma_incasare as suma_incasare, :suma_total_comanda as suma_total_comanda from dual) new_inc
		on (inc.id_incasare = new_inc.id_incasare)
		when matched then
			update set inc.id_comanda = new_inc.id_comanda, inc.id_client = new_inc.id_client, inc.id_timp = new_inc.id_timp, inc.id_locatie = new_inc.id_locatie, inc.id_cofetarie = new_inc.id_cofetarie, inc.suma_incasare = new_inc.suma_incasare, inc.suma_total_comanda = new_inc.suma_total_comanda
		when not matched then
			insert (id_incasare, id_comanda, id_client, id_timp, id_locatie, id_cofetarie, suma_incasare, suma_total_comanda) values (new_inc.id_incasare, new_inc.id_comanda, new_inc.id_client, new_inc.id_timp, new_inc.id_locatie, new_inc.id_cofetarie, new_inc.suma_incasare, new_inc.suma_total_comanda)`,
		incasari,
		{
			autoCommit: true,
			bindDefs: {
				id_incasare: { type: oracledb.NUMBER },
				id_comanda: { type: oracledb.NUMBER },
				id_client: { type: oracledb.NUMBER },
				id_timp: { type: oracledb.NUMBER },
				id_locatie: { type: oracledb.NUMBER },
				id_cofetarie: { type: oracledb.NUMBER },
				suma_incasare: { type: oracledb.NUMBER },
				suma_total_comanda: { type: oracledb.NUMBER },
			},
		}
	);

	return { comenzi, incasari, plati };
}
