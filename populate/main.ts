import judet from './scripts/judet.ts';
import init from './oracle.ts';
import oras from './scripts/oras.ts';
import locatie from './scripts/locatie.ts';
import cofetarie from './scripts/cofetarie.ts';
import angajat from './scripts/angajat.ts';
import client from './scripts/client.ts';
import produs from './scripts/produs.ts';
import comanda from './scripts/comanda.ts';
import comandaProdus from './scripts/comanda_produs.ts';
import promotie from './scripts/promotie.ts';
import plata from './scripts/plata.ts';
import istoric from './scripts/istoric_angajat.ts';

async function main() {
	const connection = await init();
	try {
		const judete = await judet();
		const orase = await oras(judete);
		const locatii = await locatie(orase);
		const cofetarii = await cofetarie(locatii);
		const angajati = await angajat(cofetarii);
		await istoric(angajati);
		const clienti = await client();
		const produse = await produs();
		const promotii = await promotie(produse);
		const comenzi = await comanda(
			clienti,
			locatii,
			angajati.filter((a) => a.tip == 'sofer_livrator'),
			produse,
			promotii
		);
		await comandaProdus(comenzi);
		await plata(comenzi, angajati);
	} catch (err) {
		console.error('Error:', err);
	} finally {
		await connection.close();
		Deno.exit(1);
	}
}

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
	main();
}
