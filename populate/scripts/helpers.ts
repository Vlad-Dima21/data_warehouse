export function faraDiacritice(s: string) {
	return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}
