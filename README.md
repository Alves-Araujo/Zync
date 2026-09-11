# Zync — Pomodoro & Study Timer

O timer Pomodoro definitivo para foco e estudo. Feito com React 19 + TypeScript + Vite.

## Destaques

- **Relógio analógico 3D** — ponteiros que "desenrolam" em tempo real (animação por `requestAnimationFrame`), anel de progresso que esvazia ao longo da fase e leve parallax 3D acompanhando o cursor.
- **Ciclos granulares** — defina foco e pausa por ciclo, com presets (Clássico, Longo, Sprint, Deep work).
- **Estatísticas de estudo** — foco acumulado no dia, ciclos, sequência de dias e recorde diário, persistidos em `localStorage`.
- **Atalhos de teclado** — `espaço` play/pause, `S` pular fase, `R` reiniciar.
- **Contagem na aba** — o tempo restante aparece no título do navegador.
- **Tema claro/escuro** automático e suporte a `prefers-reduced-motion`.

## Scripts

```bash
npm run dev      # servidor de desenvolvimento
npm run build    # type-check + build de produção
npm run lint     # oxlint
npm run preview  # pré-visualização do build
```

## Estrutura

| Arquivo | Papel |
| --- | --- |
| `src/hooks/useTimer.ts` | máquina de estados do Pomodoro (fases, ciclos, alertas) |
| `src/hooks/useStudyStats.ts` | estatísticas diárias e all-time em `localStorage` |
| `src/components/AnalogClock.tsx` | relógio analógico 3D + anel de progresso |
| `src/components/AmbientBackground.tsx` | aurora animada, grid e partículas |
| `src/components/NumberStepper.tsx` | input numérico temático (substitui o spinner nativo) |
