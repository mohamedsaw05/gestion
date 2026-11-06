# Activation et gestion des modules

Le catalogue des modules et capacités est défini dans `packages/db/src/modules.catalog.ts` et `packages/db/src/capabilities.catalog.ts`. Les capacités représentent les fonctions autorisées par le plan; les modules contrôlent l’exposition des domaines dans l’interface. Une option de module ne peut pas contourner une capacité interdite.

À la création, les capacités et modules initiaux sont dérivés du type d’activité et de l’offre. Les choix persistés sont associés au tenant. Les routes backend restent responsables de l’autorisation: masquer un lien du menu n’est pas une barrière de sécurité.

Le catalogue recommandé ne constitue pas encore un parcours d’édition complet pour tous les modules depuis une fiche Super Admin. Vérifier la liste autorisée du plan et les droits du tenant avant toute activation; ne pas annoncer un module comme accessible sans validation API.

