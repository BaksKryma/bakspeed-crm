// Bakspeed letterhead constants — used by all outgoing PDFs
export const BAKSPEED = {
  legalName: 'BAKSPEED Sp. z o.o.',
  address: 'Henryka Sienkiewicza 22/618, 60-818 Poznań, Poland',
  nip: '7812023271',
  krs: '0000911850',
  regon: '389468581',
  timocomId: '436346',
  ceo: 'Serhii Krymniak',
  email: 'info@bakspeed.pl',
  dispoEmail: 'dispo@bakspeed.pl',
  phone: '+48 508 295 996',
  phone2: '+48 690 463 872',
  bank: 'Santander Bank Polska S.A.',
  ibanEur: 'PL46 1090 1362 0000 0001 4837 7635',
  ibanPln: 'PL64 1090 1362 0000 0001 4837 7602',
  bic: 'WBKPPLPPXXX',
  slogan: 'SPEED YOU CAN TRUST',
};

export function letterheadFooter(): string {
  return [
    `${BAKSPEED.legalName} · ${BAKSPEED.address}`,
    `NIP ${BAKSPEED.nip} · KRS ${BAKSPEED.krs} · REGON ${BAKSPEED.regon}`,
    `${BAKSPEED.bank} · EUR ${BAKSPEED.ibanEur} · PLN ${BAKSPEED.ibanPln} · BIC ${BAKSPEED.bic}`,
    BAKSPEED.slogan,
  ].join('\n');
}
