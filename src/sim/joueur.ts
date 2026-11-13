/**
 * État du joueur : monstres possédés, équipe, ressources et progression. Pur et sérialisable (sauvegarde).
 * Toutes les opérations renvoient un nouvel état ou lèvent une erreur explicite ; rien n'est modifié en place.
 */
import { CHANCE_BONUS_XP, COUT_EVOLUTION, COUT_NOURRIR, NIVEAU_MAX, NOURRITURE_MAX, POINTS_NOURRITURE, XP_NIVEAU, ajouterXp, pointsRequis, xpDonnee, type Etoiles } from './progression';
import type { Rng } from './rng';
import { fiche } from './fiches';
import { ELEMENTS } from './types';

export const VERSION_SAUVEGARDE = 1;

export interface MonstrePossede {
  uid: number;
  id: string;
  etoiles: Etoiles;
  niveau: number;
  /** XP accumulée dans le niveau en cours. */
  xp: number;
}

export interface Joueur {
  version: number;
  prochainUid: number;
  kamas: number;
  pierresAme: number;
  monstres: MonstrePossede[];
  /** Équipe de l'histoire (uids), le leader en premier ; 4 monstres au plus. */
  equipe: number[];
  /** Stages déjà gagnés (ids). */
  stagesFinis: string[];
  /** Dernière équipe utilisée sur chaque stage (comme SW, qui la propose à nouveau). */
  equipesStages: Record<string, number[]>;
}

export const TAILLE_EQUIPE = 4;

/** Monstres de départ : trois Pious et un Kwak de Flamme, le Piou Vert en leader. */
const DEPART = ['piou_vert', 'kwak_de_flamme', 'piou_bleu', 'piou_rouge'];

export function nouveauJoueur(): Joueur {
  const monstres = DEPART.map((id, i): MonstrePossede => ({ uid: i + 1, id, etoiles: fiche(id).etoiles as Etoiles, niveau: 1, xp: 0 }));
  return { version: VERSION_SAUVEGARDE, prochainUid: monstres.length + 1, kamas: 5000, pierresAme: 0, monstres, equipe: monstres.map((m) => m.uid), stagesFinis: [], equipesStages: {} };
}

export function monstre(j: Joueur, uid: number): MonstrePossede {
  const m = j.monstres.find((x) => x.uid === uid);
  if (!m) throw new Error(`Monstre ${uid} introuvable`);
  return m;
}

/** Ajoute un monstre (invocation, butin) au niveau 1 de ses étoiles naturelles. */
export function ajouterMonstre(j: Joueur, id: string): { joueur: Joueur; uid: number } {
  const m: MonstrePossede = { uid: j.prochainUid, id, etoiles: fiche(id).etoiles as Etoiles, niveau: 1, xp: 0 };
  return { joueur: { ...j, prochainUid: j.prochainUid + 1, monstres: [...j.monstres, m] }, uid: m.uid };
}

/** Change l'équipe (le premier est le leader) ; retenue pour ce stage si on le précise. */
export function definirEquipe(j: Joueur, uids: number[], stageId?: string): Joueur {
  if (uids.length < 1 || uids.length > TAILLE_EQUIPE) throw new Error(`Une équipe compte de 1 à ${TAILLE_EQUIPE} monstres`);
  if (new Set(uids).size !== uids.length) throw new Error('Un monstre ne peut pas être deux fois dans l\'équipe');
  for (const u of uids) monstre(j, u);
  return { ...j, equipe: [...uids], equipesStages: stageId ? { ...j.equipesStages, [stageId]: [...uids] } : j.equipesStages };
}

/** Équipe proposée pour un stage : celle utilisée la dernière fois (sans les monstres disparus), sinon l'équipe courante. */
export function equipePourStage(j: Joueur, stageId: string): number[] {
  const uids = new Set(j.monstres.map((m) => m.uid));
  const retenue = (j.equipesStages[stageId] ?? []).filter((u) => uids.has(u));
  return retenue.length ? retenue : j.equipe.filter((u) => uids.has(u));
}

/** Le monstre a-t-il atteint le niveau max de ses étoiles ? */
export const auNiveauMax = (m: MonstrePossede) => m.niveau >= NIVEAU_MAX[m.etoiles];

/** Points d'évolution apportés par des monstres donnés en nourriture (SW : 1★ = 1, 2★ = 2, 3★ = 6…). */
export const pointsNourriture = (j: Joueur, uids: readonly number[]) => uids.reduce((s, u) => s + POINTS_NOURRITURE[monstre(j, u).etoiles as Etoiles], 0);

/**
 * Peut-il évoluer tout de suite ? Assez de points avec les monstres d'autant ou moins d'étoiles
 * qui ne sont pas dans l'équipe (on ne propose jamais de sacrifier l'équipe), et assez de kamas.
 */
export function peutEvoluer(j: Joueur, uid: number): boolean {
  const m = monstre(j, uid);
  if (m.etoiles >= 6) return false;
  const e = m.etoiles as 1 | 2 | 3 | 4 | 5;
  const dispo = j.monstres.filter((x) => x.uid !== uid && x.etoiles <= e && !j.equipe.includes(x.uid)).map((x) => x.uid);
  return pointsNourriture(j, dispo) >= pointsRequis(e) && j.kamas >= COUT_EVOLUTION[e];
}

export type Tri = 'etoiles' | 'niveau' | 'element';

/** Collection triée : par étoiles, par niveau, ou par élément (Feu, Air, Eau, Bonta, Brâkmar), puis du plus fort au plus faible. */
export function trierMonstres(monstres: readonly MonstrePossede[], tri: Tri): MonstrePossede[] {
  const force = (a: MonstrePossede, b: MonstrePossede) => b.etoiles - a.etoiles || b.niveau - a.niveau;
  const cmp: Record<Tri, (a: MonstrePossede, b: MonstrePossede) => number> = {
    etoiles: force,
    niveau: (a, b) => b.niveau - a.niveau || b.etoiles - a.etoiles,
    element: (a, b) => ELEMENTS.indexOf(fiche(a.id).element) - ELEMENTS.indexOf(fiche(b.id).element) || force(a, b),
  };
  return [...monstres].sort((a, b) => cmp[tri](a, b) || a.uid - b.uid);
}

/** Donne de l'XP à des monstres ; renvoie aussi les niveaux gagnés par chacun. */
export function donnerXp(j: Joueur, uids: number[], gain: number): { joueur: Joueur; niveaux: Record<number, number> } {
  const niveaux: Record<number, number> = {};
  const monstres = j.monstres.map((m) => {
    if (!uids.includes(m.uid)) return m;
    const r = ajouterXp(m.etoiles, m.niveau, m.xp, gain);
    niveaux[m.uid] = r.niveau - m.niveau;
    return { ...m, ...r };
  });
  return { joueur: { ...j, monstres }, niveaux };
}

/** Retire des monstres sacrifiés (collection, équipe, équipes retenues). */
function sacrifier(j: Joueur, uids: readonly number[], garder: number): Joueur {
  const equipe = j.equipe.filter((u) => !uids.includes(u));
  const equipesStages = Object.fromEntries(Object.entries(j.equipesStages).map(([k, v]) => [k, v.filter((u) => !uids.includes(u))]));
  return { ...j, monstres: j.monstres.filter((x) => !uids.includes(x.uid)), equipe: equipe.length ? equipe : [garder], equipesStages };
}

/** XP et kamas qu'apporterait cette nourriture (sans le bonus aléatoire). */
export function apercuNourrir(j: Joueur, uids: readonly number[]) {
  const ms = uids.map((u) => monstre(j, u));
  return { xp: ms.reduce((s, m) => s + xpDonnee(m.etoiles as Etoiles, m.niveau), 0), kamas: ms.reduce((s, m) => s + COUT_NOURRIR[m.etoiles as Etoiles], 0) };
}

/**
 * ✓ Nourrir au Cercle d'amélioration (SW) : jusqu'à 5 monstres sacrifiés donnent leur XP ; ~20 % de chances de ×1,5.
 * Le hasard passe par le Rng (combat et serveur déterministes).
 */
export function nourrir(j: Joueur, uid: number, nourriture: number[], rng: Rng): { joueur: Joueur; xp: number; bonus: boolean; niveaux: number } {
  monstre(j, uid); // vérifie qu'il existe
  if (!nourriture.length || nourriture.length > NOURRITURE_MAX) throw new Error(`De 1 à ${NOURRITURE_MAX} monstres`);
  if (new Set(nourriture).size !== nourriture.length || nourriture.includes(uid)) throw new Error('Nourriture invalide');
  const { xp: base, kamas } = apercuNourrir(j, nourriture);
  if (j.kamas < kamas) throw new Error(`Il faut ${kamas} kamas`);
  const bonus = rng.suivant() < CHANCE_BONUS_XP;
  const xp = bonus ? Math.round(base * 1.5) : base;
  const r = donnerXp({ ...j, kamas: j.kamas - kamas }, [uid], xp);
  return { joueur: sacrifier(r.joueur, nourriture, uid), xp, bonus, niveaux: r.niveaux[uid] ?? 0 };
}

/**
 * ✓ Évolution façon SW actuel (RELOADED) : pas de condition de niveau ; la nourriture (autant ou moins d'étoiles)
 * apporte des points ; on paie des kamas ; le monstre gagne une étoile et garde son niveau.
 */
export function evoluer(j: Joueur, uid: number, nourriture: number[]): Joueur {
  const m = monstre(j, uid);
  if (m.etoiles >= 6) throw new Error('Déjà 6★');
  const e = m.etoiles as 1 | 2 | 3 | 4 | 5;
  if (!nourriture.length || new Set(nourriture).size !== nourriture.length || nourriture.includes(uid)) throw new Error('Nourriture invalide');
  for (const u of nourriture) if (monstre(j, u).etoiles > e) throw new Error(`La nourriture doit avoir ${e}★ ou moins`);
  const points = pointsNourriture(j, nourriture), requis = pointsRequis(e);
  if (points < requis) throw new Error(`Il faut ${requis} points de nourriture (${points} donnés)`);
  const cout = COUT_EVOLUTION[e];
  if (j.kamas < cout) throw new Error(`Il faut ${cout} kamas`);
  // SW (RELOADED) : le niveau est gardé ; l'XP en cours est gardée sans dépasser le palier suivant
  const etoiles = (e + 1) as Etoiles;
  const restants = j.monstres.filter((x) => !nourriture.includes(x.uid)).map((x) =>
    x.uid === uid ? { ...x, etoiles, xp: Math.min(x.niveau >= NIVEAU_MAX[e] ? 0 : x.xp, XP_NIVEAU[etoiles][x.niveau - 1] - 1) } : x);
  return sacrifier({ ...j, kamas: j.kamas - cout, monstres: restants }, nourriture, uid);
}

/** Relit une sauvegarde : renvoie un joueur valide, ou null si elle est illisible (on repart alors d'un joueur neuf). */
export function lireSauvegarde(brut: unknown): Joueur | null {
  if (!brut || typeof brut !== 'object') return null;
  const j = brut as Partial<Joueur>;
  if (j.version !== VERSION_SAUVEGARDE || !Array.isArray(j.monstres) || !Array.isArray(j.equipe)) return null;
  const monstres = j.monstres.filter((m): m is MonstrePossede => {
    try {
      return !!m && Number.isInteger(m.uid) && !!fiche(m.id) && m.etoiles >= 1 && m.etoiles <= 6 && m.niveau >= 1 && m.niveau <= NIVEAU_MAX[m.etoiles] && m.xp >= 0;
    } catch {
      return false;
    }
  });
  if (!monstres.length) return null;
  const uids = new Set(monstres.map((m) => m.uid));
  const equipe = j.equipe.filter((u) => uids.has(u)).slice(0, TAILLE_EQUIPE);
  return {
    version: VERSION_SAUVEGARDE,
    prochainUid: Math.max(Number(j.prochainUid) || 0, ...monstres.map((m) => m.uid + 1)),
    kamas: Math.max(0, Number(j.kamas) || 0),
    pierresAme: Math.max(0, Number(j.pierresAme) || 0),
    monstres,
    equipe: equipe.length ? equipe : [monstres[0].uid],
    stagesFinis: Array.isArray(j.stagesFinis) ? j.stagesFinis.filter((s) => typeof s === 'string') : [],
    equipesStages: Object.fromEntries(
      Object.entries(j.equipesStages && typeof j.equipesStages === 'object' ? j.equipesStages : {})
        .filter((e): e is [string, number[]] => Array.isArray(e[1]))
        .map(([k, v]) => [k, v.filter((u) => uids.has(u)).slice(0, TAILLE_EQUIPE)]),
    ),
  };
}
