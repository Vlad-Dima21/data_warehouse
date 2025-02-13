import { initOltp, initWh } from "./oracle.ts";
import CliProgress from "./progress.ts";
import { COFETARIE } from './wh-types.ts';

async function getCofetarieOltp(lastMigrationTimestamp: Date) {
    const oltpConnection = await initOltp();
    const sql = `SELECT id_cofetarie, nume, tip FROM COFETARIE WHERE modificat > :lastMigrationTimestamp`;
    return (await oltpConnection.execute(sql, {lastMigrationTimestamp}).then((result: any) => result.rows)) as COFETARIE[];
}

export default async function migrateCofetarie(lastMigrationTimestamp: Date) {
    const cofetarii = await getCofetarieOltp(lastMigrationTimestamp);
    if (cofetarii.length === 0) {
        return;
    }

    const sql = `
        merge into cofetarie cf
        using (select :ID_COFETARIE as id_cofetarie, :NUME as nume, :TIP as tip from dual) new_cf
        on (cf.id_cofetarie = new_cf.id_cofetarie)
        when matched then
            update set cf.nume = new_cf.nume, cf.tip = new_cf.tip
        when not matched then
            insert (id_cofetarie, nume, tip) values (new_cf.id_cofetarie, new_cf.nume, new_cf.tip)
    `;

    const progress = new CliProgress('Migrare cofetarii');
    progress.start(cofetarii.length, 0);

    const whConnection = await initWh();

    for (const cofetarie of cofetarii) {
        try {
            await whConnection.execute(sql, {
                id_cofetarie: cofetarie.ID_COFETARIE,
                nume: cofetarie.NUME,
                tip: cofetarie.TIP
            }, {autoCommit: true});
        } catch (e) {
            console.error(e);
        } finally {
            progress.increment();
        }
    }

    progress.stop();
    return cofetarii;
}