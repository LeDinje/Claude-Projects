// Catalogue des moteurs. "fiche" = chemin de la fiche complète, ou null si elle est à venir.
// Données volontairement limitées aux caractéristiques générales ; les fiches détaillées portent le reste.
window.BIBLE = window.BIBLE || {};
window.BIBLE.moteurs = [
  { code: 'S14', famille: 'M', archi: '4 cylindres en ligne', cyl: 4, cylindree: '2,3 l', aspiration: 'Atmosphérique', modeles: 'M3 E30', periode: '1986-1991', fiche: null },
  { code: 'S38', famille: 'M', archi: '6 cylindres en ligne', cyl: 6, cylindree: '3,5 à 3,8 l', aspiration: 'Atmosphérique', modeles: 'M5 E28 et E34, M635CSi E24', periode: '1984-1995', fiche: null },
  { code: 'S50', famille: 'M', archi: '6 cylindres en ligne', cyl: 6, cylindree: '3,0 à 3,2 l', aspiration: 'Atmosphérique', modeles: 'M3 E36', periode: '1992-1999', fiche: null },
  { code: 'S54', famille: 'M', archi: '6 cylindres en ligne', cyl: 6, cylindree: '3,2 l', aspiration: 'Atmosphérique', modeles: 'M3 E46, Z3 M, Z4 M', periode: '2000-2008', fiche: null },
  { code: 'S62', famille: 'M', archi: 'V8', cyl: 8, cylindree: '4,9 l', aspiration: 'Atmosphérique', modeles: 'M5 E39, Z8', periode: '1998-2003', fiche: null },
  { code: 'S65', famille: 'M', archi: 'V8', cyl: 8, cylindree: '4,0 l', aspiration: 'Atmosphérique', modeles: 'M3 E90, E92, E93', periode: '2007-2013', fiche: 's65/index.html' },
  { code: 'S85', famille: 'M', archi: 'V10', cyl: 10, cylindree: '5,0 l', aspiration: 'Atmosphérique', modeles: 'M5 E60 et E61, M6 E63 et E64', periode: '2005-2010', fiche: null },
  { code: 'S63', famille: 'M', archi: 'V8', cyl: 8, cylindree: '4,4 l', aspiration: 'Biturbo', modeles: 'X5 M, X6 M, M5 F10 et F90, M8', periode: '2009-', fiche: null },
  { code: 'S55', famille: 'M', archi: '6 cylindres en ligne', cyl: 6, cylindree: '3,0 l', aspiration: 'Biturbo', modeles: 'M3 F80, M4 F82 et F83, M2 Competition', periode: '2014-2020', fiche: null },
  { code: 'S58', famille: 'M', archi: '6 cylindres en ligne', cyl: 6, cylindree: '3,0 l', aspiration: 'Biturbo', modeles: 'M3 G80, M4 G82, X3 M, X4 M', periode: '2019-', fiche: null },
  { code: 'M54', famille: 'Série', archi: '6 cylindres en ligne', cyl: 6, cylindree: '2,2 à 3,0 l', aspiration: 'Atmosphérique', modeles: '330i E46, 530i E39', periode: '2000-2006', fiche: null },
  { code: 'N54', famille: 'Série', archi: '6 cylindres en ligne', cyl: 6, cylindree: '3,0 l', aspiration: 'Biturbo', modeles: '335i E90 et E92, 135i E82, Z4 35i', periode: '2006-2016', fiche: null },
  { code: 'N55', famille: 'Série', archi: '6 cylindres en ligne', cyl: 6, cylindree: '3,0 l', aspiration: 'Turbo double entrée', modeles: '335i F30, 535i F10, M235i', periode: '2009-2019', fiche: null },
  { code: 'B58', famille: 'Série', archi: '6 cylindres en ligne', cyl: 6, cylindree: '3,0 l', aspiration: 'Turbo', modeles: 'M340i, M240i, X3 M40i', periode: '2015-', fiche: null },
];
