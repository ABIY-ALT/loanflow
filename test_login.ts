import { loginUser } from './src/app/auth/actions';

async function testLogin() {
  const result = await loginUser('0000000000', 'admin123');
  console.log('Login Result:', JSON.stringify(result, null, 2));
}

testLogin();
