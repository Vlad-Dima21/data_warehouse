import { Application, Router } from '@oak/oak';
import { getMigrationTimestamp, initPartitions } from './oracle.ts';
import migrateLocatie from './locatie.ts';
import migrateClient from './client.ts';
import migrateCofetarie from './cofetarie.ts';
import { saveMigrationInfo } from './oracle.ts';
import migrateProdus from "./produs.ts";
import migrateIstoric from "./istoric.ts";
import migrateComandaIncasarePlata from "./comanda_incasare_plata.ts";
import migrateComandaFinalizata from "./comanda_finalizata.ts";
import { initOltp } from "./oracle.ts";
import { initWh } from "./oracle.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";

const router = new Router();

let locked = false;

const migrate = async (
	entity: string[],
	migrationFn: (lmt: Date) => Promise<unknown[]> | undefined,
	lastMigrationTimestamp: Date
) => {
	locked = true;
    const result = await migrationFn(lastMigrationTimestamp);
    await initPartitions();
	if (result?.length) await saveMigrationInfo(entity);
	locked = false;
	return result?.length;
};

[
	['locatii', ['LOCATIE'], migrateLocatie],
	['clienti', ['CLIENT'], migrateClient],
    ['cofetarii', ['COFETARIE'], migrateCofetarie],
    ['produse', ['PRODUS'], migrateProdus],
    ['istorice', ['ISTORIC_ANGAJAT', 'INFORMATII_ANGAJAT'], migrateIstoric],
    ['comenzi-finalizate', ['COMANDA_FINALIZATA'], migrateComandaFinalizata]
].forEach(([route, entity, migrationFn]) => {
	router.post(`/${route}`, async (ctx) => {
		if (locked) {
			ctx.response.status = 503;
			ctx.response.body = 'Service Unavailable';
			return;
		}
		const lastMigrationTimestamp = await getMigrationTimestamp();
		console.log('Last migration timestamp:', lastMigrationTimestamp);
		try {
			ctx.response.body = await migrate(
				entity as string[],
				migrationFn as (lmt: Date) => Promise<unknown[]> | undefined,
				lastMigrationTimestamp
			) ?? 0;
		} catch (error) {
			ctx.response.status = 500;
			ctx.response.body = (error as Error).stack;
        } finally {
            locked = false;
        }
	});
});

router.post('/comenzi-plati-incasari', async (ctx) => {
    if (locked) {
        ctx.response.status = 503;
        ctx.response.body = 'Service Unavailable';
        return;
    }
    const lastMigrationTimestamp = await getMigrationTimestamp();
    console.log('Last migration timestamp:', lastMigrationTimestamp);
    try {
        const { comenzi, incasari, plati } = (await migrateComandaIncasarePlata(
            lastMigrationTimestamp
        )) ?? { comenzi: [], incasari: [], plati: [] };
        const migratedTables = [];
        if (comenzi.length) {
            migratedTables.push('COMANDA');
        }
        if (incasari.length) {
            migratedTables.push('INCASARE');
        }
        if (plati.length) {
            migratedTables.push('PLATA');
        }
        if (migratedTables.length) {
            await saveMigrationInfo(migratedTables);
        }
        ctx.response.body = comenzi.length + incasari.length + plati.length;
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = (error as Error).stack;
    } finally {
        locked = false;
    }
});

const main = async () => {
    console.log('Initializing connections...');
    const [connOltp, connWh] = await Promise.all([initOltp(), initWh()]);

    console.log('Starting server...');

    const app = new Application();
    app.use(oakCors({ origin: "*" }));
    app.use(router.routes());
    app.use(router.allowedMethods());
    

    app.listen({
        port: 8000,
    });

    app.addEventListener('close', async () => {
		console.log('Closing connections...');
		await Promise.all([connOltp.close(), connWh.close()]);
    })
    
    console.log(`Server running on http://localhost:8000`);

}

main();