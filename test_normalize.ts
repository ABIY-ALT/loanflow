import { normalizeEthiopianPhone } from './src/lib/utils';

console.log("Input: '0000000000', Normalized: '" + normalizeEthiopianPhone('0000000000') + "'");
console.log("Input: '0912345678', Normalized: '" + normalizeEthiopianPhone('0912345678') + "'");
console.log("Input: '+251912345678', Normalized: '" + normalizeEthiopianPhone('+251912345678') + "'");
