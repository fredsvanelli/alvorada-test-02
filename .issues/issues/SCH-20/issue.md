---
id: SCH-20
title: Show an (x) to cancel when hovering an active Timeline bar
type: feature
status: done
priority: medium
estimate: 3
assignee: fred-vanelli
branch: sch-20-show-cancel-x-on-timeline-bar-hover
created: 2026-11-06T06:21:11.031Z
updated: 2026-11-06T07:28:14Z
---

## Description

### Context

A Timeline mostra cada reserva como uma barra, mas para cancelar uma reserva o usuário precisa encontrá-la na tabela Bookings e clicar em Cancel. Um (x) na própria barra deixa o cancelamento a um clique de onde a reserva aparece, sem mudar o que acontece depois: o mesmo modal de confirmação e o mesmo resultado.

### Scope (in)

- Ao passar o mouse sobre uma barra ativa da Timeline, além de esticar para revelar o label, mostrar um ícone (x) redondo dentro da barra azul, do lado direito
- Clicar no (x) abre o mesmo modal de confirmação do Cancel da tabela, com o mesmo texto e os mesmos botões
- Confirmar no modal cancela a reserva exatamente como o Cancel da tabela
- Atualizar os runbooks e os scripts dos fluxos afetados

### Out of scope

- Acesso ao (x) por teclado ou toque: o Cancel da tabela continua cobrindo esses casos
- (x) em barras canceladas
- Mudanças na API

### Tasks

- [ ] Mostrar o (x) nas barras ativas da Timeline ao passar o mouse
- [ ] Abrir o modal de cancelamento a partir do (x)
- [ ] Atualizar os runbooks da Timeline e do cancelamento

## Acceptance criteria

- [ ] Ao passar o mouse sobre uma barra ativa da Timeline, um ícone (x) redondo aparece dentro da barra azul, do lado direito, junto com o label completo
- [ ] Sem o mouse sobre a barra, o (x) não aparece
- [ ] Barras canceladas e barras com cancelamento em andamento não mostram o (x)
- [ ] Clicar no (x) abre o modal "Cancel booking <id>?" com o mesmo texto e os mesmos botões do Cancel da tabela
- [ ] "Keep booking" ou Escape fecham o modal sem enviar nada
- [ ] "Cancel booking" cancela a reserva como o Cancel da tabela: a barra e a linha passam a Canceled, e o cartão de resultado e o Operation log mostram o cancelamento
- [ ] O Cancel da tabela continua funcionando como antes
- [ ] Os runbooks dos fluxos afetados descrevem o novo comportamento e passam
