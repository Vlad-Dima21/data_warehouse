
// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import init from "../oracle.ts";
import locatii from './localitati_cu_zona.json' with { type: "json" };
import CliProgress from "./progress.ts";

export interface JudetOut {
    id_judet: number,
    nume_judet: string
}

export default async function () {
    const connection = await init();
    const sql = `
    INSERT INTO judet (id_zona, nume)
    VALUES ((SELECT z.id_zona FROM zona z WHERE z.nume = :zona), :nume)
    RETURNING id_judet, nume INTO :id_judet, :nume_judet`;
    const judete: JudetOut[] = [];
    const locatiiKeys = Object.values(locatii.reduce((acc, locatie) => {
        if (locatie.zona !== 'N/A' && !acc[locatie.judet]) {
            acc[locatie.judet] = { zona: locatie.zona, judet: locatie.judet };
        }
        return acc;
    }, { 'Bucuresti': { zona: 'Muntenia', judet: 'Bucuresti' } } as { [judet: string]: { zona: string, judet: string } }));
    const progress = new CliProgress('Judete');
    progress.start(locatiiKeys.length, 0);
    for (const locatie of locatiiKeys) {
        try {
            const { outBinds } = await connection.execute(sql, {
                zona: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: locatie.zona },
                nume: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: locatie.judet },
                id_judet: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                nume_judet: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            }, { autoCommit: true }) as { outBinds: { id_judet: number[], nume_judet: string[] } };
            judete.push({ id_judet: outBinds.id_judet[0], nume_judet: outBinds.nume_judet[0] });
        } catch (err) {
            console.error(err);
        } finally {
            progress.increment();
        }
    }
    progress.stop();
    return judete;
}