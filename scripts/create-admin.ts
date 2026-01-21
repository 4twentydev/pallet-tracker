import { createUser } from '../lib/db/user-queries';

/**
 * Script to create the first admin user
 * Run with: npx tsx scripts/create-admin.ts
 */
async function main() {
  const name = process.argv[2];
  const pin = process.argv[3];

  if (!name || !pin) {
    console.error('Usage: npx tsx scripts/create-admin.ts <name> <pin>');
    console.error('Example: npx tsx scripts/create-admin.ts "Admin User" "1234"');
    process.exit(1);
  }

  if (pin.length < 4) {
    console.error('Error: PIN must be at least 4 characters');
    process.exit(1);
  }

  try {
    const user = await createUser(name, pin, 'admin');
    console.log('✅ Admin user created successfully!');
    console.log('Name:', user.name);
    console.log('Role:', user.role);
    console.log('PIN:', pin);
    console.log('\nYou can now sign in with this PIN.');
  } catch (error) {
    const errorMessage = String(error);
    console.error('❌ Failed to create admin user:', error);

    if (errorMessage.includes('relation "users" does not exist') || errorMessage.includes('42P01')) {
      console.error('\nThe database schema is missing. Run the following to create tables:');
      console.error('  pnpm db:push');
    }

    process.exit(1);
  }
}

main();
