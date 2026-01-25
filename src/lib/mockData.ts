export type Email = {
    id: string;
    sender: {
        name: string;
        email: string;
        avatar?: string;
    };
    subject: string;
    preview: string;
    body: string;
    date: string;
    tags: string[];
    status: 'read' | 'unread';
    category: 'inbox' | 'task' | 'campaign';
    hasAttachment?: boolean;
};

export const MOCK_EMAILS: Email[] = [
    {
        id: '1',
        sender: { name: 'Sarah Wilson', email: 'sarah.w@design.co', avatar: 'https://i.pravatar.cc/150?u=sarah' },
        subject: 'Q4 Marketing Campaign Assets',
        preview: 'Here are the final assets for the Q4 campaign. Let me know if you need any changes...',
        body: 'Hi there,\n\nI have attached the final assets for the Q4 marketing campaign. Please review them and let me know if you have any feedback or if anything is missing.\n\nBest,\nSarah',
        date: '10:30 AM',
        tags: ['Urgent', 'Marketing'],
        status: 'unread',
        category: 'campaign',
        hasAttachment: true,
    },
    {
        id: '2',
        sender: { name: 'Jason Chen', email: 'jason@techflow.io' },
        subject: 'Project Alpha Deployment Schedule',
        preview: 'Just a reminder that we are scheduled to deploy Project Alpha this Friday at 2 PM...',
        body: 'Team,\n\nWe are on track for the deployment of Project Alpha this Friday. Please ensure all code is merged by Thursday EOD.\n\nThanks,\nJason',
        date: 'Yesterday',
        tags: ['Dev', 'Deployment'],
        status: 'read',
        category: 'task',
    },
    {
        id: '3',
        sender: { name: 'Google Cloud Platform', email: 'noreply@google.com' },
        subject: 'Monthly Billing Invoice',
        preview: 'Your invoice for the month of December is now available...',
        body: 'Hello,\n\nYour Google Cloud Platform invoice for December is attached. Total amount: $124.50.\n\nRegards,\nGCP Team',
        date: 'Jan 15',
        tags: ['Finance'],
        status: 'unread',
        category: 'inbox',
    },
    {
        id: '4',
        sender: { name: 'Emily Davis', email: 'emily@creative.studio' },
        subject: 'Re: Website Redesign Proposal',
        preview: 'I love the new direction! Can we schedule a call to discuss the homepage layout?',
        body: 'Hi,\n\nI reviewed the proposal and I really like the direction. I have a few thoughts on the homepage layout. Can we chat tomorrow?\n\nBest,\nEmily',
        date: 'Jan 14',
        tags: ['Client', 'Design'],
        status: 'read',
        category: 'inbox',
    },
    {
        id: '5',
        sender: { name: 'Asana', email: 'notifications@asana.com' },
        subject: 'New Task Assigned: Review Q1 Roadmap',
        preview: 'Michael assigned you a new task in Q1 Planning project...',
        body: 'You have a new task.\n\nTask: Review Q1 Roadmap\nDue: Friday\n\nClick here to view.',
        date: 'Jan 12',
        tags: ['Productivity'],
        status: 'read',
        category: 'task',
    },
];

export const TASKS = [
    { id: 't1', title: 'Review Q4 Campaign', due: 'Today', status: 'pending' },
    { id: 't2', title: 'Deploy Alpha', due: 'Friday', status: 'pending' },
];
