// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import { initOltp, initWh } from './oracle.ts';
import CliProgress from './progress.ts';
import initTimp from './timp.ts';

async function getFromOltp(lastMigrationTimestamp: Date) {
	const connection = await initOltp();
	const sql = `
        SELECT ang.id_angajat, ang.nume, ang.prenume, ang.email,
            ang.salariu, ang.sex, ang.cnp, ang.telefon, ang.id_cofetarie, loc.id_locatie,
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    KEY 'data_angajare_start' IS trunc(ist.data_angajare_start),
                    KEY 'data_angajare_end' IS trunc(ist.data_angajare_end),
                    KEY 'tip_angajat' IS ist.tip_angajat,
                    KEY 'salariu' IS ist.salariu
                )
            ) istoric
        FROM istoric ist
            JOIN angajat ang ON ang.id_angajat = ist.id_angajat
            JOIN cofetarie cof ON cof.id_cofetarie = ang.id_cofetarie
            JOIN locatie loc ON loc.id_locatie = cof.id_locatie
		WHERE ist.modificat > :lastMigrationTimestamp
        GROUP BY ang.id_angajat, ang.nume, ang.prenume, ang.email,
            ang.salariu, ang.sex, ang.cnp, ang.telefon, ang.id_cofetarie, loc.id_locatie`;

	return (
		(await connection
			.execute(sql, { lastMigrationTimestamp })
			.then((result: any) => result.rows)) as {
			ID_ANGAJAT: number;
			NUME: string;
			PRENUME: string;
			EMAIL: string;
			SALARIU: number;
			SEX: string;
			CNP: string;
			TELEFON: string;
			ID_COFETARIE: number;
			ID_LOCATIE: number;
			ISTORIC: string;
		}[]
	)
		.map((row) => ({
			id_angajat: row.ID_ANGAJAT,
			nume: row.NUME,
			prenume: row.PRENUME,
			email: row.EMAIL,
			salariu: row.SALARIU,
			sex: row.SEX,
			cnp: row.CNP,
			telefon: row.TELEFON,
			id_cofetarie: row.ID_COFETARIE,
			id_locatie: row.ID_LOCATIE,
			istoric: row.ISTORIC,
		}))
		.map((row) => ({
			...row,
			istoric: (
				JSON.parse(row.istoric) as {
					data_angajare_start: string;
					data_angajare_end: string | null;
					tip_angajat: string;
					salariu: number;
				}[]
			).map((istoric) => ({
				...istoric,
				data_angajare_start: new Date(istoric.data_angajare_start),
				data_angajare_end: istoric.data_angajare_end
					? new Date(istoric.data_angajare_end)
					: null,
			})),
		}));
}

function getMonthsBetween(
	startDate: Date,
	endDate: Date | null
): number | null {
	startDate = new Date(startDate);
	endDate = endDate ? new Date(endDate) : null;
	if (!endDate) return null;
	const years = endDate.getFullYear() - startDate.getFullYear();
	const months = endDate.getMonth() - startDate.getMonth();
	return years * 12 + months;
}

export default async function migrateIstoric(lastMigrationTimestamp: Date) {
	const angajati = await getFromOltp(lastMigrationTimestamp);
	if (angajati.length === 0) {
		return;
	}
	const connection = await initWh();
	const data = angajati.flatMap((angajat) =>
		angajat.istoric.reduce(
			(acc, istoric) => {
				let istoricAngajat = acc.find(
					(ia) =>
						ia.nume == angajat.nume &&
						ia.prenume == angajat.prenume &&
						ia.tip_angajat == istoric.tip_angajat
				);
				if (!istoricAngajat) {
					istoricAngajat = {
						id_angajat: angajat.id_angajat,
						nume: angajat.nume,
						prenume: angajat.prenume,
						data_prima_angajare: angajat.istoric
							.map((i) => i.data_angajare_start)
							.toSorted()[0]
							.getTime(),
						tip_angajat: istoric.tip_angajat,
						informatii_angajat: [],
					};
					acc.push(istoricAngajat);
				}
				istoricAngajat.informatii_angajat.push({
					id_locatie: angajat.id_locatie,
					id_cofetarie: angajat.id_cofetarie,
					id_timp_start: istoric.data_angajare_start.getTime(),
					id_timp_final: istoric.data_angajare_end?.getTime() ?? null,
					nr_luni: getMonthsBetween(
						istoric.data_angajare_start,
						istoric.data_angajare_end
					),
					salariu: istoric.salariu,
				});
				return acc;
			},
			[] as {
				id_angajat: number;
				nume: string;
				prenume: string;
				tip_angajat: string;
				data_prima_angajare: number;
				informatii_angajat: {
					id_locatie: number;
					id_cofetarie: number;
					id_timp_start: number | null;
					id_timp_final: number | null;
					nr_luni: number | null;
					salariu: number;
				}[];
			}[]
		)
	);

	const insertIstoric = `
		insert into istoric_angajat (id_angajat, nume, prenume, data_prima_angajare, tip_angajat)
		values (:id_angajat, :nume, :prenume, :data_prima_angajare, :tip_angajat)
		returning id_istoric into :id_istoric
	`;
	const updateIstoric = `
		update istoric_angajat
		set tip_angajat = :tip_angajat
		where id_angajat = :id_angajat
		returning id_istoric into :id_istoric
	`;
	const insertInformatii = `
		insert into informatii_angajat(id_istoric, id_locatie, id_cofetarie, id_timp_start, id_timp_final, nr_luni, salariu)
		values (:id_istoric, :id_locatie, :id_cofetarie, :id_timp_start, :id_timp_final, :nr_luni, :salariu)
	`;
	const updateInformatii = `
		update informatii_angajat
		set id_timp_final = :id_timp_final, nr_luni = :nr_luni, salariu = :salariu
		where id_istoric = :id_istoric and id_timp_start = :id_timp_start
	`;

	const progress = new CliProgress('Migrare istoric angajat');
	progress.start(data.length, 0);

	for (const istoricAngajat of data) {
		try {
			const binds = {
				id_angajat: istoricAngajat.id_angajat,
				nume: istoricAngajat.nume,
				prenume: istoricAngajat.prenume,
				data_prima_angajare: istoricAngajat.data_prima_angajare,
				tip_angajat: istoricAngajat.tip_angajat,
				id_istoric: {
					dir: oracledb.BIND_OUT,
					type: oracledb.NUMBER,
				},
			};
			let id_istoric: number;
			const {
				outBinds: { id_istoric: id_istoric_update },
			} = (await connection.execute(updateIstoric, {
				id_angajat: binds.id_angajat,
				tip_angajat: binds.tip_angajat,
				id_istoric: binds.id_istoric,
			}, {
				autoCommit: true,
			})) as { outBinds: { id_istoric: number[] } };

			if (id_istoric_update.length === 0) {
				const {
					outBinds: { id_istoric: id_istoric_insert },
				} = (await connection.execute(insertIstoric, binds, {
					autoCommit: true,
				})) as { outBinds: { id_istoric: number[] } };
				id_istoric = id_istoric_insert[0];
			} else {
				id_istoric = id_istoric_update[0];
			}

			for (const informatiiAngajat of istoricAngajat.informatii_angajat) {
				try {
					const { rowsAffected } = await connection.execute(
						updateInformatii,
						{
							id_istoric,
							id_timp_start: informatiiAngajat.id_timp_start,
							id_timp_final: informatiiAngajat.id_timp_final,
							nr_luni: informatiiAngajat.nr_luni,
							salariu: informatiiAngajat.salariu,
						},
						{ autoCommit: true }
					);
					if (rowsAffected === 0) {
						await connection.execute(insertInformatii, {
							id_istoric,
							...informatiiAngajat,
						});
					}
				} catch (err) {
					console.error(err);
				}
			}
		} catch (err) {
			console.error(err);
		} finally {
			progress.increment();
		}
	}
	progress.stop();
	return data;
}
