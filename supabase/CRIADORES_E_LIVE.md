# Criadores e Recompensas da Live — o que fazer no dia de ligar o servidor

O que já funciona sem servidor:

- Página **Criadores** (rodapé da Home) com as regras, os ganhos e o botão de inscrição (abre o Suporte já preenchido).
- **Código de criador na Loja** e o link do criador (`https://hordenova.vercel.app/?criador=CODIGO`): o jogador ganha o Estandarte e a Moldura do Apoiador no Duelo, e o código fica na conta para as compras.
- Os códigos aprovados ficam em `src/config/creators.ts` (lista `CREATORS`). Para aprovar um criador antes do servidor, é só pedir para adicionar o código dele ali.

O que liga com o servidor (Supabase):

1. Rodar no SQL Editor, nesta ordem: `0001_init.sql`, `0002_support_tickets.sql`, `0003_creators_and_live.sql`.
2. Colocar o seu e-mail em `support_admins` (está explicado no topo do `0002`). É com ele que você aprova criadores e lê as inscrições.
3. Na Vercel, as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Os criadores passam a ser aprovados na tabela `creators` (status `APPROVED`); o site passa a ler a lista de lá.

Recompensas da Live (Twitch):

1. Criar o app do HORDE NOVA em https://dev.twitch.tv/console/apps e anotar o Client ID e o Client Secret.
2. No Supabase → Authentication → Providers, ligar a **Twitch** com esse Client ID/Secret (é assim que o jogador vincula a Twitch dele).
3. Publicar as funções `supabase/functions/live-watch` e `supabase/functions/creator-connect`, com os segredos: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `HORDENOVA_TWITCH_GAME_ID` (id da categoria HORDE NOVA na Twitch), `CRON_SECRET` (senha longa) e `SITE_URL`.
4. Agendar a `live-watch` a cada 5 minutos, enviando o cabeçalho `x-cron-secret`.
5. Cada criador aprovado conecta a Twitch dele uma vez pelo link explicado no topo de `creator-connect/index.ts`.
6. Ligar `LIVE_REWARDS_ENABLED = true` em `src/config/liveRewards.ts`: a seção aparece na página Criadores e os visuais da Live aparecem na loja do Duelo.

Pagamento dos criadores: quando as compras com dinheiro abrirem, o servidor de pagamento grava cada compra com código em `creator_sales`; a visão `creator_monthly_sales` mostra o total do mês por criador para o pagamento.
