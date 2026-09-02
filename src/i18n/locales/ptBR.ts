import type { TranslationSchema } from "./en";

/**
 * Português (Brasil) — kept structurally identical to `en` (the
 * `TranslationSchema` annotation below makes a missing/extra key a type
 * error, not a silent runtime fallback).
 */
export const ptBR: TranslationSchema = {
  language: {
    selectorLabel: "Idioma",
    en: "English",
    ptBR: "Português (Brasil)",
  },
  menu: {
    subtitle: "CONSTRUA. EVOLUA. SOBREVIVA.",
    play: "ENFRENTAR A HORDA",
    bestWave: "MELHOR ONDA",
  },
  hud: {
    wave: "FASE",
    baseHp: "VIDA DA BASE",
    gold: "OURO",
    state: "ESTADO",
    phase: {
      PRE_RUN: "PRÉ-JOGO",
      OFFLINE_RETURN: "BEM-VINDO DE VOLTA",
      RUNNING: "EM ANDAMENTO",
      WAVE_TRANSITION: "ONDA CONCLUÍDA",
      BOSS_INTRO: "CHEFE SE APROXIMA",
      BOSS_BATTLE: "BATALHA CONTRA O CHEFE",
      VICTORY: "VITÓRIA",
      PROGRESSION_STOPPED: "PROGRESSÃO INTERROMPIDA",
    },
  },
  towers: {
    IRONWOOD: {
      name: "Ironwood",
      role: "Alvo Único / Crítico / Dano em Chefes",
      description: "Alto dano em rajada em um único alvo, com chance de crítico. Ganha projéteis extras e um bônus contra chefes conforme evolui — a torre certa quando o chefe não morre.",
    },
    INFERNO: {
      name: "Inferno",
      role: "Dano em Área / Queimadura Sustentada",
      description: "Dano em área que incendeia tudo que atinge. A queimadura acumula em níveis mais altos — ideal para quando muitos inimigos se acumulam de uma vez.",
    },
    FROSTBORN: {
      name: "Frostborn",
      role: "Lentidão / Controle de Grupo / Congelamento",
      description: "Cada acerto desacelera o alvo, e níveis mais altos adicionam chance de congelá-lo completamente. A resposta para quando inimigos rápidos escapam.",
    },
    STORMCALLER: {
      name: "Stormcaller",
      role: "Mágico / Dano em Cadeia / Penetração de Armadura",
      description: "Raio arcano de longo alcance que salta entre inimigos e, em níveis mais altos, atravessa armaduras. Continua funcionando quando inimigos blindados ignoram tudo o mais.",
    },
  },
  towerInfo: {
    level: "Nível {level} / {max}",
    damage: "Dano",
    attackSpeed: "Velocidade de Ataque",
    range: "Alcance",
    special: "Especialização",
    maxLevel: "NÍVEL MÁXIMO",
    upgrade: "MELHORAR",
    goodAgainst: "Eficaz contra",
    nextLevel: "PRÓXIMO NÍVEL",
    cost: "Custo",
    unlockBanner: "DESBLOQUEIO NÍVEL {level}",
    specialLines: {
      IRONWOOD: {
        critChance: "Chance de Crítico",
        critMultiplier: "Dano Crítico",
        bossDamageMultiplier: "Dano em Chefes",
        locked: "Desbloqueia no Nív.{level}",
      },
      INFERNO: {
        burnDamagePerSecond: "Queimadura (DPS)",
        aoeRadius: "Raio de Área",
        burnMaxStacks: "Acúmulos de Queimadura",
      },
      FROSTBORN: {
        slowPercent: "Lentidão",
        freezeChance: "Chance de Congelar",
      },
      STORMCALLER: {
        chainTargets: "Alvos em Cadeia",
        armorPenetration: "Penetração de Armadura",
      },
    },
    unlocks: {
      multiShot: { name: "MULTI-TIRO", description: "Dispara um 2º projétil em um alvo próximo a cada ataque." },
      giantSlayer: { name: "MATADOR DE GIGANTES", description: "Causa dano extra contra chefes e mini-chefes." },
      tripleShot: { name: "TRIPLO TIRO", description: "Dispara um 3º projétil em um alvo próximo a cada ataque." },
      wildfire: { name: "FOGO SELVAGEM", description: "A queimadura agora pode acumular, causando dano cumulativo ao longo do tempo." },
      infernoCore: { name: "NÚCLEO DO INFERNO", description: "A queimadura pode acumular uma 3ª vez para ainda mais dano sustentado." },
      deepFreeze: { name: "CONGELAMENTO PROFUNDO", description: "Chance no acerto de paralisar completamente o alvo por um instante." },
      permafrost: { name: "PERMAFROST", description: "O Congelamento Profundo se torna significativamente mais provável." },
      arcaneSurge: { name: "SURTO ARCANO", description: "Os acertos agora ignoram parte da armadura do alvo." },
      stormBreaker: { name: "QUEBRA-TEMPESTADE", description: "A penetração de armadura aumenta ainda mais." },
    },
  },
  defeat: {
    title: "FORTALEZA CAÍDA",
    waveReached: "Onda Alcançada",
    enemiesDefeated: "Inimigos Derrotados",
    bestWave: "Melhor Onda",
    tryAgain: "TENTAR NOVAMENTE",
    mainMenu: "MENU PRINCIPAL",
  },
  boss: {
    introLine: "{name} se aproxima",
    getReady: "Prepare suas defesas",
    defeatedLine: "{name} derrotado",
    rewardLine: "+{amount} Ouro",
    enraged: "ENFURECIDO",
  },
  progressionStopped: {
    title: "PROGRESSÃO INTERROMPIDA",
    phaseFailed: "FASE {phase} — FALHOU",
    whyDidILose: "POR QUE EU PERDI?",
    howCanIImprove: "COMO POSSO MELHORAR?",
    statDamage: "Dano",
    recommendationLine: "{tower} Nív.{from} → {to} (+{percent}% {stat})",
    recommendationBuildNew: "Você ainda não tem um(a) {tower} — considere construir um(a)",
    reasons: {
      fastEnemiesLeaked: "Inimigos rápidos (Corredores) chegaram à base antes que suas torres pudessem derrotá-los.",
      highResistance: "Grande parte dos seus ataques atingiu inimigos fortemente blindados e causou dano reduzido.",
      bossSurvived: "O chefe sobreviveu com vida restante quando sua base caiu.",
      overwhelmedByNumbers: "Muitos inimigos chegaram à base ao mesmo tempo — sua defesa não cobriu o volume.",
      tankyEnemiesLeaked: "Inimigos de alta vida (Brutos) romperam sua defesa.",
      armoredEnemiesLeaked: "Inimigos blindados (Escudeiros) resistiram ao seu dano e chegaram à base.",
      lowDps: "Seu dano geral está baixo demais para os inimigos desta fase.",
    },
    continueBuilding: "MELHORAR TORRES",
    retry: "TENTAR NOVAMENTE",
    boostComingSoon: "IMPULSO — EM BREVE",
    mainMenu: "MENU PRINCIPAL",
  },
  offlineReturn: {
    title: "BEM-VINDO DE VOLTA",
    subtitle: "Enquanto você esteve fora...",
    phasesCleared: "+{count} Fases",
    miniBossesCleared: "+{count} Mini-Chefes",
    bossesCleared: "+{count} Chefes",
    resourcesEarned: "+{count} Ouro",
    currentProgression: "PROGRESSÃO ATUAL",
    phaseLabel: "Fase {phase}",
    continueButton: "CONTINUAR",
  },
};
