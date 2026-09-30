// Pièces du S65B40 (BMW M3 E90 / E92 / E93).
//
// Statut de chaque référence :
//   "verifiee"     vérifiée sur RealOEM (diagramme et numéro de châssis) ;
//   "recoupee"     numéro d'origine BMW trouvé sur au moins deux fiches de revendeurs spécialisés ;
//   "a-confirmer"  numéro trouvé sur une seule source, ou sans précision de variante ;
//   "a-renseigner" pas encore de numéro : à relever sur RealOEM.
// Aucune référence n'est encore "verifiee" : RealOEM n'était pas accessible depuis l'outil qui a
// constitué cette première base. Voir CONTRIBUER.md pour la marche à suivre.
//
// "vis" relie la pièce à la vue 3D (calques à afficher quand on la sélectionne).
window.BIBLE = window.BIBLE || {};
window.BIBLE.pieces = window.BIBLE.pieces || {};
window.BIBLE.pieces.s65 = {
  moteur: 'S65B40',
  vehicules: 'BMW M3 E90, E92, E93 (2007-2013)',
  miseAJour: '2026-09-30',
  groupes: [
    { id: '11', nom: 'Moteur' },
    { id: '12', nom: 'Électricité moteur' },
    { id: '13', nom: 'Alimentation et injection' },
    { id: '18', nom: 'Échappement' },
  ],
  pieces: [
    // --- 11 Moteur : attelage mobile ---
    { nom: 'Coussinets de bielle', groupe: '11', sousGroupe: 'Bielle et coussinets', qte: '8 paires', vis: 'rods',
      refs: [{ ref: '11247841702', role: 'demi-coussinet (paire citée avec 11247841703)' }, { ref: '11247841703', role: 'demi-coussinet' }],
      statut: 'a-confirmer',
      note: "Point faible connu du S65 : le jeu d'origine est serré et les coussinets s'usent tôt. Beaucoup de propriétaires les remplacent à titre préventif. Kits de remplacement du commerce (références fabricant, pas BMW) : BE Bearings SP1527…, ACL 8B1580H-STD.",
      sources: [
        { nom: 'eBay (annonce « OEM 11247841702 11247841703 »)', url: 'https://www.ebay.com/itm/196034387170' },
        { nom: 'ECS Tuning, coussinets de bielle S65', url: 'https://www.ecstuning.com/BMW-E92-M3-S65_4.0L/Engine/Mechanical/Connecting_Rod/Bearing/' },
      ] },
    { nom: 'Vis de bielle', groupe: '11', sousGroupe: 'Bielle et coussinets', qte: '16', vis: 'rods',
      refs: [{ ref: '11247834522', role: 'vis de chapeau de bielle' }],
      statut: 'a-confirmer',
      note: 'Généralement remplacées à chaque démontage des chapeaux. Alternative du commerce : ARP 201-6001.',
      sources: [{ nom: 'Driftshop, vis de bielle d’origine S65 / S85', url: 'https://www.driftshop.com/oem-rod-bolts-bmw-m3-e9x-m5-m6-e6x.html' }] },
    { nom: 'Bielle', groupe: '11', sousGroupe: 'Bielle et coussinets', qte: '8', vis: 'rods', refs: [], statut: 'a-renseigner', note: '', sources: [] },
    { nom: 'Coussinets de palier de vilebrequin', groupe: '11', sousGroupe: 'Vilebrequin et coussinets', qte: '5 paliers', vis: 'crank',
      refs: [
        { ref: '11217841609', role: 'supérieur, classe jaune' },
        { ref: '11217841610', role: 'supérieur, classe verte' },
        { ref: '11217841611', role: 'supérieur, classe violette' },
        { ref: '11217841606', role: 'inférieur, classe verte' },
      ],
      statut: 'a-confirmer',
      note: "La couleur indique la classe d'épaisseur. On la choisit d'après les repères frappés sur le bloc et sur le vilebrequin.",
      sources: [{ nom: 'ECS Tuning, coussinets de vilebrequin S65', url: 'https://www.ecstuning.com/BMW-E92-M3-S65_4.0L/Engine/Mechanical/Crankshaft/Bearing/' }] },
    { nom: 'Vilebrequin', groupe: '11', sousGroupe: 'Vilebrequin et coussinets', qte: '1', vis: 'crank', refs: [], statut: 'a-renseigner', note: '', sources: [] },
    { nom: 'Piston avec segments', groupe: '11', sousGroupe: 'Pistons', qte: '8', vis: 'pistons', refs: [], statut: 'a-renseigner', note: '', sources: [] },
    // --- 11 Moteur : culasses et distribution ---
    { nom: 'Joint de culasse', groupe: '11', sousGroupe: 'Culasse', qte: '2', vis: 'heads',
      refs: [{ ref: '11127841560', role: 'banc gauche ou droit' }],
      statut: 'a-confirmer', note: '',
      sources: [{ nom: 'Turner Motorsport, joints de culasse E92 M3', url: 'https://www.turnermotorsport.com/BMW-E92-M3/c-1107-bmw-cylinder-head-gaskets' }] },
    { nom: 'Joint de couvre-culasse', groupe: '11', sousGroupe: 'Couvre-culasse', qte: '2', vis: 'heads',
      refs: [{ ref: '11127838271', role: 'banc des cylindres 1 à 4' }, { ref: '11127838272', role: 'banc des cylindres 5 à 8' }],
      statut: 'a-confirmer', note: '',
      sources: [
        { nom: 'ECS Tuning, joints de couvre-culasse S65', url: 'https://www.ecstuning.com/BMW-E92-M3-S65_4.0l/Engine/Mechanical/Valve_Cover/Gasket/' },
        { nom: 'Turner Motorsport, joints de couvre-culasse', url: 'https://www.turnermotorsport.com/BMW-E92-M3/c-1129-bmw-valve-cover-gasket' },
      ] },
    { nom: 'Arbre à cames d’admission / d’échappement', groupe: '11', sousGroupe: 'Distribution', qte: '4', vis: 'valvetrain', refs: [], statut: 'a-renseigner', note: '', sources: [] },
    { nom: 'Soupapes d’admission / d’échappement', groupe: '11', sousGroupe: 'Distribution', qte: '32', vis: 'valvetrain', refs: [], statut: 'a-renseigner', note: '', sources: [] },
    { nom: 'Chaîne de distribution et tendeur', groupe: '11', sousGroupe: 'Distribution', qte: '', vis: 'valvetrain', refs: [], statut: 'a-renseigner', note: '', sources: [] },
    { nom: 'Unité VANOS', groupe: '11', sousGroupe: 'Distribution variable (VANOS)', qte: '', vis: 'valvetrain', refs: [], statut: 'a-renseigner', note: '', sources: [] },
    // --- 11 Moteur : lubrification et refroidissement ---
    { nom: 'Kit filtre à huile', groupe: '11', sousGroupe: 'Lubrification', qte: '1', vis: 'block',
      refs: [{ ref: '11427837997', role: 'cartouche, joint et bague' }],
      statut: 'recoupee', note: 'Fabriqué pour BMW par Mahle et Mann.',
      sources: [
        { nom: 'ECS Tuning, pièce d’origine 11427837997', url: 'https://www.ecstuning.com/b-genuine-bmw-parts/oil-filter-kit/11427837997/' },
        { nom: 'BimmerWorld, filtre à huile d’origine S65', url: 'https://www.bimmerworld.com/Engine/Engine-Maintenance/OEM-BMW-Oil-Filter-Kit-11-42-7-837-997.html' },
      ] },
    { nom: 'Pompe à eau', groupe: '11', sousGroupe: 'Pompe à eau et thermostat', qte: '1', vis: 'block',
      refs: [{ ref: '11517838201', role: 'pompe à roue métallique, avec joint torique' }],
      statut: 'recoupee', note: '',
      sources: [
        { nom: 'ECS Tuning, pièce d’origine 11517838201', url: 'https://www.ecstuning.com/b-genuine-bmw-parts/new-water-pump/11517838201/' },
        { nom: 'Turner Motorsport, pièce d’origine 11517838201', url: 'https://www.turnermotorsport.com/p-35707-11517838201-genuine-bmw-part/' },
      ] },
    { nom: 'Poulie de pompe à eau', groupe: '11', sousGroupe: 'Pompe à eau et thermostat', qte: '1', vis: 'block',
      refs: [{ ref: '11517838676', role: 'poulie en plastique' }],
      statut: 'a-confirmer', note: 'Souvent remplacée en même temps que la pompe.',
      sources: [{ nom: 'ECS Tuning, pompes à eau S65', url: 'https://www.ecstuning.com/BMW-E92-M3-S65_4.0L/Engine/Cooling/Water_Pump/' }] },
    { nom: 'Thermostat et boîtier', groupe: '11', sousGroupe: 'Pompe à eau et thermostat', qte: '1', vis: 'block',
      refs: [{ ref: '11537836155', role: 'thermostat' }, { ref: '11537838480', role: 'boîtier de thermostat' }],
      statut: 'a-confirmer', note: '',
      sources: [
        { nom: 'Turner Motorsport, kit thermostat 11537836155KT', url: 'https://www.turnermotorsport.com/p-377551-thermostat-replacement-kit/' },
        { nom: 'BimmerWorld, boîtier de thermostat d’origine', url: 'https://www.bimmerworld.com/Cooling/Thermostats/Thermostat-Housing-Genuine-BMW-E90-E92-E93-M3.html' },
      ] },
    // --- 12 Électricité moteur ---
    { nom: 'Bobine d’allumage', groupe: '12', sousGroupe: 'Allumage', qte: '8', vis: 'heads',
      refs: [{ ref: '12137841754', role: 'référence actuelle' }, { ref: '12137838388', role: 'ancienne référence, remplacée' }],
      statut: 'recoupee', note: 'Bobine crayon, une par bougie.',
      sources: [
        { nom: 'ML Performance, pièce d’origine 12137841754', url: 'https://www.mlperformance.co.uk/products/genuine-bmw-e90-e92-e93-s65-m3-ignition-coil' },
        { nom: 'Redline360, bobine 12 13 7 841 754', url: 'https://shop.redline360.com/products/ignition-coil-bmw-m3-e90-e92-e93-08-13-oem-replacement-12-13-7-841-754' },
      ] },
    { nom: 'Bougie d’allumage', groupe: '12', sousGroupe: 'Allumage', qte: '8', vis: 'heads',
      refs: [{ ref: '12120032273', role: 'équivalent NGK LKR8AP' }],
      statut: 'a-confirmer', note: '',
      sources: [{ nom: 'CP Performance, bougies NGK LKR8AP pour S65', url: 'https://cp-performance.co.uk/product/bmw-e90-e92-m3-v8-s65-spark-plugs-ngk-lkr8ap/' }] },
    { nom: 'Capteur de position de vilebrequin', groupe: '12', sousGroupe: 'Capteurs', qte: '1', vis: 'crank', refs: [], statut: 'a-renseigner', note: '', sources: [] },
    // --- 13 Alimentation ---
    { nom: 'Injecteur', groupe: '13', sousGroupe: 'Injection', qte: '8', vis: 'manifolds',
      refs: [{ ref: '13647838440', role: 'injecteur Bosch' }],
      statut: 'recoupee', note: '',
      sources: [
        { nom: 'Turner Motorsport, injecteur d’origine 13647838440', url: 'https://www.turnermotorsport.com/p-42788-oem-bosch-fuel-injector-e9x-m3-with-s65-engine/' },
        { nom: 'BimmerWorld, injecteur d’origine', url: 'https://www.bimmerworld.com/Intake-Fuel/Fuel-Filters/Genuine-BMW-Fuel-Injector-13647838440.html' },
      ] },
    { nom: 'Actionneur de papillons', groupe: '13', sousGroupe: 'Papillons individuels', qte: '2 (un par banc)', vis: 'manifolds',
      refs: [{ ref: '13627838085', role: 'actionneur électrique' }],
      statut: 'a-confirmer', note: 'Pièce réputée fragile : ses engrenages internes s’usent.',
      sources: [
        { nom: 'Euro Power Motorsports, actionneur 13627838085', url: 'https://europowermotorsports.com/products/bmw-e9x-m3-s65-throttle-actuator' },
        { nom: 'BimmerWorld, kit de remplacement d’actionneur', url: 'https://www.bimmerworld.com/Intake-Fuel/Throttle-Body/Throttle-Body-Actuator-Replacement-Kit-Genuine-BMW-E9X-M3.html' },
      ] },
    { nom: 'Rampe d’injection', groupe: '13', sousGroupe: 'Injection', qte: '2', vis: 'manifolds', refs: [], statut: 'a-renseigner', note: '', sources: [] },
    // --- 18 Échappement ---
    { nom: 'Collecteur d’échappement', groupe: '18', sousGroupe: 'Collecteurs', qte: '2', vis: 'manifolds', refs: [], statut: 'a-renseigner', note: '', sources: [] },
  ],
};
