const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://user:password@127.0.0.1:5432/dashboard_db'
    }
  }
})

async function testConnection() {
  try {
    console.log('Testing database connection...')
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Connection successful!', result)
    
    const userCount = await prisma.user.count()
    console.log(`✅ Found ${userCount} users`)
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
    console.error('Full error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
