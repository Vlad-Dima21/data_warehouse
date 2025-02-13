// types.ts

export interface TIMP {
	ID_TIMP: Date;
	ZI_NUME: string;
	ZI_LUNA: number;
	ZI_AN: number;
	ESTE_WEEKEND: number;
	SAPTAMANA_LUNA: number;
	LUNA: number;
	LUNA_NUME: string;
	SEMESTRU: number;
	AN: number;
	ZI_SAPTAMANA_LUNA_SEMESTRU_AN: string;
	SAPTAMANA_LUNA_SEMESTRU_AN: string;
	LUNA_SEMESTRU_AN: string;
	SEMESTRU_AN: string;
}

export interface LOCATIE {
	ID_LOCATIE: number;
	ID_ORAS: number;
	NUME_STRADA: string;
	NR: number;
	NUME_ORAS: string;
	NUME_SECTOR: string;
	NUME_JUDET: string;
	NUME_ZONA: string;
	ISO_ZONA: string;
	NUME_ORAS_JUDET: string;
}

export interface INFORMATII_ANGAJAT {
	ID_ISTORIC_ANGAJAT: number;
	ID_ISTORIC: number;
	ID_LOCATIE: number;
	ID_COFETARIE: number;
	ID_TIMP_START: Date;
	ID_TIMP_FINAL: Date;
	NR_LUNI: number;
	SALARIU: number;
}

export interface ISTORIC_ANGAJAT {
	ID_ISTORIC: number;
	ID_ANGAJAT: number;
	NUME: string;
	PRENUME: string;
	TIP_ANGAJAT: string;
	DATA_PRIMA_ANGAJARE: Date;
}

export interface COFETARIE {
	ID_COFETARIE: number;
	NUME: string;
	TIP: string;
}

export interface PRODUS {
	ID_PRODUS: number;
	NUME: string;
	PRET_CURENT: number;
	TIP: string;
	GRAMAJ: number;
}

export interface COMANDA_FINALIZATA {
	ID: number;
	ID_COMANDA: number;
	ID_CLIENT: number;
	SUMA: number;
	ID_TIMP: Date;
	ID_LOCATIE: number;
	ID_COFETARIE: number;
	ID_PRODUS: number;
	CANTITATE_PRODUS: number;
	PRET_VANZARE_PRODUS: number;
	PRET_CANTITATE_DISCOUNT_PRODUS: number;
	DISCOUNT: number;
}

export interface CLIENT {
	ID_CLIENT: number;
	NUME: string;
	PRENUME: string;
}

export interface COMANDA {
	ID_COMANDA: number;
	DATA_ONORARE: Date;
	NR_PLATI: number;
}

export interface INCASARE {
	ID_INCASARE: number;
	ID_COMANDA: number;
	ID_CLIENT: number;
	ID_TIMP: Date;
	ID_LOCATIE: number;
	ID_COFETARIE: number;
	SUMA_INCASARE: number;
	SUMA_TOTAL_COMANDA: number;
}

export interface PLATA {
	ID_PLATA: number;
	TIP: string;
}
