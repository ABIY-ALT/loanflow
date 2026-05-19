
import { PrismaClient } from '@prisma/client';
import { ALL_PERMISSIONS, PERMISSIONS } from '../src/lib/permissions';
import bcrypt from 'bcryptjs';
import { normalizeEthiopianPhone } from '../src/lib/utils';

interface SeedUser {
  id: string;
  userId?: string;
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  department: string;
  districtName?: string;
  jobTitle?: string;
}

const appMockUsers: SeedUser[] = [
  { id: '00000001-aaaa-4b0b-a81f-000000000001', userId: '11111111-bbbb-49f0-b7c2-000000000001', name: 'Gizachew Abebaw', email: 'Gizachew.Abebaw@nibbank.com.et', firstName: 'Gizachew', lastName: 'Abebaw', phoneNumber: '0913435684', department: 'Service Sector Department', jobTitle: 'Director' },
  { id: '00000002-aaaa-4b0b-a81f-000000000002', userId: '11111112-bbbb-49f0-b7c2-000000000002', name: 'Kalkidan Taye', email: 'Kalkidan.Taye@nibbank.com.et', firstName: 'Kalkidan', lastName: 'Taye', phoneNumber: '0927436918', department: 'Service Sector Department', jobTitle: 'Junior Secretary' },
  { id: '00000003-aaaa-4b0b-a81f-000000000003', userId: '11111113-bbbb-49f0-b7c2-000000000003', name: 'Belachew Mada', email: 'Belachew.Mada@nibbank.com.et', firstName: 'Belachew', lastName: 'Mada', phoneNumber: '0911661927', department: 'Service Sector Department', jobTitle: 'CRM' },
  { id: '00000004-aaaa-4b0b-a81f-000000000004', userId: '11111114-bbbb-49f0-b7c2-000000000004', name: 'Endalamaw Mequanent', email: 'Endalemaw.mequanent@nibbank.com.et', firstName: 'Endalamaw', lastName: 'Mequanent', phoneNumber: '0913832999', department: 'Service Sector Department', jobTitle: 'CRM' },
  { id: '00000005-aaaa-4b0b-a81f-000000000005', userId: '11111115-bbbb-49f0-b7c2-000000000005', name: 'Endashaw Bekele', email: 'Endashaw.Bekele@nibbank.com.et', firstName: 'Endashaw', lastName: 'Bekele', phoneNumber: '0910324818', department: 'Service Sector Department', jobTitle: 'CRM' },
  { id: '00000006-aaaa-4b0b-a81f-000000000006', userId: '11111116-bbbb-49f0-b7c2-000000000006', name: 'Ephrem Tadesse', email: 'Ephrem.Tadesse@nibbank.com.et', firstName: 'Ephrem', lastName: 'Tadesse', phoneNumber: '0911428127', department: 'Service Sector Department', jobTitle: 'CRM' },
  { id: '00000007-aaaa-4b0b-a81f-000000000007', userId: '11111117-bbbb-49f0-b7c2-000000000007', name: 'Fikadu Zerga', email: 'Fikadu.Zerga@nibbank.com.et', firstName: 'Fikadu', lastName: 'Zerga', phoneNumber: '0930800098', department: 'Service Sector Department', jobTitle: 'CRM' },
  { id: '00000008-aaaa-4b0b-a81f-000000000008', userId: '11111118-bbbb-49f0-b7c2-000000000008', name: 'Hiwot Wondosen', email: 'Hiwot.Wondesson@nibbank.com.et', firstName: 'Hiwot', lastName: 'Wondosen', phoneNumber: '0912743625', department: 'Service Sector Department', jobTitle: 'CRM' },
  { id: '00000009-aaaa-4b0b-a81f-000000000009', userId: '11111119-bbbb-49f0-b7c2-000000000009', name: 'Kirubel Solomon', email: 'Kirubel.Solomon@nibbank.com.et', firstName: 'Kirubel', lastName: 'Solomon', phoneNumber: '0913583987', department: 'Service Sector Department', jobTitle: 'CRM' },
  { id: '00000010-aaaa-4b0b-a81f-000000000010', userId: '1111111a-bbbb-49f0-b7c2-000000000010', name: 'Matewos Legesse', email: 'Matewos.Legesse@nibbank.com.et', firstName: 'Matewos', lastName: 'Legesse', phoneNumber: '0913561298', department: 'Service Sector Department', jobTitle: 'CRM' },
  { id: '00000011-aaaa-4b0b-a81f-000000000011', userId: '1111111b-bbbb-49f0-b7c2-000000000011', name: 'Mihretu Mengistu', email: 'Mihretu.Mengistu@nibbank.com.et', firstName: 'Mihretu', lastName: 'Mengistu', phoneNumber: '0962992535', department: 'Institutional Banking and Hospitality, Green Financing Department', jobTitle: 'CRM' },
  { id: '00000012-aaaa-4b0b-a81f-000000000012', userId: '1111111c-bbbb-49f0-b7c2-000000000012', name: 'Yonas Ejersa', email: 'Yonas.Ejersa@nibbank.com.et', firstName: 'Yonas', lastName: 'Ejersa', phoneNumber: '0913938919', department: 'Institutional Banking and Hospitality, Green Financing Department', jobTitle: 'CRM' },
  { id: '00000013-aaaa-4b0b-a81f-000000000013', userId: '1111111d-bbbb-49f0-b7c2-000000000013', name: 'YALEW GENANA GULUMA', email: 'Yalew.Genana@nibbank.com.et', firstName: 'Yalew', lastName: 'Genana', phoneNumber: '0913876990', department: 'Institutional Banking and Hospitality, Green Financing Department', jobTitle: 'CRM' },
  { id: '00000014-aaaa-4b0b-a81f-000000000014', userId: '1111111e-bbbb-49f0-b7c2-000000000014', name: 'AMSALU DAGNEW AMENU', email: 'Amsalu.Dagnew@nibbank.com.et', firstName: 'Amsalu', lastName: 'Dagnew', phoneNumber: '0910055853', department: 'Institutional Banking and Hospitality, Green Financing Department', jobTitle: 'CRM' },
  { id: '00000015-aaaa-4b0b-a81f-000000000015', userId: '1111111f-bbbb-49f0-b7c2-000000000015', name: 'SOPHIA W/TSADIK G/MESEKE', email: 'Sophia.Wtsadik@nibbank.com.et', firstName: 'Sophia', lastName: 'Wtsadik', phoneNumber: '0911609508', department: 'Institutional Banking and Hospitality, Green Financing Department', jobTitle: 'Associ Insti Banking& hospi Green Financing Officer' },
  { id: '00000016-aaaa-4b0b-a81f-000000000016', userId: '11111120-bbbb-49f0-b7c2-000000000016', name: 'Fisseha Wujra', email: 'Fisseha.Wujra@nibbank.com.et', firstName: 'Fisseha', lastName: 'Wujra', phoneNumber: '0911873867', department: 'Construction Manufacturing and Agriculture Sector Department', jobTitle: 'Director' },
  { id: '00000017-aaaa-4b0b-a81f-000000000017', userId: '11111121-bbbb-49f0-b7c2-000000000017', name: 'Surafel Aregahagn', email: 'Surafel.Arega@nibbank.com.et', firstName: 'Surafel', lastName: 'Aregahagn', phoneNumber: '0911619652', department: 'Construction Manufacturing and Agriculture Sector Department', jobTitle: 'CRM' },
  { id: '00000018-aaaa-4b0b-a81f-000000000018', userId: '11111122-bbbb-49f0-b7c2-000000000018', name: 'Fekadu Beyadgilgn', email: 'Fekadu.Beyadgilgn@nibbank.com.et', firstName: 'Fekadu', lastName: 'Beyadgilgn', phoneNumber: '0911930349', department: 'Construction Manufacturing and Agriculture Sector Department', jobTitle: 'CRM' },
  { id: '00000019-aaaa-4b0b-a81f-000000000019', userId: '11111123-bbbb-49f0-b7c2-000000000019', name: 'Elias Eshetu', email: 'Elias.Eshetu@nibbank.com.et', firstName: 'Elias', lastName: 'Eshetu', phoneNumber: '0910088978', department: 'Construction Manufacturing and Agriculture Sector Department', jobTitle: 'CRM' },
  { id: '00000020-aaaa-4b0b-a81f-000000000020', userId: '11111124-bbbb-49f0-b7c2-000000000020', name: 'Hailemichael Getachew', email: 'Hailemichael.Getachew@nibbank.com.et', firstName: 'Hailemichael', lastName: 'Getachew', phoneNumber: '0913752501', department: 'Construction Manufacturing and Agriculture Sector Department', jobTitle: 'CRM' },
  { id: '00000021-aaaa-4b0b-a81f-000000000021', userId: '11111125-bbbb-49f0-b7c2-000000000021', name: 'Abinet Wondimu', email: 'Abinet.Wondimu@nibbank.com.et', firstName: 'Abinet', lastName: 'Wondimu', phoneNumber: '0938027756', department: 'Construction Manufacturing and Agriculture Sector Department', jobTitle: 'CRM' },
  { id: '00000022-aaaa-4b0b-a81f-000000000022', userId: '11111126-bbbb-49f0-b7c2-000000000022', name: 'Anteneh Mekonnen', email: 'Anteneh.Mekonnen@nibbank.com.et', firstName: 'Anteneh', lastName: 'Mekonnen', phoneNumber: '0911116228', department: 'Construction Manufacturing and Agriculture Sector Department', jobTitle: 'CRM' },
  { id: '00000023-aaaa-4b0b-a81f-000000000023', userId: '11111127-bbbb-49f0-b7c2-000000000023', name: 'Abenezer Abraham', email: 'Abenezer.Abraham@nibbank.com.et', firstName: 'Abenezer', lastName: 'Abraham', phoneNumber: '0911698289', department: 'Construction Manufacturing and Agriculture Sector Department', jobTitle: 'CRM' },
  { id: '00000024-aaaa-4b0b-a81f-000000000024', userId: '11111128-bbbb-49f0-b7c2-000000000024', name: 'Wondwossen Enko', email: 'Wondwossen.Enko@nibbank.com.et', firstName: 'Wondwossen', lastName: 'Enko', phoneNumber: '0922577300', department: 'Property Valuation Department', jobTitle: 'Director' },
  { id: '00000025-aaaa-4b0b-a81f-000000000025', userId: '11111129-bbbb-49f0-b7c2-000000000025', name: 'Natnael Bereded', email: 'Natnael.Bereded@nibbank.com.et', firstName: 'Natnael', lastName: 'Bereded', phoneNumber: '0911658056', department: 'Property Valuation Department', jobTitle: 'Manager, Property Valuation (Maker)' },
  { id: '00000026-aaaa-4b0b-a81f-000000000026', userId: '1111112a-bbbb-49f0-b7c2-000000000026', name: 'Daniel Andualem', email: 'Daniel.Andualem@nibbank.com.et', firstName: 'Daniel', lastName: 'Andualem', phoneNumber: '0911156151', department: 'Property Valuation Department', jobTitle: 'Manager, Property Valuation (Checker)' },
  { id: '00000027-aaaa-4b0b-a81f-000000000027', userId: '1111112b-bbbb-49f0-b7c2-000000000027', name: 'Yidnekachew Awraris', email: 'Yidnekachew.Awraris@nibbank.com.et', firstName: 'Yidnekachew', lastName: 'Awraris', phoneNumber: '0913001100', department: 'Property Valuation Department', jobTitle: 'Senior Property Valuation Officer' },
  { id: '00000028-aaaa-4b0b-a81f-000000000028', userId: '1111112c-bbbb-49f0-b7c2-000000000028', name: 'Michael Abate', email: 'Michael.Abate@nibbank.com.et', firstName: 'Michael', lastName: 'Abate', phoneNumber: '0913597100', department: 'Property Valuation Department', jobTitle: 'Senior Property Valuation Officer' },
  { id: '00000029-aaaa-4b0b-a81f-000000000029', userId: '1111112d-bbbb-49f0-b7c2-000000000029', name: 'Frezer Endalkachew', email: 'Frezer.Endalkachew@nibbank.com.et', firstName: 'Frezer', lastName: 'Endalkachew', phoneNumber: '0911079216', department: 'Property Valuation Department', jobTitle: 'Senior Property Valuation Officer' },
  { id: '00000030-aaaa-4b0b-a81f-000000000030', userId: '1111112e-bbbb-49f0-b7c2-000000000030', name: 'Hanna Hinsene', email: 'Hanna.Hinsene@nibbank.com.et', firstName: 'Hanna', lastName: 'Hinsene', phoneNumber: '0923434306', department: 'Property Valuation Department', jobTitle: 'Senior Property Valuation Officer' },
  { id: '00000031-aaaa-4b0b-a81f-000000000031', userId: '1111112f-bbbb-49f0-b7c2-000000000031', name: 'Kalkidan Sesay', email: 'Kalkidan.Sesay@nibbank.com.et', firstName: 'Kalkidan', lastName: 'Sesay', phoneNumber: '0912419445', department: 'Property Valuation Department', jobTitle: 'Senior Property Valuation Officer' },
  { id: '00000032-aaaa-4b0b-a81f-000000000032', userId: '11111130-bbbb-49f0-b7c2-000000000032', name: 'Selamawit Tamirat', email: 'Selamawit.Tamirat@nibbank.com.et', firstName: 'Selamawit', lastName: 'Tamirat', phoneNumber: '0912830335', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000033-aaaa-4b0b-a81f-000000000033', userId: '11111131-bbbb-49f0-b7c2-000000000033', name: 'Elim Tesfaye', email: 'Elim.Tesfaye@nibbank.com.et', firstName: 'Elim', lastName: 'Tesfaye', phoneNumber: '0929091153', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000034-aaaa-4b0b-a81f-000000000034', userId: '11111132-bbbb-49f0-b7c2-000000000034', name: 'Yonas Dereje', email: 'Yonas.Dereje@nibbank.com.et', firstName: 'Yonas', lastName: 'Dereje', phoneNumber: '0910321545', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000035-aaaa-4b0b-a81f-000000000035', userId: '11111133-bbbb-49f0-b7c2-000000000035', name: 'Yoseph Wondimu', email: 'Yoseph.Wondimu@nibbank.com.et', firstName: 'Yoseph', lastName: 'Wondimu', phoneNumber: '0922945657', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000036-aaaa-4b0b-a81f-000000000036', userId: '11111134-bbbb-49f0-b7c2-000000000036', name: 'Eleni Belay', email: 'Eleni.Belay@nibbank.com.et', firstName: 'Eleni', lastName: 'Belay', phoneNumber: '0948216838', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000037-aaaa-4b0b-a81f-000000000037', userId: '11111135-bbbb-49f0-b7c2-000000000037', name: 'Meron Argaw', email: 'Meron.Argaw@nibbank.com.et', firstName: 'Meron', lastName: 'Argaw', phoneNumber: '0921081371', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000038-aaaa-4b0b-a81f-000000000038', userId: '11111136-bbbb-49f0-b7c2-000000000038', name: 'Meron Fantu', email: 'Meron.Fantu@nibbank.com.et', firstName: 'Meron', lastName: 'Fantu', phoneNumber: '0975690773', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000039-aaaa-4b0b-a81f-000000000039', userId: '11111137-bbbb-49f0-b7c2-000000000039', name: 'Eyuel Moges', email: 'Eyuel.Moges@nibbank.com.et', firstName: 'Eyuel', lastName: 'Moges', phoneNumber: '0922586666', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000040-aaaa-4b0b-a81f-000000000040', userId: '11111138-bbbb-49f0-b7c2-000000000040', name: 'Tsigab Kube', email: 'Tsigab.Kube@nibbank.com.et', firstName: 'Tsigab', lastName: 'Kube', phoneNumber: '0904185695', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000041-aaaa-4b0b-a81f-000000000041', userId: '11111139-bbbb-49f0-b7c2-000000000041', name: 'Alazar Eliyas', email: 'Alazar.Eliyas@nibbank.com.et', firstName: 'Alazar', lastName: 'Eliyas', phoneNumber: '0920893000', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000042-aaaa-4b0b-a81f-000000000042', userId: '1111113a-bbbb-49f0-b7c2-000000000042', name: 'Bezawit Desalegn', email: 'Bezawit.Desalegn@nibbank.com.et', firstName: 'Bezawit', lastName: 'Bezawit', phoneNumber: '0977442751', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000043-aaaa-4b0b-a81f-000000000043', userId: '1111113b-bbbb-49f0-b7c2-000000000043', name: 'Hailemariam Sewale', email: 'Hailemariam.Sewale@nibbank.com.et', firstName: 'Hailemariam', lastName: 'Sewale', phoneNumber: '0927686103', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000044-aaaa-4b0b-a81f-000000000044', userId: '1111113c-bbbb-49f0-b7c2-000000000044', name: 'Natnael Tesfaye', email: 'Natnael.Tesfaye@nibbank.com.et', firstName: 'Natnael', lastName: 'Tesfaye', phoneNumber: '0910133800', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000045-aaaa-4b0b-a81f-000000000045', userId: '1111113d-bbbb-49f0-b7c2-000000000045', name: 'Abinet Getahun', email: 'Abinet.Getahun@nibbank.com.et', firstName: 'Abinet', lastName: 'Getahun', phoneNumber: '0910979074', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000046-aaaa-4b0b-a81f-000000000046', userId: '1111113e-bbbb-49f0-b7c2-000000000046', name: 'Abrham Tilaye', email: 'Abrham.Tilaye@nibbank.com.et', firstName: 'Abrham', lastName: 'Tilaye', phoneNumber: '0923560536', department: 'Property Valuation Department', jobTitle: 'Junior Property Valuation Officer' },
  { id: '00000047-aaaa-4b0b-a81f-000000000047', userId: '1111113f-bbbb-49f0-b7c2-000000000047', name: 'Hagos G/medhin', email: 'Hagos.G/medhin@nibbank.com.et', firstName: 'Hagos', lastName: 'G/medhin', phoneNumber: '0910349069', department: 'Property Valuation Department', jobTitle: 'Property Valuation Officer' },
  { id: '00000048-aaaa-4b0b-a81f-000000000048', userId: '11111140-bbbb-49f0-b7c2-000000000048', name: 'Nardos Eshetu', email: 'Nardos.Eshetu@nibbank.com.et', firstName: 'Nardos', lastName: 'Eshetu', phoneNumber: '0921253113', department: 'Property Valuation Department', jobTitle: 'Property Valuation Officer' },
  { id: '00000049-aaaa-4b0b-a81f-000000000049', userId: '11111141-bbbb-49f0-b7c2-000000000049', name: 'Nuria Jibril', email: 'Nuria.Jibril@nibbank.com.et', firstName: 'Nuria', lastName: 'Jibril', phoneNumber: '0942776855', department: 'Property Valuation Department', jobTitle: 'Property Valuation Officer' },
  { id: '00000050-aaaa-4b0b-a81f-000000000050', userId: '11111142-bbbb-49f0-b7c2-000000000050', name: 'Hana Mulugeta Fekadu', email: 'Hana.Mulugeta@nibbank.com.et', firstName: 'Hana', lastName: 'Mulugeta', phoneNumber: '0946661246', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Corporate Credit Analysis & Appraisal Officer' },
  { id: '00000051-aaaa-4b0b-a81f-000000000051', userId: '11111143-bbbb-49f0-b7c2-000000000051', name: 'Fasil Baraki G/Meskel', email: 'Fasil.Baraki@nibbank.com.et', firstName: 'Fasil', lastName: 'Baraki', phoneNumber: '0911425395', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Manager' },
  { id: '00000052-aaaa-4b0b-a81f-000000000052', userId: '11111144-bbbb-49f0-b7c2-000000000052', name: 'Birtukan Kuliche', email: 'Birtukan.Kuliche@nibbank.com.et', firstName: 'Birtukan', lastName: 'Kuliche', phoneNumber: '0911026688', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Senior Officer' },
  { id: '00000053-aaaa-4b0b-a81f-000000000053', userId: '11111145-bbbb-49f0-b7c2-000000000053', name: 'Andinet Yifru Mengistu', email: 'Andinet.Yifru@nibbank.com.et', firstName: 'Andinet', lastName: 'Yifru', phoneNumber: '0911897579', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Officer' },
  { id: '00000054-aaaa-4b0b-a81f-000000000054', userId: '11111146-bbbb-49f0-b7c2-000000000054', name: 'Menbere Mengist Alehegn', email: 'Menbere.Mengist@nibbank.com.et', firstName: 'Menbere', lastName: 'Alehegn', phoneNumber: '0922868694', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Corporate Officer' },
  { id: '00000055-aaaa-4b0b-a81f-000000000055', userId: '11111147-bbbb-49f0-b7c2-000000000055', name: 'Helen Mamo Ayele', email: 'Helen.Mamo@nibbank.com.et', firstName: 'Helen', lastName: 'Mamo', phoneNumber: '0926792997', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Officer' },
  { id: '00000056-aaaa-4b0b-a81f-000000000056', userId: '11111148-bbbb-49f0-b7c2-000000000056', name: 'Tamiru Demis Trbis', email: 'Tamiru.Demis@nibbank.com.et', firstName: 'Tamiru', lastName: 'Demis', phoneNumber: '0905060617', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Officer' },
  { id: '00000057-aaaa-4b0b-a81f-000000000057', userId: '11111149-bbbb-49f0-b7c2-000000000057', name: 'Zinash Tadesse Defa', email: 'Zinash.Tadesse@nibbank.com.et', firstName: 'Zinash', lastName: 'Tadesse', phoneNumber: '0912040540', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Corporate Officer' },
  { id: '00000058-aaaa-4b0b-a81f-000000000058', userId: '1111114a-bbbb-49f0-b7c2-000000000058', name: 'Estalu Mengist Tesema', email: 'Estalu.Mengist@nibbank.com.et', firstName: 'Estalu', lastName: 'Mengist', phoneNumber: '0946792489', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Corporate Officer' },
  { id: '00000059-aaaa-4b0b-a81f-000000000059', userId: '1111114b-bbbb-49f0-b7c2-000000000059', name: 'Tariku Dagnew Zeleke', email: 'Tariku.Dagnew@nibbank.com.et', firstName: 'Tariku', lastName: 'Dagnew', phoneNumber: '0929403387', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Officer' },
  { id: '00000060-aaaa-4b0b-a81f-000000000060', userId: '1111114c-bbbb-49f0-b7c2-000000000060', name: 'Yoseph Alemu Haile', email: 'Yoseph.Alemu@nibbank.com.et', firstName: 'Yoseph', lastName: 'Alemu', phoneNumber: '0911115733', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Senior Officer' },
  { id: '00000061-aaaa-4b0b-a81f-000000000061', userId: '1111114d-bbbb-49f0-b7c2-000000000061', name: 'Temesgen Teklay Berhe', email: 'Temesgen.Teklay@nibbank.com.et', firstName: 'Temesgen', lastName: 'Teklay', phoneNumber: '0911568475', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Principal Officer' },
  { id: '00000062-aaaa-4b0b-a81f-000000000062', userId: '1111114e-bbbb-49f0-b7c2-000000000062', name: 'Daniel Dagne Tadesse', email: 'Daniel.Dagne@nibbank.com.et', firstName: 'Daniel', lastName: 'Dagne', phoneNumber: '0966930921', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Senior Corporate Officer' },
  { id: '00000063-aaaa-4b0b-a81f-000000000063', userId: '1111114f-bbbb-49f0-b7c2-000000000063', name: 'Mulualem Feleke Ayele', email: 'Mulualem.Feleke@nibbank.com.et', firstName: 'Mulualem', lastName: 'Feleke', phoneNumber: '0911752034', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Senior Officer' },
  { id: '00000064-aaaa-4b0b-a81f-000000000064', userId: '11111150-bbbb-49f0-b7c2-000000000064', name: 'Abenezer Abraham Tadesse', email: 'Abenezer.Abraham.Tadesse@nibbank.com.et', firstName: 'Abenezer', lastName: 'Abraham', phoneNumber: '0911698289', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Senior Corporate Officer' },
  { id: '00000065-aaaa-4b0b-a81f-000000000065', userId: '11111151-bbbb-49f0-b7c2-000000000065', name: 'Belaynew Berhanu Tesfaye', email: 'Belaynew.Berhanu@nibbank.com.et', firstName: 'Belaynew', lastName: 'Berhanu', phoneNumber: '0932293297', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Senior Corporate Officer' },
  { id: '00000066-aaaa-4b0b-a81f-000000000066', userId: '11111152-bbbb-49f0-b7c2-000000000066', name: 'Berhanu Alemayehu Gudeta', email: 'Berhanu.Alemayehu@nibbank.com.et', firstName: 'Berhanu', lastName: 'Alemayehu', phoneNumber: '0911460915', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Senior Corporate Officer' },
  { id: '00000067-aaaa-4b0b-a81f-000000000067', userId: '11111153-bbbb-49f0-b7c2-000000000067', name: 'Sintayehu Zewude Assefa', email: 'Sintayehu.Zewude@nibbank.com.et', firstName: 'Sintayehu', lastName: 'Zewude', phoneNumber: '0922867676', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Corporate Officer' },
  { id: '00000068-aaaa-4b0b-a81f-000000000068', userId: '11111154-bbbb-49f0-b7c2-000000000068', name: 'Simachew Bizuayehu Assefa', email: 'Simachew.Bizuayehu@nibbank.com.et', firstName: 'Simachew', lastName: 'Bizuayehu', phoneNumber: '0912049144', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Corporate Officer' },
  { id: '00000069-aaaa-4b0b-a81f-000000000069', userId: '11111155-bbbb-49f0-b7c2-000000000069', name: 'Dawit Zenebe W/Semayat', email: 'Dawit.Zenebe@nibbank.com.et', firstName: 'Dawit', lastName: 'Zenebe', phoneNumber: '0924699536', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Corporate Officer' },
  { id: '00000070-aaaa-4b0b-a81f-000000000070', userId: '11111156-bbbb-49f0-b7c2-000000000070', name: 'Marta Amare Alemu', email: 'Marta.Amare@nibbank.com.et', firstName: 'Marta', lastName: 'Amare', phoneNumber: '0923695018', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Secretary' },
  { id: '00000071-aaaa-4b0b-a81f-000000000071', userId: '11111157-bbbb-49f0-b7c2-000000000071', name: 'Getahun Abebe', email: 'Getahun.Abebe@nibbank.com.et', firstName: 'Getahun', lastName: 'Abebe', phoneNumber: '0911458552', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Director' },
  { id: '00000072-aaaa-4b0b-a81f-000000000072', userId: '11111158-bbbb-49f0-b7c2-000000000072', name: 'Kidist Tadesse', email: 'Kidist.Tadesse@nibbank.com.et', firstName: 'Kidist', lastName: 'Tadesse', phoneNumber: '0942586540', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Junior Secretary' },
  { id: '00000073-aaaa-4b0b-a81f-000000000073', userId: '11111159-bbbb-49f0-b7c2-000000000073', name: 'Daniel Ergogo', email: 'Daniel.Ergogo@nibbank.com.et', firstName: 'Daniel', lastName: 'Ergogo', phoneNumber: '0911606015', department: 'Credit Analysis & Appraisal Department', jobTitle: 'Deputy Chief' },
  { id: '00000074-aaaa-4b0b-a81f-000000000074', userId: '1111115a-bbbb-49f0-b7c2-000000000074', name: 'BELAY GORFU', email: 'Belay.Gorfu@nibbank.com.et', firstName: 'Belay', lastName: 'Gorfu', phoneNumber: '0911250057', department: 'Chief Wholesale Banking Office', jobTitle: 'Chief Wholesale Banking Officer' },
  { id: '00000075-aaaa-4b0b-a81f-000000000075', userId: '1111115b-bbbb-49f0-b7c2-000000000075', name: 'FIREHIWOT YOHANNES', email: 'Firehiwot.Yohannes@nibbank.com.et', firstName: 'Firehiwot', lastName: 'Yohannes', phoneNumber: '0913133381', department: 'Chief Wholesale Banking Office', jobTitle: 'Executive Secretary' },
  { id: '00000076-aaaa-4b0b-a81f-000000000076', userId: '1111115c-bbbb-49f0-b7c2-000000000076', name: 'Shimelis Haile', email: 'Shimelis.Haile@nibbank.com.et', firstName: 'Shimelis', lastName: 'Haile', phoneNumber: '0942207070', department: 'Institutional Banking and Hospitality, Green Financing Department', jobTitle: 'Director' },
  { id: '00000077-aaaa-4b0b-a81f-000000000077', userId: '1111115d-bbbb-49f0-b7c2-000000000077', name: 'TIRUSEW AYALEW LIYEW', email: 'Tirusew.Ayalew@nibbank.com.et', firstName: 'Tirusew', lastName: 'Ayalew', phoneNumber: '0911891971', department: 'Institutional Banking and Hospitality, Green Financing Department', jobTitle: 'Principal Customer Relationship Manager' },
  { id: '00000078-aaaa-4b0b-a81f-000000000078', userId: '1111115e-bbbb-49f0-b7c2-000000000078', name: 'FEVEN BEYENE YIMENU', email: 'Feven.Beyene@nibbank.com.et', firstName: 'Feven', lastName: 'Beyene', phoneNumber: '0922578765', department: 'Institutional Banking and Hospitality, Green Financing Department', jobTitle: 'Senior Insti Banking& hospi Green Financing Officer' },
  { id: '00000079-aaaa-4b0b-a81f-000000000079', userId: '1111115f-bbbb-49f0-b7c2-000000000079', name: 'Ato Henok Kebede Tades', email: 'Henok.Kebede@nibbank.com.et', firstName: 'Henok', lastName: 'Kebede', phoneNumber: '0115503304', department: 'CEO Office', jobTitle: 'CEO' },
  { id: '00000080-aaaa-4b0b-a81f-000000000080', userId: '11111160-bbbb-49f0-b7c2-000000000080', name: 'W/ro Kassanesh Abrham', email: 'Kassanesh.Abrham@nibbank.com.et', firstName: 'Kassanesh', lastName: 'Abrham', phoneNumber: '0995043493', department: 'CEO Office', jobTitle: 'Senior Executive Secretary' },
  { id: '00000081-aaaa-4b0b-a81f-000000000081', userId: '11111161-bbbb-49f0-b7c2-000000000061', name: 'Abel Atlabachew', email: 'Abel.Atlabachew@nibbank.com.et', firstName: 'Abel', lastName: 'Atlabachew', phoneNumber: '0965054347', department: 'District', districtName: 'WAAD', jobTitle: 'District Director' },
  { id: '00000082-aaaa-4b0b-a81f-000000000082', userId: '11111162-bbbb-49f0-b7c2-000000000062', name: 'Endalamahu Sileshi', email: 'Endalamahu.Sileshi@nibbank.com.et', firstName: 'Endalamahu', lastName: 'Sileshi', phoneNumber: '0911647993', department: 'District', districtName: 'WAAD', jobTitle: 'District Business Manager' },
  { id: '00000083-aaaa-4b0b-a81f-000000000083', userId: '11111163-bbbb-49f0-b7c2-000000000063', name: 'Amare Feleke', email: 'Amare.Feleke@nibbank.com.et', firstName: 'Amare', lastName: 'Feleke', phoneNumber: '0911697645', department: 'District', districtName: 'WAAD', jobTitle: 'District Operation Manager' },
  { id: '00000084-aaaa-4b0b-a81f-000000000084', userId: '11111164-bbbb-49f0-b7c2-000000000064', name: 'Aster Asfaw', email: 'Aster.Asfaw@nibbank.com.et', firstName: 'Aster', lastName: 'Asfaw', phoneNumber: '0921824996', department: 'District', districtName: 'WAAD', jobTitle: 'District Secretary' },
  { id: '00000085-aaaa-4b0b-a81f-000000000085', userId: '11111165-bbbb-49f0-b7c2-000000000065', name: 'Kalkidan Atnafu', email: 'Kalkidan.Atnafu@nibbank.com.et', firstName: 'Kalkidan', lastName: 'Atnafu', phoneNumber: '0911626315', department: 'District', districtName: 'WAAD', jobTitle: 'District CRM' },
  { id: '00000086-aaaa-4b0b-a81f-000000000086', userId: '11111166-bbbb-49f0-b7c2-000000000066', name: 'Dereje Ejersa', email: 'Dereje.Ejersa@nibbank.com.et', firstName: 'Dereje', lastName: 'Ejersa', phoneNumber: '0938019437', department: 'District', districtName: 'WAAD', jobTitle: 'District CRM' },
  { id: '00000087-aaaa-4b0b-a81f-000000000087', userId: '11111167-bbbb-49f0-b7c2-000000000067', name: 'H/Michael Ejigu', email: 'HMichael.Ejigu@nibbank.com.et', firstName: 'HMichael', lastName: 'Ejigu', phoneNumber: '0912902037', department: 'District', districtName: 'WAAD', jobTitle: 'District CRM' },
  { id: '00000088-aaaa-4b0b-a81f-000000000088', userId: '11111168-bbbb-49f0-b7c2-000000000068', name: 'Hiwot Bogale', email: 'Hiwot.Bogale@nibbank.com.et', firstName: 'Hiwot', lastName: 'Bogale', phoneNumber: '0912457252', department: 'District', districtName: 'WAAD', jobTitle: 'District CRM' },
  { id: '00000089-aaaa-4b0b-a81f-000000000089', userId: '11111169-bbbb-49f0-b7c2-000000000069', name: 'Zinash Yewaydemam', email: 'Zinash.Yewaydemam@nibbank.com.et', firstName: 'Zinash', lastName: 'Yewaydemam', phoneNumber: '0911568002', department: 'District', districtName: 'WAAD', jobTitle: 'District CRM' },
  { id: '00000090-aaaa-4b0b-a81f-000000000090', userId: '1111116a-bbbb-49f0-b7c2-000000000070', name: 'Misrak Asayehegn', email: 'Misrak.Asayehegn@nibbank.com.et', firstName: 'Misrak', lastName: 'Asayehegn', phoneNumber: '0911880255', department: 'District', districtName: 'WAAD', jobTitle: 'District CRM' },
  { id: '00000091-aaaa-4b0b-a81f-000000000091', userId: '1111116b-bbbb-49f0-b7c2-000000000071', name: 'Yeshibebet Yimer', email: 'Yeshibebet.Yimer@nibbank.com.et', firstName: 'Yeshibebet', lastName: 'Yimer', phoneNumber: '0973916609', department: 'District', districtName: 'WAAD', jobTitle: 'District CRM' },
  { id: '00000092-aaaa-4b0b-a81f-000000000092', userId: '1111116c-bbbb-49f0-b7c2-000000000072', name: 'Demeke Alemu', email: 'Demeke.Alemu@nibbank.com.et', firstName: 'Demeke', lastName: 'Alemu', phoneNumber: '0922995718', department: 'District', districtName: 'WAAD', jobTitle: 'District CRM' },
  { id: '00000093-aaaa-4b0b-a81f-000000000093', userId: '1111116d-bbbb-49f0-b7c2-000000000073', name: 'Woinishet Nekatibeb', email: 'Woinishet.Nekatibeb@nibbank.com.et', firstName: 'Woinishet', lastName: 'Nekatibeb', phoneNumber: '0911676882', department: 'District', districtName: 'WAAD', jobTitle: 'District CRM' },
  { id: '00000094-aaaa-4b0b-a81f-000000000094', userId: '1111116e-bbbb-49f0-b7c2-000000000074', name: 'Obsa Terefe', email: 'Obsa.Terefe@nibbank.com.et', firstName: 'Obsa', lastName: 'Terefe', phoneNumber: '0925475442', department: 'District', districtName: 'WAAD', jobTitle: 'District CRM' },
  { id: '00000095-aaaa-4b0b-a81f-000000000095', userId: '1111116f-bbbb-49f0-b7c2-000000000075', name: 'Nardos Dibisa', email: 'Nardos.Dibisa@nibbank.com.et', firstName: 'Nardos', lastName: 'Dibisa', phoneNumber: '0920025393', department: 'District', districtName: 'WAAD', jobTitle: 'District CRM' },
  { id: '00000096-aaaa-4b0b-a81f-000000000096', userId: '11111170-bbbb-49f0-b7c2-000000000076', name: 'Habtam Tadesse', email: 'Habtam.Tadesse@nibbank.com.et', firstName: 'Habtam', lastName: 'Tadesse', phoneNumber: '0941245029', department: 'District', districtName: 'WAAD', jobTitle: 'District CRM' },
  { id: '00000097-aaaa-4b0b-a81f-000000000097', userId: '11111171-bbbb-49f0-b7c2-000000000077', name: 'Desta G/Hanna', email: 'Desta.GHanna@nibbank.com.et', firstName: 'Desta', lastName: 'GHanna', phoneNumber: '0923349434', department: 'District', districtName: 'WAAD', jobTitle: 'District CRM' },
  { id: '00000098-aaaa-4b0b-a81f-000000000098', userId: '11111172-bbbb-49f0-b7c2-000000000078', name: 'Cheramlak Mare', email: 'Cheramlak.Mare@nibbank.com.et', firstName: 'Cheramlak', lastName: 'Mare', phoneNumber: '0922358514', department: 'District', districtName: 'WAAD', jobTitle: 'District Analyst' },
  { id: '00000099-aaaa-4b0b-a81f-000000000099', userId: '11111173-bbbb-49f0-b7c2-000000000079', name: 'Woinishet Terefe', email: 'Woinishet.Terefe@nibbank.com.et', firstName: 'Woinishet', lastName: 'Terefe', phoneNumber: '0967670318', department: 'District', districtName: 'WAAD', jobTitle: 'District Analyst' },
];

const districtsToSeed: Record<string, string[]> = {
  NAAD: ['Abakoran', 'Addisu Gebeya', 'Amist Kilo', 'Arada giorgis', 'Arat Killo Premium', 'Artist Mohamud Ahmed (Arada)', 'Atiklet Tera', 'Aware', 'Cathedral', 'Chilot', 'Churchil', 'Enqulal Fabrica', 'Ferensay Legasion', 'Gola', 'Gulele', 'H/Giorgis', 'Janmeda', 'Kazanchis', 'Kebena', 'Kotebe', 'Kotebe Gebeya', 'Nib Premium', 'Ras', 'Rufael', 'Sebara Babure', 'Senga tera', 'Sheger Menafesha', 'Shiro Meda', 'Shola Gebeya', 'Sholla', 'Sidest Killo', 'Stadium', 'T/Adebabay', 'Tigat', 'Wessen', 'Wuha Limat', 'Yeka (Engliz Embassy)', 'Yeka Abado', 'Fiche', 'Gebra Guracha', 'Sululta'],
  WAAD: ['Abinet', 'Abinet Adebabay', 'Adarash', 'Addis Ketema', 'Addisu Michael', 'Alem Bank', 'Alem Bank Tropical', 'Alert', 'Asfa Wossen', 'Asko', 'Ayertena', 'B/Abanefso', 'Bethel', 'Bethel Rom Sefer', 'Billal', 'Cinma Ras', "D'Afrique", 'Daremar Branch', 'Dubai Tera', 'Ehil Berenda', 'Geja Sefer', 'Kara Kore', 'Kolfe', 'Kolfe Atana Tera', 'Kolfe Efoyita', 'Kolfe Fetno Derash', 'Kolfe Taywan', 'Lideta', 'Lomi Meda', 'Mehal Merkato', 'Military Tera', 'Mirab Merkato', 'Mismar tera', 'NIB Halal Amin', 'NIB Halal Autobus Tera', 'Nib Halal Aysha', 'Nib Halal Emana', 'Nib Halal Kolfe Efoyta', 'Nib Halal Nur Mesgid', 'Nib Halal Taqwa', 'Raguel', 'Sefere Selam', 'Shera Tera', 'Sidamo Tera', 'T/Haimanot', 'Tana', 'Tatari', 'Tiret', 'Tor-Hayiloch', 'Yekake Wordwet', 'Abdi Nono', 'Ambo', 'Anfo', 'Burayu', 'Holeta', 'Melka Geferesa'],
  EAAD: ['Arabssa', 'Ayat 49 Mazoria', 'Ayat 72', 'Ayat Adebabay', 'Ayat Arabssa', 'Ayat Mall', 'Ayat-Tafo', 'Beshale', 'Bole 24', 'Bole Atlas', 'Bole Brass', 'Bole Chefe', 'Bole Eniredada', 'Bole M/Alem', 'Bole Stadium', 'CMC', 'Gerji Giorgis', 'Gerji Mebrat Haile', 'Goro', 'Gurd Shola', 'Hayahulet Mazoria', 'Hayahulet Megenanga', 'Imperial', 'Imperial Sport Acadamy', 'Jacros', 'Jacros Beshale', 'Kara Alo', 'Karamara', 'Lamberet', 'Main', 'Megenagna Athlete Derartu Tulu', 'Megenagna', 'Megenagna Gurd shola', 'Mehal Summit', 'Meri Loque', 'Moenco', 'Peacock', 'Sealite Mehret', 'Shala Area', 'Summit', 'Summit CMC Adebabay', 'Summit Figa', 'Urael', 'Yerer Ber', 'Atse Zerayakob', 'Debre Eba', 'Debrebirehan', 'Legetafo', 'Sheno'],
  SAAD: ['Africa Avenue', 'Akaki Gebeya', 'B/Gebreal', 'Beklobet', 'Bole', 'Bole Bulbula', 'Bole Bulbula Mariam Mazoria', 'Bole Jaefer Mesjid', 'Bole Michael', 'Bole Rwanda', 'Bulbula 93 Mazoria', 'Buna Board', 'Denbel Corporate Banking Center', 'Flamingo', 'Furi', 'Furi Adebabay', 'Gara Duba', 'Gelan Condominium', 'Gofa Gebriel', 'Gofa Mazoria', 'Gotera', 'Gotera Ibex', 'Hana Mariam', 'Jemo', 'Kality', 'Kality Menaharia', 'Kera Sar Bet', 'Kirkos', 'Lafto', 'Lebu Irtu', 'Lebu Muzica Sefer', 'Lebu', 'Mamokacha', 'Mechare', 'Mehal Lafto', 'Mekanissa', 'Mekanissa Kore', 'Mekenisa Michael', 'Meskel Flower', 'Nib Halal Gofa', 'Nifas Silk', 'Olympia', 'Salogora', 'Sarbet', 'Saris', 'Saris Abo', 'Saris Addisu Sefer', 'Sefera Atikilt tera', 'Temenja Yaze', 'Tulu Dimtu', 'Vatican', 'Wello Sefer', 'Zenebe Worq Gebeya', 'Alem Gena', 'Sebeta', 'Wechecha'],
  Hawassa: ['Adare', 'Adola Woyu', 'Aleta Chuko', 'Aleta Wondo', 'Arbaminch', 'Arbaminch Gebeya', 'Areb Sefer', 'Arsi Negele', 'Awasho', 'Birbir', 'Bore', 'Bule Hora', 'Daye', 'Dilla', 'Dilla Edget', 'Damota', 'Gedeb', 'Gelila', 'Gesuba', 'Harufa', 'Hawassa', 'Hawassa Alamura', 'Hawassa Atote', 'Hawassa Menaheria', 'Hawassa-Warka', 'Humbo', 'Jinka', 'Moyale sub branch', 'Negele Borena', 'Nib Halal Shashemene', 'Sawula', 'Selam Ber', 'Shakiso', 'Shashemene', 'Shashemene ODA', 'Shecha', 'Tabor', 'W/Sodo', 'W/sodo Menharia', 'Yabelo', 'Yirgachefe', 'Yirgalem'],
  Hossaena: ['Adillo Sub Branch', 'Angacha', 'Ansho (Duna Ketema)', 'Areka', 'Bele', 'Boditi', 'Bombe', 'Bonosha', 'Domboya', 'Doyogena', 'Durame', 'Fonko', 'Gimbichu', 'Hadero', 'Halaba Kulito', 'Homecho', 'Hossaena Batena', 'Hossaena Gebeya', 'Hossaena Meneharia', 'Hossana', 'Hossana Arada', 'Hossana Gombora', 'Lera', 'Mudula', 'Nib Halal Aman', 'Nib Halal Dalocha', 'Nib Halal Hakika (Werabe Duna)', 'Nib Halal Hossana', 'Nib Halal Kibet', 'Nib Halal Silte Mitto', 'Nib Halal Tora', 'Sankura', 'Shinshicho', 'Shone', 'Wachamo University Sub-Br', 'Werabe'],
  'Bahir Dar': ['Abay Mado', 'Adet Tera', 'Bahir Dar Gebeya', 'Bahir Dar Ghion', 'Bahir Dar Tana', 'Bahir Dar', 'Bichena', 'Dangila', 'Debre Markos Gebeya (Sub )', 'Debre tabor', 'Debremarkos', 'Dejene', 'Durbete', 'Enjibara', 'Fasilo', 'Finote Selam', 'Gondar', 'Gonder Maraki', 'Humera', 'M/Yohanns (Sub Branch )', 'Merawi', 'Mota', 'Nib Halal Bahir Dar Ramadan', 'Nifas Mewcha', 'Woreta'],
  'Dire Dawa': ['Afetesa', 'Aw-Bare', 'Aweday', 'Bedessa', 'Chiro', 'Dire Dawa', 'Gelemso', 'Harar', 'Harar Ras', 'Hirna', 'Jigjiga Shebele', 'Jijiga', 'Kefira', 'Kezira Main', 'Melka Rafu', 'Mideregenet (Harer)', 'Nib Halal Kezira', 'Sabian Gulit', 'Sabian Meskelegna', 'Togo Chale Sub Branch'],
  Jimma: ['Agaro', 'Aman (Sub Branch )', 'Assosa', 'Bambasi', 'Bedele', 'Beshishe (Sub branch)', 'Bonga', 'Chora', 'Dembidolo', 'Dima', 'Gambela', 'Gimbi', 'Jimma (050)', 'Jimma Abajifar', 'Jimma Menharia', 'Limu Genet', 'Meti', 'Mettu', 'Mizan', 'Nekemte', 'Nib Halal Areboch Tera', 'Tarecha', 'Tepi', 'Wacha'],
  Adama: ['Adama Boset', 'Adama Menaharia', 'Adama.', 'Adda Bishoftu', 'Arerti', 'Asela', 'Awash 7 Killo', 'Bale Robe', 'Batu', 'Bekoji', 'Berecha', 'Bishoftu Michael', 'Bishoftu', 'Chillalo', 'Denbela', 'Digelou', 'Dodolla', 'Dukem', 'Dukem Eastern Industry', 'Eteya', 'Geda (Adama Moenco sub branch)', 'Ginb Gebeya(Adama )', 'Goba', 'Hasasa', 'Huruta', 'M/A/Adama', 'Meki', 'Modjo', 'Modjo Derk Wedb', 'Nib Halal Adama', 'Olen chiti', 'Sagure', 'Tiyo Assela', 'Ziquala Bishoftu'],
  Dessie: ['Ayiteyef', 'Bati', 'Dessie', 'Haik', 'Kemise', 'Kobo', 'Kombolcha', 'Lakomelza', 'Lalibella', 'Logia', 'Mersa', 'Semera', 'Shewa Robit', 'Woldia'],
  Mekelle: ['Adi Haqi', 'Adigrat', 'Axum', 'Kesate Birehan', 'Mekelle', 'Mesobo', 'Shire', 'Wekro'],
  Wolikite: ['Agena', 'Areket', 'Bozheber', 'Buie', 'Butajira', 'Darge', 'Emdebir', 'Endegegn', 'Ensino', 'Gunchire', 'Hawaryat', 'Kare', 'Kella', 'Kosie', 'L/T/J/W/Silase Bereka (Gubre )', 'Mareko Koshe', 'Nib Halal Bidara Gebeya', 'Nib Halal Gubre Bilal', 'Nib Halal Rebi', 'Quante', 'Tiya Bitwoded Bahiru', 'Tulu Bollo', 'Walga', 'Woliso', 'Wolkite', 'Wolkite University Sub-Br.', 'Yejoka', 'Zebidar'],
};

const prisma = new PrismaClient();

const DocumentRequirementType = {
  CHECKBOX: 'CHECKBOX',
  UPLOAD: 'UPLOAD',
} as const;

async function main() {
  console.log(`🚀 Start seeding ...`);

  // ==================== DEFAULT PASSWORD ====================
  const DEFAULT_PASSWORD = "password123";
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // ==================== SEED SECTORS ====================
  console.log('Seeding Sectors...');
  const parentSectors = [
    'Institutional Banking and Hospitality and Green Financing Sector',
    'Service sector Department',
    'Construction Manufacturing and Agriculture Sector Department'
  ];
  const childSectors: Record<string, string[]> = {
    'Institutional Banking and Hospitality and Green Financing Sector': ['Financial Institution', 'Mining, Power and Water'],
    'Service sector Department': [
      'Domestic Trade and Service',
      'Hotel and Tourism',
      'Transport',
      'International Trade – Export',
      'International Trade – Import',
      'Personal Loan'
    ],
    'Construction Manufacturing and Agriculture Sector Department': [
      'Manufacturing Industry',
      'Agriculture',
      'Building and Construction'
    ],
  };

  for (const sectorName of parentSectors) {
    const parent = await prisma.sector.upsert({
      where: { name: sectorName },
      update: {},
      create: { name: sectorName },
    });

    if (childSectors[sectorName]) {
      for (const childName of childSectors[sectorName]) {
        await prisma.sector.upsert({
          where: { name: childName },
          update: { parentId: parent.id },
          create: { name: childName, parentId: parent.id },
        });
      }
    }
  }

  // ==================== SEED REQUEST TYPES ====================
  const requestTypes = [
    'Additional Facility',
    'Apeal',
    'Collateral Substitution',
    'Fresh Loan',
    'Guarantee',
    'Letters',
    'New Loan',
    'Restructuring',
  ];
  for (const name of requestTypes) {
    await prisma.requestType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // ==================== SEED DEPARTMENTS ====================
  console.log('Seeding Departments...');
  const uniqueDepts = Array.from(
    new Set([
      ...appMockUsers.map((u) => u.department).filter(Boolean),
      'District', // Required for District Specialized (TYPE-2) workflow stages
    ])
  );
  for (const deptName of uniqueDepts) {
    await prisma.department.upsert({
      where: { nameLowercase: deptName.toLowerCase() },
      update: {},
      create: {
        name: deptName,
        nameLowercase: deptName.toLowerCase(),
      },
    });
  }

  // ==================== SEED DISTRICTS & BRANCHES ====================
  console.log('Seeding Districts and Branches...');
  for (const [districtName, branches] of Object.entries(districtsToSeed)) {
    const district = await prisma.district.upsert({
      where: { name: districtName },
      update: {},
      create: { name: districtName },
    });
    for (const branchName of branches) {
      await prisma.branch.upsert({
        where: { name_districtId: { name: branchName, districtId: district.id } },
        update: {},
        create: { name: branchName, districtId: district.id }
      });
    }
  }

  // ==================== SEED ROLES ====================
  console.log('Seeding Roles...');
  const rolesToSeed = [
    { name: "Administrator", permissions: ALL_PERMISSIONS },
    { name: "Chief", permissions: ALL_PERMISSIONS },
    { name: "CEO", permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_EXECUTIVE_OVERVIEW, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS, PERMISSIONS.VIEW_CUSTOMERS] },
    { name: "Director", permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_EXECUTIVE_OVERVIEW, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS, PERMISSIONS.VIEW_CUSTOMERS, PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE, PERMISSIONS.VIEW_MANAGER_REVIEW_HISTORY, PERMISSIONS.VIEW_INCOMING_CASES, PERMISSIONS.VIEW_UNASSIGNED_CASES_QUEUE, PERMISSIONS.ASSIGN_LOAN_TO_STAFF, PERMISSIONS.PROMOTE_LOAN_STAGE, PERMISSIONS.RETURN_LOAN_FOR_REWORK] },
    { name: "Manager", permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_EXECUTIVE_OVERVIEW, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS, PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE, PERMISSIONS.VIEW_MANAGER_REVIEW_HISTORY, PERMISSIONS.VIEW_INCOMING_CASES, PERMISSIONS.VIEW_UNASSIGNED_CASES_QUEUE, PERMISSIONS.PROMOTE_LOAN_STAGE, PERMISSIONS.ASSIGN_LOAN_TO_STAFF] },
    { name: "Deputy Chief", permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_EXECUTIVE_OVERVIEW, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS, PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE, PERMISSIONS.VIEW_MANAGER_REVIEW_HISTORY, PERMISSIONS.VIEW_INCOMING_CASES, PERMISSIONS.VIEW_UNASSIGNED_CASES_QUEUE, PERMISSIONS.VIEW_OWN_ASSIGNED_CASES, PERMISSIONS.ASSIGN_LOAN_TO_STAFF, PERMISSIONS.PROMOTE_LOAN_STAGE, PERMISSIONS.RETURN_LOAN_FOR_REWORK, PERMISSIONS.ADD_LOAN_NOTES] },
    { name: "CRM", permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS, PERMISSIONS.VIEW_OWN_ASSIGNED_CASES, PERMISSIONS.VIEW_CUSTOMERS, PERMISSIONS.CREATE_LOAN_REQUEST, PERMISSIONS.EDIT_LOAN_DETAILS, PERMISSIONS.UPLOAD_LOAN_DOCUMENTS, PERMISSIONS.ADD_LOAN_NOTES, PERMISSIONS.MARK_STAGE_COMPLETE, PERMISSIONS.PROMOTE_LOAN_STAGE] },
    { name: "Loan Officer", permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS, PERMISSIONS.VIEW_OWN_ASSIGNED_CASES, PERMISSIONS.EDIT_LOAN_DETAILS, PERMISSIONS.UPLOAD_LOAN_DOCUMENTS, PERMISSIONS.ADD_LOAN_NOTES, PERMISSIONS.MARK_STAGE_COMPLETE] },
    { name: "Credit Appraisal Officer", permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS, PERMISSIONS.VIEW_OWN_ASSIGNED_CASES, PERMISSIONS.EDIT_LOAN_DETAILS, PERMISSIONS.UPLOAD_LOAN_DOCUMENTS, PERMISSIONS.ADD_LOAN_NOTES, PERMISSIONS.MARK_STAGE_COMPLETE] },
    { name: "Property Valuation Officer", permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS, PERMISSIONS.VIEW_MY_VALUATION_CASES, PERMISSIONS.VIEW_DISTRICT_VALUATION, PERMISSIONS.EDIT_LOAN_DETAILS, PERMISSIONS.UPLOAD_LOAN_DOCUMENTS, PERMISSIONS.VERIFY_LOAN_DOCUMENTS, PERMISSIONS.ADD_LOAN_NOTES, PERMISSIONS.MARK_STAGE_COMPLETE, PERMISSIONS.FULFILL_INFO_REQUEST] },
    { name: "Manager, Property Valuation (Maker)", permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS, PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE, PERMISSIONS.VIEW_MANAGER_REVIEW_HISTORY, PERMISSIONS.VIEW_MY_VALUATION_CASES, PERMISSIONS.VIEW_DISTRICT_VALUATION, PERMISSIONS.VIEW_INCOMING_CASES, PERMISSIONS.ADD_LOAN_NOTES, PERMISSIONS.LOG_INFO_REQUEST, PERMISSIONS.RETURN_LOAN_FOR_REWORK, PERMISSIONS.ASSIGN_LOAN_TO_STAFF, PERMISSIONS.FLAG_URGENT_CASE, PERMISSIONS.MARK_STAGE_COMPLETE] },
    { name: "Manager, Property Valuation (Checker)", permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS, PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE, PERMISSIONS.VIEW_MANAGER_REVIEW_HISTORY, PERMISSIONS.VIEW_MY_VALUATION_CASES, PERMISSIONS.VIEW_DISTRICT_VALUATION, PERMISSIONS.ADD_LOAN_NOTES, PERMISSIONS.PROMOTE_LOAN_STAGE, PERMISSIONS.RETURN_LOAN_FOR_REWORK, PERMISSIONS.FLAG_URGENT_CASE] },
    { name: "Secretary", permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.CREATE_LOAN_REQUEST, PERMISSIONS.VIEW_OWN_SUBMITTED_CASES] },
    // District workflow roles
    { name: "District Manager", permissions: [
      PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS,
      PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE, PERMISSIONS.VIEW_MANAGER_REVIEW_HISTORY,
      PERMISSIONS.VIEW_DISTRICT_DASHBOARD, PERMISSIONS.VIEW_INCOMING_CASES,
      PERMISSIONS.VIEW_OWN_ASSIGNED_CASES, PERMISSIONS.ASSIGN_LOAN_TO_STAFF,
      PERMISSIONS.PROMOTE_LOAN_STAGE, PERMISSIONS.RETURN_LOAN_FOR_REWORK,
      PERMISSIONS.ADD_LOAN_NOTES, PERMISSIONS.FLAG_URGENT_CASE,
    ] },
    { name: "District Analyst", permissions: [
      PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS,
      PERMISSIONS.VIEW_DISTRICT_ANALYST_REVIEW, PERMISSIONS.VIEW_OWN_ASSIGNED_CASES,
      PERMISSIONS.EDIT_LOAN_DETAILS, PERMISSIONS.UPLOAD_LOAN_DOCUMENTS,
      PERMISSIONS.ADD_LOAN_NOTES, PERMISSIONS.MARK_STAGE_COMPLETE,
      PERMISSIONS.DISTRIBUTE_TO_DISTRICT_APPROVAL,
      PERMISSIONS.APPROVE_COMMITTEE_CASES,
    ] },
    { name: "District Crm", permissions: [
      PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS,
      PERMISSIONS.VIEW_OWN_ASSIGNED_CASES, PERMISSIONS.VIEW_CUSTOMERS,
      PERMISSIONS.VIEW_DISTRICT_DASHBOARD,
      PERMISSIONS.EDIT_LOAN_DETAILS, PERMISSIONS.UPLOAD_LOAN_DOCUMENTS,
      PERMISSIONS.ADD_LOAN_NOTES, PERMISSIONS.MARK_STAGE_COMPLETE, PERMISSIONS.PROMOTE_LOAN_STAGE,
    ] },
    { name: "District secretary", permissions: [
      PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.CREATE_LOAN_REQUEST,
      PERMISSIONS.VIEW_OWN_SUBMITTED_CASES, PERMISSIONS.VIEW_DISTRICT_DASHBOARD,
    ] },
    { name: "viewer", permissions: [
      PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_LOAN_PIPELINE,
      PERMISSIONS.VIEW_LOAN_DETAILS, PERMISSIONS.VIEW_CUSTOMERS, PERMISSIONS.VIEW_REPORTS,
    ] },
  ];

  for (const roleData of rolesToSeed) {
    const serializedPermissions = JSON.stringify(roleData.permissions || []);
    await prisma.role.upsert({
      where: { name: roleData.name },
      update: { permissions: serializedPermissions },
      create: { name: roleData.name, permissions: serializedPermissions },
    });
  }

  // Rename legacy "Cao" / "Ceo" roles → "CEO"
  const ceoRole = await prisma.role.findUnique({ where: { name: 'CEO' } });
  for (const legacyName of ['Cao', 'Ceo'] as const) {
    const legacyRole = await prisma.role.findUnique({ where: { name: legacyName } });
    if (!legacyRole) continue;
    if (ceoRole) {
      await prisma.user.updateMany({
        where: { customRoleId: legacyRole.id },
        data: { customRoleId: ceoRole.id },
      });
      await prisma.role.delete({ where: { id: legacyRole.id } });
    } else {
      await prisma.role.update({
        where: { id: legacyRole.id },
        data: { name: 'CEO' },
      });
    }
  }

  // ==================== SEED USERS ====================
  console.log('Seeding Users...');
  for (const userData of appMockUsers) {
    const dept = await prisma.department.findUnique({ where: { nameLowercase: userData.department.toLowerCase() } });
    const district = userData.districtName
      ? await prisma.district.findUnique({ where: { name: userData.districtName } })
      : null;

    // Map job title to role
    const jobTitle = (userData.jobTitle || '').toLowerCase();
    const departmentName = dept?.name || userData.department;
    let roleName = "Loan Officer";
    if (departmentName === 'Property Valuation Department') {
      if (jobTitle.includes("manager") && jobTitle.includes("maker")) roleName = "Manager, Property Valuation (Maker)";
      else if (jobTitle.includes("manager") && jobTitle.includes("checker")) roleName = "Manager, Property Valuation (Checker)";
      else if (jobTitle.includes("manager")) roleName = "Manager"; // Fallback
      else roleName = 'Property Valuation Officer';
    } else if (departmentName === 'Credit Analysis & Appraisal Department') {
      roleName = 'Credit Appraisal Officer';
    } else if (departmentName === 'District' || departmentName === 'Service Sector Department') {
      if (jobTitle.includes('analyst')) roleName = 'District Analyst';
      else if (jobTitle.includes('manager')) roleName = 'District Manager';
      else if (jobTitle.includes('crm')) roleName = 'District Crm';
      else if (jobTitle.includes('secretary')) roleName = 'District secretary';
      else if (jobTitle.includes('director')) roleName = 'Director';
    }
    
    if (roleName === "Loan Officer" || roleName === "Property Valuation Officer" || roleName === "Credit Appraisal Officer") {
      if (jobTitle.includes("deputy chief")) roleName = "Deputy Chief";
      else if (jobTitle.includes("director")) roleName = "Director";
      else if (jobTitle.includes("manager") && departmentName !== 'Property Valuation Department') roleName = "Manager";
      else if (jobTitle.includes("crm")) roleName = "CRM";
      else if (jobTitle.includes("secretary")) roleName = "Secretary";
      else if (jobTitle.includes("chief")) roleName = "Chief";
      else if (jobTitle.includes("ceo")) roleName = "CEO";
    }

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    const finalUserId = userData.userId || userData.id;
    const normalizedPhoneNumber = normalizeEthiopianPhone(userData.phoneNumber);

    await prisma.user.upsert({
      where: { userId: finalUserId },
      update: {
        name: userData.name,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: normalizedPhoneNumber || userData.phoneNumber,
        departmentId: dept?.id,
        districtId: district?.id,
        customRoleId: role?.id,
        isActive: true,
      },
      create: {
        userId: finalUserId,
        name: userData.name,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: normalizedPhoneNumber || userData.phoneNumber,
        passwordHash: passwordHash,
        isPasswordChanged: false,
        isActive: true,
        departmentId: dept?.id,
        districtId: district?.id,
        customRoleId: role?.id,
      },
    });
  }

  // Admin Account
  await prisma.user.upsert({
    where: { email: 'system@loanflow.app' },
    update: {
      phoneNumber: '0000000000',
      isActive: true,
      isPasswordChanged: true,
    },
    create: {
      userId: 'system-admin',
      name: 'System Admin',
      email: 'system@loanflow.app',
      phoneNumber: '0000000000',
      passwordHash: await bcrypt.hash("admin123", 10),
      isPasswordChanged: true,
      isActive: true,
      customRole: { connect: { name: 'Administrator' } }
    }
  });

  // ==================== SEED WORKFLOWS ====================
  console.log('Seeding Workflows...');
  const standardWorkflowsToSeed = [
    { name: 'WF-01 – RM Request Registration (Acceptance)', order: 1, purpose: 'Initial registration and acceptance of loan requests by Relationship Managers.' },
    { name: 'WF-02 – Valuation', order: 2, purpose: 'Perform asset or collateral valuation for the loan application.' },
    { name: 'WF-03 – RM Valuation Result', order: 3, purpose: 'Record and review valuation results by the RM team.' },
    { name: 'WF-04 – Valuation Appeal (Optional Workflow)', order: 4, purpose: 'Handle appeals related to the asset valuation.' },
    { name: 'WF-05 – Appraisal', order: 5, purpose: 'Conduct comprehensive credit and risk appraisal based on valuation and financial analysis.' },
    { name: 'WF-06 – RM Disbursement', order: 6, purpose: 'Handles the initial disbursement process after appraisal.' },
    { name: 'WF-07 – Appraisal Appeal (Optional Workflow)', order: 7, purpose: 'Handle appeals related to the credit appraisal decision.' },
    { name: 'WF-08 – RM Final Disbursement (Optional Workflow)', order: 8, purpose: 'Final approval and disbursement processing by RM following successful appraisal.' },
  ];

  const sharedWorkflowStageDepartments: Record<string, string> = {
    'WF-02 – Valuation': 'Property Valuation Department',
    'WF-05 – Appraisal': 'Credit Analysis & Appraisal Department',
  };

  const resolveStageDepartmentName = (workflowName: string, sectorDepartmentName: string) => {
    return sharedWorkflowStageDepartments[workflowName] || sectorDepartmentName;
  };

  const seedWorkflowPath = async (
    parentSectorName: string,
    childSectorName: string,
    departmentName: string
  ) => {
    console.log(`--- Seeding Workflows for ${parentSectorName} / ${childSectorName}...`);
    const parentSector = await prisma.sector.findUnique({ where: { name: parentSectorName } });
    const childSector = await prisma.sector.findUnique({ where: { name: childSectorName } });
    const workflowDepartment = await prisma.department.findUnique({ where: { nameLowercase: departmentName.toLowerCase() } });

    if (!parentSector || !childSector || !workflowDepartment) {
      console.error(`Could not find necessary entities for ${parentSectorName}. Aborting.`);
      console.error(`Missing: ${!parentSector ? 'Parent Sector, ' : ''}${!childSector ? 'Child Sector, ' : ''}${!workflowDepartment ? 'Department' : ''}`);
      return;
    }

    for (const wf of standardWorkflowsToSeed) {
      const duplicateDefinitions = await prisma.workflowDefinition.findMany({
        where: {
          sectorId: childSector.id,
          name: wf.name,
        },
        orderBy: [{ createdAt: 'desc' }],
        include: {
          versions: { select: { id: true } },
        },
      });

      let workflowDefinition = duplicateDefinitions[0];
      if (workflowDefinition) {
        workflowDefinition = await prisma.workflowDefinition.update({
          where: { id: workflowDefinition.id },
          data: {
            description: wf.purpose,
            order: wf.order,
            departmentId: workflowDepartment.id,
          },
          include: {
            versions: { select: { id: true } },
          },
        });
        console.log(`Reused Workflow Definition: ${workflowDefinition.name}`);
      } else {
        workflowDefinition = await prisma.workflowDefinition.create({
          data: {
            name: wf.name,
            description: wf.purpose,
            order: wf.order,
            department: { connect: { id: workflowDepartment.id } },
            sector: { connect: { id: childSector.id } },
          },
          include: {
            versions: { select: { id: true } },
          },
        });
        console.log(`Created Workflow Definition: ${workflowDefinition.name}`);
      }

      // Keep one canonical workflow definition per child sector + workflow name.
      for (const duplicate of duplicateDefinitions.slice(1)) {
        const duplicateVersionIds = duplicate.versions.map((v) => v.id);
        if (duplicateVersionIds.length === 0) {
          await prisma.workflowDefinition.delete({ where: { id: duplicate.id } });
          continue;
        }

        const usedByLoans = await prisma.loanRequest.count({
          where: { workflowVersionId: { in: duplicateVersionIds } },
        });

        if (usedByLoans > 0) {
          continue;
        }

        await prisma.documentRequirement.deleteMany({
          where: {
            workflowStage: {
              workflowVersionId: { in: duplicateVersionIds },
            },
          },
        });
        await prisma.workflowStageDefinition.deleteMany({
          where: { workflowVersionId: { in: duplicateVersionIds } },
        });
        await prisma.workflowVersion.deleteMany({
          where: { id: { in: duplicateVersionIds } },
        });
        await prisma.workflowDefinition.delete({ where: { id: duplicate.id } });
      }

      let workflowVersion = await prisma.workflowVersion.findFirst({
        where: {
          workflowDefinitionId: workflowDefinition.id,
          isActive: true,
        },
        orderBy: [{ versionNumber: 'desc' }, { createdAt: 'desc' }],
      });

      let shouldSeedStages = false;
      if (!workflowVersion) {
        workflowVersion = await prisma.workflowVersion.create({
          data: {
            workflowDefinition: { connect: { id: workflowDefinition.id } },
            versionNumber: 1,
            isActive: true,
          },
        });
        shouldSeedStages = true;
        console.log(`  - Created active Version 1 for ${workflowDefinition.name}`);
      }

      const responsibleDepartmentName = resolveStageDepartmentName(wf.name, workflowDepartment.name);
      const responsibleDepartment = await prisma.department.findUnique({
        where: { nameLowercase: responsibleDepartmentName.toLowerCase() },
      });
      if (!responsibleDepartment) {
        throw new Error(`Department \"${responsibleDepartmentName}\" not found for ${wf.name}`);
      }

      if (!shouldSeedStages) {
        continue;
      }

      if (wf.name === 'WF-01 – RM Request Registration (Acceptance)') {
        const wf01Stages = [
          { name: 'RM Submit Checklist', order: 0, timeline: 1, weight: 5, docs: [] },
          { name: 'Submit Acknowledgement Letter', order: 1, timeline: 1, weight: 20, docs: [] },
          {
            name: 'Submit to Property Valuation', order: 2, timeline: 1, weight: 10,
            docs: [
              { name: 'Estimation Fee', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Property Valuation Form', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'LHC Copy / Booklet Copy', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Customer Application Form', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
            ],
          },
        ];

        for (const stageInfo of wf01Stages) {
          const stage = await prisma.workflowStageDefinition.create({
            data: {
              name: stageInfo.name,
              order: stageInfo.order,
              defaultTimelineDays: stageInfo.timeline,
              percentageWeight: stageInfo.weight,
              workflowVersion: { connect: { id: workflowVersion.id } },
              responsibleDepartment: { connect: { id: responsibleDepartment.id } },
              availableStatuses: JSON.stringify({ [responsibleDepartment.name]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited', 'Returned'] }),
            },
          });
          console.log(`    - Created stage "${stage.name}" for Version 1`);

          for (const doc of stageInfo.docs) {
            await prisma.documentRequirement.create({
              data: {
                name: doc.name,
                isMandatory: doc.isMandatory,
                type: doc.type,
                workflowStage: { connect: { id: stage.id } },
              },
            });
            console.log(`      - Added doc requirement: "${doc.name}"`);
          }
        }
      } else if (wf.name === 'WF-02 – Valuation') {
        const wf02Stages = [
          {
            name: 'Valuation Maker', order: 0, timeline: 2, weight: 1,
            docs: [
              { name: 'Requesting Form', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'LHC / Title Certificate / Declaration / PI / CI', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Customer Form / Previous Estimation', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Estimation Fee', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
            ],
          },
          {
            name: 'Valuation 01-A', order: 1, timeline: 8, weight: 10,
            docs: [
              { name: 'Requesting Form', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'LHC / Title Certificate / Declaration / PI / CI', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Customer Form / Previous Estimation', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Estimation Fee', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
            ],
          },
          {
            name: 'Valuation Checker', order: 2, timeline: 2, weight: 1,
            docs: [
              { name: 'Requesting Form', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'LHC / Title Certificate / Declaration / PI / CI', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Customer Form / Previous Estimation', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Estimation Fee', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
            ],
          },
          {
            name: 'Valuation 02-A', order: 3, timeline: 2, weight: 10,
            docs: [
              { name: 'Requesting Form', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'LHC / Title Certificate / Declaration / PI / CI', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Customer Form / Previous Estimation', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Estimation Fee', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
            ],
          },
          {
            name: 'Valuation Finalization', order: 4, timeline: 1, weight: 10,
            docs: [
              { name: 'Property Estimation Result', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
            ],
          },
        ];

        for (const stageInfo of wf02Stages) {
          const stage = await prisma.workflowStageDefinition.create({
            data: {
              name: stageInfo.name,
              order: stageInfo.order,
              defaultTimelineDays: stageInfo.timeline,
              percentageWeight: stageInfo.weight,
              workflowVersion: { connect: { id: workflowVersion.id } },
              responsibleDepartment: { connect: { id: responsibleDepartment.id } },
              availableStatuses: JSON.stringify({ [responsibleDepartment.name]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited', 'Returned'] }),
            },
          });
          console.log(`    - Created stage "${stage.name}" for Version 1`);

          for (const doc of stageInfo.docs) {
            await prisma.documentRequirement.create({
              data: {
                name: doc.name,
                isMandatory: doc.isMandatory,
                type: doc.type,
                workflowStage: { connect: { id: stage.id } },
              },
            });
            console.log(`      - Added doc requirement: "${doc.name}"`);
          }
        }
      } else if (wf.name === 'WF-03 – RM Valuation Result') {
        const wf03Stages = [
          {
            name: 'Major Requirements Document', order: 0, timeline: 1, weight: 15,
            docs: [
              { name: 'Financial Statements Received', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Property Valuation Results Received', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Tax Clearance Received', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Business License Received', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'CRB Report Received', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Other Related Document', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
            ],
          },
          { name: 'Prepare DDR and LAF', order: 1, timeline: 3, weight: 10, docs: [] },
        ];

        for (const stageInfo of wf03Stages) {
          const stage = await prisma.workflowStageDefinition.create({
            data: {
              name: stageInfo.name,
              order: stageInfo.order,
              defaultTimelineDays: stageInfo.timeline,
              percentageWeight: stageInfo.weight,
              workflowVersion: { connect: { id: workflowVersion.id } },
              responsibleDepartment: { connect: { id: responsibleDepartment.id } },
              availableStatuses: JSON.stringify({ [responsibleDepartment.name]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited', 'Returned'] }),
            },
          });
          console.log(`    - Created stage "${stage.name}" for Version 1`);

          for (const doc of stageInfo.docs) {
            await prisma.documentRequirement.create({
              data: {
                name: doc.name,
                isMandatory: doc.isMandatory,
                type: doc.type,
                workflowStage: { connect: { id: stage.id } },
              },
            });
            console.log(`      - Added doc requirement: "${doc.name}"`);
          }
        }
      } else if (wf.name === 'WF-05 – Appraisal') {
        const wf05Stages = [
          { name: 'Deputy Chief Credit Operation Officer', order: 0, timeline: 1, weight: 1, docs: [] },
          { name: 'Director, Credit Appraisal and Analysis Department', order: 1, timeline: 1, weight: 5, docs: [] },
          { name: 'Manager, Wholesale Credit Appraisal Division', order: 2, timeline: 1, weight: 5, docs: [] },
          { name: 'Manager, Retail Credit Appraisal Division', order: 3, timeline: 1, weight: 5, docs: [] },
          { name: 'Document Verification', order: 4, timeline: 2, weight: 10, docs: [] },
          { name: 'Review Appraisal Analysis', order: 5, timeline: 3, weight: 10, docs: [{ name: 'Annex Report', isMandatory: true, type: DocumentRequirementType.CHECKBOX }] },
          { name: 'Distribute Appraisal Analysis', order: 6, timeline: 3, weight: 10, docs: [] },
          { name: 'Submit to Committee Secretary', order: 7, timeline: 3, weight: 10, docs: [] },
          { name: 'Distribute to Committee Members', order: 8, timeline: 3, weight: 10, docs: [] },
          { name: 'Credit Approval Committee Review', order: 9, timeline: 5, weight: 30, docs: [] },
          { name: 'Submit to Appraisal Officer', order: 10, timeline: 3, weight: 4, docs: [{ name: 'LAF Signed by All Committee Members', isMandatory: true, type: DocumentRequirementType.CHECKBOX }] },
        ];

        for (const stageInfo of wf05Stages) {
          const stage = await prisma.workflowStageDefinition.create({
            data: {
              name: stageInfo.name,
              order: stageInfo.order,
              defaultTimelineDays: stageInfo.timeline,
              percentageWeight: stageInfo.weight,
              workflowVersion: { connect: { id: workflowVersion.id } },
              responsibleDepartment: { connect: { id: responsibleDepartment.id } },
              availableStatuses: JSON.stringify({ [responsibleDepartment.name]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited', 'Returned'] }),
            },
          });
          console.log(`    - Created stage "${stage.name}" for Version 1`);

          for (const doc of stageInfo.docs) {
            await prisma.documentRequirement.create({
              data: {
                name: doc.name,
                isMandatory: doc.isMandatory,
                type: doc.type,
                workflowStage: { connect: { id: stage.id } },
              },
            });
            console.log(`      - Added doc requirement: "${doc.name}"`);
          }
        }
      } else if (wf.name === 'WF-06 – RM Disbursement') {
        const wf06Stages = [
          { name: 'Submit Loan Decision Letter to Customer', order: 0, timeline: 5, weight: 12, docs: [] },
          { name: 'Preparation of Loan and Mortgage Contract', order: 1, timeline: 1, weight: 3, docs: [] },
          { name: 'Contract Signing', order: 2, timeline: 3, weight: 3, docs: [] },
          { name: 'Collateral Registration Process', order: 3, timeline: 3, weight: 10, docs: [] },
          {
            name: 'Collection of Security Documents', order: 4, timeline: 3, weight: 10,
            docs: [
              { name: 'Conditions stated on LAF fulfilled', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Insurance Document', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
            ],
          },
          { name: 'Disbursement Approval Form', order: 5, timeline: 3, weight: 10, docs: [] },
          { name: 'Disbursement Approval Committee', order: 6, timeline: 3, weight: 10, docs: [] },
          { name: 'Final Disbursement', order: 7, timeline: 3, weight: 42, docs: [] },
        ];

        for (const stageInfo of wf06Stages) {
          const stage = await prisma.workflowStageDefinition.create({
            data: {
              name: stageInfo.name,
              order: stageInfo.order,
              defaultTimelineDays: stageInfo.timeline,
              percentageWeight: stageInfo.weight,
              workflowVersion: { connect: { id: workflowVersion.id } },
              responsibleDepartment: { connect: { id: responsibleDepartment.id } },
              availableStatuses: JSON.stringify({ [responsibleDepartment.name]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited', 'Returned'] }),
            },
          });
          console.log(`    - Created stage "${stage.name}" for Version 1`);

          for (const doc of stageInfo.docs) {
            await prisma.documentRequirement.create({
              data: {
                name: doc.name,
                isMandatory: doc.isMandatory,
                type: doc.type,
                workflowStage: { connect: { id: stage.id } },
              },
            });
            console.log(`      - Added doc requirement: "${doc.name}"`);
          }
        }
      } else {
        const stageName = wf.name.split('–')[1].trim();
        await prisma.workflowStageDefinition.create({
          data: {
            name: stageName,
            order: 0,
            defaultTimelineDays: 5,
            percentageWeight: 100,
            workflowVersion: { connect: { id: workflowVersion.id } },
            responsibleDepartment: { connect: { id: responsibleDepartment.id } },
            availableStatuses: JSON.stringify({ [responsibleDepartment.name]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited', 'Returned'] }),
          },
        });
        console.log(`    - Created stage "${stageName}" for Version 1`);
      }
    }
    console.log(`${parentSectorName} workflows seeded.`);
  };

  const sectorWorkflowConfigs = [
    {
      parentSectorName: 'Institutional Banking and Hospitality and Green Financing Sector',
      departmentName: 'Institutional Banking and Hospitality, Green Financing Department',
    },
    {
      parentSectorName: 'Service sector Department',
      departmentName: 'Service Sector Department',
    },
    {
      parentSectorName: 'Construction Manufacturing and Agriculture Sector Department',
      departmentName: 'Construction Manufacturing and Agriculture Sector Department',
    },
  ];

  for (const config of sectorWorkflowConfigs) {
    const sectorChildren = childSectors[config.parentSectorName] || [];
    for (const childSectorName of sectorChildren) {
      await seedWorkflowPath(
        config.parentSectorName,
        childSectorName,
        config.departmentName
      );
    }
  }

  // ==================== DISTRICT SPECIALIZED WORKFLOW (TYPE-2) ====================
  console.log('Seeding District Specialized Loan Workflow...');
  const districtSector = await prisma.sector.upsert({
    where: { name: 'District Operations' },
    update: {},
    create: { name: 'District Operations' },
  });

  const districtDept = await prisma.department.findUnique({
    where: { nameLowercase: 'district' },
  });
  const valuationDept = await prisma.department.findUnique({
    where: { nameLowercase: 'property valuation department' },
  });

  if (!districtDept || !valuationDept) {
    console.error(
      'Skipping District Specialized Workflow: missing District or Property Valuation department.'
    );
  } else {
    const districtWorkflow = await prisma.workflowDefinition.upsert({
      where: { id: 'wf-district-specialized' },
      update: {
        name: 'District Specialized Loan Workflow',
        description:
          'Multi-step workflow involving District Managers, CRMs, and HO Valuation.',
        departmentId: districtDept.id,
        sectorId: districtSector.id,
      },
      create: {
        id: 'wf-district-specialized',
        name: 'District Specialized Loan Workflow',
        description:
          'Multi-step workflow involving District Managers, CRMs, and HO Valuation.',
        order: 10,
        departmentId: districtDept.id,
        sectorId: districtSector.id,
      },
    });

    let districtVersion = await prisma.workflowVersion.findFirst({
      where: { workflowDefinitionId: districtWorkflow.id, isActive: true },
      include: { stages: true },
    });

    if (!districtVersion) {
      await prisma.workflowVersion.updateMany({
        where: { workflowDefinitionId: districtWorkflow.id },
        data: { isActive: false },
      });
      districtVersion = await prisma.workflowVersion.create({
        data: {
          workflowDefinitionId: districtWorkflow.id,
          versionNumber: 1,
          isActive: true,
        },
        include: { stages: true },
      });
    }

    if (districtVersion.stages.length === 0) {
      const districtStages = [
        {
          name: 'District Director Secretary Submission',
          order: 0,
          deptId: districtDept.id,
          roles: ['District secretary', 'Secretary'],
        },
        {
          name: 'District Business Manager Assignment',
          order: 1,
          deptId: districtDept.id,
          roles: ['District Manager', 'Manager'],
        },
        {
          name: 'CRM PVR Preparation',
          order: 2,
          deptId: districtDept.id,
          roles: ['District Crm', 'CRM'],
        },
        {
          name: 'HO Valuation Review',
          order: 3,
          deptId: valuationDept.id,
          roles: ['Property Valuation Officer'],
        },
        {
          name: 'CRM LAF & Summary Preparation',
          order: 4,
          deptId: districtDept.id,
          roles: ['District Crm', 'CRM'],
        },
        {
          name: 'District Operation Manager Check',
          order: 5,
          deptId: districtDept.id,
          roles: ['District Manager', 'Manager'],
        },
        {
          name: 'District Analyst Review',
          order: 6,
          deptId: districtDept.id,
          roles: ['District Analyst', 'Credit Appraisal Officer'],
        },
        {
          name: 'Final Operation Manager Review',
          order: 7,
          deptId: districtDept.id,
          roles: ['District Manager', 'Manager'],
        },
        {
          name: 'Committee Distribution',
          order: 8,
          deptId: districtDept.id,
          roles: ['District Analyst', 'Credit Appraisal Officer'],
        },
        {
          name: 'Committee Approval',
          order: 9,
          deptId: districtDept.id,
          roles: ['District Analyst', 'Credit Appraisal Officer'],
        },
      ];

      const defaultStatuses = ['Initiated', 'In Progress', 'Completed', 'Pending', 'Returned'];
      for (const stage of districtStages) {
        const stageDept =
          stage.deptId === valuationDept.id ? valuationDept : districtDept;
        await prisma.workflowStageDefinition.create({
          data: {
            workflowVersionId: districtVersion.id,
            name: stage.name,
            order: stage.order,
            defaultTimelineDays: 3,
            percentageWeight: 10,
            responsibleDepartmentId: stage.deptId,
            allowedRoles: JSON.stringify(stage.roles),
            availableStatuses: JSON.stringify({
              [stageDept.name]: defaultStatuses,
            }),
          },
        });
      }
      console.log('  District Specialized Workflow stages created.');
    } else {
      console.log('  District Specialized Workflow already has stages.');
    }
  }

  console.log('🎉 Seeding finished successfully!');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
