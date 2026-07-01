import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Clean existing records (optional/caution)
  // To avoid constraints errors during re-runs
  await prisma.payment.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.productCategory.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  // 2. Create Tenant
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

  // 3. Create Owner User
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

  // 4. Create Customers
  const customer1 = await prisma.customer.create({
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

  const customer2 = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      name: 'Ankit Gupta',
      email: 'ankit@gupta.com',
      phone: '9898989898',
      address: 'Gopal Nagar, Ghaziabad',
      outstandingBalance: 0,
    },
  });

  // 5. Create Categories
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

  // 6. Create Products
  const prod1 = await prisma.product.create({
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

  const prod2 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catElectronics.id,
      name: 'Samsung 24-inch IPS Monitor',
      sku: 'SAM-IPS24-HD',
      barcode: '8901234560028',
      salesPrice: 8500,
      purchasePrice: 6200,
      taxRate: 18,
      unit: 'PCS',
      stock: 12,
    },
  });

  const prod3 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catOffice.id,
      name: 'A4 Copier Paper Bundle (500 sheets)',
      sku: 'COP-A4-500',
      barcode: '8901234560035',
      salesPrice: 320,
      purchasePrice: 220,
      taxRate: 12,
      unit: 'BOX',
      stock: 3,
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log('🔑 Credentials to Log In:');
  console.log('   Email:    test@sharma.com');
  console.log('   Password: TestPass@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
