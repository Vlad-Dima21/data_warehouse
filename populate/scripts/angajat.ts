// @ts-types="@types/oracledb"
import oracledb from 'oracledb';
import { ro, Faker, faker as origFaker } from '@faker-js/faker';
import init from '../oracle.ts';
import { CofetarieOut } from './cofetarie.ts';
import { faraDiacritice } from './helpers.ts';
import CliProgress from './progress.ts';

export interface AngajatOut {
	id_angajat: number;
	tip: 'cofetar' | 'sofer_livrator' | 'chelner';
	cofetarie: CofetarieOut;
	cofetar?: CofetarOut;
	salariu: number;
}

const faker = new Faker({ locale: [ro] });

export interface CofetarOut {
	//todo poate adaugam check la specializare
	specializare: 'prajituri' | 'torturi' | 'cozonaci';
}

async function insertCofetar(id_angajat: AngajatOut['id_angajat']) {
	const connection = await init();
	const sql = `
		INSERT INTO cofetar (
			id_angajat, specializare
		) VALUES (
			:id_angajat,
			:specializare
		)`;
	const angajat = {
		id_angajat,
		specializare: faker.helpers.arrayElement([
			'prajituri',
			'torturi',
			'cozonaci',
		]),
	};
	try {
		await connection.execute(sql, angajat, { autoCommit: true });
		return angajat.specializare;
	} catch (error) {
		console.error(error);
	}
}

export interface SoferLivrariOut {
	nr_livrari_zi: number;
}

async function insertSoferLivrari(id_angajat: AngajatOut['id_angajat']) {
	const connection = await init();
	const sql = `
		INSERT INTO sofer_livrari (
			id_angajat, nr_livrari_zi
		) VALUES (
			:id_angajat,
			:nr_livrari_zi
		)`;
	const angajat = {
		id_angajat,
		nr_livrari_zi: faker.number.int({ min: 1, max: 5 }),
	};
	try {
		await connection.execute(sql, angajat, { autoCommit: true });
		return angajat.nr_livrari_zi;
	} catch (error) {
		console.error(error);
	}
}

export interface ChelnerOut {
	program_start: number;
	program_final: number;
	zi_vanzator: number;
}

async function insertChelner(id_angajat: AngajatOut['id_angajat']) {
	const connection = await init();
	const sql = `
		INSERT INTO chelner (
			id_angajat, program_start, program_final, zi_vanzator
		) VALUES (
			:id_angajat,
			:program_start,
			:program_final,
			:zi_vanzator
		)`;
	const angajat = {
		id_angajat,
		program_start: faker.number.int({ min: 7, max: 11 }),
		program_final: faker.number.int({ min: 13, max: 18 }),
		zi_vanzator: faker.number.int({ min: 1, max: 7 }),
	};
	try {
		await connection.execute(sql, angajat, { autoCommit: true });
		return {
			program_start: angajat.program_start,
			program_final: angajat.program_final,
			zi_vanzator: angajat.zi_vanzator,
		};
	} catch (error) {
		console.error(error);
	}
}

export default async function (cofetarii: CofetarieOut[]) {
	const connection = await init();
	const sql = `
        INSERT INTO angajat (
            nume, prenume, salariu, sex, email, cnp, telefon, id_cofetarie
        ) VALUES (
            :nume,
            :prenume,
            :salariu,
            :sex,
            :email,
            :cnp,
            :telefon,
            :id_cofetarie
        )
        RETURNING id_angajat INTO :id_angajat`;
	const angajati: AngajatOut[] = [];
	const progress = new CliProgress('Angajati');
	progress.start(cofetarii.length * 10, 0);
	for (const cofetarie of cofetarii) {
		for (const tipAngajat of [
			...Array.from({ length: 3 }).map(() => 'cofetar'),
			...Array.from({ length: 2 }).map(() => 'sofer_livrator'),
			...Array.from({ length: 5 }).map(() => 'chelner'),
		]) {
			const sex = origFaker.person.sexType();
			const nume = faraDiacritice(faker.person.lastName(sex));
			const prenume = faraDiacritice(faker.person.firstName(sex));
			const salariu = faker.number.int({ min: 2000, max: 5000 });
			const data_nastere = faker.date.birthdate({
				mode: 'age',
				min: 18,
				max: 65,
			});
			const binds = {
				nume,
				prenume,
				email: faker.internet
					.email({
						firstName: prenume,
						lastName: nume,
						allowSpecialCharacters: false,
					})
					.toLowerCase(),
				cnp: `${sex == 'female' ? '2' : '1'}${data_nastere
					.getFullYear()
					.toString()
					.slice(
						2
					)}${data_nastere.getMonth()}${data_nastere.getDate()}${faker.number.int(
					{ min: 100000, max: 999999 }
				)}`,
				salariu,
				sex: sex.charAt(0).toUpperCase(),
				telefon: faker.phone
					.number({ style: 'international' })
					.slice(2),
				id_cofetarie: cofetarie.id_cofetarie,
				id_angajat: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
			};

			try {
				const { outBinds } = (await connection.execute(sql, binds, {
					autoCommit: true,
				})) as { outBinds: { id_angajat: number[] } };
				const angajat = {
					id_angajat: outBinds.id_angajat[0],
					tip: tipAngajat as 'cofetar' | 'sofer_livrator' | 'chelner',
					cofetarie,
					salariu,
				};

				switch (tipAngajat) {
					case 'cofetar':
						{
							const specializare = await insertCofetar(
								angajat.id_angajat
							);
							angajati.push({
								...angajat,
								...(!!specializare && {
									cofetar: {
										specializare,
									},
								}),
							});
						}
						break;
					case 'sofer_livrator':
						{
							const nr_livrari_zi = await insertSoferLivrari(
								angajat.id_angajat
							);
							angajati.push({
								...angajat,
								...(!!nr_livrari_zi && {
									sofer_livrari: {
										nr_livrari_zi,
									},
								}),
							});
						}
						break;
					case 'chelner':
						{
							const detaliiChelner = await insertChelner(
								angajat.id_angajat
							);
							angajati.push({
								...angajat,
								...(!!detaliiChelner && {
									chelner: {
										...detaliiChelner,
									},
								}),
							});
						}
						break;
				}
			} catch (error) {
				console.error(error);
			} finally {
				progress.increment();
			}
		}
	}

	progress.stop();
	return angajati;
}
