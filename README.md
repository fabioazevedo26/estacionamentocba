# EstacionamentoCBA

Sistema web de controle de acesso de veículos ao estacionamento do CBA. Substitui a
planilha Excel (Motorista, Cargo, Carro/Modelo, Placa, Entrada, Saída) e é usado pelos
porteiros no computador da guarita, pelo navegador, na rede local. Funciona **sem
internet**: Bootstrap e os ícones são servidos pelo próprio sistema.

## Funcionalidades

- **Portaria** (tela inicial): busca por placa ou nome enquanto digita, card do veículo
  (verde = liberado, vermelho = bloqueado), registro de entrada/saída com a hora atual
  (editável), troca de motorista ou novo visitante, **cadastro rápido** para placa nova e
  as últimas 10 movimentações do dia.
- **Pedestres**: entrada e saída de pessoas a pé (colaborador cadastrado ou novo
  visitante), lista de quem está no CBA agora com botão de saída, histórico com correção
  de horário e exportação para Excel. Pessoa bloqueada não pode entrar.
- **Estacionamento**: veículos dentro do estacionamento, com permanência e botão de saída.
  Linhas em amarelo depois de `HORA_FIM_DIA` e em vermelho para entradas de dias
  anteriores sem saída. Contador no menu em todas as telas.
- **Pessoas** e **Veículos**: cadastro, edição, filtros, bloqueio com motivo,
  inativação, exclusão (somente sem movimentações) e histórico.
- **Movimentações**: lista completa com paginação e correção de horário (exige motivo).
- **Relatórios**: filtros por período, pessoa, placa, tipo, cargo, setor, empresa e
  "somente sem saída", com totais e **exportação para Excel** (.xlsx com aba "Resumo").
- **Auditoria**: todas as criações, edições, bloqueios, exclusões, entradas, saídas,
  correções e logins.
- **Backup** diário automático às 23:30 e botão "Baixar backup agora".

### Atalhos na tela da portaria

| Tecla | Ação |
|---|---|
| `Enter` na busca | seleciona o primeiro resultado (ou abre o cadastro rápido se a placa não existe) |
| `↑` / `↓` | navegam pelos resultados |
| `Enter` depois de selecionar | confirma a entrada ou a saída (o botão já fica em foco) |
| `Esc` | limpa a tela e volta para a busca |
| `F2` | leva o cursor para a busca (também filtra a lista no Estacionamento) |

### Identidade visual e acessibilidade

O visual segue o design gerado no Stitch (`stitch_estacionamento_cba_guarita/`, apenas
referência; o sistema não usa esses arquivos): logo do CBA no login e na barra superior,
turquesa escuro `#0B6E6E` como cor principal (o turquesa claro da logo só aparece na
própria logo), fontes **Atkinson Hyperlegible Next** e **JetBrains Mono** servidas
localmente, texto base de 18px, botões de no mínimo 48px, foco do teclado sempre visível,
status sempre com ícone + texto e placas desenhadas como Mercosul (faixa azul) ou padrão
antigo (cinza). O **modo noturno** é ativado no menu do usuário ou na tela de login e fica
salvo no navegador daquele computador.

Arquivos da logo em `public/img/`: `logo-cba.png` (colorida, login), `logo-cba-branco.png`
(barra superior) e `favicon.png`.

## Tecnologias

Node.js 22, Express 5, EJS, Bootstrap 5 (local), SQLite (better-sqlite3, modo WAL),
express-session (sessões no SQLite), bcrypt, helmet, CSRF, rate limit no login,
exceljs, node-cron, Docker e Docker Compose.

---

## Configuração (`.env`)

Copie `.env.example` para `.env` e preencha:

| Variável | Exemplo | Descrição |
|---|---|---|
| `PERMITIR_TROCA_SENHA` | `false` | Mostra e permite a troca de senha pela interface. Com `false` (padrão), só o administrador troca a senha, pela linha de comando. |
| `PORT` | `3001` | Porta da aplicação (a 3000 já é usada por outro sistema na VM). |
| `TZ` | `America/Manaus` | Fuso usado para gravar e exibir todas as datas e horas. |
| `SESSION_SECRET` | *(longo e aleatório)* | Segredo das sessões. Gere com `openssl rand -hex 32`. |
| `ADMIN_USER` | `Portaria2` | Usuário criado na primeira execução. |
| `ADMIN_PASSWORD` | *(senha forte)* | Usada **somente** na primeira execução, quando ainda não há usuários. É gravada como hash bcrypt. Depois, troque a senha pela interface. |
| `HORA_FIM_DIA` | `18:00` | A partir desse horário, veículos ainda no estacionamento ficam destacados. |
| `BACKUP_RETENCAO_DIAS` | `30` | Quantos dias de backups manter em `data/backups`. |

> Se `SESSION_SECRET` ficar vazio, o sistema funciona, mas todos precisam fazer login
> de novo sempre que ele reiniciar.

---

## Deploy na VM Ubuntu

Pré-requisito: Docker e o plugin Docker Compose já instalados na VM.

### 1. Repositório no GitHub e token só de leitura

1. Crie o repositório **`estacionamentocba`** no GitHub (pode ser privado) e envie o código:
   ```bash
   git init && git add . && git commit -m "EstacionamentoCBA"
   git branch -M main
   git remote add origin https://github.com/<usuario>/estacionamentocba.git
   git push -u origin main
   ```
2. Crie um token para a VM em **GitHub → Settings → Developer settings → Personal access
   tokens → Fine-grained tokens → Generate new token**:
   - *Repository access*: **Only select repositories** → `estacionamentocba`
   - *Permissions → Repository permissions → Contents*: **Read-only**
   - Guarde o token: ele só aparece uma vez.

### 2. Instalação na VM

```bash
git clone https://github.com/<usuario>/estacionamentocba.git ~/Projeto_EstacionamentoCBA
```

Quando o Git pedir as credenciais, use o seu **usuário do GitHub** e, como senha, **o
token**. Para não precisar digitá-lo a cada `git pull`, rode uma vez dentro da pasta:
`git config credential.helper store` (o token fica salvo em `~/.git-credentials`, legível
só pelo seu usuário).

```bash
cd ~/Projeto_EstacionamentoCBA && cp .env.example .env && nano .env
```

No `nano`, preencha pelo menos `SESSION_SECRET` (gere com `openssl rand -hex 32`) e
`ADMIN_PASSWORD`. Salve com `Ctrl+O`, `Enter` e saia com `Ctrl+X`.

Crie a pasta de dados com o dono certo (o container roda como usuário não-root de UID 1000):

```bash
mkdir -p data && sudo chown 1000:1000 data
```

Suba o sistema:

```bash
docker compose up --build -d
```

Confira se está saudável (a coluna STATUS deve mostrar `healthy` depois de alguns segundos):

```bash
docker compose ps
```

### 3. Liberar a porta no firewall

```bash
sudo ufw allow 3001/tcp
```

### 4. Acessar

No computador da guarita, abra **http://IP_DA_VM:3001** e entre com `ADMIN_USER` e
`ADMIN_PASSWORD`. Para descobrir o IP da VM: `hostname -I`.

Dica: crie um atalho/favorito no navegador da guarita e deixe-o configurado em português
(os campos de data e hora seguem o idioma do navegador).

### 5. Atualizar para uma nova versão

```bash
cd ~/Projeto_EstacionamentoCBA && git pull && docker compose up --build -d
```

As migrações do banco rodam sozinhas ao iniciar. Os dados em `./data` são preservados.
Antes de atualizar, por segurança, baixe um backup (menu do usuário → **Baixar backup agora**).

Se o `git pull` reclamar de alterações locais (arquivos editados direto na VM), veja o que
mudou com `git status` e descarte a alteração com `git checkout -- caminho/do/arquivo`
antes de repetir o `git pull`. Configurações ficam no `.env`, que o git não toca.

### 6. Reinstalar levando o banco atual

1. Na instalação atual: menu do usuário → **Baixar backup agora** (ou copie
   `data/estacionamento.db` com o sistema parado: `docker compose down`).
2. Na nova instalação, antes do primeiro `docker compose up`: crie a pasta `data`, copie o
   arquivo para `data/estacionamento.db` e acerte o dono:
   ```bash
   mkdir -p data && cp ~/estacionamento_backup.db data/estacionamento.db && sudo chown -R 1000:1000 data
   ```
3. Suba com `docker compose up --build -d`. As tabelas novas (por exemplo, a de pedestres)
   são criadas automaticamente e os dados existentes continuam iguais.

### Comandos úteis

| O quê | Comando |
|---|---|
| Ver logs | `docker compose logs -f` |
| Reiniciar | `docker compose restart` |
| Parar | `docker compose down` |
| Situação/saúde | `docker compose ps` |

---

## Troca de senha

- **Pela interface:** fica **desativada por padrão**, para que a equipe da portaria não
  troque a senha e o acesso se perca. Para liberar, coloque `PERMITIR_TROCA_SENHA=true` no
  `.env` e rode `docker compose up -d`; aparece "Trocar senha" no menu do usuário.
- **Pelo administrador (recomendado) ou senha esquecida:** na VM, rode:
  ```bash
  docker compose exec estacionamento node scripts/redefinir-senha.js Portaria2 'NovaSenhaForte'
  ```
  Todas as sessões abertas são encerradas. Alterar `ADMIN_PASSWORD` no `.env` **não**
  troca a senha de um usuário que já existe.

---

## Backup e restauração

### Backups automáticos

- Todo dia às **23:30** (fuso de `TZ`) o sistema cria uma cópia consistente do banco em
  `data/backups/estacionamento_AAAA-MM-DD_HH-MM-SS.db`, sem precisar parar.
- São mantidos os últimos `BACKUP_RETENCAO_DIAS` dias; os mais antigos são apagados.
- Na interface, menu do usuário → **Baixar backup agora** gera e baixa um backup na hora.
  Em **Backups** há a lista dos arquivos existentes para baixar.

> Os backups ficam na mesma VM. Copie-os periodicamente para outro lugar, por exemplo
> baixando pela interface ou com `scp usuario@IP_DA_VM:~/Projeto_EstacionamentoCBA/data/backups/*.db .`

### Restaurar um backup

```bash
cd ~/Projeto_EstacionamentoCBA
docker compose down
```

Guarde o banco atual, por segurança:

```bash
mv data/estacionamento.db data/estacionamento.db.antes-da-restauracao
```

Remova os arquivos temporários do modo WAL:

```bash
rm -f data/estacionamento.db-wal data/estacionamento.db-shm
```

Copie o backup escolhido (troque o nome do arquivo):

```bash
cp data/backups/estacionamento_2026-01-31_23-30-00.db data/estacionamento.db
```

Acerte o dono e suba de novo:

```bash
sudo chown 1000:1000 data/estacionamento.db && docker compose up -d
```

Para restaurar um arquivo baixado pela interface, copie-o para a VM (por exemplo com
`scp`) e use-o no lugar do arquivo de `data/backups` no comando `cp` acima.

---

## Desenvolvimento local (sem Docker)

```bash
npm install
cp .env.example .env    # preencha SESSION_SECRET e ADMIN_PASSWORD
npm run dev             # http://localhost:3001 (reinicia ao salvar arquivos)
```

### Dados de exemplo (opcional)

```bash
npm run seed
```

Insere pessoas, veículos e movimentações dos últimos dias. **Nunca roda sozinho** e não
faz nada se já houver pessoas cadastradas (para forçar: `npm run seed -- --forcar`).
No Docker: `docker compose exec estacionamento node scripts/seed.js`.

### Atualizar Bootstrap

Os arquivos de `public/vendor` (Bootstrap, ícones e fontes) fazem parte do repositório
(o sistema não usa CDN). Para atualizá-los: `npm install` e depois `npm run vendor`.

---

## Regras de negócio

- **Placa**: gravada em maiúsculas, sem hífen nem espaços. Aceita o padrão antigo
  (ABC1234, exibida ABC-1234) e o Mercosul (ABC1D23). Para carretas, placas estrangeiras
  etc., marque **"placa fora do padrão"**.
- Um veículo só pode ter **uma movimentação em aberto** (garantido também por um índice
  único no banco). A saída precisa ser posterior à entrada, e as movimentações de um
  veículo não podem se sobrepor no tempo.
- **Bloqueado** (pessoa ou veículo): alerta vermelho com o motivo, e a entrada é impedida.
- **Inativo**: some das buscas da portaria, mas continua nos relatórios.
- **Excluir**: só é possível sem movimentações; caso contrário o sistema explica e
  sugere **Inativar**. Sempre pede confirmação.
- O motorista pode ser diferente do proprietário. Um veículo tem no máximo um
  proprietário; uma pessoa pode ter vários veículos.
- **Pedestres** ficam numa tabela própria (`acessos_pedestres`): uma pessoa só pode ter
  um acesso a pé em aberto, a saída precisa ser posterior à entrada, e pessoa bloqueada não
  entra. Os relatórios de veículos não mudam; os pedestres têm histórico e Excel próprios.
- Toda alteração relevante gera um registro na **Auditoria**, com os dados antes e depois.

## Estrutura do projeto

```
├── Dockerfile · docker-compose.yml · .env.example
├── scripts/            seed.js, redefinir-senha.js, copy-vendor.js
├── public/             css/, js/ (portaria, relatórios, comum), vendor/ (Bootstrap local)
├── data/               banco SQLite e backups (fora do git e da imagem)
└── src/
    ├── server.js       inicialização (migrações, usuário inicial, agendamento do backup)
    ├── app.js          Express, segurança, sessão e rotas
    ├── db/             conexão, migrações versionadas, store de sessões
    ├── middleware/     login obrigatório, CSRF, mensagens flash, variáveis das views
    ├── services/       regras de negócio (pessoas, veículos, movimentações, relatórios, Excel, backup…)
    ├── routes/         rotas HTTP de cada tela e a API JSON da busca
    ├── utils/          datas/fuso, placa, paginação
    └── views/          telas EJS
```

### Banco de dados

| Tabela | Conteúdo |
|---|---|
| `usuarios` | usuários do sistema (senha em hash bcrypt) |
| `sessoes` | sessões de login |
| `pessoas` | colaboradores e visitantes |
| `opcoes` | listas de cargo e setor (crescem com "Outro (digitar)") |
| `veiculos` | veículos, com proprietário opcional |
| `movimentacoes` | entradas e saídas de veículos (`saida_em` vazio = no estacionamento) |
| `acessos_pedestres` | entradas e saídas a pé (`saida_em` vazio = no CBA) |
| `auditoria` | histórico de ações |
| `migracoes` | migrações já aplicadas |

As datas são gravadas como texto `AAAA-MM-DD HH:MM:SS` no fuso de `TZ`. Novas migrações
vão em `src/db/migrations/NNN_descricao.js` (exportando `up(db)`) e rodam
automaticamente ao iniciar.

## Solução de problemas

- **`SQLITE_CANTOPEN` / permissão negada em `data/`**: rode
  `sudo chown -R 1000:1000 data` e `docker compose up -d`.
- **Porta 3001 ocupada**: altere `PORT` no `.env` **e** o mapeamento de portas no
  `docker-compose.yml`.
- **"Formulário expirado"**: a sessão expirou (12 h sem uso) ou a página ficou aberta de
  uma versão antiga. Recarregue a página.
- **"Muitas tentativas de login"**: depois de 10 senhas erradas, o login fica bloqueado por
  15 minutos para aquele computador.
