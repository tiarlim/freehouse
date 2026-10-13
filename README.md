# Freehouse

## Versao conectada, 12/10/2026

O produto tem uma versao com login e banco compartilhado. Na workspace original, execute `npm run dev` e abra `http://localhost:4187`. Use localhost, que e a origem configurada. A configuracao privada fica em `../../work/freehouse-runtime/.env`, fora do diretorio publico e ignorada pelo Git. Nenhuma credencial do banco e incluida no pacote de publicacao.

Em um checkout independente, configure `DATABASE_URL` e `NEON_AUTH_BASE_URL` no ambiente, instale as dependencias com `npm ci --include=dev`, execute `npm run build` e depois `npm start`. Se utilizar um arquivo `.env` privado, inicie com `node --env-file=.env app-server.mjs`. `.env.example` lista somente exemplos de valores; nao permite acesso ao ambiente existente.

`npm run build` compila o cliente de autenticacao. `npm run migrate:dev` aplica o schema de desenvolvimento e adiciona exemplos sem sobrescrever os dados existentes. Dependencias ficam fixadas pelo arquivo de lock. O runtime e Node.js 24.

Cadastro, entrada, saida e restauracao da sessao usam o SDK oficial do Neon. A API verifica assinatura, emissor, destinatario e expiracao do token. O proxy de autenticacao usa cookies HttpOnly na mesma origem. O cliente nao recebe credenciais do banco.

Cada anfitriao cadastra seu lugar. A propriedade e verificada no servidor para alterar experiencias, recomendacoes, consultar interessados e moderar planos. Perfis privados de outros usuarios nao sao incluidos na resposta publica. Os planos do mural sao publicos, incluindo nome do autor. Os exemplos iniciais nao podem ser assumidos por uma conta.

O roteiro, interesses, perfil, estadia, agenda e planos ficam no banco. A versao conectada nao importa automaticamente perfis ou atividades do armazenamento local anterior. Nao ha pagamentos ou reservas confirmadas. A recuperacao de senha esta integrada, mas sua entrega por email ainda nao foi verificada ponta a ponta.

Teste compartilhado: `node work/freehouse-connected-test.cjs` a partir da raiz da workspace. Usa contas ficticias em dominio reservado e deixa lugares/experiencias marcados como teste no ambiente de desenvolvimento. Verifica dois contextos independentes de navegador, recusas de acesso indevido e telas de 320 a 1440 pixels.

Documentacao de referencia: https://neon.com/docs/auth/guides/plugins/jwt e https://neon.com/docs/auth/quick-start/react. O SDK instalado e 0.5.0-beta. A obtencao de JWT usa X-Force-Fetch, suportado no SDK instalado, para evitar que o cache de sessao substitua a resposta de token.

## Publicacao online preparada

`render.yaml` descreve um unico servico Node no plano Free, regiao Ohio, reutilizando o banco Neon existente. O repositorio de destino e `https://github.com/tiarlim/freehouse`, branch `main`. Em 13/10/2026, o usuario autorizou manter o codigo publico e publicar a demonstracao no workspace My Workspace. Este arquivo nao cria recursos por si so.

O servidor usa `PORT` e escuta todas as interfaces quando executado no Render. A origem publica vem automaticamente de `RENDER_EXTERNAL_URL`. Nao copie o `APP_ORIGIN=http://localhost:4187` do ambiente local para a hospedagem. Para um dominio proprio, configure `APP_ORIGIN` com a origem HTTPS exata, sem caminho ou barra final.

Passos da publicacao:

1. Enviar somente o pacote sem credenciais para `tiarlim/freehouse`, mantendo a visibilidade publica autorizada. Criar o servico Free no workspace My Workspace.
2. Executar o build `npm ci --include=dev && npm run build` e iniciar com `npm start`.
3. Informar `DATABASE_URL` e `NEON_AUTH_BASE_URL` como variaveis privadas do servico. Nao incluir o arquivo `.env` no Git nem no upload.
4. Cadastrar a origem HTTPS realmente fornecida pelo Render nos dominios confiaveis do Neon Auth. Nao autorizar curingas.
5. Conferir `/api/health`, entrada, persistencia do roteiro em dois dispositivos e QR code com a URL publicada.
6. Verificar recuperacao de conta com um email autorizado antes de convidar participantes reais.

As migrations sao manuais (`npm run migrate` com variaveis de ambiente configuradas). O schema atual ja foi aplicado ao ambiente de desenvolvimento. O build nao altera o banco nem reinicia dados. Uma nova base requer executar a migration antes de atender usuarios.

O servico gratuito e adequado para demonstracao tecnica, nao para operacao comercial. Pode suspender apos 15 minutos sem acessos e levar cerca de um minuto para retomar. Limites de uso continuam aplicaveis. Fonte: https://render.com/docs/free, consultada em 12/10/2026.

Nao adicionar pagamentos, reservas garantidas ou conteudo privado por hospedagem nesta etapa. Recuperacao por email, exclusao de conta e regras de uso precisam estar resolvidas antes de abrir o piloto para publico real.

## Demo local anterior

Abrir `index.html` diretamente inicia a demo local anterior, sem autenticacao real nem banco compartilhado. O servidor estatico antigo permanece na workspace original, mas nao faz parte do pacote de publicacao. Para a versao conectada, use o servidor descrito acima.

Os dados usam a chave `freehouse-demo-v2` no armazenamento do navegador. Perfis locais nao sao login real. Trocar o endereco ou navegador muda o armazenamento. Lugares e precos sao exemplos ficticios, fotos sao ilustrativas.

Hospede: crie um perfil local, abra um lugar, vincule uma estadia, salve atividades, marque interesse e publique planos. Anfitriao: crie outro perfil local, publique uma experiencia, altere recomendacoes e consulte os interesses. Os dois perfis compartilham os dados da demo na mesma origem.

As inscricoes representam interesse. Nao ha reserva de vaga, pagamento nem compartilhamento de dados entre dispositivos. Os contadores representam uso local e aberturas de pagina, nao visitantes unicos.

QR code: informe o endereco publicado para uso em outros dispositivos. Um link em localhost funciona apenas no computador local.

## Dependencias e imagens

`lucide.min.js`: icones Lucide, licenca ISC. Copia da dependencia incluida no runtime.

`qrcode.js`: qrcode-generator 1.4.4, Kazuhiko Arase, licenca MIT. Fonte: https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js

Fotos da demo anterior, agora incluidas localmente:

- surf: https://images.unsplash.com/photo-1502680390469-be75c86b636f
- jantar: https://images.unsplash.com/photo-1528605248644-14dd04022da1
- workspace: https://images.unsplash.com/photo-1497366754035-f200968a6e72
- praia: https://images.unsplash.com/photo-1507525428034-b723cf961d3e
- casa: https://images.unsplash.com/photo-1518005020951-eccb494ad742
- hostel: https://images.unsplash.com/photo-1520250497591-112f2f40a3f4

## Verificacao

`work/freehouse-test.cjs` verifica regras de negocio e jornadas com Playwright e Chrome instalado. O script usa a porta 4186 e contextos de navegador descartaveis, sem mudar os dados do navegador do usuario. Imagens e screenshots de teste ficam em `work/qa/`.
