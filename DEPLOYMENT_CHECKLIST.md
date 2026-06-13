# ✅ Checklist de Deploy com Docker Compose

Use este checklist para garantir que tudo está configurado corretamente.

## 📋 Pré-requisitos

- [ ] Você tem acesso SSH à EC2 (chave .pem)
- [ ] Você tem conta no Docker Hub
- [ ] Você tem permissão para adicionar secrets no GitHub
- [ ] Sua aplicação passa nos testes (`npm test`)

## 🔧 Fase 1: Setup da EC2 (Uma Única Vez)

### 1.1 Conectar na EC2

```bash
ssh -i /caminho/para/sua-chave.pem ec2-user@seu-ec2-ip
```

- [ ] Conseguiu conectar via SSH

### 1.2 Executar Setup Script

```bash
# Opção 1: Automático (recomendado)
curl -fsSL https://raw.githubusercontent.com/SEU_USER/promata/main/setup-ec2.sh | bash

# Opção 2: Manual (veja DEPLOY_GUIDE.md)
```

- [ ] Script executou sem erros
- [ ] Docker está instalado (`docker --version`)
- [ ] Docker Compose está instalado (`docker-compose --version`)
- [ ] Docker daemon está rodando (`docker ps` retorna lista vazia)

### 1.3 Clonar Repositório

```bash
# Script já faz isso, mas verifique
cd ~/promata-backend
ls -la docker-compose.prod.yml
```

- [ ] Arquivo `docker-compose.prod.yml` existe
- [ ] Repositório está na branch `main`

### 1.4 Logout e Login (Para permissões)

```bash
logout
ssh -i /caminho/para/sua-chave.pem ec2-user@seu-ec2-ip
```

- [ ] Consegue rodar `docker ps` sem `sudo`

## 🔑 Fase 2: GitHub Secrets

### 2.1 Preparar Informações

```bash
# No seu computador LOCAL, execute:

# Para copiar a chave SSH (conteúdo completo)
cat /caminho/para/sua-chave.pem

# Para saber o IP da EC2
echo "seu-ec2-ip"

# Para saber o usuário SSH
echo "ec2-user"  # ou ubuntu
```

- [ ] Tenho o conteúdo da chave privada `.pem`
- [ ] Tenho o IP/DNS da EC2
- [ ] Tenho o nome de usuário SSH

### 2.2 Gerar Senhas Aleatórias

```bash
# Gerar senha do banco (use em PROD_DB_PASSWORD)
openssl rand -base64 32

# Gerar JWT Secret (use em PROD_JWT_SECRET)
openssl rand -hex 32

# Exemplos (não use esses!):
# PROD_DB_PASSWORD = aB3cD4eF5gH6iJ7kL8mN9oPqRsT0uVwXyZ1a2b3
# PROD_JWT_SECRET  = 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
```

- [ ] Gerei uma senha forte para DB
- [ ] Gerei um JWT Secret
- [ ] Guardei essas senhas em lugar seguro

### 2.3 Adicionar Secrets no GitHub

**GitHub → Seu Repositório → Settings → Secrets and variables → Actions**

#### Secrets Obrigatórios

```
PROD_EC2_HOST           = seu-ec2-ip (ex: 54.123.45.67)
PROD_EC2_USER           = ec2-user
PROD_EC2_SSH_KEY        = (conteúdo da chave privada .pem)
PROD_DB_PASSWORD        = (senha gerada acima)
PROD_JWT_SECRET         = (secret JWT gerado acima)
DOCKER_PASSWORD         = (token Docker Hub)
```

- [ ] Adicionei `PROD_EC2_HOST`
- [ ] Adicionei `PROD_EC2_USER`
- [ ] Adicionei `PROD_EC2_SSH_KEY` (conteúdo completo, incluindo `-----BEGIN` e `-----END`)
- [ ] Adicionei `PROD_DB_PASSWORD`
- [ ] Adicionei `PROD_JWT_SECRET`
- [ ] Adicionei `DOCKER_PASSWORD`

#### Secrets Opcionais (mas recomendados)

```
AWS_ACCESS_KEY_ID       = (deixe vazio se não usar S3)
AWS_SECRET_ACCESS_KEY   = (deixe vazio se não usar S3)
PROD_AWS_S3_BUCKET      = (seu-bucket ou deixe vazio)

MAIL_HOST              = smtp.gmail.com (ou seu SMTP)
MAIL_PORT              = 587
MAIL_USER              = seu-email@gmail.com
MAIL_PASS              = sua-senha-app (ou app-password)
MAIL_FROM              = noreply@seu-dominio.com
MAIL_FROM_NAME         = Seu App

FRONTEND_URL           = http://seu-frontend.com (ou https)
```

- [ ] Adicionei variáveis de email (se usar)
- [ ] Adicionei variáveis de AWS S3 (se usar)
- [ ] Adicionei FRONTEND_URL

### 2.4 Adicionar Variables (Não-secretas)

**GitHub → Settings → Secrets and variables → Variables**

```
AWS_REGION             = us-east-1 (ou sua região)
DOCKER_USERNAME        = seu-usuario-docker
```

- [ ] Adicionei `AWS_REGION`
- [ ] Adicionei `DOCKER_USERNAME`

## 🚀 Fase 3: Primeiro Deploy

### 3.1 Preparar Código

```bash
# Na sua máquina local
cd ~/promata/backend

# Confirmar que está na branch main
git branch

# Verificar que docker-compose.prod.yml está no repo
git ls-files | grep docker-compose.prod.yml

# Fazer commit de qualquer mudança pendente
git add .
git commit -m "Configurar deploy com docker-compose"
```

- [ ] Estou na branch `main`
- [ ] `docker-compose.prod.yml` está no git
- [ ] Código está commitado

### 3.2 Fazer Push (Dispara Workflow)

```bash
git push origin main
```

- [ ] Push foi bem-sucedido

### 3.3 Monitorar Deploy

**GitHub → Actions → Backend CI/CD**

Procure pelo seu commit mais recente:

```
✅ build-and-verify       (Build + testes)
✅ publish-prod           (Push ao Docker Hub)
⏳ deploy-prod            (Deploy na EC2)
```

- [ ] `build-and-verify` completou com sucesso
- [ ] `publish-prod` completou com sucesso
- [ ] `deploy-prod` completou com sucesso

### 3.4 Testar API

```bash
# Aguarde 30s após o workflow terminar

# Testar healthcheck
curl http://seu-ec2-ip:3000/health

# Deve retornar algo como:
# {"status":"ok","timestamp":"2026-05-24T..."}
```

- [ ] API respondeu ao healthcheck

### 3.5 Verificar Logs na EC2

```bash
ssh -i /caminho/para/sua-chave.pem ec2-user@seu-ec2-ip

# Ver status
docker ps

# Ver logs do backend
docker logs -f promata-backend-prod

# Ver logs do banco
docker logs -f promata-postgres-prod

# Entrar no PostgreSQL
docker exec -it promata-postgres-prod psql -U postgres -d promata_db
# \l  = listar databases
# \q  = sair
```

- [ ] Backend está rodando (`docker ps` mostra `promata-backend-prod`)
- [ ] PostgreSQL está rodando (`docker ps` mostra `promata-postgres-prod`)
- [ ] Backend logs não mostram erros
- [ ] Migrations foram executadas com sucesso

## 🔄 Fase 4: Deployments Futuros

Agora é automático! Sempre que você fazer push para `main`:

```bash
git push origin main
# GitHub Actions vai fazer o resto
```

- [ ] Entendi que deployments são automáticos em push para main

## ✅ Tudo Pronto!

Parabéns! Seu deploy está configurado. 

### Próximos Passos Opcionais

- [ ] Configurar domínio + SSL (Nginx + Let's Encrypt)
- [ ] Configurar backup automático do banco
- [ ] Configurar monitoramento (Sentry, New Relic, etc)
- [ ] Configurar logs centralizados
- [ ] Testar rollback (parar container antigo, restaurar anterior)

### Troubleshooting

Se algo deu errado, veja:

1. **Logs do GitHub Actions**: GitHub → Actions → seu-workflow
2. **Logs da EC2**: `docker logs -f promata-backend-prod`
3. **DEPLOY_GUIDE.md**: Secção "Troubleshooting"

### Comandos de Emergência (SE2)

```bash
# Parar tudo (se der problema)
docker compose -f docker-compose.prod.yml down

# Restart
docker compose -f docker-compose.prod.yml up -d

# Ver espaço em disco
docker system df

# Limpar imagens antigas
docker image prune -af
```

---

**Última atualização**: 2026-05-24
**Criado para**: Deploy em Docker Compose (sem AWS RDS)
