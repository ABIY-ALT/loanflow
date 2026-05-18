import bcrypt from 'bcryptjs';

async function testBcrypt() {
  const password = "admin123";
  const hash = "$2a$10$MsuAJo2GnrxOvDxevXLb8.nDnirDEgOcD7eFhEYXbrGfy7SQ33lHm";
  const match = await bcrypt.compare(password, hash);
  console.log('Match:', match);
}

testBcrypt();
