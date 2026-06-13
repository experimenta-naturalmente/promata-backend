# 🚀 Deploy com Docker Compose - Guia Completo (VPS Hostinger)

Este guia explica como fazer deploy do backend em uma VPS (Hostinger) usando Docker Compose, com PostgreSQL rodando em container (sem depender de serviços AWS).

## 📋 Arquivos Envolvidos

- **`docker-compose.prod.yml`** - Configuração do Docker Compose com PostgreSQL + Backend
- **`.github/workflows/ci-cd.yml`** - Workflow CI/CD que builda a imagem e faz deploy via SSH

## 🎯 Fluxo de Deploy

```
Seu PC → git push origin main
    ↓
GitHub Actions (CI/CD) → Build & Testes
    ↓
Push imagem ao Docker Hub
    ↓
SSH na VPS → docker compose pull & up
    ↓
✅ API + PostgreSQL rodando
```

## 🔧 Setup Inicial (Uma Única Vez)

### 1. Acessar a VPS

```bash
ssh root@SEU_IP_DA_VPS
```

O IP da VPS fica no hPanel da Hostinger → **VPS** → seu servidor → aba **Visão Geral** (IPv4 Address).

### 2. Instalar Docker e Docker Compose

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Chave GPG oficial do Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Repositório oficial do Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Iniciar e habilitar Docker
sudo systemctl enable docker --now

# Permitir rodar docker sem sudo (faça logout/login depois)
sudo usermod -aG docker $USER
```

> ⚠️ O comando é `docker compose` (sem hífen), pois usamos o plugin oficial — não o binário antigo `docker-compose`.

### 3. Configurar Firewall (UFW)

Não existe "Security Group" como na AWS — use o `ufw`:

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 3000/tcp    # API
sudo ufw enable
```

A porta **5432 (Postgres) NÃO deve ser exposta** externamente — o `docker-compose.prod.yml` já cuida disso via rede interna `promata_prod`. Se o compose mapear `5432:5432`, considere remover esse mapeamento de portas em produção.

### 4. Gerar Chave SSH para o GitHub Actions

Na sua máquina **local**:

```bash
ssh-keygen -t ed25519 -C "deploy-promata" -f ~/.ssh/promata_deploy
```

Copie a chave pública para a VPS:

```bash
ssh-copy-id -i ~/.ssh/promata_deploy.pub root@SEU_IP_DA_VPS
```

Teste a conexão:

```bash
ssh -i ~/.ssh/promata_deploy root@SEU_IP_DA_VPS "docker ps"
```

> 🔒 Recomendado: desabilitar login por senha em `/etc/ssh/sshd_config` (`PasswordAuthentication no`) e reiniciar com `sudo systemctl restart sshd`.

### 5. Clonar o Repositório na VPS

```bash
mkdir -p ~/promata-backend
cd ~/promata-backend
git clone https://github.com/SEU_USER/promata.git .
```

> Se o repositório for **privado**, use um Personal Access Token:
> `git clone https://SEU_TOKEN@github.com/SEU_USER/promata.git .`

Teste se o compose está válido:

```bash
docker compose -f docker-compose.prod.yml config > /dev/null && echo "OK"
```

### 6. Adicionar GitHub Secrets

**GitHub → Settings → Secrets and variables → Actions → New repository secret**

```
PROD_EC2_HOST           = IP da VPS
PROD_EC2_USER           = root
PROD_EC2_SSH_KEY        = (conteúdo completo da chave privada ~/.ssh/promata_deploy)

PROD_DB_PASSWORD        = SenhaForte123!@# (escolha uma, ex: openssl rand -base64 32)
PROD_JWT_SECRET         = sua-secret-jwt (ex: openssl rand -hex 32)

AWS_ACCESS_KEY_ID       = (deixe em branco se não usar S3)
AWS_SECRET_ACCESS_KEY   = (deixe em branco se não usar S3)
PROD_AWS_S3_BUCKET      = (deixe em branco se não usar S3)

MAIL_HOST              = seu-smtp-host (ex: smtp.gmail.com)
MAIL_PORT              = 587
MAIL_USER              = seu-email@gmail.com
MAIL_PASS              = sua-senha-app
MAIL_FROM              = noreply@seu-dominio.com
MAIL_FROM_NAME         = Seu App

FRONTEND_URL           = http://seu-frontend.com

DOCKER_PASSWORD        = token-docker-hub
```

> Os nomes dos secrets mantêm o prefixo `PROD_EC2_*` por compatibilidade com o workflow existente — não é necessário renomear, apenas trocar os **valores** para os dados da VPS.

**Variables** (não são secretas):

```
AWS_REGION             = us-east-1 (ou deixe um valor qualquer se não usar S3)
DOCKER_USERNAME        = seu-usuario-docker-hub
```

## 🚀 Como Fazer Deploy

### Opção 1: Deploy Automático (Recomendado)

```bash
# Na sua máquina local
cd ~/promata/backend

# Fazer mudanças no código...
git add .
git commit -m "Nova feature"

# Push para main = deploy automático
git push origin main

# Acompanhar em: GitHub → Actions
```

### Opção 2: Deploy Manual

```bash
ssh root@SEU_IP_DA_VPS

cd ~/promata-backend
git pull origin main

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml down
docker compose --env-file .env -f docker-compose.prod.yml up -d

# Ver logs
docker compose -f docker-compose.prod.yml logs -f backend
```

## 🔍 Monitorar Deploy

### Via GitHub Actions
1. GitHub → **Actions**
2. Clique no workflow em execução
3. Veja logs em tempo real

### Via VPS

```bash
ssh root@SEU_IP_DA_VPS

# Ver containers rodando
docker ps

# Ver logs do backend
docker logs -f promata-backend-prod

# Ver logs do PostgreSQL
docker logs -f promata-postgres-prod

# Testar API
curl http://localhost:3000/health

# Ver espaço em disco
docker system df
```

## 📊 Variáveis de Ambiente

Todas as variáveis são carregadas automaticamente do arquivo **`.env`** (gerado pelo workflow na VPS, na pasta `~/promata-backend`).

> ⚠️ O Docker Compose só lê automaticamente um arquivo chamado `.env` no mesmo diretório do `docker-compose.prod.yml`. Se o workflow gerar `.env.prod`, é necessário usar `--env-file .env.prod` em todos os comandos `docker compose`, ou renomear o arquivo gerado para `.env`.

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DB_PASSWORD` | - | Senha do PostgreSQL |
| `DATABASE_URL` | `postgresql://postgres:PASSWORD@postgres:5432/promata_db` | (Auto-gerada) |
| `JWT_SECRET` | - | Secret JWT da API |
| `NODE_ENV` | `production` | Ambiente |
| `PORT` | `3000` | Porta da API |

## 🔒 Segurança

### Firewall (UFW)

```bash
# Já configurado no setup, mas para revisar:
sudo ufw status

# SSH: idealmente restrito ao seu IP
# TCP 3000: API (ou apenas 80/443 se usar Nginx + proxy reverso)
# TCP 5432: NUNCA exposto externamente
```

### Backup do Banco

```bash
# Backup completo
docker exec promata-postgres-prod pg_dump -U postgres promata_db > backup.sql

# Enviar para storage seguro
scp backup.sql usuario@outro-servidor:/backups/

# Restore
docker exec -i promata-postgres-prod psql -U postgres promata_db < backup.sql
```

## ❌ Troubleshooting

### "Connection refused"
```bash
# Backend não conecta ao banco
docker compose -f docker-compose.prod.yml logs postgres
docker compose -f docker-compose.prod.yml logs backend

# PostgreSQL pode estar demorando. Aguarde 20s e tente novamente
```

### "Port already in use"
```bash
# Alguma coisa está usando porta 3000 ou 5432
lsof -i :3000
sudo kill -9 <PID>

# Ou remover tudo
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### "Image not found"
```bash
# Docker Hub image não conseguiu fazer pull
docker login  # use suas credenciais do Docker Hub
docker compose -f docker-compose.prod.yml pull
```

### "command not found: docker-compose"
```bash
# A VPS usa o plugin novo, sem hífen:
docker compose version

# Se algum script antigo ainda usa "docker-compose" (com hífen),
# substitua por "docker compose" (espaço, sem hífen)
```

### "SSH key permission denied"
```bash
# Permissões erradas da chave privada
chmod 400 ~/.ssh/promata_deploy

# Ou na VPS, garantir que a chave pública está em authorized_keys
ssh-keyscan -H SEU_IP_DA_VPS >> ~/.ssh/known_hosts
```

## 📚 Comandos Úteis

```bash
# Ver status dos services
docker compose -f docker-compose.prod.yml ps

# Entrar no container do backend
docker compose -f docker-compose.prod.yml exec backend sh

# Entrar no PostgreSQL
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d promata_db

# Parar services
docker compose -f docker-compose.prod.yml down

# Remover volumes (⚠️ deleta dados!)
docker compose -f docker-compose.prod.yml down -v

# Ver logs de um service
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f postgres

# Rebuild da imagem
docker compose -f docker-compose.prod.yml build --no-cache
```

## 🎯 Checklist de Setup

1. ✅ VPS Hostinger configurada (Docker + Docker Compose plugin)
2. ✅ Firewall (UFW) configurado
3. ✅ Chave SSH gerada e adicionada à VPS
4. ✅ Repositório clonado em `~/promata-backend`
5. ✅ Secrets do GitHub atualizados (host, user `root`, chave SSH da VPS)
6. ✅ Branch padrão `main` configurada e push disparando o workflow
7. ✅ Testar API em `http://SEU_IP_DA_VPS:3000/health`
8. ⚠️ Configurar domínio + SSL com Nginx/Let's Encrypt (opcional)
9. ⚠️ Configurar backups automáticos do banco (opcional)

## 🆘 Precisa de Ajuda?

Verifique os logs:

```bash
# GitHub Actions
GitHub → Actions → seu-workflow → logs detalhados

# VPS
ssh root@SEU_IP_DA_VPS
docker compose -f docker-compose.prod.yml logs
```

Bom deploy! 🚀