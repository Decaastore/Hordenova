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
