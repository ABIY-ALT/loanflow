
import { PrismaClient, DocumentRequirementType } from '@prisma/client';
import { mockUsers as appMockUsers, mockDepartments } from '../src/lib/mock-data'; // Using app-level mock users
import type { Department as AppDepartment } from '../src/types/loan';
import { ALL_PERMISSIONS, PERMISSIONS } from '../src/lib/permissions'; // Import all permissions
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  // --- Seed Sectors ---
  console.log('Seeding Sectors...');
  const parentSectors = [
    'Institutional Banking & Green Financing', 
    'Service & Mining Sectors', 
    'Manufacturing & Agriculture Sector'
  ];
  const childSectors: Record<string, string[]> = {
    'Institutional Banking & Green Financing': ['Financial Institution', 'Mining, Power and Water'],
    'Service & Mining Sectors': [
      'Domestic Trade and Service',
      'Hotel and Tourism',
      'Transport',
      'International Trade – Export',
      'International Trade – Import',
      'Personal Loan'
    ],
    'Manufacturing & Agriculture Sector': [
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
    console.log(`Created/verified parent sector: ${sectorName}`);

    if (childSectors[sectorName]) {
      for (const childName of childSectors[sectorName]) {
        await prisma.sector.upsert({
          where: { name: childName },
          update: {
            parent: {
              connect: { id: parent.id }
            }
          },
          create: {
            name: childName,
            parent: {
              connect: { id: parent.id }
            }
          },
        });
        console.log(`  - Created/verified child sector: ${childName}`);
      }
    }
  }
  console.log('Sectors seeded.');

  // --- Seed Request Types ---
  console.log('Seeding Request Types...');
  const requestTypes = ['New Loan', 'Restructuring', 'Additional Facility'];
  for (const requestTypeName of requestTypes) {
    await prisma.requestType.upsert({
      where: { name: requestTypeName },
      update: {},
      create: { name: requestTypeName },
    });
    console.log(`Created/verified request type: ${requestTypeName}`);
  }
  console.log('Request Types seeded.');


  // Seed Departments
  console.log('Seeding Departments...');
  for (const deptName of mockDepartments) {
    const department = await prisma.department.upsert({
      where: { nameLowercase: deptName.toLowerCase() },
      update: {},
      create: {
        name: deptName,
        nameLowercase: deptName.toLowerCase(),
      },
    });
    console.log(`Created/verified department with id: ${department.id} (${department.name})`);
  }
  console.log('Departments seeded.');

  // --- Seed Districts and Branches ---
  console.log('Seeding Districts and Branches...');
  const districtsToSeed = {
    'South District': ['Gotera Ibex'],
    'North District': ['Abinet Adebabay'],
    'West District': [],
    'East District': [],
  };

  for (const districtName of Object.keys(districtsToSeed)) {
      const district = await prisma.district.upsert({
          where: { name: districtName },
          update: {},
          create: { name: districtName },
      });
      console.log(`Created/verified district: ${districtName}`);

      const branchesForDistrict = districtsToSeed[districtName as keyof typeof districtsToSeed];
      for (const branchName of branchesForDistrict) {
          await prisma.branch.upsert({
              where: {
                  name_districtId: {
                      name: branchName,
                      districtId: district.id
                  }
              },
              update: {},
              create: {
                  name: branchName,
                  districtId: district.id,
              }
          });
          console.log(`  - Created/verified branch: ${branchName} in ${districtName}`);
      }
  }
  console.log('Districts and Branches seeded.');

  // Seed Roles
  console.log('Seeding Custom Roles...');
  const rolesToSeed = [
    {
      name: "Administrator",
      description: "Full access to all system features and settings.",
      permissions: ALL_PERMISSIONS
    },
    {
      name: "Chief",
      description: "High-level management with broad oversight and administrative capabilities.",
      permissions: [
        "VIEW_DASHBOARD", "VIEW_LOAN_DETAILS", "VIEW_LOAN_PIPELINE", "VIEW_CUSTOMERS",
        "PROMOTE_LOAN_STAGE", "RETURN_LOAN_FOR_REWORK", "VIEW_MANAGER_REVIEW_QUEUE",
        "VIEW_UNASSIGNED_CASES_QUEUE", "VIEW_REPORTS", "VIEW_OVERDUE_TASKS_REPORT",
        "MANUAL_STAGE_TRANSITION", "TERMINATE_LOAN_PROCESS", "MANAGE_SETTINGS_WORKFLOWS",
        "MANAGE_SETTINGS_BRANCHES", "MANAGE_SETTINGS_DEPARTMENTS", "MANAGE_SETTINGS_ROLES",
        "MANAGE_USERS", "VIEW_SYSTEM_AUDIT_LOGS"
      ]
    },
    {
      name: "Credit Analysis & Appraisal Officer",
      description: "Responsible for analyzing credit and appraisal data.",
      permissions: [
        "VIEW_DASHBOARD", "VIEW_LOAN_PIPELINE", "VIEW_LOAN_DETAILS", "EDIT_LOAN_DETAILS",
        "VERIFY_LOAN_DOCUMENTS", "ADD_LOAN_NOTES", "MARK_STAGE_COMPLETE"
      ]
    },
    {
      name: "CRM",
      description: "Customer Relationship Manager, handles client-facing interactions and initial requests.",
      permissions: [
        "VIEW_DASHBOARD", "VIEW_LOAN_PIPELINE", "VIEW_LOAN_DETAILS", "VIEW_CUSTOMERS",
        "CREATE_LOAN_REQUEST", "EDIT_LOAN_DETAILS", "UPLOAD_LOAN_DOCUMENTS",
        "LOG_INFO_REQUEST", "FULFILL_INFO_REQUEST", "ADD_LOAN_NOTES", "FLAG_URGENT_CASE"
      ]
    },
    {
      name: "Deputy Chief",
      description: "Senior management with review and reporting capabilities.",
      permissions: [
        "VIEW_DASHBOARD", "VIEW_LOAN_PIPELINE", "VIEW_LOAN_DETAILS", "VIEW_CUSTOMERS",
        "VIEW_MANAGER_REVIEW_QUEUE", "PROMOTE_LOAN_STAGE", "RETURN_LOAN_FOR_REWORK", "VIEW_REPORTS"
      ]
    },
    {
      name: "Director",
      description: "Departmental leadership with review and approval authority.",
      permissions: [
        "VIEW_DASHBOARD", "VIEW_LOAN_PIPELINE", "VIEW_LOAN_DETAILS", "VIEW_CUSTOMERS",
        "VIEW_MANAGER_REVIEW_QUEUE", "PROMOTE_LOAN_STAGE", "RETURN_LOAN_FOR_REWORK"
      ]
    },
    {
      name: "Division Manager",
      description: "Manages a division and can promote loans through stages.",
      permissions: [
        "VIEW_DASHBOARD", "VIEW_LOAN_PIPELINE", "VIEW_LOAN_DETAILS", "VIEW_CUSTOMERS",
        "VIEW_MANAGER_REVIEW_QUEUE", "PROMOTE_LOAN_STAGE"
      ]
    },
    {
      name: "Loan Officer",
      description: "Manages assigned loan requests and related documentation.",
      permissions: [
        "VIEW_DASHBOARD", "VIEW_LOAN_PIPELINE", "VIEW_LOAN_DETAILS",
        "VIEW_OWN_ASSIGNED_CASES", "EDIT_LOAN_DETAILS",
        "UPLOAD_LOAN_DOCUMENTS", "ADD_LOAN_NOTES"
      ]
    },
    {
      name: "Viewer",
      description: "Can view loan data but cannot make changes.",
      permissions: ["VIEW_DASHBOARD", "VIEW_LOAN_PIPELINE", "VIEW_LOAN_DETAILS"]
    }
  ];

  // Mapping from provided permission names to system permission names
  const permissionMap: { [key: string]: keyof typeof PERMISSIONS } = {
    'VIEW_KANBAN': 'VIEW_LOAN_PIPELINE',
    'VIEW_ALL_CUSTOMERS': 'VIEW_CUSTOMERS',
    'VIEW_UNASSIGNED_CASES': 'VIEW_UNASSIGNED_CASES_QUEUE',
  };

  for (const roleData of rolesToSeed) {
    // Map permissions to ensure they exist in the system
    const mappedPermissions = Array.isArray(roleData.permissions)
      ? roleData.permissions.map(p => permissionMap[p] || p).filter(p => p in PERMISSIONS)
      : roleData.permissions; // 'ALL' case

    const role = await prisma.role.upsert({
      where: { name: roleData.name },
      update: {
        description: roleData.description,
        permissions: mappedPermissions,
      },
      create: {
        name: roleData.name,
        description: roleData.description,
        permissions: mappedPermissions,
      },
    });
    console.log(`Created/verified role: ${role.name}`);
  }
  console.log('Custom Roles seeded.');


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
  
  const seedWorkflowPath = async (
    parentSectorName: string,
    childSectorName: string,
    departmentName: string
  ) => {
    console.log(`--- Seeding Workflows for ${parentSectorName}...`);
    const parentSector = await prisma.sector.findUnique({ where: { name: parentSectorName } });
    const childSector = await prisma.sector.findUnique({ where: { name: childSectorName } });
    const department = await prisma.department.findUnique({ where: { nameLowercase: departmentName.toLowerCase() } });
  
    if (!parentSector || !childSector || !department) {
      console.error(`Could not find necessary entities for ${parentSectorName}. Aborting.`);
      console.error(`Missing: ${!parentSector ? 'Parent Sector, ' : ''}${!childSector ? 'Child Sector, ' : ''}${!department ? 'Department' : ''}`);
      return;
    }

    // Find the current max order for this parent sector
    const maxOrderResult = await prisma.workflowDefinition.aggregate({
      _max: { order: true },
      where: {
        sector: {
          parentId: parentSector.id
        }
      }
    });
    let currentMaxOrder = maxOrderResult._max.order ?? -1;
  
    for (const wf of standardWorkflowsToSeed) {
      const workflowDefinition = await prisma.workflowDefinition.create({
        data: {
          name: wf.name,
          description: wf.purpose,
          order: ++currentMaxOrder,
          department: { connect: { id: department.id } },
          sector: { connect: { id: childSector.id } },
        },
      });
      console.log(`Created Workflow Definition: ${workflowDefinition.name}`);
  
      const workflowVersion = await prisma.workflowVersion.create({
        data: {
          workflowDefinition: { connect: { id: workflowDefinition.id } },
          versionNumber: 1,
          isActive: true,
        },
      });
      console.log(`  - Created active Version 1 for ${workflowDefinition.name}`);
      
      if (wf.name === 'WF-01 – RM Request Registration (Acceptance)') {
        // --- Special multi-stage seeding for WF-01 ---
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
              responsibleDepartment: { connect: { id: department.id } },
              availableStatuses: { [department.name]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited','Returned'] },
            },
          });
          console.log(`    - Created stage "${stage.name}" for Version 1`);

          for (const doc of stageInfo.docs) {
            await prisma.documentRequirement.create({
              data: {
                name: doc.name,
                isMandatory: doc.isMandatory,
                type: doc.type,
                workflowStage: { connect: { id: stage.id } }
              }
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
          { name: 'Valuation Finalization', order: 4, timeline: 1, weight: 10, 
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
              responsibleDepartment: { connect: { id: department.id } },
              availableStatuses: { [department.name]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited','Returned'] },
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
              responsibleDepartment: { connect: { id: department.id } },
              availableStatuses: { [department.name]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited','Returned'] },
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
              responsibleDepartment: { connect: { id: department.id } },
              availableStatuses: { [department.name]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited','Returned'] },
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
          { name: 'Collection of Security Documents', order: 4, timeline: 3, weight: 10, docs: [
              { name: 'Conditions stated on LAF fulfilled', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
              { name: 'Insurance Document', isMandatory: true, type: DocumentRequirementType.CHECKBOX },
          ]},
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
              responsibleDepartment: { connect: { id: department.id } },
              availableStatuses: { [department.name]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited','Returned'] },
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
        // --- Default single-stage seeding for other WFs ---
        const stageName = wf.name.split('–')[1].trim();
        await prisma.workflowStageDefinition.create({
          data: {
            name: stageName,
            order: 0,
            defaultTimelineDays: 5,
            percentageWeight: 100,
            workflowVersion: { connect: { id: workflowVersion.id } },
            responsibleDepartment: { connect: { id: department.id } },
            availableStatuses: { [department.name]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited','Returned'] },
          },
        });
        console.log(`    - Created stage "${stageName}" for Version 1`);
      }
    }
    console.log(`${parentSectorName} workflows seeded.`);
  };

  await seedWorkflowPath(
    'Institutional Banking & Green Financing',
    'Financial Institution',
    'Director Institutional Banking and Green Financing'
  );
  
  await seedWorkflowPath(
    'Service & Mining Sectors',
    'Domestic Trade and Service',
    'Director Service and Mining Sector'
  );

  await seedWorkflowPath(
    'Manufacturing & Agriculture Sector',
    'Manufacturing Industry',
    'Director Manufacturing and Agricultural Sector'
  );

  // Add default user assignments
  const abinetUser = appMockUsers.find(u => u.name === 'Abinet Wondimu');
  if (abinetUser) {
      abinetUser.customRoleName = 'Loan Officer';
  }

  // Seed Users
  console.log('Seeding Users...');
  const allUsersToSeed = [
    ...appMockUsers, // This will seed the two users from mock-data.ts
    {
      id: 'system-prisma', 
      userId: 'system-prisma-identity', 
      name: 'System Process',
      email: 'system@loanflow.app',
      department: undefined, 
      customRoleName: 'Administrator', 
      firstName: 'System',
      lastName: 'Process',
      phoneNumber: '0000000000',
    },
  ];

  for (const userData of allUsersToSeed) {
    let departmentDataConnect = {};
    if (userData.department) {
      const deptName = (userData.department as AppDepartment).toLowerCase();
      const deptRecord = await prisma.department.findUnique({
        where: { nameLowercase: deptName },
      });
      if (deptRecord) {
        departmentDataConnect = { department: { connect: { id: deptRecord.id } } };
      } else {
        console.warn(`Department "${userData.department}" not found for user "${userData.name}".`);
      }
    }
    
    let customRoleDataConnect = {};
    if (userData.customRoleName) {
        const roleRecord = await prisma.role.findUnique({
            where: { name: userData.customRoleName },
        });
        if (roleRecord) {
            customRoleDataConnect = { customRole: { connect: { id: roleRecord.id }}};
        } else {
            console.warn(`Custom Role "${userData.customRoleName}" not found for user "${userData.name}".`);
        }
    }

    const defaultPassword = "password123";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const finalUserId = userData.userId || userData.id;

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        name: userData.name,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: userData.phoneNumber,
        userId: finalUserId,
        passwordHash: passwordHash,
        isPasswordChanged: false, // Set to true so they don't need to change password
        failedLoginAttempts: 0,
        lockoutUntil: null,
        isActive: true,
        ...departmentDataConnect,
        ...customRoleDataConnect,
      },
      create: {
        id: userData.id, 
        userId: finalUserId,
        name: userData.name,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: userData.phoneNumber,
        passwordHash: passwordHash,
        isPasswordChanged: false, // Set to true so they don't need to change password
        isActive: true,
        ...departmentDataConnect,
        ...customRoleDataConnect,
      },
    });
    console.log(`Created/updated user with id: ${user.id} (${user.name}), customRoleID: ${user.customRoleId}`);
  }
  console.log('Users seeded.');
  console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
