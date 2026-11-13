/**
 * Panneau de maquette (à droite de l'écran) : questions numérotées, options A/B/C cliquables, réponse à copier.
 * Le jeu change en direct à chaque choix. Ouvert par l'adresse #maquette-<nom>.
 */
export interface Question {
  titre: string;
  aide?: string;
  options: { id: string; texte: string }[];
  /** Option choisie au départ. */
  defaut?: string;
  /** Bouton d'action à côté de la question (ex. « Rejouer l'éveil »). */
  action?: { texte: string; faire: () => void };
}

export function creerPanneau(nom: string, intro: string, questions: Question[], changer: (choix: string[]) => void) {
  const choix = questions.map((q) => q.defaut ?? q.options[0].id);
  const style = document.createElement('style');
  style.textContent = `
    #maquette { position: fixed; top: 0; right: 0; bottom: 0; width: min(380px, 42vw); z-index: 20; overflow-y: auto;
      background: rgba(10, 17, 14, 0.94); border-left: 2px solid #5d6f52; color: #e9efe6; font: 14px Lexend, sans-serif;
      padding: 16px 16px 24px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; }
    #maquette h1 { margin: 0; font: 600 20px Lexend, sans-serif; color: #e3b54c; }
    #maquette p { margin: 0; color: #9fb3a6; font-size: 12.5px; line-height: 1.45; }
    #maquette .q { display: flex; flex-direction: column; gap: 6px; }
    #maquette .q b { font-weight: 600; }
    #maquette .q small { color: #9fb3a6; font-size: 12px; }
    #maquette .opts { display: flex; flex-wrap: wrap; gap: 6px; }
    #maquette button { font: 600 12.5px Lexend, sans-serif; border-radius: 8px; padding: 7px 10px; cursor: pointer;
      background: #1d2c25; color: #e9efe6; border: 1.5px solid #3c5045; text-align: left; }
    #maquette button:hover { border-color: #c9a24a; }
    #maquette button.on { background: #c9a24a; color: #1d1405; border-color: #c9a24a; }
    #maquette button.action { background: transparent; border-style: dashed; color: #ffe08a; }
    #maquette button:focus-visible { outline: 2px solid #ffe08a; outline-offset: 2px; }
    #maquette .rep { position: sticky; bottom: -24px; background: #0a110e; border-top: 1px solid #3c5045; padding: 10px 0 0;
      display: flex; gap: 8px; align-items: center; }
    #maquette code { flex: 1; font: 600 14px monospace; color: #ffe08a; }
  `;
  document.head.appendChild(style);
  const el = document.createElement('aside');
  el.id = 'maquette';
  el.innerHTML = `<h1>Maquette « ${nom} : »</h1><p>${intro}</p>`;
  const rep = document.createElement('code');
  const maj = () => {
    rep.textContent = `${nom} : ${choix.map((c, i) => `${i + 1}${c}`).join(' ')}`;
    changer([...choix]);
  };
  questions.forEach((q, i) => {
    const bloc = document.createElement('div');
    bloc.className = 'q';
    bloc.innerHTML = `<b>${i + 1}. ${q.titre}</b>${q.aide ? `<small>${q.aide}</small>` : ''}`;
    const opts = document.createElement('div');
    opts.className = 'opts';
    for (const o of q.options) {
      const b = document.createElement('button');
      b.textContent = `${o.id} · ${o.texte}`;
      b.classList.toggle('on', choix[i] === o.id);
      b.onclick = () => {
        choix[i] = o.id;
        opts.querySelectorAll('button:not(.action)').forEach((x) => x.classList.toggle('on', x === b));
        maj();
      };
      opts.appendChild(b);
    }
    if (q.action) {
      const a = document.createElement('button');
      a.className = 'action';
      a.textContent = `▶ ${q.action.texte}`;
      a.onclick = q.action.faire;
      opts.appendChild(a);
    }
    bloc.appendChild(opts);
    el.appendChild(bloc);
  });
  const pied = document.createElement('div');
  pied.className = 'rep';
  const copier = document.createElement('button');
  copier.textContent = 'Copier';
  copier.onclick = () => navigator.clipboard?.writeText(rep.textContent ?? '').then(() => { copier.textContent = 'Copié ✓'; }, () => undefined);
  pied.append(rep, copier);
  el.appendChild(pied);
  document.body.appendChild(el);
  maj();
  return choix;
}
