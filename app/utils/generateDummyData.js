// Generate dummy kanban data
const taskPrefixes = [
  'Design', 'Implement', 'Refactor', 'Test', 'Debug', 'Optimize', 'Review',
  'Update', 'Create', 'Fix', 'Improve', 'Deploy', 'Configure', 'Analyze',
  'Document', 'Research', 'Build', 'Integrate', 'Migrate', 'Setup'
];

const taskSubjects = [
  'user authentication', 'payment gateway', 'dashboard layout', 'API endpoints',
  'database schema', 'responsive design', 'error handling', 'caching system',
  'search functionality', 'email notifications', 'file upload', 'data validation',
  'unit tests', 'performance metrics', 'security patches', 'UI components',
  'navigation menu', 'form validation', 'third-party integration', 'logging system',
  'user profile', 'analytics tracking', 'real-time updates', 'webhook handlers',
  'image optimization', 'SEO improvements', 'accessibility features', 'mobile app',
  'admin panel', 'reporting system', 'backup strategy', 'CI/CD pipeline',
  'documentation site', 'API documentation', 'customer portal', 'inventory system',
  'shopping cart', 'checkout process', 'order tracking', 'invoice generation',
  'subscription management', 'chat feature', 'video streaming', 'content management',
  'social media integration', 'push notifications', 'geolocation services', 'payment processing',
  'user permissions', 'data export', 'audit logs', 'batch processing'
];

const priorities = ['Low', 'Medium', 'High', 'Critical'];

const descriptions = [
  'This task requires careful attention to detail.',
  'High priority item that needs immediate action.',
  'Can be completed in the next sprint.',
  'Blocked by external dependencies.',
  'Waiting for stakeholder approval.',
  'Technical debt that should be addressed.',
  'New feature requested by customers.',
  'Bug fix required for production.',
  'Performance optimization needed.',
  'Security vulnerability to patch.'
];

const tags = [
  'frontend', 'backend', 'api', 'database', 'ui/ux', 'devops', 
  'security', 'performance', 'bug', 'feature', 'enhancement', 'refactor',
  'documentation', 'testing', 'mobile', 'desktop', 'cloud', 'infrastructure'
];

let taskIdCounter = 1000;

export function generateTask(columnId = 'todo') {
  const prefix = taskPrefixes[Math.floor(Math.random() * taskPrefixes.length)];
  const subject = taskSubjects[Math.floor(Math.random() * taskSubjects.length)];
  const priority = priorities[Math.floor(Math.random() * priorities.length)];
  const description = descriptions[Math.floor(Math.random() * descriptions.length)];
  const taskTags = [];
  
  // Add 1-3 random tags
  const numTags = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < numTags; i++) {
    const tag = tags[Math.floor(Math.random() * tags.length)];
    if (!taskTags.includes(tag)) {
      taskTags.push(tag);
    }
  }

  return {
    id: taskIdCounter++,
    title: `${prefix} ${subject}`,
    priority,
    description,
    tags: taskTags,
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    assignee: `User ${Math.floor(Math.random() * 10) + 1}`,
    estimatedHours: Math.floor(Math.random() * 40) + 1,
    columnId
  };
}

export function generateDummyData(tasksPerColumn = 150) {
  const columns = [
    {
      id: 'todo',
      title: '📝 To Do',
      tasks: []
    },
    {
      id: 'in-progress',
      title: '🚀 In Progress',
      tasks: []
    },
    {
      id: 'review',
      title: '👀 Review',
      tasks: []
    },
    {
      id: 'done',
      title: '✅ Done',
      tasks: []
    }
  ];

  // Generate tasks for each column
  columns.forEach(column => {
    for (let i = 0; i < tasksPerColumn; i++) {
      column.tasks.push(generateTask(column.id));
    }
  });

  return columns;
}
