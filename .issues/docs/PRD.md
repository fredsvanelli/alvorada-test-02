# Caso 02 — Reservas sem conflito

Queremos conhecer seu jeito de resolver problemas. Neste desafio, você vai construir uma solução pequena, mostrar como ela funciona e conversar conosco sobre as decisões que tomou.

## O desafio

Uma equipe compartilha salas ou equipamentos. Crie um sistema que responda se um recurso pode ser reservado em determinado período e permita cancelar uma reserva.

A solução pode ser um calendário, app, API, biblioteca ou aplicação de terminal.

## Como deve funcionar

Comece com uma lista fixa de recursos. Uma reserva tem `id`, `recurso`, `inicio` e `fim`, com o início anterior ao fim. Use números para representar o tempo, sem precisar lidar com calendário ou fuso horário.

Uma reserva de 10 a 20 ocupa o período a partir de 10, mas libera o recurso exatamente em 20. Por isso, outra reserva pode começar em 20. Essa regra também pode ser escrita como `[inicio, fim)`. A restrição de sobreposição vale para reservas ativas do mesmo recurso, então recursos diferentes podem ser reservados no mesmo horário.

Se o recurso não existir, os dados forem inválidos ou o horário estiver ocupado, explique o problema sem criar a reserva. Uma tentativa rejeitada não ocupa o identificador. Já o identificador de uma reserva criada não pode ser reutilizado, mesmo depois do cancelamento.

Cancelar uma reserva libera seu horário. Se ela já estiver cancelada, retorne `ja_cancelada` sem mudar nada. Se não existir, informe o erro.

Também deve ser possível consultar um período sem reservar. Para um recurso e intervalo válidos, informe se está disponível e quais reservas ativas conflitam, em ordem crescente de identificador. A consulta não muda os dados.

Permita consultar as reservas e saber quais estão ativas ou canceladas. Tudo pode funcionar em memória, com uma operação por vez. Não precisa implementar pagamento, reservas recorrentes, autenticação ou acesso simultâneo.

## Um exemplo

Considere os recursos R1 e R2 e faça as seguintes reservas:

| Reserva | Recurso | Período | Resultado |

|---|---|---|---|

| A | R1 | `[10,20)` | Aceita. |

| B | R1 | `[20,30)` | Aceita: começa quando A termina. |

| C | R1 | `[19,21)` | Recusada: conflita com A e B. |

| C | R2 | `[19,21)` | Aceita: a tentativa anterior não ocupou o identificador C. |

Consultar R1 para `[19,21)` deve mostrar os conflitos A e B. Depois de cancelar A, R1 fica disponível em `[10,20)`, mas o identificador A continua ocupado.

## Como organizar seu tempo

Nossa sugestão é dedicar até quatro horas à implementação, aos testes e à documentação. Se não conseguir terminar tudo nesse tempo, envie o que fez e conte o que ficou pendente. O objetivo é ter uma solução pequena que sirva de ponto de partida para nossa conversa.

## Ferramentas e uso de IA

Use a linguagem e as ferramentas com que se sente mais à vontade. A solução pode ser uma interface, API, aplicação de terminal, biblioteca com exemplo executável ou simulador. Escolha a forma que melhor combina com seu foco, seja front, mobile, back, arquitetura, algoritmos ou dados.

As regras do desafio valem para qualquer abordagem, mas você tem liberdade para decidir como organizar e apresentar a solução. Não é necessário publicar a aplicação, pagar por serviços ou usar hardware. Se depender de um serviço externo, ofereça uma forma local de demonstrar o funcionamento.

Pode usar IA, documentação e bibliotecas. Conte como essas ferramentas ajudaram, o que você aproveitou ou mudou e como conferiu o resultado. Não precisamos do histórico de conversas com a IA, pois queremos conhecer suas decisões e a maneira como você verificou o código.

## O que entregar

A entrega tem duas partes:

- **Um repositório Git com o código, os testes e a documentação da solução.** O README deve explicar como instalar o que for necessário, executar a aplicação e rodar os testes. Inclua uma demonstração que possamos reproduzir, suas principais decisões e o que ficou pendente.

- **Um vídeo de até 30 minutos explicando a solução.** Mostre a aplicação funcionando, percorra os trechos de código mais importantes e conte por que escolheu essa abordagem.

### Repositório e documentação

Crie o repositório no serviço de sua preferência. No README, informe o nome ou número do caso, o foco escolhido e quanto tempo você dedicou ao trabalho. Quem clonar o projeto deve conseguir acompanhar a demonstração com as instruções que você deixou.

Ao explicar os testes, destaque até três situações que ajudem a entender sua solução, como um valor no limite de uma regra, a interação entre duas regras ou uma entrada inválida. Conte o resultado esperado e que tipo de erro cada teste ajuda a encontrar. Você pode escrever outros testes, sem precisar atingir um percentual de cobertura.

Conte também duas decisões que tomou durante o trabalho, explicando o que queria conferir, como investigou e o que concluiu. Uma delas pode ser sobre uma sugestão da IA, se você a usou. Essas notas podem ficar no próprio README e não precisam seguir um formulário.

Use dados fictícios e deixe de fora credenciais, dados pessoais reais e código de empregadores. A quantidade de commits não conta na avaliação.

### Vídeo explicando a solução

A gravação deve nos ajudar a acompanhar seu raciocínio. Escolha um cenário diferente do exemplo deste documento, explique o resultado que espera e execute a solução para compará-lo com o que aconteceu. Mostre também um teste importante e o trecho de código que ele ajuda a conferir.

Ao percorrer o projeto, conte por que escolheu uma abordagem, que alternativa considerou e onde a solução tem limites. Se algo não funcionou, vale mostrar como investigou.

Não precisa mostrar o rosto, criar slides, editar a gravação ou repetir seu currículo. Use o tempo para explicar o trabalho, incluindo como verificou as sugestões da IA, quando houver. Se precisar de outro formato de apresentação, converse com a pessoa que acompanha seu processo.

## Como enviar

Quando estiver pronto, responda pelo mesmo canal em que recebeu o convite, compartilhando:

- O link do repositório e o hash completo do commit que devemos avaliar.

- O link do vídeo, que também pode ficar no README.

- O nome ou número do caso, o foco escolhido e o tempo aproximado utilizado.

- Alguma observação necessária para executar a solução, se houver.

O repositório pode ser privado. Nesse caso, peça à pessoa responsável os usuários que devem receber acesso de leitura. Confira também se conseguimos abrir o vídeo, sem enviar senhas ou tokens. Vamos confirmar o recebimento e o acesso aos arquivos.

O commit identifica o código entregue. Se continuar trabalhando e quiser incluir uma mudança na avaliação, basta avisar e enviar o novo hash. Você também pode corrigir links, permissões e instruções de execução depois do envio.