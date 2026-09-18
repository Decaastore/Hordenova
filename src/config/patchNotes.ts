import type { LanguageCode } from "@/i18n";

/**
 * Novidades (patch notes) — the single source of truth for the Novidades
 * screen (src/screens/NovidadesScreen.tsx) AND the Home teaser card
 * (src/screens/MainMenu.tsx). Every entry below corresponds to a real,
 * shipped change in this codebase — no invented feature, date, or number.
 * "Não inventar histórico."
 *
 * ONE FILE, BOTH LANGUAGES — every entry carries its own `en`/`ptBR` text
 * inline (title, description, highlights). There is no separate
 * `novidades.entries.*` block in src/i18n/locales/*.ts anymore: this file
 * alone is what you edit to add or change a changelog entry, in both
 * languages at once. Nothing else needs to change for a new entry to show
 * up on both the Novidades page and the Home teaser.
 *
 * THE MANDATORY WORKFLOW (see CLAUDE.md's "Novidades / Changelog" section
 * for the full contract every session — human or AI — follows in this
 * repo): implement → test → validate → ONLY THEN add ONE new PatchNoteEntry
 * here, in the same commit as the validated work. A change that fails its
 * tests, isn't finished, or is purely internal (refactor, file move, test
 * tweak, variable rename) NEVER gets an entry — see CLAUDE.md for the exact
 * player-facing/not-player-facing line. Several related changes from the
 * same piece of work become ONE grouped entry (a title + short description
 * + bullet highlights), never one entry per file touched.
 *
 * `npm run draft:novidades` (scripts/draftNovidades.mjs) is the safety net:
 * it lists every commit since this file was last touched, as a plain
 * review checklist, so nothing player-relevant slips through unnoticed. It
 * never writes here and never auto-publishes — deciding what's real,
 * player-facing news and writing honest copy for it stays a judgment call,
 * not a mechanical transform.
 *
 * Ordering: newest first. `dateIso` is `null` on an early version whose
 * real ship date isn't known (this repo's earliest history was authored
 * inside a single sandboxed session, so those commits don't carry a
 * meaningful individual calendar date) — versions stay ordered newest-first
 * regardless, a missing date never affects ordering. From v4 onward every
 * version's `dateIso` is the real date it shipped.
 */

export type PatchNoteCategory =
  | "CONTENT"
  | "TOWERS"
  | "BOSSES"
  | "CASTLE"
  | "ITEMS"
  | "ASCENSION"
  | "INTERFACE"
  | "SYSTEMS"
  | "BALANCE"
  | "FIXES";

/** Every player-facing string in a patch note entry carries both supported languages inline — see file header. */
export type LocalizedText = Record<LanguageCode, string>;

export interface PatchNoteEntry {
  id: string;
  /** ISO date (YYYY-MM-DD) for a version with a known real ship date, or null — see file header. */
  dateIso: string | null;
  category: PatchNoteCategory;
  /** Short, commercial-changelog-style title, e.g. "New Mini-Boss — Ashfen Warlord". */
  title: LocalizedText;
  /** One clear, plain-language paragraph — never raw engine/commit jargon. */
  description: LocalizedText;
  /** Bullet points with the specific, player-relevant facts of the change. */
  highlights: readonly LocalizedText[];
}

/** Newest first. */
export const PATCH_NOTES: readonly PatchNoteEntry[] = [
  {
    id: "v30",
    dateIso: "2026-09-18",
    category: "CONTENT",
    title: {
      en: "Every Biome Now Scatters Its Own Scenery",
      ptBR: "Cada Bioma Agora Espalha Seu Próprio Cenário",
    },
    description: {
      en: "A visual audit comparing biomes side by side found the real reason every stage still felt like the same map with a new coat of paint: every single biome — Crystal Sea, Ashen Valley, Moon Gardens, all sixteen — was quietly rendering the exact same scenery layout (the same trees, rocks, ruins, crystals, in the same positions), each biome's own carefully authored mix of what should appear there was never actually being used. The bug is fixed: each biome now generates its own real scenery from its own mix. Ashen Valley is now a barren field of broken rock and ruined pillars with no trees, water, or crystals in sight. Crystal Sea is now dense with crystal formations and water pools and nothing else. Moon Gardens is now a quiet grove of trees, flowers, and undergrowth. Every other biome follows its own long-designed mix the same way. The road, tower slots, and everything about actual gameplay are untouched — only what grows and sits around them now genuinely differs from stage to stage.",
      ptBR: "Uma auditoria visual comparando biomas lado a lado encontrou o motivo real pelo qual cada fase ainda parecia o mesmo mapa com uma nova cor: todo bioma — Mar de Cristal, Vale das Cinzas, Jardins da Lua, os dezesseis — estava, sem ninguém perceber, desenhando exatamente o mesmo layout de cenário (as mesmas árvores, pedras, ruínas, cristais, nas mesmas posições); a mistura própria e cuidadosamente pensada de cada bioma nunca estava realmente sendo usada. O defeito foi corrigido: cada bioma agora gera seu próprio cenário real, a partir da sua própria mistura. O Vale das Cinzas agora é um campo árido de pedras quebradas e pilares em ruínas, sem árvore, água ou cristal à vista. O Mar de Cristal agora é denso em formações de cristal e poças d'água, e nada mais. Os Jardins da Lua agora são um bosque silencioso de árvores, flores e vegetação rasteira. Todo outro bioma segue sua própria mistura, já pensada há tempos, do mesmo jeito. A estrada, as posições de torre e tudo sobre a jogabilidade em si permanecem intactos — só o que cresce e fica ao redor deles agora realmente muda de fase para fase.",
    },
    highlights: [
      {
        en: "Fixed a bug where every biome scattered the exact same fixed scenery layout regardless of which stage you were on — each biome's own decoration mix is now actually applied.",
        ptBR: "Corrigido um defeito em que todo bioma espalhava exatamente o mesmo layout fixo de cenário, não importando a fase — a mistura própria de decoração de cada bioma agora é realmente aplicada.",
      },
      {
        en: "Ashen Valley is now visibly a rock-and-ruin wasteland, Crystal Sea a field of crystal formations and water, Moon Gardens a tree-and-flower grove — every other biome follows its own long-designed mix the same way.",
        ptBR: "O Vale das Cinzas agora é visivelmente um deserto de pedras e ruínas, o Mar de Cristal um campo de formações de cristal e água, os Jardins da Lua um bosque de árvores e flores — todo outro bioma segue sua própria mistura, já pensada há tempos, do mesmo jeito.",
      },
      {
        en: "Purely visual — the road, tower slots, combat, and every gameplay system are untouched.",
        ptBR: "Puramente visual — a estrada, as posições de torre, o combate e todos os sistemas de jogabilidade permanecem intactos.",
      },
    ],
  },
  {
    id: "v29",
    dateIso: "2026-09-18",
    category: "INTERFACE",
    title: {
      en: "Terrain Objects Rebuilt — Real Shapes Instead of Glow Blobs",
      ptBR: "Objetos do Terreno Reconstruídos — Formas Reais em vez de Manchas de Brilho",
    },
    description: {
      en: "A follow-up to the visual audit found the second-biggest problem with the scenery: torches, crystals, and ancient ruins were reading as soft glowing blobs rather than physical objects sitting on the ground. The torch's light pool was so large and bright it visually swallowed the torch itself — you could barely tell there was a pole and a flame in there. It's been rebuilt with a proper brazier the fire actually sits inside, and the light is now a small, controlled pool drawn behind the object instead of on top of it. Crystals used to float slightly above their own shadow, which — combined with an oversized glow — made them look like hovering lights instead of mineral formations; they now visibly emerge from a buried base directly above a real ground shadow, with a second darker facet so more than one crystal face reads at a glance. The deepest fix is Ruins: they used to be built from the exact same 3D rock shape as ordinary boulders, so every 'ancient ruin' on the map was, geometrically, an indistinguishable rock — no broken pillar, no fallen slab, nothing that said 'this used to be a structure.' Ruins now have their own two-piece silhouette: a broken column stump beside a tilted, fallen slab, so they finally read as rubble instead of scenery reused from elsewhere. Regular rocks, trees, water, and every other decoration are untouched.",
      ptBR: "Uma continuação da auditoria visual encontrou o segundo maior problema do cenário: tochas, cristais e ruínas antigas estavam lendo como manchas suaves de brilho em vez de objetos físicos apoiados no chão. O halo de luz da tocha era tão grande e brilhante que engolia visualmente a própria tocha — mal dava para perceber que havia um poste e uma chama ali dentro. Ela foi reconstruída com um braseiro de verdade onde o fogo realmente se apoia, e a luz agora é uma poça pequena e controlada, desenhada atrás do objeto em vez de por cima dele. Os cristais antes flutuavam ligeiramente acima da própria sombra, o que, somado a um brilho grande demais, os fazia parecer luzes suspensas em vez de formações minerais; agora eles visivelmente emergem de uma base enterrada bem acima de uma sombra real no chão, com uma segunda face mais escura para que mais de uma face do cristal seja perceptível num único olhar. O ajuste mais profundo foi nas Ruínas: elas eram construídas com a mesma forma 3D usada pelas pedras comuns, então toda 'ruína antiga' no mapa era, geometricamente, uma pedra indistinguível — nenhum pilar quebrado, nenhuma laje caída, nada que dissesse 'isso já foi uma estrutura'. As ruínas agora têm sua própria silhueta de duas peças: um toco de coluna quebrada ao lado de uma laje caída e inclinada, então finalmente lêem como escombros em vez de cenário reaproveitado de outro lugar. Pedras comuns, árvores, água e qualquer outra decoração permanecem inalteradas.",
    },
    highlights: [
      {
        en: "Torches now have a real brazier the fire sits inside, and their light is a small, restrained pool drawn behind the object instead of an oversized glow that used to sit on top and hide the pole/flame shape.",
        ptBR: "As tochas agora têm um braseiro de verdade onde o fogo se apoia, e a luz é uma poça pequena e contida desenhada atrás do objeto, em vez de um brilho grande demais que antes ficava por cima e escondia a forma do poste/chama.",
      },
      {
        en: "Crystals now visibly emerge from a buried base directly above a real ground shadow (previously floating slightly above it), with a second darker facet so more than one crystal face reads at a glance.",
        ptBR: "Os cristais agora visivelmente emergem de uma base enterrada bem acima de uma sombra real no chão (antes flutuavam ligeiramente acima dela), com uma segunda face mais escura para que mais de uma face seja perceptível num único olhar.",
      },
      {
        en: "Ancient Ruins are no longer built from the same 3D shape as ordinary rocks — they're now a distinct broken-pillar-plus-fallen-slab silhouette, so ruins finally read as rubble instead of an indistinguishable boulder.",
        ptBR: "Ruínas Antigas deixaram de ser construídas com a mesma forma 3D das pedras comuns — agora têm uma silhueta própria de pilar quebrado com uma laje caída ao lado, então as ruínas finalmente lêem como escombros em vez de uma pedra indistinguível.",
      },
      {
        en: "Purely visual — no change to gameplay, combat, economy, tower/castle mechanics, or the Boss redesign shipped in the previous update.",
        ptBR: "Puramente visual — nenhuma mudança em gameplay, combate, economia, mecânicas de torre/castelo ou no redesign do Chefe lançado na atualização anterior.",
      },
    ],
  },
  {
    id: "v28",
    dateIso: "2026-09-17",
    category: "BOSSES",
    title: {
      en: "The Ashen Colossus — All-New Body, Not a Bigger Brute",
      ptBR: "O Ashen Colossus — Corpo Totalmente Novo, Não um Brute Maior",
    },
    description: {
      en: "A full visual audit of the game found its single biggest problem: the Ashen Valley's boss, The Ashen Colossus, Forsaken, technically had its own name, aura, and entrance — but its actual body was still just a scaled-up, slightly recolored version of the same shape a regular enemy uses, so at a glance it barely read as a boss at all. It's been rebuilt from scratch with its own anatomy: a hunched, asymmetric frame with one massive dragging forelimb, a broken row of stone spine plates, a low fused head with one intact horn and one snapped off, and a torn-open chest cavity its molten core visibly escapes from instead of a dot painted on its chest. Every light-facing edge now catches a real highlight, so the silhouette reads clearly even against this biome's dark ash palette — the exact problem that made it blend into the background before. Its walk now visibly compresses under its own weight with each step, kicking up a small puff of ash where it lands. The mini-boss version of the same boss is no longer a smaller copy: it's a distinct, low prowling quadruped that shares the family's material and glowing core but has its own build entirely, so the two no longer look like the same monster at two sizes.",
      ptBR: "Uma auditoria visual completa do jogo encontrou seu maior problema isolado: o chefe do Vale das Cinzas, The Ashen Colossus, Forsaken, tecnicamente já tinha nome, aura e entrada próprios — mas seu corpo de verdade ainda era só uma versão aumentada e ligeiramente recolorida da mesma forma usada por um inimigo comum, então, num olhar rápido, quase não parecia um chefe. Ele foi reconstruído do zero com anatomia própria: um corpo curvado e assimétrico com um braço dianteiro enorme sendo arrastado, uma fileira quebrada de placas de pedra na espinha, uma cabeça baixa fundida ao corpo com um chifre intacto e outro quebrado, e uma cavidade no peito rasgada de onde seu núcleo em brasa escapa visivelmente, em vez de um pontinho pintado no peito. Toda borda voltada para a luz agora recebe um brilho de contorno real, então a silhueta se destaca com clareza mesmo contra a paleta escura desse bioma — exatamente o problema que antes o fazia se misturar com o fundo. Sua caminhada agora comprime visivelmente sob o próprio peso a cada passo, levantando um pequeno borrifo de cinzas onde pisa. A versão mini-chefe do mesmo chefe deixou de ser uma cópia menor: agora é um quadrúpede baixo e rondador, com identidade própria, que compartilha o material e o núcleo brilhante da família mas tem uma estrutura corporal totalmente distinta — os dois deixaram de parecer o mesmo monstro em dois tamanhos.",
    },
    highlights: [
      {
        en: "The Ashen Colossus (main boss, Ashen Valley) has an all-new bespoke silhouette — asymmetric hunched frame, one massive dragging forelimb, broken spine plates, a fused low head with an intact horn and a broken stub, and a torn chest cavity its core visibly sits inside and escapes from.",
        ptBR: "The Ashen Colossus (chefe principal, Vale das Cinzas) tem uma silhueta totalmente nova e própria — corpo assimétrico e curvado, um braço dianteiro enorme sendo arrastado, placas de espinha quebradas, cabeça baixa fundida com um chifre intacto e um quebrado, e uma cavidade no peito rasgada de onde o núcleo visivelmente escapa.",
      },
      {
        en: "Added real material contrast (warm rim highlights on every light-facing edge) so the boss's silhouette reads clearly against Ashen Valley's dark palette instead of blending into the background.",
        ptBR: "Adicionado contraste real de material (brilhos de contorno quentes em toda borda voltada para a luz) para a silhueta do chefe se destacar com clareza contra a paleta escura do Vale das Cinzas, em vez de se misturar com o fundo.",
      },
      {
        en: "Its walk now visibly compresses under its own weight each step and kicks up a small puff of ash where it lands, instead of a flat sideways sway.",
        ptBR: "Sua caminhada agora comprime visivelmente sob o próprio peso a cada passo e levanta um pequeno borrifo de cinzas onde pisa, em vez de um simples balanço lateral.",
      },
      {
        en: "The mini-boss (Ashen Colossus, Spawn) is now a distinct low prowling quadruped — its own build, not the main boss scaled down — while still sharing the family's charred material and glowing core.",
        ptBR: "O mini-chefe (Ashen Colossus, Spawn) agora é um quadrúpede baixo e rondador com identidade própria — estrutura própria, não o chefe principal em escala reduzida — mas ainda compartilhando o material carbonizado e o núcleo brilhante da família.",
      },
      {
        en: "Purely visual — same HP, damage, abilities, enrage, and rewards as before; the regular Brute enemy and every other boss/mini-boss are unchanged.",
        ptBR: "Puramente visual — mesmo HP, dano, habilidades, fúria e recompensas de antes; o inimigo Brute comum e todo outro chefe/mini-chefe permanecem inalterados.",
      },
    ],
  },
  {
    id: "v27",
    dateIso: "2026-09-17",
    category: "FIXES",
    title: {
      en: "Creature Presence Pass — Real Ground Contact and Weight Feedback",
      ptBR: "Passagem de Presença das Criaturas — Contato Real com o Chão e Peso",
    },
    description: {
      en: "A close look at the original creature roster (Crawler, Runner, Brute, Shieldbearer, Swarmling, Regenerator, Ironclad, Disabler — the ones players see most, from wave 1 onward) found that seven of those eight rendered with no ground shadow at all, including both heavy ones — the concrete reason they could still look like they were sliding across the map instead of standing on it despite already having footstep dust and hit reactions. Both heavy creatures now settle their torso into each footfall too, on top of their existing leg animation. Getting hit now also reacts to the creature's own weight instead of one generic flinch for everyone — light creatures snap back fast, heavy ones barely budge and settle slower, and a mini-boss's reaction is now visibly stronger (but shorter) than a full boss's controlled one, instead of both getting the exact same nudge. Finally, a real gap in the death sequence is fixed: a burst of many kills in the same moment could push a dying creature's body past its own pool of on-screen \"corpse\" slots, making it vanish instantly on the exact frame its death effect and floating damage number appeared — that pool is now large enough for the density this game actually reaches, and the lingering footstep dust/trail effects a dying creature was still carrying now fade together with its body instead of holding at full brightness and then cutting out. Purely visual — no change to HP, damage, drops, or any other gameplay value.",
      ptBR: "Uma análise de perto do elenco original de criaturas (Crawler, Runner, Brute, Shieldbearer, Swarmling, Regenerator, Ironclad, Disabler — as que os jogadores mais veem, desde a onda 1) encontrou que sete dessas oito criaturas eram renderizadas sem nenhuma sombra no chão, incluindo as duas pesadas — a razão concreta pela qual ainda podiam parecer deslizando pelo mapa em vez de apoiadas nele, mesmo já tendo poeira de pegada e reação a acertos. As duas criaturas pesadas agora também acomodam o tronco a cada passada, além da animação de pernas que já tinham. Tomar um acerto agora também reage ao peso da própria criatura em vez de um único flinch genérico para todo mundo — criaturas leves recuam rápido, as pesadas quase não se movem e se acomodam mais devagar, e a reação de um mini-chefe agora é visivelmente mais forte (porém mais curta) que a de um chefe completo, em vez de ambos receberem exatamente o mesmo empurrão. Por fim, uma lacuna real na sequência de morte foi corrigida: uma leva de várias mortes no mesmo instante podia empurrar o corpo de uma criatura morrendo para além do próprio limite de \"cadáveres\" na tela, fazendo-o desaparecer instantaneamente no exato frame em que seu efeito de morte e o número de dano apareciam — esse limite agora é grande o suficiente para a densidade que o jogo realmente atinge, e os efeitos de poeira/rastro de pegada que uma criatura morrendo ainda carregava agora desaparecem junto com o corpo dela em vez de continuar no brilho máximo e sumir de repente. Puramente visual — nenhuma mudança em HP, dano, drops ou qualquer outro valor de gameplay.",
    },
    highlights: [
      {
        en: "Fixed a real gap: 7 of the 8 original creature archetypes (everything except Crawler) rendered with no ground shadow at all — both heavy ones (Brute, Shieldbearer) now cast one too, weighted to their size.",
        ptBR: "Corrigida uma lacuna real: 7 dos 8 arquétipos originais de criatura (tudo menos o Crawler) eram renderizados sem nenhuma sombra no chão — as duas pesadas (Brute, Shieldbearer) agora também projetam uma, com peso proporcional ao tamanho.",
      },
      {
        en: "Brute and Shieldbearer now settle their torso into each footfall instead of only animating their legs while the body glided at a fixed height.",
        ptBR: "Brute e Shieldbearer agora acomodam o tronco a cada passada, em vez de só animar as pernas enquanto o corpo deslizava numa altura fixa.",
      },
      {
        en: "Hit reactions are now weight-aware: light creatures flinch fast and far, heavy ones barely move and take longer to settle, mini-bosses hit hard but recover quickly, and bosses stay visibly composed — instead of every non-boss sharing one identical reaction.",
        ptBR: "As reações a acerto agora consideram o peso: criaturas leves recuam rápido e longe, as pesadas quase não se mexem e demoram mais para se acomodar, mini-chefes reagem forte mas se recuperam rápido, e chefes permanecem visivelmente compostos — em vez de todo não-chefe compartilhar a mesma reação idêntica.",
      },
      {
        en: "Fixed a death-sequence desync where a large burst of simultaneous kills could make a creature's body vanish instantly instead of collapsing, and where its lingering dust/trail effects didn't fade with it.",
        ptBR: "Corrigida uma dessincronização na sequência de morte em que uma leva grande de mortes simultâneas podia fazer o corpo de uma criatura sumir instantaneamente em vez de desabar, e em que os efeitos de poeira/rastro que ainda carregava não desapareciam junto com ela.",
      },
      {
        en: "Purely visual polish — no change to HP, damage, drops, Gold, Gems, waves, or any other gameplay value.",
        ptBR: "Polimento puramente visual — nenhuma mudança em HP, dano, drops, Gold, Gemas, ondas ou qualquer outro valor de gameplay.",
      },
    ],
  },
  {
    id: "v26",
    dateIso: "2026-09-17",
    category: "FIXES",
    title: {
      en: "Impact Effects Polish — Hits, Deaths, and Footsteps Now Actually Visible",
      ptBR: "Polimento dos Efeitos de Impacto — Acertos, Mortes e Pegadas Agora Realmente Visíveis",
    },
    description: {
      en: "A follow-up pass on the material-based hit/death/footstep effects: at the game's real zoomed-out scale, the particles and footstep dust were too thin and too small to actually read next to a creature's own body and the map's detail, and one footstep dust puff was being drawn in the wrong draw order and getting painted over by the creature itself. Both are fixed — particles are thicker and a bit faster, footstep dust is bigger, lighter-toned, and correctly placed behind the creature's own silhouette, and critical hits push the same effect noticeably further (more particles, longer reach) rather than just slightly bigger. Boss entrances also get a brief ground-dust ring alongside their existing impact burst, so the arrival reads as a real landing. Everything is still the same restrained, no-gore, no-neon effects from the previous pass — this is purely about making them actually visible during real gameplay, with zero change to HP, damage, drops, or any other gameplay value.",
      ptBR: "Um polimento sobre os efeitos de acerto/morte/pegada baseados em material: na escala real e mais afastada do jogo, as partículas e a poeira das pegadas eram finas e pequenas demais para realmente aparecer perto do corpo da própria criatura e dos detalhes do mapa, e uma das pegadas estava sendo desenhada na ordem errada e ficava escondida atrás da própria criatura. Os dois problemas foram corrigidos — as partículas ficaram mais grossas e um pouco mais rápidas, a poeira das pegadas ficou maior, com um tom mais claro e posicionada corretamente atrás da silhueta da criatura, e acertos críticos agora empurram o mesmo efeito visivelmente mais longe (mais partículas, mais alcance) em vez de só um pouco maior. A entrada dos chefes também ganhou um breve anel de poeira no chão junto com o impacto que já existia, para a chegada parecer um pouso de verdade. Tudo continua com a mesma identidade contida, sem sangue e sem neon do polimento anterior — isso é puramente sobre deixar os efeitos realmente visíveis durante o jogo real, sem nenhuma mudança em HP, dano, drops ou qualquer outro valor de gameplay.",
    },
    highlights: [
      {
        en: "Material hit/death particle bursts are noticeably thicker and a bit faster across all 6 creature families — the previous pass's effects were structurally correct but too thin to read at real gameplay zoom.",
        ptBR: "Os efeitos de partículas de acerto/morte por material ficaram visivelmente mais grossos e um pouco mais rápidos nas 6 famílias de criaturas — os efeitos do polimento anterior estavam corretos na estrutura, mas finos demais para aparecer na escala real do jogo.",
      },
      {
        en: "Fixed a footstep dust puff that was being drawn behind the creature in the wrong order and getting hidden by its own (opaque) body — dust now correctly appears behind/beside the creature as it walks.",
        ptBR: "Corrigida uma pegada de poeira que era desenhada na ordem errada atrás da criatura e ficava escondida pelo próprio corpo (opaco) dela — a poeira agora aparece corretamente atrás/ao lado da criatura enquanto ela caminha.",
      },
      {
        en: "Footstep dust is bigger and lighter-toned per material, so it reads clearly against dark ground in every biome instead of blending in.",
        ptBR: "A poeira das pegadas ficou maior e com um tom mais claro por material, para aparecer claramente contra o chão escuro em todos os biomas em vez de se misturar com ele.",
      },
      {
        en: "Critical hits now visibly amplify reach and particle count on the same effect, not just a small size bump.",
        ptBR: "Acertos críticos agora amplificam visivelmente o alcance e a quantidade de partículas do mesmo efeito, não apenas um pequeno aumento de tamanho.",
      },
      {
        en: "Boss entrances add a brief ground-dust ring alongside the existing impact burst, so the arrival reads as a real landing without becoming a bigger, louder effect.",
        ptBR: "A entrada dos chefes ganhou um breve anel de poeira no chão junto ao impacto já existente, para a chegada parecer um pouso de verdade sem se tornar um efeito maior ou mais chamativo.",
      },
      {
        en: "Purely visual polish — no change to HP, damage, drops, Gold, Gems, waves, or any other gameplay value.",
        ptBR: "Polimento puramente visual — nenhuma mudança em HP, dano, drops, Gold, Gemas, ondas ou qualquer outro valor de gameplay.",
      },
    ],
  },
  {
    id: "v25",
    dateIso: "2026-09-17",
    category: "CONTENT",
    title: {
      en: "Creature Impact Overhaul — Every Hit and Death Now Reacts to What It's Made Of",
      ptBR: "Reformulação do Impacto das Criaturas — Todo Acerto e Morte Agora Reage ao Material da Criatura",
    },
    description: {
      en: "Getting hit, dying, and just walking now looks different depending on what a creature actually is. Crystal creatures spark and shatter into sharp shards; armored/stone creatures kick up dust and heavier debris; plant creatures disperse into drifting petals; charred creatures crumble into embers and ash; aquatic creatures burst into droplets with a ring of displaced water; everything else reacts with a softer, organic burst. Heavier creatures now leave a real footstep behind them as they walk — nothing for the lightest creatures, a noticeable ground impact for the heaviest and for mini-bosses and bosses — synced to their real walking speed the same way their animation already is. Bosses also get a small, controlled ground impact the instant they enter the map. None of this touches HP, damage, drops, or any other real game value — it's purely about making a hit and a kill feel like they actually happened to that specific creature.",
      ptBR: "Tomar um golpe, morrer e simplesmente andar agora parecem diferentes dependendo do que a criatura realmente é. Criaturas de cristal faíscam e se estilhaçam em fragmentos afiados; criaturas blindadas/de pedra levantam poeira e detritos mais pesados; criaturas vegetais se dispersam em pétalas flutuantes; criaturas carbonizadas desmoronam em brasas e cinzas; criaturas aquáticas explodem em gotas com um anel de água deslocada; todo o resto reage com um impacto orgânico mais suave. Criaturas mais pesadas agora deixam uma pegada real ao caminhar — quase nada para as criaturas mais leves, um impacto perceptível no chão para as mais pesadas e para mini-chefes e chefes, sincronizado com a velocidade real de caminhada do mesmo jeito que a animação já é. Chefes também ganham um pequeno impacto controlado no chão no instante em que entram no mapa. Nada disso toca em HP, dano, drops ou qualquer outro valor real do jogo — é puramente sobre fazer um acerto e uma morte parecerem que realmente aconteceram com aquela criatura específica.",
    },
    highlights: [
      {
        en: "Every creature and boss/mini-boss now has its own material identity (crystal, armored, plant, charred, organic, or aquatic) driving a distinct hit-impact and death particle effect — no more one shared burst recolored for everyone.",
        ptBR: "Toda criatura e mini-chefe/chefe agora tem sua própria identidade de material (cristal, blindado, vegetal, carbonizado, orgânico ou aquático) guiando um efeito distinto de impacto e morte — não é mais um único efeito compartilhado apenas recolorido para todos.",
      },
      {
        en: "New weight-based footstep system: light creatures leave almost no trace, heavier creatures kick up real dust (or a water ripple for aquatic ones), scaling up clearly for mini-bosses and bosses.",
        ptBR: "Novo sistema de pegadas baseado em peso: criaturas leves quase não deixam rastro, criaturas mais pesadas levantam poeira de verdade (ou uma ondulação na água para as aquáticas), aumentando claramente para mini-chefes e chefes.",
      },
      {
        en: "Critical hits now amplify the same material effect (more particles, a brief bright flash) instead of a separate, unrelated crit effect.",
        ptBR: "Acertos críticos agora amplificam o mesmo efeito do material (mais partículas, um breve clarão) em vez de um efeito de crítico separado e sem relação.",
      },
      {
        en: "Bosses get a small, controlled ground-impact burst at the instant they enter the map, alongside the existing entrance shake.",
        ptBR: "Chefes ganham um pequeno impacto controlado no chão no instante em que entram no mapa, junto com o tremor de entrada já existente.",
      },
      {
        en: "Purely visual work — no change to HP, damage, drops, Gold, Gems, waves, or any other gameplay value.",
        ptBR: "Trabalho puramente visual — nenhuma mudança em HP, dano, drops, Gold, Gemas, ondas ou qualquer outro valor de gameplay.",
      },
    ],
  },
  {
    id: "v24",
    dateIso: "2026-09-17",
    category: "CONTENT",
    title: {
      en: "Creatures Now Really Walk, Fly, and Fight — Full Movement Overhaul",
      ptBR: "As Criaturas Agora Realmente Andam, Voam e Lutam — Reformulação Completa do Movimento",
    },
    description: {
      en: "Every creature, mini-boss, and boss across all 10 biomes has been rebuilt to move like a living thing traveling the circuit instead of a picture sliding along a line. Legs alternate and push off the ground, wings actually beat and bank into turns, tails and heads follow a step behind the body on curves, and everything speeds up or slows down its own animation to match its real, current speed — a creature slowed to a crawl now looks like it's crawling instead of running in place. Bosses got their own unique way of moving (an Iron Burrower Sovereign digs forward with a body tremor, a Crystal Behemoth Prime stomps with its crystals swaying, a Leviathan Elder hauls itself with real amphibious weight), and taking damage now causes a brief, real recoil instead of just a screen flash. Deaths are no longer instant disappearances — creatures collapse, dissolve, or topple over depending on their kind, with bigger, more dramatic reactions for mini-bosses and bosses.",
      ptBR: "Toda criatura, mini-chefe e chefe dos 10 biomas foi reconstruída para se mover como algo vivo percorrendo o circuito, em vez de uma imagem deslizando por uma linha. As pernas se alternam e empurram o chão de verdade, as asas batem e inclinam o corpo nas curvas, a cauda e a cabeça acompanham o corpo com um leve atraso nas curvas, e a animação inteira acelera ou desacelera para bater com a velocidade real e atual da criatura — uma criatura lentificada até quase parar agora parece mesmo arrastando-se, em vez de continuar correndo no lugar. Os chefes ganharam seu próprio jeito único de se mover (o Perfurador de Ferro Soberano cava para frente com o corpo tremendo, o Behemoth de Cristal Primordial pisa pesado com os cristais balançando, o Leviatã Ancião se arrasta com peso anfíbio de verdade), e tomar dano agora causa um recuo breve e real em vez de só um clarão na tela. As mortes deixaram de ser um desaparecimento instantâneo — as criaturas caem, se dissolvem ou tombam dependendo do seu tipo, com reações maiores e mais dramáticas para mini-chefes e chefes.",
    },
    highlights: [
      {
        en: "All 30 regular creatures and every mini-boss/boss now use a real walking or flying cycle driven by their actual on-screen speed, not a fixed animation clock — curves are followed with a gradual, weighty turn instead of an instant snap.",
        ptBR: "As 30 criaturas comuns e todos os mini-chefes/chefes agora usam um ciclo real de caminhada ou voo guiado pela sua velocidade real na tela, não por um relógio de animação fixo — curvas são acompanhadas com uma virada gradual e com peso, em vez de um giro instantâneo.",
      },
      {
        en: "Flying creatures (Cloudfang, Sky Manta, Storm Talon, Void Bat, Cinderwing, Lunamoth, and the flying bosses) now bank into turns and beat their wings at a pace that matches how fast they're actually moving.",
        ptBR: "Criaturas voadoras (Garra-de-Nuvem, Arraia-do-Céu, Garra-da-Tempestade, Morcego do Vazio, Asa-de-Cinzas, Traça-Lunar e os chefes voadores) agora inclinam o corpo nas curvas e batem as asas num ritmo que bate com sua velocidade real.",
      },
      {
        en: "Every one of the 10 main bosses now has its own distinct way of moving (digging, dragging, prowling, stomping, slithering, and more) instead of reusing one generic walk animation.",
        ptBR: "Cada um dos 10 chefes principais agora tem seu próprio jeito distinto de se mover (cavando, arrastando, rondando, pisando pesado, deslizando e mais) em vez de reaproveitar uma única animação genérica de caminhada.",
      },
      {
        en: "New universal hit-reaction (recoil, compression, brief flash) plays on every creature type when it takes damage, and a proper death animation (collapse, dissolve, or topple) replaces the old instant vanish.",
        ptBR: "Uma nova reação de impacto universal (recuo, compressão, clarão breve) acontece em todo tipo de criatura ao tomar dano, e uma animação de morte de verdade (queda, dissolução ou tombo) substitui o antigo desaparecimento instantâneo.",
      },
      {
        en: "Purely visual work — no change to HP, damage, real movement speed, economy, drops, waves, or any other gameplay value.",
        ptBR: "Trabalho puramente visual — nenhuma mudança em HP, dano, velocidade real de movimento, economia, drops, ondas ou qualquer outro valor de gameplay.",
      },
    ],
  },
  {
    id: "v23",
    dateIso: "2026-09-16",
    category: "CONTENT",
    title: {
      en: "Premium Creature Art Pass — All 10 New Biomes Redrawn",
      ptBR: "Nova Arte Premium das Criaturas — Os 10 Novos Biomas Redesenhados",
    },
    description: {
      en: "The 30 creatures and 20 mini-boss/boss bodies added with the last 10 biomes have all been redrawn from scratch with real anatomy instead of simple shapes: layered materials (bone, stone, metal, crystal, hide, chitin, charred flesh, plant matter) that actually look different from each other, volumetric jointed limbs with visible knees and feet instead of straight lines, subtle idle breathing and swaying so nothing stands frozen, and a proper ground/flight presence (contact shadows for walkers, altitude bob and cast shadows for fliers). Every boss now clearly outgrows its own mini-boss with extra armor, horns, or growths — not just a bigger copy of the same drawing — and every creature was checked to still read correctly as a silhouette alone, so you can tell species apart by shape, not just color.",
      ptBR: "As 30 criaturas e os 20 corpos de mini-chefe/chefe adicionados com os últimos 10 biomas foram totalmente redesenhados com anatomia de verdade em vez de formas simples: materiais em camadas (osso, pedra, metal, cristal, pele, quitina, carne carbonizada, matéria vegetal) que realmente parecem diferentes entre si, membros articulados e volumétricos com joelhos e pés visíveis em vez de linhas retas, respiração e balanço sutis no estado parado para nada ficar congelado, e presença correta no chão ou no ar (sombra de contato para quem anda, oscilação de altitude e sombra projetada para quem voa). Todo chefe agora claramente supera seu próprio mini-chefe com armadura, chifres ou crescimentos extras — não é só uma cópia maior do mesmo desenho — e cada criatura foi conferida para continuar reconhecível só pela silhueta, então dá pra diferenciar as espécies pela forma, não só pela cor.",
    },
    highlights: [
      {
        en: "All 30 regular creatures across the 10 new biomes redrawn with real body parts (head, jaw, limbs, joints, tail, wings, plates, claws) matched to their biome's materials.",
        ptBR: "As 30 criaturas comuns dos 10 novos biomas foram redesenhadas com partes do corpo de verdade (cabeça, mandíbula, membros, articulações, cauda, asas, placas, garras) combinando com os materiais do seu bioma.",
      },
      {
        en: "All 10 mini-bosses and their matching main bosses got a second pass of extra anatomy, armor, or growths on the main boss so it visibly outranks its mini-boss instead of just being scaled up.",
        ptBR: "Os 10 mini-chefes e seus chefes principais correspondentes ganharam uma segunda camada de anatomia, armadura ou crescimentos extras no chefe principal, para que ele claramente supere seu mini-chefe em vez de ser apenas uma versão ampliada.",
      },
      {
        en: "Flying creatures (Gravewing, Storm Talon, Void Bat, Cinderwing, Lunamoth, Bell Wraith, and the flying bosses) now bob with altitude and cast a proper flight shadow.",
        ptBR: "Criaturas voadoras (Asa-Sepulcral, Garra-da-Tempestade, Morcego do Vazio, Asa-de-Cinzas, Traça-Lunar, Espectro do Sino e os chefes voadores) agora oscilam com a altitude e projetam uma sombra de voo de verdade.",
      },
      {
        en: "Fixed a bug where the 'New Enemy' discovery banner never actually auto-dismissed after its intended few seconds, so it could sit indefinitely over the enemy spawn point.",
        ptBR: "Corrigido um bug em que o banner de descoberta de 'Novo Inimigo' nunca fechava sozinho após os segundos previstos, podendo ficar indefinidamente sobre o ponto de surgimento dos inimigos.",
      },
      {
        en: "Purely visual work — no change to HP, damage, speed, drops, waves, Gold, Gems, Prestige, Mastery, or Specialization.",
        ptBR: "Trabalho puramente visual — nenhuma mudança em HP, dano, velocidade, drops, ondas, Gold, Gemas, Prestígio, Maestria ou Especialização.",
      },
    ],
  },
  {
    id: "v22",
    dateIso: "2026-09-16",
    category: "CONTENT",
    title: {
      en: "10 New Worlds — Dwarven Undercity, Floating Isles, Leviathan Coast, and More",
      ptBR: "10 Novos Mundos — Cidade Subterrânea dos Anões, Ilhas Flutuantes, Península dos Leviatãs e Mais",
    },
    description: {
      en: "The journey now keeps going well past the Abyss: 10 brand-new biomes (waves 131-330), each with its own scenery, lighting, and atmosphere, and each home to its own exclusive cast of creatures that never show up anywhere else — an abandoned dwarven mining city, a graveyard of ancient colossi, floating sky islands, a buried sun temple, a sea of giant crystal, a fortress built inside a bottomless chasm, an ash-covered wasteland, a nocturnal moonlit garden, a shattered gothic cathedral, and a rocky coast littered with leviathan bones. Every one of the 30 new creatures and 10 new mini-boss/boss pairs is a genuinely original design (new anatomy, new silhouette, new materials) — nothing here is a recolored or resized version of an existing enemy.",
      ptBR: "A jornada agora continua bem além do Abismo: 10 biomas totalmente novos (ondas 131-330), cada um com cenário, iluminação e atmosfera próprios, e cada um com seu próprio elenco exclusivo de criaturas que não aparecem em nenhum outro lugar — uma cidade mineradora anã abandonada, um cemitério de colossos antigos, ilhas celestes flutuantes, um templo solar soterrado, um mar de cristal gigante, uma fortaleza erguida dentro de um abismo sem fundo, um deserto de cinzas, um jardim noturno sob a lua, uma catedral gótica em ruínas e uma costa rochosa coberta de ossos de leviatãs. Cada uma das 30 novas criaturas e dos 10 novos pares de mini-chefe/chefe é um design genuinamente original (nova anatomia, nova silhueta, novos materiais) — nada aqui é uma versão recolorida ou redimensionada de um inimigo já existente.",
    },
    highlights: [
      {
        en: "10 new biomes with their own palette, lighting, and ambient particle effects (steam, ash, sea spray, luminous spores, and more), each with a distinct decoration set.",
        ptBR: "10 novos biomas com paleta, iluminação e efeitos de partículas ambientais próprios (vapor, cinzas, respingos do mar, esporos luminosos e mais), cada um com um conjunto de decorações distinto.",
      },
      {
        en: "30 new exclusive creatures (3 per biome) with hand-built anatomy and movement — including several true fliers with their own altitude bob and ground shadow.",
        ptBR: "30 novas criaturas exclusivas (3 por bioma) com anatomia e movimento próprios — incluindo diversos voadores de verdade, com seu próprio balanço de altitude e sombra no chão.",
      },
      {
        en: "10 new mini-bosses (Iron Burrower, Colossus Spawn, Aether Drake, Raithar, Crystal Behemoth, Abyssal Warden, Ashen Colossus, Moonroot Matriarch, Cathedral Abomination, Leviathan Spawn) and 10 matching main bosses — each biome's mini-boss and boss now share their own bespoke body instead of the generic Colossus look.",
        ptBR: "10 novos mini-chefes (Perfurador de Ferro, Cria do Colosso, Dragão do Éter, Raithar, Behemoth de Cristal, Guardião Abissal, Colosso Cinzento, Matriarca Raiz-da-Lua, Abominação da Catedral, Cria do Leviatã) e 10 chefes principais correspondentes — o mini-chefe e o chefe de cada bioma agora compartilham um corpo próprio, em vez do visual genérico do Colosso.",
      },
      {
        en: "Every new biome's mini-boss now always belongs to its own biome instead of the old global mini-boss rotation.",
        ptBR: "O mini-chefe de cada novo bioma agora sempre pertence ao seu próprio bioma, em vez da antiga rotação global de mini-chefes.",
      },
      {
        en: "No change to Gold, Gems, Prestige, Mastery, Specialization, or tower balance — this is new scenery and new enemies only.",
        ptBR: "Nenhuma mudança em Gold, Gemas, Prestígio, Maestria, Especialização ou balanceamento de torres — isto é apenas cenário e inimigos novos.",
      },
    ],
  },
  {
    id: "v21",
    dateIso: "2026-09-16",
    category: "SYSTEMS",
    title: {
      en: "Mastery Is Now Bought With Gold, Not Gems — Plus a Reworked Prestige",
      ptBR: "Maestria Agora é Comprada com Gold, Não Gemas — Além de um Prestígio Reformulado",
    },
    description: {
      en: "A clearer split for what each currency is for: Gold now buys and grows every bit of a tower's power, while Gems are reserved for access decisions and permanent Prestige. Tower Mastery — unlock included — is entirely Gold-funded now, and each tower's Mastery investment flavors its own signature strength a little (Ironwood leans harder into crit, Inferno into AoE and burn, Frostborn into slow and freeze, Stormcaller into chain lightning and armor penetration) instead of only ever adding flat damage. Prestige got a full pass too: its Gems cost curve is friendlier early on, Gem Shard income from boss and mini-boss kills is up, wave milestones now extend all the way to wave 500, and a handful of real milestone rewards (profile frames, a title, an exclusive tower skin, an exclusive castle skin) are now waiting at Prestige 10/20/30/50/75/100.",
      ptBR: "Uma divisão mais clara do papel de cada moeda: Gold agora compra e evolui todo o poder de uma torre, enquanto Gemas ficam reservadas para decisões de acesso e o Prestígio permanente. A Maestria de Torre — incluindo o desbloqueio — agora é totalmente financiada com Gold, e o investimento em Maestria de cada torre passa a reforçar um pouco a força de identidade dela (Ironwood aposta mais em crítico, Inferno em área e queimadura, Frostborn em lentidão e congelamento, Stormcaller em corrente elétrica e penetração de armadura) em vez de só somar dano puro. O Prestígio também recebeu uma revisão completa: a curva de custo em Gemas ficou mais amigável no início, o ganho de Gem Shards por chefes e mini-chefes aumentou, os marcos de onda agora vão até a onda 500, e um punhado de recompensas reais de marco (molduras de perfil, um título, uma skin de torre exclusiva, uma skin de castelo exclusiva) esperam agora no Prestígio 10/20/30/50/75/100.",
    },
    highlights: [
      {
        en: "Tower Mastery's one-time unlock is now Gold (no Gems spent anywhere in Mastery, ever); every level after that stays Gold too, exactly as before.",
        ptBR: "O desbloqueio único da Maestria de Torre agora é em Gold (nenhuma Gema é gasta em Maestria, em nenhum momento); todo nível seguinte continua em Gold, como antes.",
      },
      {
        en: "Specialization is untouched: path unlock still costs 500 Gems, switching paths still costs 200 Gems, and every level within a path stays Gold-funded.",
        ptBR: "Especialização não mudou: desbloquear um caminho ainda custa 500 Gemas, trocar de caminho ainda custa 200 Gemas, e todo nível dentro de um caminho continua sendo pago em Gold.",
      },
      {
        en: "Gem Shards from boss and mini-boss kills are up from 1 to 2 each, and the one-time wave-milestone bonus now extends out to wave 500 instead of stopping at 130.",
        ptBR: "Gem Shards de chefes e mini-chefes subiram de 1 para 2 cada, e o bônus único de marco de onda agora se estende até a onda 500 em vez de parar na 130.",
      },
      {
        en: "Prestige's next-level cost curve is gentler at low levels (Prestige 10 now costs 20 Gems instead of ~400) while staying a genuine long-term goal at high levels.",
        ptBR: "A curva de custo do próximo nível de Prestígio ficou mais suave nos níveis baixos (Prestígio 10 agora custa 20 Gemas em vez de ~400), mantendo-se uma meta real de longo prazo nos níveis altos.",
      },
      {
        en: "New permanent Prestige rewards: bronze/silver profile frames at 10/20, a title at 30, an exclusive Tower Skin at 50, a special effect at 75, and an exclusive Castle Skin plus the top title at 100.",
        ptBR: "Novas recompensas permanentes de Prestígio: molduras de perfil bronze/prata em 10/20, um título em 30, uma Skin de Torre exclusiva em 50, um efeito especial em 75, e uma Skin de Castelo exclusiva mais o título máximo em 100.",
      },
      {
        en: "The Prestige panel now also shows your current Gems, a progress bar toward the next level, and every milestone reward you've earned or are working toward.",
        ptBR: "O painel de Prestígio agora também mostra suas Gemas atuais, uma barra de progresso até o próximo nível, e cada recompensa de marco já conquistada ou em andamento.",
      },
    ],
  },
  {
    id: "v20",
    dateIso: "2026-09-16",
    category: "ITEMS",
    title: {
      en: "Crown of the Hollow King Gets Its Own Real Artwork",
      ptBR: "Coroa do Rei Oco Ganha Arte Própria Real",
    },
    description: {
      en: "The game's single Mythic item, Crown of the Hollow King, now shows its own real picture instead of the generic Amulet icon: a corrupted royal crown of dark, gothic spikes and ornamental filigree, cracked open at its front — the most elaborate item in the game, fitting the rarest drop in the game (0.10% drop weight). With this, every one of Hordenova's 4 fully-identified items (Mosswood Charm, Hollow Sigil, Warden's Eye, and now Crown of the Hollow King) has its own distinct visual identity everywhere it can appear: Inventory, tooltip, item details, and the Marketplace.",
      ptBR: "O único item Mítico do jogo, a Coroa do Rei Oco, agora mostra sua própria imagem real em vez do ícone genérico de Amuleto: uma coroa real corrompida, com espinhos góticos escuros e filigrana ornamental, rachada na frente — o item mais elaborado do jogo, à altura do drop mais raro do jogo (peso de 0.10% na drop table). Com isso, todos os 4 itens de HORDENOVA com identidade totalmente definida (Amuleto do Bosque Musgoso, Sigilo Oco, Olho do Guardião e agora a Coroa do Rei Oco) têm identidade visual própria em todo lugar onde podem aparecer: Inventário, tooltip, detalhes do item e Marketplace.",
    },
    highlights: [
      {
        en: "Fourth and final item, for now, to use the per-item art pipeline — no new code was needed, just the artwork itself.",
        ptBR: "Quarto e último item, por enquanto, a usar o pipeline de arte por item — não foi preciso nenhum código novo, só a arte em si.",
      },
      {
        en: "Rarity presentation (the colored border and glow) is still applied by the interface around the artwork, never baked into the picture itself.",
        ptBR: "A apresentação de raridade (borda e brilho coloridos) continua sendo aplicada pela interface ao redor da arte, nunca embutida na própria imagem.",
      },
      {
        en: "Nothing about the item's rarity, effect, drop chance, or tradability changed — purely a visual upgrade.",
        ptBR: "Nada sobre a raridade, efeito, chance de drop ou negociabilidade do item mudou — puramente uma melhoria visual.",
      },
    ],
  },
  {
    id: "v19",
    dateIso: "2026-09-16",
    category: "ITEMS",
    title: {
      en: "Warden's Eye Gets Its Own Real Artwork — All 3 Amulets Now Complete",
      ptBR: "Olho do Guardião Ganha Arte Própria Real — Os 3 Amuletos Agora Estão Completos",
    },
    description: {
      en: "Warden's Eye now shows its own real picture instead of the generic Amulet icon: an ornate relic built around a supernatural eye, set in dark engraved metal with an elaborate chain — the most striking of the three amulets, fitting its Legendary rarity. With this, all 3 confirmed amulets (Mosswood Charm, Hollow Sigil, Warden's Eye) now have a fully distinct visual identity everywhere they appear: Inventory, tooltip, item details, and the Marketplace.",
      ptBR: "O Olho do Guardião agora mostra sua própria imagem real em vez do ícone genérico de Amuleto: um relicário ornamentado construído em torno de um olho sobrenatural, cravado em metal escuro gravado com uma corrente elaborada — o mais impressionante dos três amuletos, à altura de sua raridade Lendária. Com isso, os 3 amuletos confirmados (Amuleto do Bosque Musgoso, Sigilo Oco, Olho do Guardião) agora têm identidade visual totalmente própria em todo lugar onde aparecem: Inventário, tooltip, detalhes do item e Marketplace.",
    },
    highlights: [
      {
        en: "Third and final confirmed amulet to use the per-item art pipeline — no new code was needed, just the artwork itself.",
        ptBR: "Terceiro e último amuleto confirmado a usar o pipeline de arte por item — não foi preciso nenhum código novo, só a arte em si.",
      },
      {
        en: "Rarity presentation (the colored border and glow) is still applied by the interface around the artwork, never baked into the picture itself.",
        ptBR: "A apresentação de raridade (borda e brilho coloridos) continua sendo aplicada pela interface ao redor da arte, nunca embutida na própria imagem.",
      },
      {
        en: "The game's single Mythic item, Crown of the Hollow King, is the next one still using a generic icon while its own artwork is prepared — nothing about its rarity, effects, or how it works has changed.",
        ptBR: "O único item Mítico do jogo, a Coroa do Rei Oco, é o próximo ainda usando um ícone genérico enquanto sua própria arte é preparada — nada sobre sua raridade, efeitos ou funcionamento mudou.",
      },
    ],
  },
  {
    id: "v18",
    dateIso: "2026-09-16",
    category: "ITEMS",
    title: {
      en: "Hollow Sigil Gets Its Own Real Artwork",
      ptBR: "Sigilo Oco Ganha Arte Própria Real",
    },
    description: {
      en: "Hollow Sigil now shows its own real picture instead of the generic Amulet icon: an aged black metal ring with a hollowed-out, vacant center and engraved ancient markings — visually distinct from Mosswood Charm's pendant, exactly as its sinister, hollow theme describes. The same picture now appears everywhere the item shows up: Inventory, its tooltip, the item details view, and the Marketplace.",
      ptBR: "O Sigilo Oco agora mostra sua própria imagem real em vez do ícone genérico de Amuleto: um anel de metal negro envelhecido com um centro vazio e oco, e marcações antigas gravadas — visualmente bem diferente do pingente do Amuleto do Bosque Musgoso, exatamente como seu tema sombrio e vazio sempre sugeriu. A mesma imagem agora aparece em todo lugar onde o item aparece: Inventário, tooltip, tela de detalhes do item e Marketplace.",
    },
    highlights: [
      {
        en: "Second item to use the per-item art pipeline introduced for Mosswood Charm — no new code was needed, just the artwork itself.",
        ptBR: "Segundo item a usar o pipeline de arte por item introduzido com o Amuleto do Bosque Musgoso — não foi preciso nenhum código novo, só a arte em si.",
      },
      {
        en: "Rarity presentation (the colored border and glow) is still applied by the interface around the artwork, never baked into the picture itself.",
        ptBR: "A apresentação de raridade (borda e brilho coloridos) continua sendo aplicada pela interface ao redor da arte, nunca embutida na própria imagem.",
      },
      {
        en: "Warden's Eye still uses the generic Amulet icon for now, until its own artwork is ready — nothing about its rarity, effects, or how it works has changed.",
        ptBR: "Olho do Guardião ainda usa o ícone genérico de Amuleto por enquanto, até que sua própria arte fique pronta — nada sobre sua raridade, efeitos ou funcionamento mudou.",
      },
    ],
  },
  {
    id: "v17",
    dateIso: "2026-09-16",
    category: "ITEMS",
    title: {
      en: "Mosswood Charm Gets Its Own Real Artwork",
      ptBR: "Amuleto do Bosque Musgoso Ganha Arte Própria Real",
    },
    description: {
      en: "Mosswood Charm is the first item in Hordenova to show a real, hand-crafted picture of itself instead of a generic category icon — an aged bronze pendant wrapped in moss around a glowing green core, exactly as its lore describes. The same picture now appears everywhere the item shows up: Inventory, its tooltip, the item details view, and the Marketplace.",
      ptBR: "O Amuleto do Bosque Musgoso é o primeiro item de HORDENOVA a mostrar uma imagem real e única de si mesmo, em vez de um ícone genérico de categoria — um pingente de bronze envelhecido, envolto em musgo, com um núcleo verde brilhante no centro, exatamente como sua descrição sempre disse. A mesma imagem agora aparece em todo lugar onde o item aparece: Inventário, tooltip, tela de detalhes do item e Marketplace.",
    },
    highlights: [
      {
        en: "New per-item art pipeline: each item can now carry its own unique picture, resolved through a single registry so it shows up correctly everywhere at once — no more separate wiring per screen.",
        ptBR: "Novo pipeline de arte por item: cada item agora pode ter sua própria imagem única, resolvida por um único registro, de forma que ela apareça corretamente em todo lugar de uma vez — sem precisar conectar tela por tela.",
      },
      {
        en: "Rarity presentation (the colored border and glow) is still applied by the interface around the artwork, never baked into the picture itself — so the same image reads correctly at every rarity treatment.",
        ptBR: "A apresentação de raridade (borda e brilho coloridos) continua sendo aplicada pela interface ao redor da arte, nunca embutida na própria imagem — então a mesma imagem funciona corretamente em qualquer tratamento de raridade.",
      },
      {
        en: "Hollow Sigil and Warden's Eye still use the generic Amulet icon for now, until their own artwork is ready — nothing about their rarity, effects, or how they work has changed.",
        ptBR: "Sigilo Oco e Olho do Guardião ainda usam o ícone genérico de Amuleto por enquanto, até que suas próprias artes fiquem prontas — nada sobre a raridade, efeitos ou funcionamento deles mudou.",
      },
    ],
  },
  {
    id: "v16",
    dateIso: "2026-09-15",
    category: "ITEMS",
    title: {
      en: "Amulets Are Now Real Items",
      ptBR: "Amuletos Agora São Itens Reais",
    },
    description: {
      en: "Mosswood Charm, Hollow Sigil, and Warden's Eye now have their own dedicated Amulet identity throughout the game instead of being lumped in with generic relics and artifacts: a proper icon, a rarity-colored border and glow, and a real hover tooltip everywhere an item can appear.",
      ptBR: "Amuleto do Bosque Musgoso, Sigilo Oco e Olho do Guardião agora têm identidade própria de Amuleto em todo o jogo, em vez de ficarem misturados com relíquias e artefatos genéricos: um ícone dedicado, borda e brilho na cor da raridade, e uma tooltip real ao passar o mouse em qualquer lugar onde um item apareça.",
    },
    highlights: [
      {
        en: "New hand-drawn Amulet icon (a cord loop over a faceted pendant) distinguishes amulets from every other item category at a glance — in the Inventory grid, the item details view, the boss-drop reward popup, tower equipment slots, and the Marketplace.",
        ptBR: "Novo ícone desenhado à mão para Amuleto (um laço de cordão sobre um pingente facetado) distingue amuletos de qualquer outra categoria à primeira vista — na grade do Inventário, na tela de detalhes do item, no popup de recompensa de drop de Boss, nos slots de equipamento das torres e no Marketplace.",
      },
      {
        en: "The Inventory now has a category filter row (All / Amulet / Material / etc.) that appears automatically once you own items from more than one category, so amulets are easy to find at a glance.",
        ptBR: "O Inventário agora tem uma linha de filtro por categoria (Todos / Amuleto / Material / etc.) que aparece automaticamente assim que você possui itens de mais de uma categoria, deixando os amuletos fáceis de encontrar.",
      },
      {
        en: "Hovering any item tile now shows an instant tooltip with its icon, name, rarity, type, description, real effects, and which Boss it drops from — no click required.",
        ptBR: "Passar o mouse sobre qualquer item agora mostra uma tooltip instantânea com ícone, nome, raridade, tipo, descrição, efeitos reais e de qual Boss ele cai — sem precisar clicar.",
      },
      {
        en: "Purely a presentation and categorization upgrade: no amulet's rarity, effect, drop rate, or tradability changed, and equipping/trading them works exactly as before.",
        ptBR: "Uma melhoria puramente de apresentação e categorização: nenhuma raridade, efeito, chance de drop ou negociabilidade de amuleto mudou, e equipar/negociar continua funcionando exatamente como antes.",
      },
    ],
  },
  {
    id: "v15",
    dateIso: "2026-09-15",
    category: "SYSTEMS",
    title: {
      en: "New: Marketplace — Player Auction House",
      ptBR: "Novo: Marketplace — Casa de Leilões",
    },
    description: {
      en: "A new Marketplace page joins Home/Season/Ranking/Wiki/Novidades in the top navigation: list a tradable item for auction, set your own minimum bid, choose a duration, and let bidding decide the real price. Anti-sniping protects a close finish, and every listed item is locked (unequippable, excluded from Fusion) until its auction ends.",
      ptBR: "Uma nova página de Marketplace se junta a Home/Season/Ranking/Wiki/Novidades na navegação superior: liste um item negociável em leilão, defina seu próprio lance mínimo, escolha uma duração, e deixe os lances decidirem o preço real. Anti-sniping protege um final disputado, e todo item listado fica bloqueado (não pode ser equipado nem entrar em Fusão) até o leilão encerrar.",
    },
    highlights: [
      {
        en: "Create Auction: pick a tradable item, set a minimum bid (never below a real, rarity-based floor), choose 12h/24h/48h/72h, and pay a small Gems listing fee — never refunded, even if nobody bids.",
        ptBR: "Criar Leilão: escolha um item negociável, defina um lance mínimo (nunca abaixo de um piso real baseado em raridade), escolha 12h/24h/48h/72h, e pague uma pequena taxa de listagem em Gemas — nunca devolvida, mesmo se ninguém der lance.",
      },
      {
        en: "Featured Auctions, filters (rarity/category), search, and sort (ending soon / highest / lowest / most contested / most recent) on the Browse tab; My Market tracks every listing you've ever created, permanently.",
        ptBR: "Leilões em Destaque, filtros (raridade/categoria), busca e ordenação (encerrando em breve / maior / menor / mais disputado / mais recente) na aba Explorar; Meu Mercado guarda permanentemente todos os leilões que você já criou.",
      },
      {
        en: "Item detail shows origin Boss, drop chance, bid history, and real Price History (average/median/lowest/highest) sourced only from sales that actually happened in your save — nothing invented.",
        ptBR: "O detalhe do item mostra o Boss de origem, chance de drop, histórico de lances e um Histórico de Preços real (média/mediana/menor/maior) baseado apenas em vendas que realmente aconteceram no seu save — nada inventado.",
      },
      {
        en: "Honest about today's limits: HORDENOVA has no live multiplayer server yet, so bidding uses a clearly labeled local demonstration identity — never a fabricated other player — while the underlying auction engine (bids, outbid handling, anti-sniping, atomic settlement) is fully real and server-ready.",
        ptBR: "Honesto sobre os limites de hoje: HORDENOVA ainda não tem um servidor multiplayer real, então os lances usam uma identidade de demonstração local claramente rotulada — nunca um jogador falso inventado — enquanto o motor de leilão por trás (lances, superação, anti-sniping, liquidação atômica) é totalmente real e pronto para um servidor.",
      },
    ],
  },
  {
    id: "v14",
    dateIso: "2026-09-15",
    category: "SYSTEMS",
    title: {
      en: "Automatic Changelog System",
      ptBR: "Sistema de Changelog Automático",
    },
    description: {
      en: "Rebuilt how Novidades works end to end: every update now reads like a real changelog entry (title, category, plain description, bullet highlights), and it is now standard practice for every validated change going forward to add its own entry here as part of finishing the work — no separate reminder needed.",
      ptBR: "Reconstruído o funcionamento da tela de Novidades de ponta a ponta: cada atualização agora aparece como uma entrada de changelog de verdade (título, categoria, descrição clara, destaques em tópicos), e agora é prática padrão que toda alteração validada adicione sua própria entrada aqui como parte da conclusão do trabalho — sem precisar de lembrete separado.",
    },
    highlights: [
      {
        en: "Each entry now shows a short title, a category, a plain-language description and a bullet list of what actually changed for the player — closer to a commercial game's patch notes than a flat list of one-line items.",
        ptBR: "Cada entrada agora mostra um título curto, uma categoria, uma descrição em linguagem clara e uma lista de tópicos com o que realmente mudou para o jogador — mais parecido com o changelog de um jogo comercial do que uma lista simples de itens de uma linha.",
      },
      {
        en: "All entry text (English and Portuguese) now lives in exactly one file (src/config/patchNotes.ts) — adding a new entry no longer means touching three separate files.",
        ptBR: "Todo o texto das entradas (inglês e português) agora vive em exatamente um arquivo (src/config/patchNotes.ts) — adicionar uma nova entrada não exige mais mexer em três arquivos separados.",
      },
      {
        en: "Several related changes from the same piece of work are grouped into ONE entry instead of many small ones, and nothing publishes until the work behind it is implemented, tested and validated.",
        ptBR: "Várias mudanças relacionadas vindas do mesmo trabalho são agrupadas em UMA entrada em vez de várias pequenas, e nada é publicado até que o trabalho por trás dela esteja implementado, testado e validado.",
      },
    ],
  },
  {
    id: "v13",
    dateIso: "2026-09-09",
    category: "BALANCE",
    title: {
      en: "Difficulty Tuning & Testing Tools",
      ptBR: "Ajuste de Dificuldade e Ferramentas de Teste",
    },
    description: {
      en: "Enemy difficulty now factors in a small, bounded read of your own account's real strength, and testers got a manual way to reset Season progress for a clean start.",
      ptBR: "A dificuldade dos inimigos agora leva em conta uma leitura pequena e limitada da força real da sua própria conta, e testadores ganharam uma forma manual de resetar a progressão da Season para um início limpo.",
    },
    highlights: [
      {
        en: "Normal and Elite enemy HP now factors in your account's real strength (Tower Levels, Mastery, active Specializations) on top of the usual per-wave curve — never touches Boss/Mini-Boss HP, never becomes a combat bonus, never affects rewards.",
        ptBR: "O HP dos inimigos normais e Elite agora leva em conta a força real da sua conta (Níveis de Torre, Maestria, Especializações ativas) além da curva normal por onda — nunca afeta HP de Boss/Mini-Boss, nunca vira bônus de combate, nunca afeta recompensas.",
      },
      {
        en: "Added a manual \"Reset Season Progress\" option on the Season screen for testers — zeroes Best Wave, current wave, Tower/Mastery/Specialization Levels and Gold. Gems, permanent unlocks, skins, achievements and Prestige are never touched, and it always asks for confirmation first.",
        ptBR: "Adicionada a opção manual \"Resetar Progressão da Season\" na tela de Season para testadores — zera Best Wave, wave atual, Níveis de Torre/Maestria/Especialização e Gold. Gems, desbloqueios permanentes, skins, conquistas e Prestígio nunca são afetados, e sempre pede confirmação antes.",
      },
    ],
  },
  {
    id: "v12",
    dateIso: "2026-09-09",
    category: "ITEMS",
    title: {
      en: "Equipment Slot Costs, Item Fusion & Phase Display",
      ptBR: "Custo dos Slots de Equipamento, Fusão de Itens e Exibição de Fase",
    },
    description: {
      en: "Equipment Slots got a real Gem cost, Item Fusion arrived in the Inventory, and the HUD now shows your progress as Phase/Wave for easier reading.",
      ptBR: "Os Slots de Equipamento ganharam um custo real em Gemas, a Fusão de Itens chegou ao Inventário, e o HUD agora mostra seu progresso como Fase/Onda para facilitar a leitura.",
    },
    highlights: [
      {
        en: "The HUD now shows progress as \"PHASE X — WAVE Y\" (waves 1-10 per Phase) as the primary readout, with the real global wave kept as secondary info — no change to any difficulty or reward formula.",
        ptBR: "O HUD agora mostra o progresso como \"FASE X — ONDA Y\" (ondas 1-10 por Fase) como informação principal, com a onda global real mantida como informação secundária — sem mudança em fórmula de dificuldade ou recompensa.",
      },
      {
        en: "Tower Equipment Slots now have a real unlock cost: Slot 1 stays free, Slot 2 costs 250 Gems, Slot 3 costs 500 Gems — a one-time, permanent purchase per tower type that a Season Reset never undoes.",
        ptBR: "Os Slots de Equipamento das torres agora têm um custo real de desbloqueio: o Slot 1 continua gratuito, o Slot 2 custa 250 Gemas, o Slot 3 custa 500 Gemas — uma compra única e permanente por tipo de torre que um Reset de Season nunca desfaz.",
      },
      {
        en: "Added Item Fusion to the Inventory: combine 3 items of the same rarity for a chance at 1 item of the next tier (40% at Common, dropping to 0.25% at Legendary). Failure destroys the 3 items with no compensation.",
        ptBR: "Adicionada a Fusão de Itens no Inventário: combine 3 itens da mesma raridade por uma chance de obter 1 item da raridade seguinte (40% em Comum, caindo até 0,25% em Lendário). A falha destrói os 3 itens sem compensação.",
      },
    ],
  },
  {
    id: "v11",
    dateIso: "2026-09-09",
    category: "BOSSES",
    title: {
      en: "Fix — Mini-Boss Enrage",
      ptBR: "Correção — Enfurecimento de Mini-Chefes",
    },
    description: {
      en: "Only Berserker-type Mini-Bosses could ever become Enraged. Every Mini-Boss now enrages below 30% HP, same as a Boss.",
      ptBR: "Apenas Mini-Chefes do tipo Berserker conseguiam entrar em Enfurecido. Agora todo Mini-Chefe entra em Enfurecido abaixo de 30% de HP, igual aos Chefes.",
    },
    highlights: [
      {
        en: "Every Mini-Boss now correctly gains the Enraged Shield too (20% damage reduction) the moment it enrages.",
        ptBR: "Todo Mini-Chefe agora recebe corretamente o Escudo do Enfurecido (20% de redução de dano) no momento em que entra em Enfurecido.",
      },
    ],
  },
  {
    id: "v10",
    dateIso: "2026-09-09",
    category: "BOSSES",
    title: {
      en: "New — Enraged Shield",
      ptBR: "Novo — Escudo do Enfurecido",
    },
    description: {
      en: "Bosses and Mini-Bosses now gain a defensive Shield while Enraged, with a clear visual that disappears the instant Enraged ends.",
      ptBR: "Chefes e Mini-Chefes agora recebem um Escudo defensivo enquanto Enfurecidos, com um efeito visual claro que desaparece assim que o Enfurecido termina.",
    },
    highlights: [
      {
        en: "Bosses take 30% less damage and Mini-Bosses take 20% less damage while Enraged — shown as a ring around the enemy plus a shield-tinted HP bar border.",
        ptBR: "Chefes recebem 30% menos dano e Mini-Chefes 20% menos dano enquanto Enfurecidos — mostrado com um anel ao redor do inimigo e uma borda especial na barra de vida.",
      },
    ],
  },
  {
    id: "v9",
    dateIso: "2026-09-08",
    category: "INTERFACE",
    title: {
      en: "Prestige Detail in Inventory",
      ptBR: "Detalhes de Prestígio no Inventário",
    },
    description: {
      en: "The Inventory's Stats tab now shows Prestige in full detail — current benefits, the next level's cost and gain, and a complete progression list.",
      ptBR: "A aba de Estatísticas do Inventário agora mostra o Prestígio em detalhe completo — benefícios atuais, custo e ganho do próximo nível, e uma lista completa de progressão.",
    },
    highlights: [
      {
        en: "All figures are computed live from the real system — no new bonuses or price changes.",
        ptBR: "Todos os valores são calculados ao vivo pelo sistema real — sem novos bônus ou mudanças de preço.",
      },
    ],
  },
  {
    id: "v8",
    dateIso: "2026-09-08",
    category: "BALANCE",
    title: {
      en: "Balance — Gem Shard Rate",
      ptBR: "Balanceamento — Taxa de Fragmentos de Gema",
    },
    description: {
      en: "Adjusted how many Gem Shards a Boss or Mini-Boss kill grants to a healthier long-term rate for an infinite game.",
      ptBR: "Ajustada a quantidade de Fragmentos de Gema concedida ao derrotar Chefes e Mini-Chefes para uma taxa mais saudável no longo prazo de um jogo infinito.",
    },
    highlights: [
      {
        en: "The conversion itself stays unchanged: 10 Shards = 1 Gem.",
        ptBR: "A conversão em si continua a mesma: 10 Fragmentos = 1 Gema.",
      },
    ],
  },
  {
    id: "v7",
    dateIso: "2026-09-08",
    category: "TOWERS",
    title: {
      en: "Balance — Ironwood Executioner",
      ptBR: "Balanceamento — Ironwood Executioner",
    },
    description: {
      en: "Another fine-tuning pass on the Ironwood Executioner path: its edge against bosses is now more in line with the other Ironwood paths.",
      ptBR: "Novo ajuste fino no caminho Executioner do Ironwood: sua vantagem contra chefes agora fica mais alinhada com os outros caminhos do Ironwood.",
    },
    highlights: [
      {
        en: "Keeps the Executioner's boss-specialist identity without trivializing boss fights (Breaker/Vanguard paths untouched).",
        ptBR: "Mantém a identidade de especialista em chefes do Executioner sem tornar as lutas contra chefes triviais (caminhos Breaker/Vanguard não foram alterados).",
      },
    ],
  },
  {
    id: "v6",
    dateIso: "2026-09-08",
    category: "TOWERS",
    title: {
      en: "Tower Repositioning, Equipment Slots & Fixes",
      ptBR: "Reposicionamento de Torres, Slots de Equipamento e Correções",
    },
    description: {
      en: "You can now move a built tower to a different spot, towers gained 3 Equipment Slots, castle damage now scales with wave progress, and a couple of bugs were fixed.",
      ptBR: "Agora é possível mover uma torre já construída para outro espaço, as torres ganharam 3 Slots de Equipamento, o dano ao castelo agora escala com o progresso das waves, e alguns bugs foram corrigidos.",
    },
    highlights: [
      {
        en: "Fixed \"Switch Specialization\" not appearing in a tower's info panel once you owned 2+ specialization paths for that tower type — the action always worked, it just wasn't showing up.",
        ptBR: "Corrigido \"Trocar Especialização\" não aparecendo no painel da torre quando você já possuía 2 ou mais caminhos de especialização para aquele tipo — a ação sempre funcionou, apenas não estava sendo exibida.",
      },
      {
        en: "Rebalanced the Ironwood Executioner's boss-damage bonus so it stops compounding without limit at very high specialization levels.",
        ptBR: "Rebalanceado o bônus de dano contra chefes do Executioner do Ironwood para parar de crescer sem limite em níveis de especialização muito altos.",
      },
      {
        en: "Castle damage from an enemy reaching your base is now a percentage of the Castle's own max HP (10% Normal / 25% Mini-Boss / 50% Boss) that grows smoothly with wave progression, instead of a fixed number.",
        ptBR: "O dano ao Castelo quando um inimigo alcança sua base agora é uma porcentagem do HP máximo do próprio Castelo (10% Normal / 25% Mini-Chefe / 50% Chefe) que cresce suavemente com o progresso das waves, em vez de um número fixo.",
      },
      {
        en: "You can now move an already-built tower to a different building spot — 1 free move per day, 200 Gems for additional moves the same day. Moving onto another tower's spot swaps the two.",
        ptBR: "Agora você pode mover uma torre já construída para outro espaço de construção — 1 movimento grátis por dia, 200 Gems para movimentos adicionais no mesmo dia. Mover para o espaço de outra torre troca as duas de lugar.",
      },
      {
        en: "Towers now have 3 Equipment Slots where you can equip items you already own — the foundation for future rare Boss-dropped gear. Equipping doesn't change combat power yet.",
        ptBR: "Torres agora têm 3 Slots de Equipamento onde você pode equipar itens que já possui — a base para futuros equipamentos raros dropados por chefes. Equipar ainda não altera o poder de combate.",
      },
    ],
  },
  {
    id: "v5",
    dateIso: "2026-09-05",
    category: "INTERFACE",
    title: {
      en: "Home Redesign, Ranking & Season Overview",
      ptBR: "Redesenho da Home, Ranking e Visão Geral da Season",
    },
    description: {
      en: "Home got a real top navigation bar with live teasers, a new Ranking screen arrived, the Season screen got richer, and a few fixes landed.",
      ptBR: "A Home ganhou uma navegação superior real com resumos ao vivo, uma nova tela de Ranking chegou, a tela de Season ficou mais rica, e algumas correções foram feitas.",
    },
    highlights: [
      {
        en: "Home now has a real top navigation bar (Play/Season/Ranking/Wiki/News) and a portal section below the hero with live Season, Ranking, Wiki and News teasers.",
        ptBR: "A Home agora tem uma navegação superior real (Jogar/Season/Ranking/Wiki/Novidades) e uma seção de portal abaixo do hero com resumos ao vivo de Season, Ranking, Wiki e Novidades.",
      },
      {
        en: "Added a dedicated Ranking screen showing your own Season Score and Prestige — honestly marked as unavailable without a server, never a fabricated leaderboard.",
        ptBR: "Adicionada uma tela de Ranking dedicada mostrando seu próprio Season Score e Prestígio — marcada honestamente como indisponível sem servidor, nunca um ranking fabricado.",
      },
      {
        en: "The Season screen now shows Season Score, Bosses Defeated, Best Phase, a season-progress bar, and your Prestige tier.",
        ptBR: "A tela de Season agora mostra Season Score, Chefes Derrotados, Melhor Fase, uma barra de progresso da season e seu tier de Prestígio.",
      },
      {
        en: "Rebuilt the Home ambient music with richer harmonics and fixed an audible click/pop when it stopped or was muted.",
        ptBR: "Reconstruído o pad ambiente da Home com harmônicos mais ricos e corrigido um clique/estalo audível ao parar ou mutar a música.",
      },
      {
        en: "Runner, Brute and Shieldbearer were rebuilt with real anatomy (jointed legs, arms, a head) instead of a bare triangle/ellipse/shield-polygon shape.",
        ptBR: "Runner, Brute e Shieldbearer foram reconstruídos com anatomia real (pernas articuladas, braços, cabeça) em vez de um triângulo/elipse/polígono de escudo genérico.",
      },
      {
        en: "Fixed the phase name showing as a raw, untranslated key during the post-wave-130 boss rotation.",
        ptBR: "Corrigido o nome da fase aparecendo como uma chave crua e não traduzida durante a rotação de chefes pós-wave-130.",
      },
    ],
  },
  {
    id: "v4",
    dateIso: "2026-09-04",
    category: "SYSTEMS",
    title: {
      en: "Home, Wiki, Novidades & Several Fixes",
      ptBR: "Home, Wiki, Novidades e Várias Correções",
    },
    description: {
      en: "Added a proper Home screen with a real Wiki built from the game's own data and this Novidades screen, plus a batch of bug fixes and small interface improvements.",
      ptBR: "Adicionada uma Home de verdade com uma Wiki real construída a partir dos dados do próprio jogo e esta tela de Novidades, além de um lote de correções de bugs e pequenas melhorias de interface.",
    },
    highlights: [
      {
        en: "The wave-milestone Roulette no longer grants its reward automatically — it now waits, visibly, until you actually spin it. Fixed Castle HP silently increasing without an actual Roulette win behind it.",
        ptBR: "A Roleta de marco de onda não concede mais sua recompensa automaticamente — agora ela espera, de forma visível, até você realmente girar. Corrigido o HP do Castelo aumentando silenciosamente sem uma vitória real na Roleta.",
      },
      {
        en: "The Gem Shard conversion button now correctly disables when you don't have enough Shards to convert.",
        ptBR: "O botão de conversão de Fragmentos de Gema agora desativa corretamente quando você não tem Fragmentos suficientes para converter.",
      },
      {
        en: "Bosses and Mini-Bosses can no longer be frozen or slowed indefinitely — crowd control now has real, tiered resistance that recovers over time.",
        ptBR: "Chefes e Mini-Chefes não podem mais ser congelados ou desacelerados indefinidamente — o controle de grupo agora tem uma resistência real e escalonada que se recupera com o tempo.",
      },
      {
        en: "Every enemy, including Elites and Mini-Bosses, now shows a real HP bar, and shows a distinct movement effect per archetype (dust, speed trail, wisp, trailing shadow).",
        ptBR: "Todo inimigo, incluindo Elites e Mini-Chefes, agora mostra uma barra de HP real, e mostra um efeito de movimento distinto por arquétipo (poeira, rastro de velocidade, névoa, sombra arrastada).",
      },
      {
        en: "Tower build slots can no longer overlap — a structural minimum-spacing rule now guarantees it.",
        ptBR: "As posições de construção de torres não podem mais se sobrepor — uma regra estrutural de espaçamento mínimo agora garante isso.",
      },
      {
        en: "Fixed a Regenerator Mini-Boss's healing being able to fully cancel out weak sustained fire, making its HP look permanently stuck.",
        ptBR: "Corrigido um Mini-Chefe Regenerador cuja cura conseguia cancelar completamente um fogo sustentado fraco, fazendo seu HP parecer permanentemente travado.",
      },
      {
        en: "Gems and Gem Shards are now shown as two clearly separate stats — a Gem Shard reward can no longer be misread as a Gem reward.",
        ptBR: "Gemas e Fragmentos de Gema agora são exibidos como duas estatísticas claramente separadas — uma recompensa de Fragmento não pode mais ser confundida com uma recompensa de Gema.",
      },
    ],
  },
  {
    id: "v3",
    dateIso: null,
    category: "SYSTEMS",
    title: {
      en: "Sound Effects, Attack VFX & Castle Skins",
      ptBR: "Efeitos Sonoros, VFX de Ataque e Skins de Castelo",
    },
    description: {
      en: "Added a full sound-effects system, rebuilt every tower's attack visuals into a real sequence, added cosmetic Castle Skins, and fixed a couple of long-standing bugs.",
      ptBR: "Adicionado um sistema completo de efeitos sonoros, reconstruído o visual de ataque de cada torre em uma sequência real, adicionadas Skins de Castelo cosméticas, e corrigidos alguns bugs antigos.",
    },
    highlights: [
      {
        en: "Added a full sound-effects system, with volume and mute controls.",
        ptBR: "Adicionado um sistema completo de efeitos sonoros, com controles de volume e mudo.",
      },
      {
        en: "Rebuilt each tower's attack visuals into a distinct anticipation/charge/impact sequence instead of one generic effect.",
        ptBR: "Reconstruído o visual de ataque de cada torre em uma sequência distinta de antecipação/carga/impacto, em vez de um efeito genérico único.",
      },
      {
        en: "Added Castle Skins — purely cosmetic, never affecting HP or combat.",
        ptBR: "Adicionadas Skins de Castelo — puramente cosméticas, nunca afetando HP ou combate.",
      },
      {
        en: "Fixed Gold piling up with nothing left to spend it on once towers were fully upgraded.",
        ptBR: "Corrigido o Ouro se acumulando sem nada mais para gastar após as torres serem totalmente melhoradas.",
      },
      {
        en: "Fixed Frostborn's Freeze effect being able to lock an enemy in place indefinitely under certain conditions.",
        ptBR: "Corrigido o efeito de Congelamento do Frostborn podendo travar um inimigo no lugar indefinidamente em certas condições.",
      },
    ],
  },
  {
    id: "v2",
    dateIso: null,
    category: "SYSTEMS",
    title: {
      en: "Persistent Progression, Items, Ascension & More",
      ptBR: "Progressão Persistente, Itens, Ascensão e Mais",
    },
    description: {
      en: "A major batch of systems shipped together: progression now persists between sessions, and Items, Boss/Mini-Boss encounters, Ascension Seasons and Tower Mastery all launched.",
      ptBR: "Um grande lote de sistemas chegou junto: a progressão agora persiste entre sessões, e Itens, encontros de Chefe/Mini-Chefe, Temporadas de Ascensão e Maestria de Torre foram lançados.",
    },
    highlights: [
      {
        en: "Tower levels and gold now persist across sessions instead of resetting on defeat.",
        ptBR: "Níveis de torre e ouro agora persistem entre sessões em vez de reiniciar na derrota.",
      },
      {
        en: "Added multiple phases/biomes, each with its own enemy archetypes.",
        ptBR: "Adicionadas múltiplas fases/biomas, cada uma com seus próprios arquétipos de inimigos.",
      },
      {
        en: "Added recurring Boss and Mini-Boss encounters with real ability sets.",
        ptBR: "Adicionados encontros recorrentes de Chefe e Mini-Chefe com conjuntos de habilidades reais.",
      },
      {
        en: "Added a full Item System: rarity tiers, real drop-chance tables, and an inventory.",
        ptBR: "Adicionado um Sistema de Itens completo: níveis de raridade, tabelas reais de chance de drop e um inventário.",
      },
      {
        en: "Added Ascension — a competitive, time-boxed season mode with permanent cosmetic rewards.",
        ptBR: "Adicionada a Ascensão — um modo de temporada competitivo e cronometrado com recompensas cosméticas permanentes.",
      },
      {
        en: "Added the wave-milestone Roulette reward, and Tower Mastery — ongoing tower progression past the level cap.",
        ptBR: "Adicionada a recompensa da Roleta de marco de onda, e a Maestria da Torre — progressão contínua da torre além do limite de nível.",
      },
      {
        en: "Added structured Gold and Gem sinks (Profile Prestige among them) and a unique Special Attack per tower type.",
        ptBR: "Adicionados sinks estruturados de Ouro e Gemas (incluindo o Prestígio de Perfil) e um Ataque Especial único para cada tipo de torre.",
      },
      {
        en: "Towers can now be damaged and temporarily disabled by boss siege attacks.",
        ptBR: "As torres agora podem ser danificadas e temporariamente desativadas por ataques de cerco de chefes.",
      },
    ],
  },
  {
    id: "v1",
    dateIso: null,
    category: "CONTENT",
    title: {
      en: "HORDENOVA Launch",
      ptBR: "Lançamento de HORDENOVA",
    },
    description: {
      en: "The first playable version of HORDENOVA shipped.",
      ptBR: "A primeira versão jogável de HORDENOVA foi lançada.",
    },
    highlights: [
      {
        en: "Launched with four towers: Ironwood, Inferno, Frostborn, and Stormcaller.",
        ptBR: "Lançado com quatro torres: Ironwood, Inferno, Frostborn e Stormcaller.",
      },
      {
        en: "Launched the core automatic wave-defense loop.",
        ptBR: "Lançado o loop principal de defesa automática por ondas.",
      },
      {
        en: "Added English / Português (Brasil) language selection.",
        ptBR: "Adicionada a seleção de idioma Inglês / Português (Brasil).",
      },
      {
        en: "Added the cinematic main menu.",
        ptBR: "Adicionado o menu principal cinematográfico.",
      },
    ],
  },
];
