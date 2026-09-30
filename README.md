# Claude Projects

## `s65-v8/` — Anatomie du V8 S65

Simulateur 3D interactif du V8 S65 (4,0 L, 90°, vilebrequin croisé), dans une seule page HTML avec Three.js.

- Conduite : pédale d'accélérateur, frein, sélecteur P R N D S M et palettes d'une boîte DKG 7 rapports (M3 E92), avec départ arrêté, antipatinage, passages automatiques, rétrogradages refusés en zone rouge et chrono 0 à 100 km/h
- Gestion moteur : ralenti régulé, coupure d'injection pied levé, limiteur à 8 400 tr/min, vitesse maxi 250 km/h
- Coupe détaillée d'un cylindre : trajet de l'air (filtre, trompette, papillon), injection d'essence sur la soupape, mélange, charge de la bobine, étincelle entre les électrodes, front de flamme, détente et échappement ; pression, température, richesse, avance, courbes p(θ) et p‑V
- Préparation : puissance maxi visée de 250 à 800 ch, courbes de couple et de puissance en direct
- Vue 3D animée : vilebrequin, bielles, pistons, soupapes, arbres à cames, collecteurs, avec la couleur des gaz selon le temps du cycle
- Préréglages d'affichage : complet, écorché, squelette ; calques à cocher
- Ralenti réglable (de ×1/1000 au temps réel), pause et réglage manuel de l'angle du vilebrequin
- Efforts sur les bielles (traction au PMH, compression à la combustion), fatigue et casse : manuelle, en surrégime ou par excès de puissance
- Chronogramme des 8 cylindres (ordre 1-5-4-8-6-3-7-2), courbes cinématiques du piston, son synthétisé

Ouvrir `s65-v8/index.html` dans un navigateur (Three.js est chargé depuis jsDelivr).
