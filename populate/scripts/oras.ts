// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import init from "../oracle.ts";
import { JudetOut } from "./judet.ts";
import locatii from './localitati_cu_zona.json' with { type: "json" };
import CliProgress from "./progress.ts";

export interface OrasOut {
    id_oras: number,
    nume_oras: string
}

export default async function (judete: JudetOut[]) {
    const connection = await init();
    const sql = `
        INSERT INTO oras (id_judet, nume, sector)
        VALUES (:id_judet, :nume, :sector)
        RETURNING id_oras, nume INTO :id_oras, :nume_oras`;
    const orase: OrasOut[] = [];
    const locatiiKeys = locatii.filter(l => l.zona != 'N/A').map(l => ({ ...l, sector: null as number | null })).concat(Array.from({ length: 6 }).map((_, i) => ({
        "id": i + 1,
        "nume": "Bucuresti",
        "sector": i + 1,
        "diacritice": "București",
        "judet": "Bucuresti",
        "auto": "B",
        "zip": 10164,
        "populatie": 0,
        "lat": 44.4267674,
        "lng": 26.1025384,
        "zona": "Muntenia"
    })));
    const progress = new CliProgress('Orase');
    progress.start(locatiiKeys.length, 0);
    for (let i = 0; i < locatiiKeys.length; i += 100) {
        const binds = locatiiKeys.slice(i, i + 100).map((locatie) => ({
            id_judet: judete.find(j => j.nume_judet === locatie.judet)?.id_judet,
            nume: locatie.nume,
            sector: locatie.sector,
        }));
        try {
            const { outBinds } = (await connection
                .executeMany(sql, binds, {
                    autoCommit: true,
                    bindDefs: {
                        id_judet: { type: oracledb.NUMBER },
                        nume: { type: oracledb.STRING, maxSize: 80 },
                        sector: { type: oracledb.NUMBER },
                        id_oras: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                        nume_oras: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 80},
                    },
                 })) as { outBinds: { id_oras: number[], nume_oras: string[] }[] };
            orase.push(...outBinds.map(bind => ({ id_oras: bind.id_oras[0], nume_oras: bind.nume_oras[0] })));
        } catch (err) {
            console.error(err);
        } finally {
            progress.increment(Math.min(100, locatiiKeys.length - i));
        }
    }
    progress.stop();
    return orase;
}