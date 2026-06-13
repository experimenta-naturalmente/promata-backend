#!/bin/bash

# Setup script para inicializar a EC2 com Docker e Docker Compose
# Execute este script na EC2 com: bash setup-ec2.sh

set -euo pipefail

echo "🚀 Iniciando setup da EC2..."

# Detectar sistema operacional
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$ID
else
  echo "❌ Sistema operacional não suportado"
  exit 1
fi

# Instalar Docker
echo "📦 Instalando Docker..."
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
  sudo apt-get update
  sudo apt-get install -y docker.io
  COMPOSE_URL="https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)"
elif [ "$OS" = "amzn" ] || [ "$OS" = "rhel" ] || [ "$OS" = "centos" ]; then
  sudo yum install -y docker
  COMPOSE_URL="https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)"
else
  echo "❌ SO não suportado: $OS"
  exit 1
fi

# Instalar Docker Compose
echo "📦 Instalando Docker Compose..."
sudo curl -L "$COMPOSE_URL" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Iniciar Docker
echo "🔧 Iniciando Docker..."
sudo systemctl start docker
sudo systemctl enable docker

# Adicionar usuário atual ao grupo docker
echo "👤 Configurando permissões de usuário..."
sudo usermod -aG docker $USER

# Criar diretórios necessários
echo "📁 Criando diretórios..."
mkdir -p ~/promata-backend
cd ~/promata-backend

# Clonar repositório (substitua pela URL do seu repo)
if [ ! -d .git ]; then
  echo "📥 Clonando repositório..."
  # Substitua GITHUB_REPO_URL pela URL do seu repositório
  git clone https://github.com/SEU_USER/promata.git . || true
else
  echo "📝 Repositório já existe, puxando atualizações..."
  git pull origin main || true
fi

# Verificar se docker-compose.prod.yml existe
if [ ! -f docker-compose.prod.yml ]; then
  echo "❌ docker-compose.prod.yml não encontrado!"
  exit 1
fi

# Testar configuração do compose
echo "🧪 Testando configuração do Docker Compose..."
docker compose -f docker-compose.prod.yml config > /dev/null

echo ""
echo "✅ Setup concluído com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "1. Adicione os secrets do GitHub (Settings → Secrets and variables → Actions):"
echo "   - PROD_EC2_HOST: $(hostname -I | awk '{print $1}')"
echo "   - PROD_EC2_USER: $USER"
echo "   - PROD_EC2_SSH_KEY: (sua chave privada SSH)"
echo "   - PROD_DB_PASSWORD: (escolha uma senha forte)"
echo "   - Outros secrets (JWT_SECRET, AWS, MAIL, etc.)"
echo ""
echo "2. Faça um push para a branch main:"
echo "   git push origin main"
echo ""
echo "3. Acompanhe o deploy em: GitHub → Actions"
echo ""
echo "⚠️  Nota: A próxima vez, você terá que fazer logout e login para que"
echo "as permissões de docker funcionem corretamente:"
echo "   logout"
echo "   login"
echo ""
