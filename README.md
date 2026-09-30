# Claude Projects

## `s65-v8/` — Anatomie du V8 S65

Simulateur 3D interactif du V8 S65 (4,0 L, 90°, vilebrequin croisé), dans une seule page HTML avec Three.js.

- Régime (800 à 11 000 tr/min), ouverture des papillons, limiteur à 8 400 tr/min
- Préparation : puissance maxi visée de 250 à 800 ch, courbes de couple et de puissance en direct
- Vue 3D animée : vilebrequin, bielles, pistons, soupapes, arbres à cames, collecteurs, avec la couleur des gaz selon le temps du cycle
- Préréglages d'affichage : complet, écorché, squelette ; calques à cocher
- Ralenti réglable (de ×1/1000 au temps réel), pause et réglage manuel de l'angle du vilebrequin
- Efforts sur les bielles (traction au PMH, compression à la combustion), fatigue et casse : manuelle, en surrégime ou par excès de puissance
- Chronogramme des 8 cylindres (ordre 1-5-4-8-6-3-7-2), courbes cinématiques du piston, son synthétisé

Ouvrir `s65-v8/index.html` dans un navigateur (Three.js est chargé depuis jsDelivr).
