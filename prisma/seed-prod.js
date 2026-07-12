/**
 * ============================================
 * PRO-MATA - Seed de Produção
 * ============================================
 * Este seed cria APENAS o usuário ROOT inicial
 * para entrega ao cliente.
 *
 * Variáveis de ambiente obrigatórias:
 *   ROOT_EMAIL
 *   ROOT_PASSWORD
 *   ROOT_NAME (opcional)
 *   ROOT_PHONE (opcional)
 *
 * IMPORTANTE: Alterar a senha no primeiro login!
 * ============================================
 */

const { PrismaClient, UserType } = require('../generated/prisma');
const argon2 = require('argon2');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('============================================');
  console.log('PRO-MATA - Seed de Produção');
  console.log('============================================');

  const rootEmail = process.env.ROOT_EMAIL;
  const rootPassword = process.env.ROOT_PASSWORD;
  const rootName = process.env.ROOT_NAME || 'Root Admin';
  const rootPhone = process.env.ROOT_PHONE || '(00) 00000-0000';

  if (!rootEmail || !rootPassword) {
    throw new Error('ROOT_EMAIL e ROOT_PASSWORD são obrigatórios para o seed de produção.');
  }

  if (rootPassword.length < 12) {
    throw new Error('ROOT_PASSWORD deve ter pelo menos 12 caracteres.');
  }

  const existingRoot = await prisma.user.findFirst({
    where: { userType: UserType.ROOT },
  });

  if (existingRoot) {
    console.log('✓ Usuário ROOT já existe - seed ignorado.');
    console.log(`  Email: ${existingRoot.email}`);
    console.log('============================================');
    return;
  }

  const sha256Hash = crypto.createHash('sha256').update(rootPassword).digest('hex');
  const hashedPassword = await argon2.hash(sha256Hash, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const rootUser = await prisma.user.create({
    data: {
      userType: UserType.ROOT,
      name: rootName,
      email: rootEmail,
      password: hashedPassword,
      phone: rootPhone,
      gender: 'M',
      isForeign: false,
      active: true,
      verified: true,
      isFirstAccess: true,
    },
  });

  console.log('✓ Usuário ROOT criado com sucesso!');
  console.log('============================================');
  console.log('Credenciais de acesso:');
  console.log(`  Email: ${rootUser.email}`);
  console.log('  Senha: (definida via ROOT_PASSWORD — não exibida)');
  console.log('============================================');
  console.log('⚠️  IMPORTANTE: Altere a senha no primeiro login!');
  console.log('============================================');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
