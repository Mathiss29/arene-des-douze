/**
 * État du joueur : monstres possédés, équipe, ressources et progression. Pur et sérialisable (sauvegarde).
 * Toutes les opérations renvoient un nouvel état ou lèvent une erreur explicite ; rien n'est modifié en place.
 */
import { COUT_EVOLUTION, NIVEAU_MAX, ajouterXp, type Etoiles } from './progression';
import { fiche } from './fiches';

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
}

export const TAILLE_EQUIPE = 4;

/** Monstres de départ : trois Pious et un Kwak de Flamme, le Piou Vert en leader. */
const DEPART = ['piou_vert', 'kwak_de_flamme', 'piou_bleu', 'piou_rouge'];

export function nouveauJoueur(): Joueur {
  const monstres = DEPART.map((id, i): MonstrePossede => ({ uid: i + 1, id, etoiles: fiche(id).etoiles as Etoiles, niveau: 1, xp: 0 }));
  return { version: VERSION_SAUVEGARDE, prochainUid: monstres.length + 1, kamas: 5000, pierresAme: 0, monstres, equipe: monstres.map((m) => m.uid), stagesFinis: [] };
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

/** Change l'équipe (le premier est le leader). */
export function definirEquipe(j: Joueur, uids: number[]): Joueur {
  if (uids.length < 1 || uids.length > TAILLE_EQUIPE) throw new Error(`Une équipe compte de 1 à ${TAILLE_EQUIPE} monstres`);
  if (new Set(uids).size !== uids.length) throw new Error('Un monstre ne peut pas être deux fois dans l\'équipe');
  for (const u of uids) monstre(j, u);
  return { ...j, equipe: [...uids] };
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

/**
 * ✓ Évolution façon SW : le monstre doit être au niveau max ; on sacrifie autant de monstres de même étoile que
 * son nombre d'étoiles, et on paie des kamas. Il gagne une étoile et repart au niveau 1.
 */
export function evoluer(j: Joueur, uid: number, nourriture: number[]): Joueur {
  const m = monstre(j, uid);
  if (m.etoiles >= 6) throw new Error('Déjà 6★');
  if (m.niveau < NIVEAU_MAX[m.etoiles]) throw new Error(`Il faut d'abord atteindre le niveau ${NIVEAU_MAX[m.etoiles]}`);
  if (nourriture.length !== m.etoiles) throw new Error(`Il faut ${m.etoiles} monstre(s) ${m.etoiles}★`);
  if (new Set(nourriture).size !== nourriture.length || nourriture.includes(uid)) throw new Error('Nourriture invalide');
  for (const u of nourriture) if (monstre(j, u).etoiles !== m.etoiles) throw new Error(`La nourriture doit être ${m.etoiles}★`);
  const cout = COUT_EVOLUTION[m.etoiles as 1 | 2 | 3 | 4 | 5];
  if (j.kamas < cout) throw new Error(`Il faut ${cout} kamas`);
  const restants = j.monstres.filter((x) => !nourriture.includes(x.uid)).map((x) => (x.uid === uid ? { ...x, etoiles: (x.etoiles + 1) as Etoiles, niveau: 1, xp: 0 } : x));
  const equipe = j.equipe.filter((u) => !nourriture.includes(u));
  return { ...j, kamas: j.kamas - cout, monstres: restants, equipe: equipe.length ? equipe : [uid] };
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
  };
}
