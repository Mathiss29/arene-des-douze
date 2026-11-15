/**
 * Test de fumée : lance le jeu (serveur de dév Vite, planches relayées sous /r2), ouvre chaque écran dans Chrome sans tête
 * et échoue à la moindre erreur JavaScript. Lancé avant chaque mise en ligne (`npm run fumee`, workflow de déploiement).
 * Une partie de test est préparée : Astrub fini, une équipe 6★ avec des runes, des pierres, des cadeaux.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';

const PORT = 5299;
const serveur = await createServer({ server: { port: PORT, host: '127.0.0.1' }, logLevel: 'error' });
await serveur.listen();
const navigateur = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await navigateur.newPage({ viewport: { width: 1280, height: 720 } });
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(String(e)));

const attendre = (ms) => page.waitForTimeout(ms);
const ecran = async (nom, cle, data) => {
  const avant = erreurs.length;
  await page.evaluate(([c, d]) => {
    const g = window.game;
    for (const s of g.scene.getScenes(false)) if (s.scene.isActive() || s.scene.isPaused() || s.scene.isSleeping()) g.scene.stop(s.scene.key);
    g.scene.start(c, d);
  }, [cle, data ?? {}]);
  await attendre(cle === 'combat' ? 6000 : 2500);
  console.log(`${erreurs.length > avant ? '✗' : '✓'} ${nom}`);
};

try {
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await attendre(6000);
  console.log(erreurs.length ? '✗ Île' : '✓ Île');
  // partie de test
  await page.evaluate(() => {
    const k = 'arene-des-douze:joueur';
    const j = JSON.parse(localStorage.getItem(k));
    j.stagesFinis = ['astrub-1', 'astrub-2', 'astrub-3', 'astrub-4', 'astrub-5', 'astrub-6', 'astrub-7'];
    j.monstres = [
      { uid: 1, id: 'dragoss_argile', etoiles: 6, niveau: 40, xp: 0 }, { uid: 2, id: 'koalak_indigo', etoiles: 6, niveau: 40, xp: 0 },
      { uid: 3, id: 'gelee_royale_menthe', etoiles: 6, niveau: 40, xp: 0 }, { uid: 4, id: 'bouftou_nuageux', etoiles: 4, niveau: 1, xp: 0 },
    ];
    j.equipe = [1, 2, 3, 4]; j.equipesStages = {}; j.pierresAme = 20; j.pierres = { parfaite: 2 }; j.kamas = 500000;
    j.energie = { n: 300, depuis: Date.now() };
    j.runes = [1, 2, 3, 4, 5, 6].map((e) => ({ uid: e, set: e < 5 ? 'sram' : 'steamer', emplacement: e, etoiles: 5, grade: 2, niveau: 6, principale: e === 1 ? 'atq_fixe' : e === 3 ? 'def_fixe' : e === 5 ? 'pv_fixe' : 'atq', sous: [], porteur: 1 }));
    j.prochainUidRune = 7;
    localStorage.setItem(k, JSON.stringify(j));
  });
  await ecran('Île (partie de test)', 'ile');
  await ecran('Zaap', 'zaap');
  await ecran('Zaap · Astrub', 'zaap', { zone: 'astrub' });
  await ecran('Préparation', 'preparation', { stage: 'astrub-1' });
  await ecran('Combat d\'histoire', 'combat', { stage: 'astrub-1' });
  await ecran('Donjons', 'donjons');
  await ecran('Combat de donjon', 'combat', { stage: 'donjon:bouftous-1', repetition: { total: 2, fait: 0, arret: false, historique: [], cumul: { kamas: 0, pierresAme: 0, parfaites: 0, energie: 0, runes: {}, symboles: 0, monstres: 0 } } });
  await ecran('Invocation', 'invocation');
  await ecran('Cercle d\'amélioration', 'cercle');
  await ecran('Fiche et runes', 'monstre', { uid: 1, retour: { scene: 'ile' } });
  await ecran('Missions', 'missions');
  await ecran('Réception', 'reception');
  await ecran('Chemin de l\'invocateur', 'chemin');
  await ecran('Bestiaire', 'bestiaire');
  await ecran('Options', 'options');
} finally {
  await navigateur.close();
  await serveur.close();
}
if (erreurs.length) {
  console.error(`\n${erreurs.length} erreur(s) :\n` + erreurs.join('\n'));
  process.exit(1);
}
console.log('\nAucune erreur.');
