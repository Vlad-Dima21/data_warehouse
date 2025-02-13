// types.ts

export interface ZONA {
	ID_ZONA: number;
	NUME: string;
	ISO: string;
}

export interface JUDET {
	ID_JUDET: number;
	ID_ZONA: number;
	NUME: string;
}

export interface ORAS {
	ID_ORAS: number;
	ID_JUDET: number;
	NUME: string;
	SECTOR: number;
}

export interface LOCATIE {
	ID_LOCATIE: number;
	ID_ORAS: number;
	NUME_STRADA: string;
	NR: number;
}

export interface COFETARIE {
	ID_COFETARIE: number;
	ID_LOCATIE: number;
	TIP: string;
	NUME: string;
}

export interface ANGAJAT {
	ID_ANGAJAT: number;
	NUME: string;
	PRENUME: string;
	SALARIU: number;
	SEX: string;
	CNP: string;
	TELEFON: string;
	ID_COFETARIE: number;
}

export interface COFETAR {
	ID_ANGAJAT: number;
	SPECIALIZARE: string;
}

export interface CHELNER {
	ID_ANGAJAT: number;
	PROGRAM_START: number;
	PROGRAM_FINAL: number;
	ZI_VANZATOR: number;
}

export interface SOFER_LIVRARI {
	ID_ANGAJAT: number;
	NR_LIVRARI_ZI: number;
}

export interface ISTORIC {
	ID_ANGAJAT: number;
	DATA_ANGAJARE_START: Date;
	DATA_ANGAJARE_END: Date;
	ID_COFETARIE: number;
	TIP_ANGAJAT: string;
	SALARIU: number;
}

export interface CLIENT {
	ID_CLIENT: number;
	NUME: string;
	PRENUME: string;
	TELEFON: string;
}

export interface COMANDA {
	ID_COMANDA: number;
	ID_CLIENT: number;
	SUMA: string;
	DATA_ONORARE: Date;
	ID_LOCATIE: number;
	ID_SOFER: number;
}

export interface PLATA {
	ID_PLATA: number;
	ID_ANGAJAT: number;
	ID_COMANDA: number;
	TIP: string;
	SUMA: string;
}

export interface PRODUS {
	ID_PRODUS: number;
	NUME: string;
	PRET: number;
	TIP: string;
	GRAMAJ: number;
}

export interface COMANDA_PRODUS {
	ID_COMANDA_PRODUS: number;
	ID_COMANDA: number;
	ID_PRODUS: number;
	CANTITATE: number;
}

export interface FURNIZOR {
	ID_FURNIZOR: number;
	NUME: string;
	REP: string;
}

export interface INGREDIENT {
	ID_INGREDIENT: number;
	NUME: string;
	STOC: number;
	STOC_LUNAR: number;
	ID_FURNIZOR: number;
}

export interface PRODUS_INGREDIENT {
	ID_PRODUS: number;
	ID_INGREDIENT: number;
}

export interface CONTRACT {
	ID_CONTRACT: number;
	DATA_INCHEIERE: Date;
	COST: number;
	ZI_ONORARE: number;
	ID_FURNIZOR: number;
}

export interface PROMOTIE {
	ID_PROMOTIE: number;
	ID_PRODUS: number;
	PERIOADA_START: Date;
	PERIOADA_FINAL: Date;
	DISCOUNT: number;
}
