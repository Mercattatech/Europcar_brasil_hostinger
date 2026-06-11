const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testLogin(email, password) {
  console.log("Testando login para:", email);
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    console.log("ERRO: Usuário não encontrado");
    return;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  console.log("Senha confere?", isMatch);
  console.log("Role:", user.role);
}

const email = "matheus@grupomercatta.com.br";
const password = "Mercatta@2025";

testLogin(email, password)
  .finally(() => prisma.$disconnect());
