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
    wave: "ONDA",
    baseHp: "VIDA DA BASE",
    gold: "OURO",
    state: "ESTADO",
    phase: {
      PRE_RUN: "PRÉ-JOGO",
      RUNNING: "EM ANDAMENTO",
      WAVE_TRANSITION: "ONDA CONCLUÍDA",
      DEFEAT: "FORTALEZA CAÍDA",
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
};
