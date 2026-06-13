# ✅ Checklist de Deploy com Docker Compose (VPS Hostinger)

Use este checklist para garantir que tudo está configurado corretamente.

## 📋 Pré-requisitos

- [ ] Você tem acesso SSH à VPS (usuário `root` + senha inicial ou chave)
- [ ] Você tem conta no Docker Hub
- [ ] Você tem permissão para adicionar secrets no GitHub
- [ ] Sua aplicação passa nos testes (`npm test`)

## 🔧 Fase 1: Setup da VPS (Uma Única Vez)

### 1.1 Conectar na VPS

```bash
ssh root@SEU_IP_DA_VPS
```

O IP fica no hPanel da Hostinger → **VPS** → seu servidor → aba **Visão Geral**.

- [ ] Conseguiu conectar via SSH

### 1.2 Instalar Docker e Docker Compose

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable docker --now
sudo usermod -aG docker $USER
```

- [ ] `docker --version` funciona
- [ ] `docker compose version` funciona (sem hífen — é plugin, não binário separado)
- [ ] Docker daemon está rodando (`docker ps` retorna lista vazia)

### 1.3 Configurar Firewall (UFW)

```bash
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw enable
```

- [ ] UFW habilitado e permitindo portas 22 e 3000
- [ ] Porta 5432 (Postgres) **não** está exposta externamente

### 1.4 Clonar Repositório

```bash
mkdir -p ~/promata-backend
cd ~/promata-backend
git clone https://github.com/SEU_USER/promata.git .
```

- [ ] Arquivo `docker-compose.prod.yml` existe (`ls -la docker-compose.prod.yml`)
- [ ] Repositório está na branch `main`

### 1.5 Validar Docker Compose

```bash
docker compose -f docker-compose.prod.yml config > /dev/null && echo "OK"
```

- [ ] Comando retornou `OK` sem erros

### 1.6 Logout e Login (Para permissões)

```bash
exit
ssh root@SEU_IP_DA_VPS
```

- [ ] Consegue rodar `docker ps` sem `sudo`

## 🔑 Fase 2: GitHub Secrets

### 2.1 Gerar Chave SSH para o GitHub Actions

```bash
# No seu computador LOCAL
ssh-keygen -t ed25519 -C "deploy-promata" -f ~/.ssh/promata_deploy
ssh-copy-id -i ~/.ssh/promata_deploy.pub root@SEU_IP_DA_VPS

# Testar
ssh -i ~/.ssh/promata_deploy root@SEU_IP_DA_VPS "docker ps"

# Copiar conteúdo completo da chave PRIVADA (vai pro secret PROD_EC2_SSH_KEY)
cat ~/.ssh/promata_deploy
```

- [ ] Tenho o conteúdo da chave privada (incluindo `-----BEGIN` e `-----END`)
- [ ] Tenho o IP da VPS
- [ ] Usuário SSH é `root`
- [ ] Login via chave testado e funcionando

> 🔒 Opcional, mas recomendado: desabilitar `PasswordAuthentication` em `/etc/ssh/sshd_config` e `sudo systemctl restart sshd`.

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

> Os nomes dos secrets continuam com prefixo `PROD_EC2_*` por compatibilidade com o workflow — apenas os **valores** mudam para os dados da VPS.

#### Secrets Obrigatórios

```
PROD_EC2_HOST           = IP da VPS
PROD_EC2_USER           = root
PROD_EC2_SSH_KEY        = (conteúdo da chave privada ~/.ssh/promata_deploy)
PROD_DB_PASSWORD        = (senha gerada acima)
PROD_JWT_SECRET         = (secret JWT gerado acima)
DOCKER_PASSWORD         = (token Docker Hub)
```

- [ ] Adicionei `PROD_EC2_HOST`
- [ ] Adicionei `PROD_EC2_USER` (= `root`)
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
- [ ] Adicionei variáveis de AWS S3 (se usar, senão deixei vazias)
- [ ] Adicionei FRONTEND_URL

### 2.4 Adicionar Variables (Não-secretas)

**GitHub → Settings → Secrets and variables → Variables**

```
AWS_REGION             = us-east-1 (ou qualquer valor, se não usar S3)
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
git commit -m "Configurar deploy com docker compose na VPS"
```

- [ ] Estou na branch `main`
- [ ] `docker-compose.prod.yml` está no git
- [ ] Código está commitado

### 3.2 Fazer Push (Dispara Workflow)

```bash
git push origin main
```

- [ ] Push foi bem-sucedido
- [ ] Confirmei que o push foi para `main` (não `master` ou outra branch)

### 3.3 Monitorar Deploy

**GitHub → Actions → Backend CI/CD**

Procure pelo seu commit mais recente:

```
✅ build-and-verify       (Build + testes)
✅ publish-prod           (Push ao Docker Hub)
⏳ deploy-prod            (Deploy na VPS)
```

- [ ] `build-and-verify` completou com sucesso
- [ ] `publish-prod` completou com sucesso
- [ ] `deploy-prod` completou com sucesso

### 3.4 Testar API

```bash
# Aguarde 30s após o workflow terminar

curl http://SEU_IP_DA_VPS:3000/health

# Deve retornar algo como:
# {"status":"ok","timestamp":"2026-06-13T..."}
```

- [ ] API respondeu ao healthcheck

### 3.5 Verificar Logs na VPS

```bash
ssh root@SEU_IP_DA_VPS

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

- [ ] Entendi que deployments são automáticos em push para `main`

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
2. **Logs da VPS**: `docker logs -f promata-backend-prod`
3. **DEPLOY_GUIDE.md**: Secção "Troubleshooting"

### Comandos de Emergência

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

**Última atualização**: 2026-06-13
**Criado para**: Deploy em Docker Compose na VPS Hostinger (sem AWS EC2/RDS)