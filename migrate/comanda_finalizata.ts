// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import { initOltp, initWh } from './oracle.ts';
import CliProgress from './progress.ts';
import { COMANDA_FINALIZATA } from './wh-types.ts';

async function getCount(lastMigrationTimestamp: Date) {
	const oltpConnection = await initOltp();
	const sql = `select count(*) as total_count from comanda cmd
    join client cli on cli.id_client = cmd.id_client
    join angajat ang on ang.id_angajat = cmd.id_sofer
    join comanda_produs cmp on cmp.id_comanda = cmd.id_comanda
    join produs prd on prd.id_produs = cmp.id_produs
    left join promotie prm on prm.id_produs = prd.id_produs and cmd.data_onorare between prm.perioada_start and prm.perioada_final
where cmd.modificat > :lastMigrationTimestamp`;
	return await oltpConnection
		.execute(sql, { lastMigrationTimestamp })
		.then(
			(result: oracledb.Result<{ TOTAL_COUNT: number }>) => result.rows?.[0].TOTAL_COUNT
		);
}

async function getData(lastMigrationTimestamp: Date, batchNo: number) {
	const oltpConnection = await initOltp();
	const sql = `select cmd.id_comanda, cmd.id_client, cmd.suma, trunc(cmd.data_onorare) id_timp, cmd.id_locatie,
    ang.id_cofetarie, prd.id_produs, cmp.cantitate cantitate_produs, prd.pret pret_vanzare_produs,
    case when prm.id_promotie is not null then 1 - prm.discount else 1 end * cmp.cantitate * prd.pret as pret_cantitate_discount_produs,
    case when prm.id_promotie is not null then prm.discount else null end discount
from comanda cmd
    join client cli on cli.id_client = cmd.id_client
    join angajat ang on ang.id_angajat = cmd.id_sofer
    join comanda_produs cmp on cmp.id_comanda = cmd.id_comanda
    join produs prd on prd.id_produs = cmp.id_produs
    left join promotie prm on prm.id_produs = prd.id_produs and cmd.data_onorare between prm.perioada_start and prm.perioada_final
where cmd.modificat > :lastMigrationTimestamp
offset :batchNo * :batchSize rows fetch next :batchSize rows only`;

	return await oltpConnection
		.execute(sql, { lastMigrationTimestamp, batchNo, batchSize })
		.then((result: oracledb.Result<COMANDA_FINALIZATA>) => result.rows)
		.then((rows: COMANDA_FINALIZATA[]) =>
			rows.map((row) => ({
				...row,
				ID_TIMP: row.ID_TIMP.getTime(),
			}))
		);
}

const batchSize = 10_000;

export default async function migrateComandaFinalizata(
	lastMigrationTimestamp: Date
) {
    const totalCount = await getCount(lastMigrationTimestamp);
    const totalData = [];
    
    if (totalCount > 0) {
        const progress = new CliProgress('Migrare comenzi finalizate');
        progress.start(totalCount, 0);

        let batchNo = 0;
        while (batchNo < totalCount / batchSize) {
            const data: COMANDA_FINALIZATA[] = await getData(
                lastMigrationTimestamp,
                batchNo++
            );

            if (data.length === 0) {
                break;
            }

            const whConnection = await initWh();

            const sql = `
        merge into comanda_finalizata cf
        using (select :ID_COMANDA as id_comanda, :ID_CLIENT as id_client, :SUMA as suma, :ID_TIMP as id_timp, :ID_LOCATIE as id_locatie, :ID_COFETARIE as id_cofetarie, :ID_PRODUS as id_produs, :CANTITATE_PRODUS as cantitate_produs, :PRET_VANZARE_PRODUS as pret_vanzare_produs, :PRET_CANTITATE_DISCOUNT_PRODUS as pret_cantitate_discount_produs, :DISCOUNT as discount from dual) new_cf
        on (cf.id_comanda = new_cf.id_comanda and cf.id_client = new_cf.id_client and cf.id_produs = new_cf.id_produs)
        when matched then
            update set cf.suma = new_cf.suma, cf.id_timp = new_cf.id_timp, cf.id_locatie = new_cf.id_locatie, cf.id_cofetarie = new_cf.id_cofetarie, cf.cantitate_produs = new_cf.cantitate_produs, cf.pret_vanzare_produs = new_cf.pret_vanzare_produs, cf.pret_cantitate_discount_produs = new_cf.pret_cantitate_discount_produs, cf.discount = new_cf.discount
        when not matched then
            insert (id_comanda, id_client, suma, id_timp, id_locatie, id_cofetarie, id_produs, cantitate_produs, pret_vanzare_produs, pret_cantitate_discount_produs, discount) values (new_cf.id_comanda, new_cf.id_client, new_cf.suma, new_cf.id_timp, new_cf.id_locatie, new_cf.id_cofetarie, new_cf.id_produs, new_cf.cantitate_produs, new_cf.pret_vanzare_produs, new_cf.pret_cantitate_discount_produs, new_cf.discount)
    `;
            await whConnection.executeMany(sql, data, {
                autoCommit: true,
                bindDefs: {
                    ID_COMANDA: { type: oracledb.NUMBER },
                    ID_CLIENT: { type: oracledb.NUMBER },
                    SUMA: { type: oracledb.NUMBER },
                    ID_TIMP: { type: oracledb.NUMBER },
                    ID_LOCATIE: { type: oracledb.NUMBER },
                    ID_COFETARIE: { type: oracledb.NUMBER },
                    ID_PRODUS: { type: oracledb.NUMBER },
                    CANTITATE_PRODUS: { type: oracledb.NUMBER },
                    PRET_VANZARE_PRODUS: { type: oracledb.NUMBER },
                    PRET_CANTITATE_DISCOUNT_PRODUS: { type: oracledb.NUMBER },
                    DISCOUNT: { type: oracledb.NUMBER },
                },
            });
            progress.increment(data.length);
            totalData.push(...data);
        }
        progress.stop();
    }
	return totalData;
}
