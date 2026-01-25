import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Clear existing data
  await prisma.workspaceFile.deleteMany();
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
    },
  })

  // Seed tasks
  await prisma.task.createMany({
    data: [
      {
        title: 'Project Proposal Review',
        description: 'Review the latest project proposal for the Q3 roadmap.',
        status: 'pending',
        userId: user.id,
        emailSource: JSON.stringify({
          sender: { name: 'Sarah Miller', email: 'sarah@company.com', avatar: 'https://i.pravatar.cc/150?u=sarah' },
          preview: 'I have attached the proposal for your review...',
          tags: ['Urgent', 'Q3']
        })
      },
      {
        title: 'Team Lunch Details',
        description: 'Coordinate the team lunch for Friday.',
        status: 'pending',
        userId: user.id,
        emailSource: JSON.stringify({
          sender: { name: 'Michael Chen', email: 'mike@company.com', avatar: 'https://i.pravatar.cc/150?u=mike' },
          preview: 'Where should we go this Friday?',
          tags: ['Social']
        })
      },
      {
        title: 'Security Alert: New Login',
        description: 'A new login was detected on your account.',
        status: 'unread',
        userId: user.id,
        emailSource: JSON.stringify({
          sender: { name: 'IT Security', email: 'security@company.com' },
          preview: 'Was this you? A new login from San Francisco...',
          tags: ['Security']
        })
      },
      {
        title: 'Weekly Sync Notes',
        description: 'Notes from the weekly sync meeting.',
        status: 'unread',
        userId: user.id,
        emailSource: JSON.stringify({
          sender: { name: 'Emma Wilson', email: 'emma@company.com' },
          preview: 'Here are the notes from today...',
          tags: []
        })
      }
    ]
  })

  // Seed files
  const documentsFolder = await prisma.workspaceFile.create({
    data: {
      name: 'Documents',
      type: 'folder',
      items: '2 items',
      userId: user.id,
    }
  })

  const designsFolder = await prisma.workspaceFile.create({
    data: {
      name: 'Designs',
      type: 'folder',
      items: '1 item',
      userId: user.id,
    }
  })

  await prisma.workspaceFile.createMany({
    data: [
      {
        name: 'Project Roadmap.pdf',
        type: 'pdf',
        size: '1.2 MB',
        shared: true,
        userId: user.id,
        parentId: documentsFolder.id
      },
      {
        name: 'Q3 Budget.png',
        type: 'image',
        size: '850 KB',
        userId: user.id,
        parentId: documentsFolder.id
      },
      {
        name: 'Hero Mockup.jpg',
        type: 'image',
        size: '2.4 MB',
        userId: user.id,
        parentId: designsFolder.id
      },
      {
        name: 'Logo Final.svg',
        type: 'file',
        size: '12 KB',
        shared: true,
        userId: user.id
      }
    ]
  })

  console.log('Seed completed successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
