const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = "matheus@grupomercatta.com.br";
  const password = "Mercatta@2025";
  
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: "ADMIN",
      status: "ACTIVE"
    },
    create: {
      email,
      name: "Matheus Conti",
      password: hashedPassword,
      role: "ADMIN",
      status: "ACTIVE"
    }
  });

  console.log("Usuário admin cadastrado/atualizado com sucesso!");
  console.log("Email:", email);
  console.log("Senha:", password);
  console.log("Role:", user.role);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
