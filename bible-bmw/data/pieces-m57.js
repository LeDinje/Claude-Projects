// Pièces du M57 (6 cylindres diesel : 330d, 530d, 535d, 730d, X3, X5…).
// Mêmes statuts que pour le S65 : voir data/pieces-s65.js et CONTRIBUER.md.
// Attention : le M57 a connu trois générations (M57, M57TÜ ou M57N, M57TÜ2 ou M57N2) et une version biturbo.
// Beaucoup de pièces changent d'une génération à l'autre : le rôle de chaque référence précise la version.
window.BIBLE = window.BIBLE || {};
window.BIBLE.pieces = window.BIBLE.pieces || {};
window.BIBLE.pieces.m57 = {
  moteur: 'M57D30',
  vehicules: 'BMW 330d, 530d, 535d, 730d, X3, X5 (1998-2010)',
  miseAJour: '2026-10-01',
  groupes: [
    { id: '11', nom: 'Moteur' },
    { id: '12', nom: 'Électricité moteur' },
    { id: '13', nom: 'Alimentation et injection' },
  ],
  pieces: [
    // --- 11 Moteur : attelage mobile ---
    { nom: 'Coussinets de bielle', groupe: '11', sousGroupe: 'Bielle et coussinets', qte: '6 paires', vis: 'rods',
      refs: [{ ref: '11247810425', role: 'cote d’origine, paire citée avec 11247810426' }, { ref: '11247810426', role: 'cote d’origine' }],
      statut: 'a-confirmer',
      note: 'Le demi-coussinet côté bielle est de type « sputter » (couche de surface déposée sous vide), plus résistant.',
      sources: [
        { nom: 'IND Distribution, coussinets de bielle M57', url: 'https://www.idparts.com/connecting-rod-bearing-set-m57-11247810425-1124810426-37127600-p-7154.html' },
        { nom: 'ECS Tuning, coussinets de bielle M57', url: 'https://www.ecstuning.com/BMW-E90-335d-M57_3.0L/Engine/Mechanical/Connecting_Rod/Bearing/' },
      ] },
    { nom: 'Bielle', groupe: '11', sousGroupe: 'Bielle et coussinets', qte: '6', vis: 'rods', refs: [], statut: 'a-renseigner', note: '', sources: [] },
    { nom: 'Vilebrequin', groupe: '11', sousGroupe: 'Vilebrequin et coussinets', qte: '1', vis: 'crank', refs: [], statut: 'a-renseigner', note: '', sources: [] },
    { nom: 'Piston avec segments', groupe: '11', sousGroupe: 'Pistons', qte: '6', vis: 'pistons', refs: [], statut: 'a-renseigner', note: 'Piston à chambre de combustion creusée (bol) : en diesel, la combustion se fait dans le piston.', sources: [] },
    // --- 11 Moteur : culasse, distribution ---
    { nom: 'Chaîne de distribution', groupe: '11', sousGroupe: 'Distribution', qte: '', vis: 'valvetrain', refs: [], statut: 'a-renseigner', note: 'Distribution par chaîne, deux arbres à cames en tête.', sources: [] },
    { nom: 'Joint de couvre-culasse', groupe: '11', sousGroupe: 'Couvre-culasse', qte: '1', vis: 'heads', refs: [], statut: 'a-renseigner', note: '', sources: [] },
    // --- 11 Moteur : admission, EGR, turbo ---
    { nom: 'Volets de turbulence', groupe: '11', sousGroupe: 'Collecteur d’admission', qte: '6', vis: 'manifolds', refs: [], statut: 'a-renseigner',
      note: 'Point faible connu des M47 et M57 : la vis ou l’axe d’un volet peut casser, et le morceau tombe dans le cylindre. Les versions plus récentes ont des volets renforcés. Beaucoup de propriétaires posent des bouchons de suppression (pièces du commerce, pas BMW).',
      sources: [
        { nom: 'Prestige German Engines, casse des volets BMW', url: 'http://prestige-german-engines.co.uk/engine-issues/bmw-swirl-flap-failure/' },
        { nom: 'Darkside Developments, kit de suppression M57N / M57N2', url: 'https://www.darksidedevelopments.co.uk/products/swirl-flap-delete-kit-for-bmw-6-cylinder-m57n-m57n2-engines.html' },
      ] },
    { nom: 'Vanne EGR', groupe: '11', sousGroupe: 'Recirculation des gaz d’échappement', qte: '1', vis: 'manifolds',
      refs: [{ ref: '11717804382', role: 'M57N et M57N2 (TÜ et TÜ2)' }],
      statut: 'a-confirmer', note: 'Références équivalentes citées : 11717793484, 11717804380. La suie de l’EGR encrasse le collecteur et les volets.',
      sources: [
        { nom: 'Peninsula BM, vanne EGR M57N 11717804382', url: 'https://shop.peninsulabm.com/products/bmw-egr-valve-m57n' },
        { nom: 'Darkside Developments, vanne EGR M47N2 / M57N / M57N2', url: 'https://www.darksidedevelopments.co.uk/products/bmw-egr-valve-for-m47n2-m57n-m57n2-3-0-diesel-engines.html' },
      ] },
    { nom: 'Turbocompresseur', groupe: '11', sousGroupe: 'Turbocompresseur', qte: '1', vis: 'turbo',
      refs: [{ ref: '11657796314', role: 'M57TÜ2, Garrett GTB2260VK (X5 E70 3.0d)' }],
      statut: 'a-confirmer', note: 'Turbo à géométrie variable. Le 330d E90 utilise aussi un GTB2260VK, avec une référence BMW à confirmer selon le véhicule.',
      sources: [
        { nom: 'GCG Turbos, Garrett GTB2260VK pour M57TÜ2', url: 'https://gcg.com.au/garrett-motion-turbo-charger-gtb2260vk-bmw-x5-3.0ltr-m57tu2-e70-2007-7796314l12-g765985-5010w.html' },
        { nom: 'Darkside Developments, GTB2260VK pour E90 M57N2', url: 'https://www.darksidedevelopments.co.uk/products/new-garrett-bmw-gtb2260vk-for-3-series-e90-e91-e92-e93-m57-n2-engines.html' },
      ] },
    // --- 11 Moteur : lubrification ---
    { nom: 'Kit filtre à huile', groupe: '11', sousGroupe: 'Lubrification', qte: '1', vis: 'block',
      refs: [{ ref: '11427788460', role: 'M57N et M57N2 : cartouche, joint et bague' }],
      statut: 'recoupee', note: 'Fabriqué pour BMW par Hengst, Mahle et Mann.',
      sources: [
        { nom: 'ECS Tuning, pièce d’origine 11427788460', url: 'https://www.ecstuning.com/b-genuine-bmw-parts/oil-filter-kit/11427788460/' },
        { nom: 'Turner Motorsport, filtre à huile M57', url: 'https://www.turnermotorsport.com/p-568330-oil-filter/' },
        { nom: 'Blauparts, filtre à huile M57', url: 'https://www.blauparts.com/bmw-diesel-oil-filter-m57-11-42-7-788-460.html' },
      ] },
    // --- 12 Électricité moteur ---
    { nom: 'Bougie de préchauffage', groupe: '12', sousGroupe: 'Préchauffage', qte: '6', vis: 'glow',
      refs: [{ ref: '12237807277', role: 'citée pour le 330d E90' }, { ref: '12237786869', role: 'citée pour le 530d E60 (M57N)' }],
      statut: 'a-confirmer', note: 'Chauffe la chambre pour les démarrages à froid. Pas de bougie d’allumage sur un diesel.',
      sources: [{ nom: 'ECS Tuning, bougies de préchauffage M57', url: 'https://www.ecstuning.com/BMW-E90-335d-M57_3.0L/Engine/Ignition/Glow_Plugs/' }] },
    { nom: 'Boîtier de préchauffage', groupe: '12', sousGroupe: 'Préchauffage', qte: '1', vis: null,
      refs: [{ ref: '12218591724', role: '335d E90, X5 35d E70' }],
      statut: 'a-confirmer', note: '',
      sources: [{ nom: 'BimmerWorld, boîtier de préchauffage 12218591724', url: 'https://www.bimmerworld.com/Engine/Ignition/BMW-Control-Unit-12218591724.html' }] },
    // --- 13 Alimentation ---
    { nom: 'Injecteur piézo', groupe: '13', sousGroupe: 'Injection à rampe commune', qte: '6', vis: 'inj',
      refs: [{ ref: '13537808089', role: 'M57 biturbo (335d E90, X5 35d)' }, { ref: '13537808094', role: 'ancienne référence, remplacée' }],
      statut: 'a-confirmer', note: 'Les 330d et 530d M57TÜ2 ont aussi des injecteurs piézo Bosch, avec une autre référence BMW à confirmer.',
      sources: [{ nom: 'BimmerWorld, injecteur d’origine 13537808089', url: 'https://www.bimmerworld.com/Intake-Fuel/Fuel-Filters/Genuine-BMW-Injector-13537808089-E70-X5-E90.html' }] },
    { nom: 'Filtre à gazole', groupe: '13', sousGroupe: 'Filtre à carburant', qte: '1', vis: null,
      refs: [{ ref: '13327811227', role: 'cité pour X5 35d E70, 535d, 740Ld' }],
      statut: 'a-confirmer', note: 'Référence d’une version récente ; à vérifier pour un 330d ou un 530d.',
      sources: [{ nom: 'ECS Tuning, pièce d’origine 13327811227', url: 'https://www.ecstuning.com/b-genuine-bmw-parts/fuel-filter/13327811227/' }] },
    { nom: 'Pompe haute pression', groupe: '13', sousGroupe: 'Injection à rampe commune', qte: '1', vis: 'pump', refs: [], statut: 'a-renseigner', note: '', sources: [] },
    { nom: 'Rampe commune', groupe: '13', sousGroupe: 'Injection à rampe commune', qte: '1', vis: 'rail', refs: [], statut: 'a-renseigner', note: '', sources: [] },
  ],
};
