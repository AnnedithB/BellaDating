// Quick script to create first admin account
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createFirstAdmin() {
  try {
    // Check if any admin exists
    const existingAdmin = await prisma.admin.findFirst();
    if (existingAdmin) {
      console.log('❌ Admin already exists. Use this script only for first-time setup.');
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash('123456789', 10);

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        email: 'ogollachucho@gmail.com',
        passwordHash: passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });

    console.log('✅ First admin created successfully!');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Password: 123456789');
    console.log('👤 Role:', admin.role);
    console.log('\n🚀 You can now login at: http://localhost:3009/api/auth/login');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createFirstAdmin();
