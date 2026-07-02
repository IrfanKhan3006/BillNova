import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Seed Super Admin conditionally
  // Password is: AdminPass@123
  const existingAdmin = await prisma.user.findFirst({
    where: { email: 'admin@billnova.com' },
  });

  if (!existingAdmin) {
    console.log('👤 Creating Super Admin user...');
    await prisma.user.create({
      data: {
        tenantId: null,
        name: 'BillNova Admin',
        email: 'admin@billnova.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$+ihJ86m+at9X3c6dNmfNqg$jisQJMETvmAEZ+pVSsMJ/GKDbnJ8FEVAfVDBjeTHuas',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
  } else {
    console.log('✔ Super Admin already exists. Skipping...');
  }

  // 2. Seed Default Test Business (Sharma Traders) conditionally
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: 'sharma-traders' },
  });

  if (!existingTenant) {
    console.log('🏢 Creating test tenant (Sharma Traders) and catalog items...');
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Sharma Traders',
        slug: 'sharma-traders',
        plan: 'PRO',
        gstin: '07AAAAA1111A1Z1',
        stateCode: '07',
        address: '123, Block-B, Sector-15, Rohini, New Delhi',
        phone: '9876543210',
        email: 'billing@sharmatraders.com',
        invoicePrefix: 'ST',
        invoiceCounter: 0,
        dueDays: 15,
      },
    });

    // Create Owner User
    // Password is: TestPass@123
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: 'Rajesh Sharma',
        email: 'test@sharma.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$yvAVWqHjjGX0umId5KvqfQ$uIAsoHGyQ5InnkQ/K4qTuxWiww0phEfN3pC49DF5yp4',
        role: 'OWNER',
        isActive: true,
      },
    });

    // Create Customers
    const catElectronics = await prisma.productCategory.create({
      data: {
        tenantId: tenant.id,
        name: 'Electronics',
        description: 'Computer and hardware accessories',
      },
    });

    const catOffice = await prisma.productCategory.create({
      data: {
        tenantId: tenant.id,
        name: 'Office Stationery',
        description: 'Paper, notebooks and desk organizers',
      },
    });

    await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: 'Rahul Verma',
        email: 'rahul@verma.com',
        phone: '9988776655',
        address: 'Dwarka Sector-4, New Delhi',
        gstin: '07BBBBB2222B2Z2',
        outstandingBalance: 12000,
      },
    });

    await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: catElectronics.id,
        name: 'Logitech Wireless Mouse M235',
        sku: 'LOG-M235-W',
        barcode: '8901234560011',
        salesPrice: 850,
        purchasePrice: 600,
        taxRate: 18,
        unit: 'PCS',
        stock: 45,
      },
    });
  } else {
    console.log('✔ Test tenant (Sharma Traders) already exists. Skipping...');
  }

  console.log('✅ Database seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
