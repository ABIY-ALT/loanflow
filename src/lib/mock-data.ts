

import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department, DocumentRequirement } from '@/types/loan';
import { DocumentRequirementType } from '@/types/loan';
import { randomUUID } from "crypto";

// UserRole enum is removed from types/loan.ts, so it should not be imported or used here.
// We will assign custom role names directly in the mock user data if needed.

const MOCK_REFERENCE_DATE = new Date('2024-07-15T10:00:00.000Z').getTime();

// App-level User type for mocks (no longer uses UserRole enum)
interface MockAppUser {
  id: string; // This will be Prisma's User ID
  userId?: string; // This would be the ID from Identity Server if syncing
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  department?: Department;
  customRoleName?: string; // Assign custom role by name
}


export const mockUsers: MockAppUser[] = [

{
  id: '00000001-aaaa-4b0b-a81f-000000000001',
  userId: '11111111-bbbb-49f0-b7c2-000000000001',
  name: 'Mihretu Mengistu',
  email: 'mihretu.mengistu@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Mihretu',
  lastName: 'Mengistu',
  phoneNumber: '0962992535'
},
{
  id: '00000002-aaaa-4b0b-a81f-000000000002',
  userId: '11111112-bbbb-49f0-b7c2-000000000002',
  name: 'Abinet Wondimu',
  email: 'abinet.wondimu@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Abinet',
  lastName: 'Wondimu',
  phoneNumber: '0938027756'
},
{
  id: '00000003-aaaa-4b0b-a81f-000000000003',
  userId: '11111113-bbbb-49f0-b7c2-000000000003',
  name: 'Zelalem Ashenafi',
  email: 'zelalem.ashenafi@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Zelalem',
  lastName: 'Ashenafi',
  phoneNumber: '0913046524'
},
{
  id: '00000004-aaaa-4b0b-a81f-000000000004',
  userId: '11111114-bbbb-49f0-b7c2-000000000004',
  name: 'Belsti Abatihun',
  email: 'belsti.abatihun@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Belsti',
  lastName: 'Abatihun',
  phoneNumber: '0913731763'
},
{
  id: '00000005-aaaa-4b0b-a81f-000000000005',
  userId: '11111115-bbbb-49f0-b7c2-000000000005',
  name: 'Endalemaw Mekuanint',
  email: 'endalemaw.mekuanint@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Endalemaw',
  lastName: 'Mekuanint',
  phoneNumber: '0913832999'
},
{
  id: '00000006-aaaa-4b0b-a81f-000000000006',
  userId: '11111116-bbbb-49f0-b7c2-000000000006',
  name: 'Fikadu Zerga Lassa',
  email: 'firew.zerfo@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Fikadu',
  lastName: 'Zerga',
  phoneNumber: '0930800098'
},
{
  id: '00000007-aaaa-4b0b-a81f-000000000007',
  userId: '11111117-bbbb-49f0-b7c2-000000000007',
  name: 'Mekonnen Ephrem',
  email: 'mekonnen.ephrem@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Mekonnen',
  lastName: 'Ephrem',
  phoneNumber: '0911939422'
},
{
  id: '00000008-aaaa-4b0b-a81f-000000000008',
  userId: '11111118-bbbb-49f0-b7c2-000000000008',
  name: 'Kirubel Solomon',
  email: 'kirubel.solomon@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Kirubel',
  lastName: 'Solomon',
  phoneNumber: '0913593997'
},
{
  id: '00000009-aaaa-4b0b-a81f-000000000009',
  userId: '11111119-bbbb-49f0-b7c2-000000000009',
  name: 'Matewos Legesse',
  email: 'matewos.legesse@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Matewos',
  lastName: 'Legesse',
  phoneNumber: '0913561298'
},
{
  id: '00000010-aaaa-4b0b-a81f-000000000010',
  userId: '1111111a-bbbb-49f0-b7c2-000000000010',
  name: 'Ephrem Tadesse',
  email: 'ephrem.tadesse@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Ephrem',
  lastName: 'Tadesse',
  phoneNumber: '0911428127'
},
{
  id: '00000011-aaaa-4b0b-a81f-000000000011',
  userId: '1111111b-bbbb-49f0-b7c2-000000000011',
  name: 'H/Michael Getachew',
  email: 'hmichael.getachew@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'H/Michael',
  lastName: 'Getachew',
  phoneNumber: '0913752501'
},
{
  id: '00000012-aaaa-4b0b-a81f-000000000012',
  userId: '1111111c-bbbb-49f0-b7c2-000000000012',
  name: 'Belchew Meda',
  email: 'belchew.meda@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Belchew',
  lastName: 'Meda',
  phoneNumber: '0911661927'
},
{
  id: '00000013-aaaa-4b0b-a81f-000000000013',
  userId: '1111111d-bbbb-49f0-b7c2-000000000013',
  name: 'Endahsaw Bekele',
  email: 'endahsaw.bekele@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Endahsaw',
  lastName: 'Bekele',
  phoneNumber: '0910324818'
},
{
  id: '00000014-aaaa-4b0b-a81f-000000000014',
  userId: '1111111e-bbbb-49f0-b7c2-000000000014',
  name: 'Abiy Fisseha',
  email: 'abiy.fisseha@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Abiy',
  lastName: 'Fisseha',
  phoneNumber: '0911618268'
},
{
  id: '00000015-aaaa-4b0b-a81f-000000000015',
  userId: '1111111f-bbbb-49f0-b7c2-000000000015',
  name: 'Getachew Argaw',
  email: 'getachew.argaw@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Getachew',
  lastName: 'Argaw',
  phoneNumber: '0911035604'
},

{
  id: '00000016-aaaa-4b0b-a81f-000000000016',
  userId: '11111120-bbbb-49f0-b7c2-000000000016',
  name: 'Abel Atlabachew',
  email: 'abel.atlabachew@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Abel',
  lastName: 'Atlabachew',
  phoneNumber: '0911622817'
},
{
  id: '00000017-aaaa-4b0b-a81f-000000000017',
  userId: '11111121-bbbb-49f0-b7c2-000000000017',
  name: 'Surafel Aregahagn',
  email: 'surafel.aregahagn@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Surafel',
  lastName: 'Aregahagn',
  phoneNumber: '0911619652'
},
{
  id: '00000018-aaaa-4b0b-a81f-000000000018',
  userId: '11111122-bbbb-49f0-b7c2-000000000018',
  name: 'Biruk G/Meskel',
  email: 'biruk.g/meskel@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Biruk',
  lastName: 'G/Meskel',
  phoneNumber: '0913050796'
},
{
  id: '00000019-aaaa-4b0b-a81f-000000000019',
  userId: '11111123-bbbb-49f0-b7c2-000000000019',
  name: 'Fekadu Biyadgilgn',
  email: 'fekadu.biyadgilgn@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Fekadu',
  lastName: 'Biyadgilgn',
  phoneNumber: '0911930349'
},
{
  id: '00000020-aaaa-4b0b-a81f-000000000020',
  userId: '11111124-bbbb-49f0-b7c2-000000000020',
  name: 'Zegeye Walle',
  email: 'zegeye.walle@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Zegeye',
  lastName: 'Walle',
  phoneNumber: '0911434360'
},
{
  id: '00000021-aaaa-4b0b-a81f-000000000021',
  userId: '11111125-bbbb-49f0-b7c2-000000000021',
  name: 'Elias Eshetu',
  email: 'elias.eshetu@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Elias',
  lastName: 'Eshetu',
  phoneNumber: '0910088978'
},

{
  id: '00000022-aaaa-4b0b-a81f-000000000022',
  userId: '11111126-bbbb-49f0-b7c2-000000000022',
  name: 'Abraham Beyene',
  email: 'abraham.beyene@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Abraham',
  lastName: 'Beyene',
  phoneNumber: '0913835523'
},
{
  id: '00000023-aaaa-4b0b-a81f-000000000023',
  userId: '11111127-bbbb-49f0-b7c2-000000000023',
  name: 'Amsalu Dagnew Amenu',
  email: 'amsalu.dagnew@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Amsalu',
  lastName: 'Dagnew',
  phoneNumber: '0910055853'
},
{
  id: '00000024-aaaa-4b0b-a81f-000000000024',
  userId: '11111128-bbbb-49f0-b7c2-000000000024',
  name: 'Getahun Assefa Alemu',
  email: 'getahun.assefa@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Getahun',
  lastName: 'Alemu',
  phoneNumber: '0916121119'
},
{
  id: '00000025-aaaa-4b0b-a81f-000000000025',
  userId: '11111129-bbbb-49f0-b7c2-000000000025',
  name: 'Yalew Genana Gulema',
  email: 'yalew.genana@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Yalew',
  lastName: 'Gulema',
  phoneNumber: '0913876990'
},

{
  id: '00000026-aaaa-4b0b-a81f-000000000026',
  userId: '1111112a-bbbb-49f0-b7c2-000000000026',
  name: 'Fasil Baraki',
  email: 'fasil.baraki@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Fasil',
  lastName: 'Baraki',
  phoneNumber: '0912096087'
},
{
  id: '00000027-aaaa-4b0b-a81f-000000000027',
  userId: '1111112b-bbbb-49f0-b7c2-000000000027',
  name: 'Helen Mamo Ayele',
  email: 'helen.mamo@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Helen',
  lastName: 'Ayele',
  phoneNumber: '0926792997'
},
{
  id: '00000028-aaaa-4b0b-a81f-000000000028',
  userId: '1111112c-bbbb-49f0-b7c2-000000000028',
  name: 'Yonas Ejersa',
  email: 'yonas.ejersa@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Yonas',
  lastName: 'Ejersa',
  phoneNumber: '0913938919'
},
{
  id: '00000029-aaaa-4b0b-a81f-000000000029',
  userId: '1111112d-bbbb-49f0-b7c2-000000000029',
  name: 'Menbere Mengist Alehegn',
  email: 'menbere.mengist@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Menbere',
  lastName: 'Alehegn',
  phoneNumber: '0922868694'
},
{
  id: '00000030-aaaa-4b0b-a81f-000000000030',
  userId: '1111112e-bbbb-49f0-b7c2-000000000030',
  name: 'Hana Mulugeta Fekadu',
  email: 'hana.mulugeta@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Hana',
  lastName: 'Fekadu',
  phoneNumber: '0946661246'
},
{
  id: '00000031-aaaa-4b0b-a81f-000000000031',
  userId: '1111112f-bbbb-49f0-b7c2-000000000031',
  name: 'Tamiru Demis Trbis',
  email: 'tamiru.demis@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Tamiru',
  lastName: 'Trbis',
  phoneNumber: '0905060617'
},
{
  id: '00000032-aaaa-4b0b-a81f-000000000032',
  userId: '11111130-bbbb-49f0-b7c2-000000000032',
  name: 'Andinet Yifru Mengistu',
  email: 'andinet.yifru@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Andinet',
  lastName: 'Mengistu',
  phoneNumber: '0911897579'
},
{
  id: '00000033-aaaa-4b0b-a81f-000000000033',
  userId: '11111131-bbbb-49f0-b7c2-000000000033',
  name: 'Birtukan Kuliche',
  email: 'birtukan.kuliche@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Birtukan',
  lastName: 'Kuliche',
  phoneNumber: '0911026688'
},
{
  id: '00000034-aaaa-4b0b-a81f-000000000034',
  userId: '11111132-bbbb-49f0-b7c2-000000000034',
  name: 'Tariku Dagnew Zeleke',
  email: 'tariku.dagnew@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Tariku',
  lastName: 'Zeleke',
  phoneNumber: '0929403387'
},
{
  id: '00000035-aaaa-4b0b-a81f-000000000035',
  userId: '11111133-bbbb-49f0-b7c2-000000000035',
  name: 'Zinash Tadesse',
  email: 'zinash.tadesse@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Zinash',
  lastName: 'Tadesse',
  phoneNumber: '0912040540'
},
{
  id: '00000036-aaaa-4b0b-a81f-000000000036',
  userId: '11111134-bbbb-49f0-b7c2-000000000036',
  name: 'Estalu Mengist Tesema',
  email: 'estalu.mengist@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Estalu',
  lastName: 'Tesema',
  phoneNumber: '0946792489'
},
{
  id: '00000037-aaaa-4b0b-a81f-000000000037',
  userId: '11111135-bbbb-49f0-b7c2-000000000037',
  name: 'Yoseph Alemu Haile',
  email: 'yoseph.alemu@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Yoseph',
  lastName: 'Haile',
  phoneNumber: '0911115733'
},

{
  id: '00000038-aaaa-4b0b-a81f-000000000038',
  userId: '11111136-bbbb-49f0-b7c2-000000000038',
  name: 'Temesgen Teklay Berhe',
  email: 'temesgen.teklay@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Temesgen',
  lastName: 'Berhe',
  phoneNumber: '0911568475'
},
{
  id: '00000039-aaaa-4b0b-a81f-000000000039',
  userId: '11111137-bbbb-49f0-b7c2-000000000039',
  name: 'Daniel Dagne Tadesse',
  email: 'daniel.dagne@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Daniel',
  lastName: 'Tadesse',
  phoneNumber: '0966930921'
},
{
  id: '00000040-aaaa-4b0b-a81f-000000000040',
  userId: '11111138-bbbb-49f0-b7c2-000000000040',
  name: 'Mulualem Feleke Ayele',
  email: 'mulualem.feleke@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Mulualem',
  lastName: 'Ayele',
  phoneNumber: '0911752034'
},
{
  id: '00000041-aaaa-4b0b-a81f-000000000041',
  userId: '11111139-bbbb-49f0-b7c2-000000000041',
  name: 'Abenezer Abraham Tadesse',
  email: 'abenezer.abraham@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Abenezer',
  lastName: 'Tadesse',
  phoneNumber: '0911698289'
},
{
  id: '00000042-aaaa-4b0b-a81f-000000000042',
  userId: '1111113a-bbbb-49f0-b7c2-000000000042',
  name: 'Belaynew Berhanu Tesfaye',
  email: 'belaynew.berhanu@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Belaynew',
  lastName: 'Tesfaye',
  phoneNumber: '0932293297'
},
{
  id: '00000043-aaaa-4b0b-a81f-000000000043',
  userId: '1111113b-bbbb-49f0-b7c2-000000000043',
  name: 'Berhanu Alemayehu Gudeta',
  email: 'birhanu.alemayehu@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Berhanu',
  lastName: 'Gudeta',
  phoneNumber: '0911460915'
},
{
  id: '00000044-aaaa-4b0b-a81f-000000000044',
  userId: '1111113c-bbbb-49f0-b7c2-000000000044',
  name: 'Sintayehu Zewude Assefa',
  email: 'sintayehu.zewude@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Sintayehu',
  lastName: 'Assefa',
  phoneNumber: '0922867676'
},
{
  id: '00000045-aaaa-4b0b-a81f-000000000045',
  userId: '1111113d-bbbb-49f0-b7c2-000000000045',
  name: 'Simachew Bizuayehu Assefa',
  email: 'simachew.bizuayehu@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Simachew',
  lastName: 'Assefa',
  phoneNumber: '0912049144'
},
{
  id: '00000046-aaaa-4b0b-a81f-000000000046',
  userId: '1111113e-bbbb-49f0-b7c2-000000000046',
  name: 'Dawit Zenebe W/Semayat',
  email: 'dawit.zenebe@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Dawit',
  lastName: 'Zenebe',
  phoneNumber: '0924699536'
},
{
  id: '00000047-aaaa-4b0b-a81f-000000000047',
  userId: '1111113f-bbbb-49f0-b7c2-000000000047',
  name: 'Wondwossen Enko',
  email: 'wondwossen.enko@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Wondwossen',
  lastName: 'Enko',
  phoneNumber: '0922577300'
},
{
  id: '00000048-aaaa-4b0b-a81f-000000000048',
  userId: '11111140-bbbb-49f0-b7c2-000000000048',
  name: 'Natnael Bereded',
  email: 'natnael.bereded@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Natnael',
  lastName: 'Bereded',
  phoneNumber: '0911658056'
},
{
  id: '00000049-aaaa-4b0b-a81f-000000000049',
  userId: '11111141-bbbb-49f0-b7c2-000000000049',
  name: 'Daniel Andualem',
  email: 'daniel.andualem@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Daniel',
  lastName: 'Andualem',
  phoneNumber: '0911156151'
},
{
  id: '00000050-aaaa-4b0b-a81f-000000000050',
  userId: '11111142-bbbb-49f0-b7c2-000000000050',
  name: 'Yidnekachew Awraris',
  email: 'yidnekachew.awraris@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Yidnekachew',
  lastName: 'Awraris',
  phoneNumber: '0913001100'
},
{
  id: '00000051-aaaa-4b0b-a81f-000000000051',
  userId: '11111143-bbbb-49f0-b7c2-000000000051',
  name: 'Michael Abate',
  email: 'michael.abate@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Michael',
  lastName: 'Abate',
  phoneNumber: '0913597100'
},
{
  id: '00000052-aaaa-4b0b-a81f-000000000052',
  userId: '11111144-bbbb-49f0-b7c2-000000000052',
  name: 'Frezer Endalkachew',
  email: 'frezer.endalkachew@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Frezer',
  lastName: 'Endalkachew',
  phoneNumber: '0911079216'
},
{
  id: '00000053-aaaa-4b0b-a81f-000000000053',
  userId: '11111145-bbbb-49f0-b7c2-000000000053',
  name: 'Hanna Hinsene',
  email: 'hanna.hinsene@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Hanna',
  lastName: 'Hinsene',
  phoneNumber: '0923434306'
},
{
  id: '00000054-aaaa-4b0b-a81f-000000000054',
  userId: '11111146-bbbb-49f0-b7c2-000000000054',
  name: 'Kalkidan Sesay',
  email: 'kalkidan.sesay@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Kalkidan',
  lastName: 'Sesay',
  phoneNumber: '0912419445'
},
{
  id: '00000055-aaaa-4b0b-a81f-000000000055',
  userId: '11111147-bbbb-49f0-b7c2-000000000055',
  name: 'Selamawit Tamirat',
  email: 'selamawit.tamirat@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Selamawit',
  lastName: 'Tamirat',
  phoneNumber: '0912830335'
},
{
  id: '00000056-aaaa-4b0b-a81f-000000000056',
  userId: '11111148-bbbb-49f0-b7c2-000000000056',
  name: 'Elim Tesfaye',
  email: 'elim.tesfaye@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Elim',
  lastName: 'Tesfaye',
  phoneNumber: '0929091153'
},
{
  id: '00000057-aaaa-4b0b-a81f-000000000057',
  userId: '11111149-bbbb-49f0-b7c2-000000000057',
  name: 'Yonas Dereje',
  email: 'yonas.dereje@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Yonas',
  lastName: 'Dereje',
  phoneNumber: '0910321545'
},
{
  id: '00000058-aaaa-4b0b-a81f-000000000058',
  userId: '1111114a-bbbb-49f0-b7c2-000000000058',
  name: 'Yoseph Wondimu',
  email: 'yoseph.wondimu@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Yoseph',
  lastName: 'Wondimu',
  phoneNumber: '0922945657'
},
{
  id: '00000059-aaaa-4b0b-a81f-000000000059',
  userId: '1111114b-bbbb-49f0-b7c2-000000000059',
  name: 'Eleni Belay',
  email: 'eleni.belay@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Eleni',
  lastName: 'Belay',
  phoneNumber: '0948216838'
},
{
  id: '00000060-aaaa-4b0b-a81f-000000000060',
  userId: '1111114c-bbbb-49f0-b7c2-000000000060',
  name: 'Meron Argaw',
  email: 'meron.argaw@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Meron',
  lastName: 'Argaw',
  phoneNumber: '0921081371'
},
{
  id: '00000061-aaaa-4b0b-a81f-000000000061',
  userId: '1111114d-bbbb-49f0-b7c2-000000000061',
  name: 'Meron Fantu',
  email: 'meron.fantu@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Meron',
  lastName: 'Fantu',
  phoneNumber: '0975690773'
},
{
  id: '00000062-aaaa-4b0b-a81f-000000000062',
  userId: '1111114e-bbbb-49f0-b7c2-000000000062',
  name: 'Eyuel Moges',
  email: 'eyuel.moges@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Eyuel',
  lastName: 'Moges',
  phoneNumber: '0922586666'
},
{
  id: '00000063-aaaa-4b0b-a81f-000000000063',
  userId: '1111114f-bbbb-49f0-b7c2-000000000063',
  name: 'Tsigab Kube',
  email: 'tsigab.kube@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Tsigab',
  lastName: 'Kube',
  phoneNumber: '0904185695'
},
{
  id: '00000064-aaaa-4b0b-a81f-000000000064',
  userId: '11111150-bbbb-49f0-b7c2-000000000064',
  name: 'Alazar Eliyas',
  email: 'alazar.eliyas@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Alazar',
  lastName: 'Eliyas',
  phoneNumber: '0920893000'
},
{
  id: '00000065-aaaa-4b0b-a81f-000000000065',
  userId: '11111151-bbbb-49f0-b7c2-000000000065',
  name: 'Bezawit Desalegn',
  email: 'bezawit.desalegn@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Bezawit',
  lastName: 'Desalegn',
  phoneNumber: '0977442751'
},
{
  id: '00000066-aaaa-4b0b-a81f-000000000066',
  userId: '11111152-bbbb-49f0-b7c2-000000000066',
  name: 'Hailemariam Sewale',
  email: 'hailemariam.sewale@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Hailemariam',
  lastName: 'Sewale',
  phoneNumber: '0927686103'
},
{
  id: '00000067-aaaa-4b0b-a81f-000000000067',
  userId: '11111153-bbbb-49f0-b7c2-000000000067',
  name: 'Natnael Tesfaye',
  email: 'natnael.tesfaye@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Natnael',
  lastName: 'Tesfaye',
  phoneNumber: '0910133800'
},
{
  id: '00000068-aaaa-4b0b-a81f-000000000068',
  userId: '11111154-bbbb-49f0-b7c2-000000000068',
  name: 'Abinet Getahun',
  email: 'abinet.getahun@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Abinet',
  lastName: 'Getahun',
  phoneNumber: '0910979074'
},
{
  id: '00000069-aaaa-4b0b-a81f-000000000069',
  userId: '11111155-bbbb-49f0-b7c2-000000000069',
  name: 'Abrham Tilaye',
  email: 'abrham.tilaye@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Abrham',
  lastName: 'Tilaye',
  phoneNumber: '0923560536'
},
{
  id: '00000070-aaaa-4b0b-a81f-000000000070',
  userId: '11111156-bbbb-49f0-b7c2-000000000070',
  name: 'Hagos G/medhin',
  email: 'hagos.g/medhin@nibbank.com.et',
  customRoleName: undefined,
  department: undefined,
  firstName: 'Hagos',
  lastName: 'G/medhin',
  phoneNumber: '0910349069'
}
];


export const mockDepartments: Department[] = [
  "Chief Retail and SME Banking Office",
  "Chief WholeSale Banking Office",
  "Deputy Chief Credit Operation Office",
  "Director Credit Analysis and Appraisal",
  "Director Credit Monitoring and Portfolio Management",
  "Director Institutional Banking and Green Financing",
  "Director Legal Service",
  "Director Manufacturing and Agricultural Sector",
  "Director Property Valuation",
  "Director Service and Mining Sector"
];

const createDocReq = (id: string, name: string, isMandatory: boolean, type: DocumentRequirementType): DocumentRequirement => ({
  id,
  name,
  isMandatory,
  type,
});

// This file is now largely superseded by the Prisma seed script.
// The workflow and loan request mock data is kept for reference or potential future use in non-DB environments, but it is not actively used by the application which now relies on the database.
// The primary exports used by the seeding process are mockUsers and mockDepartments.


