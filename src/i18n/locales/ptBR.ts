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
      role: "Alvo Único / Crítico",
      description: "Alto dano em um único alvo, com chance de acerto crítico.",
    },
    INFERNO: {
      name: "Inferno",
      role: "Dano em Área / Queimadura",
      description: "Dano em área de curto-médio alcance que queima tudo que atinge.",
    },
    FROSTBORN: {
      name: "Frostborn",
      role: "Lentidão / Controle de Grupo",
      description: "Dano moderado; cada acerto desacelera o alvo.",
    },
    STORMCALLER: {
      name: "Stormcaller",
      role: "Longo Alcance / Dano em Cadeia",
      description: "Raio de longo alcance que salta para inimigos próximos; ataca lentamente.",
    },
  },
  towerInfo: {
    level: "Nível {level} / {max}",
    damage: "Dano",
    attackSpeed: "Velocidade de Ataque",
    range: "Alcance",
    special: "Especial",
    maxLevel: "NÍVEL MÁXIMO",
    upgrade: "MELHORAR",
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
  },
  progressionStopped: {
    title: "PROGRESSÃO INTERROMPIDA",
    phaseFailed: "FASE {phase} — FALHOU",
    whyDidILose: "POR QUE EU PERDI?",
    howCanIImprove: "COMO POSSO MELHORAR?",
    statDamage: "Dano",
    recommendationLine: "{tower} Nív.{from} → {to} (+{percent}% {stat})",
    recommendationBuildNew: "Construa um(a) {tower} — nenhum na sua construção atual",
    reasons: {
      fastEnemiesLeaked: "Inimigos rápidos (Corredores) chegaram à base antes que suas torres pudessem derrotá-los.",
      highResistance: "Grande parte dos seus ataques atingiu inimigos fortemente blindados e causou dano reduzido.",
      bossSurvived: "O chefe sobreviveu com vida restante quando sua base caiu.",
      overwhelmedByNumbers: "Muitos inimigos chegaram à base ao mesmo tempo — sua defesa não cobriu o volume.",
      tankyEnemiesLeaked: "Inimigos de alta vida (Brutos/Escudeiros) romperam sua defesa.",
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
