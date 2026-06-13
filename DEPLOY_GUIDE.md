# 🚀 Deploy com Docker Compose - Guia Completo

Este guia explica como fazer deploy do backend na EC2 sem AWS RDS usando Docker Compose.

## 📋 Arquivos Criados

- **`docker-compose.prod.yml`** - Configuração do Docker Compose com PostgreSQL + Backend
- **`setup-ec2.sh`** - Script de setup automático da EC2
- **`.github/workflows/ci-cd.yml`** - Workflow CI/CD modificado para usar docker compose

## 🎯 Fluxo de Deploy

```
Seu PC → git push origin main
    ↓
GitHub Actions (CI/CD) → Build & Testes
    ↓
Push imagem ao Docker Hub
    ↓
SSH na EC2 → docker compose pull & up
    ↓
✅ API + PostgreSQL rodando
```

## 🔧 Setup Inicial (Uma Única Vez)

### 1. Na EC2 - Instalar Docker e Docker Compose

Se você ainda não tem acesso SSH à EC2, [siga este guia primeiro](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AccessingInstances.html).

```bash
# SSH na EC2
ssh -i sua-chave.pem ec2-user@seu-ec2-ip
# ou para Ubuntu
ssh -i sua-chave.pem ubuntu@seu-ec2-ip

# Executar script de setup (automatiza tudo)
curl -fsSL https://raw.githubusercontent.com/SEU_USER/promata/main/setup-ec2.sh | bash

# OU fazer manualmente:
sudo yum install docker -y  # (ou apt-get se for Ubuntu)
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo systemctl start docker
sudo usermod -aG docker $USER
# Fazer logout e login para permissões funcionarem
```

### 2. Testar Conexão SSH Localmente

```bash
# Da sua máquina local
ssh -i caminho/para/chave.pem ec2-user@seu-ec2-ip "docker ps"

# Deve mostrar uma lista de containers (possivelmente vazia)
```

### 3. Adicionar GitHub Secrets

**GitHub → Settings → Secrets and variables → Actions → New repository secret**

Adicione estes secrets:

```
PROD_EC2_HOST           = seu-ec2-ip (ex: 54.123.45.67)
PROD_EC2_USER           = ec2-user (ou ubuntu)
PROD_EC2_SSH_KEY        = (conteúdo completo da chave privada)

PROD_DB_PASSWORD        = SenhaForte123!@# (escolha uma)
PROD_JWT_SECRET         = sua-secret-jwt

AWS_ACCESS_KEY_ID       = (deixe em branco se não usar S3)
AWS_SECRET_ACCESS_KEY   = (deixe em branco se não usar S3)

MAIL_HOST              = seu-smtp-host (ex: smtp.gmail.com)
MAIL_PORT              = 587
MAIL_USER              = seu-email@gmail.com
MAIL_PASS              = sua-senha-app
MAIL_FROM              = noreply@seu-dominio.com
MAIL_FROM_NAME         = Seu App

FRONTEND_URL           = http://seu-frontend.com
PROD_AWS_S3_BUCKET     = seu-bucket (se usar S3)

DOCKER_PASSWORD        = token-docker-hub
```

**Variables** (não são secretas):

```
AWS_REGION             = us-east-1 (ou sua região)
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
# SSH na EC2
ssh -i sua-chave.pem ec2-user@seu-ec2-ip

# Atualizar código
cd ~/promata-backend
git pull origin main

# Redeploy
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Ver logs
docker compose -f docker-compose.prod.yml logs -f backend
```

## 🔍 Monitorar Deploy

### Via GitHub Actions
1. GitHub → **Actions**
2. Clique no workflow em execução
3. Veja logs em tempo real

### Via EC2

```bash
ssh -i sua-chave.pem ec2-user@seu-ec2-ip

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

Todas as variáveis são carregadas automaticamente do `.env.prod` que o workflow cria.

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DB_PASSWORD` | - | Senha do PostgreSQL |
| `DATABASE_URL` | `postgresql://postgres:PASSWORD@postgres:5432/promata_db` | (Auto-gerada) |
| `JWT_SECRET` | - | Secret JWT da API |
| `NODE_ENV` | `production` | Ambiente |
| `PORT` | `3000` | Porta da API |

## 🔒 Segurança

### Para PROD

```bash
# Na EC2, após primeira configuração
# Editar security group da EC2 para aceitar:
# - SSH: apenas seu IP
# - TCP 3000: apenas seu frontend IP (ou deixe aberto)
# - TCP 5432: NENHUM acesso de fora (apenas entre containers)
```

### Backup do Banco

```bash
# Backup completo
docker exec promata-postgres-prod pg_dump -U postgres promata_db > backup.sql

# Enviar para storage seguro
scp backup.sql seu-storage:/backups/

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
docker login  # use seus credenciais do Docker Hub
docker compose -f docker-compose.prod.yml pull
```

### "SSH key permission denied"
```bash
# Permissões erradas da chave privada
chmod 400 /caminho/para/chave.pem

# Ou na EC2
ssh-keyscan -H seu-ec2-ip >> ~/.ssh/known_hosts
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

## 🎯 Próximos Passos

1. ✅ Setup da EC2 com script
2. ✅ Adicionar secrets do GitHub
3. ✅ Fazer push para main
4. ✅ Acompanhar em Actions
5. ✅ Testar API em `http://seu-ec2-ip:3000/health`
6. ⚠️ Configurar domínio + SSL com Nginx/Let's Encrypt (opcional)
7. ⚠️ Configurar backups automáticos do banco (opcional)

## 🆘 Precisa de Ajuda?

Verifique os logs:

```bash
# GitHub Actions
GitHub → Actions → seu-workflow → logs detalhados

# EC2
ssh -i chave.pem ec2-user@seu-ip
docker compose -f docker-compose.prod.yml logs
```

Bom deploy! 🚀
