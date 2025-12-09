<template>
  <div>
    <div class="board-header">
      <h1>📋 Kanban Board with Virtual Scroll</h1>
    </div>
    
    <div class="container">
      <KanbanColumn
        v-for="column in columns" 
        :key="column.id"
        :column="column"
        @task-move="handleTaskMove"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
import { useKanbanDragDrop } from '../composables/useKanbanDragDrop.js'
import KanbanColumn from './KanbanColumn.vue'

// Initialize drag and drop
const dragDrop = useKanbanDragDrop()

// Provide to child components
provide('kanbanDragDrop', dragDrop)

// Sample data - replace with your actual data
const columns = ref([
  {
    id: 'todo',
    title: '📝 To Do',
    tasks: Array.from({ length: 100 }, (_, i) => ({
      id: `todo-${i}`,
      title: `Task ${i + 1}`,
      priority: ['Low', 'Medium', 'High'][i % 3],
      description: i % 2 === 0 ? 'Short description' : 'Longer description with more details'
    }))
  },
  {
    id: 'in-progress',
    title: '🚀 In Progress',
    tasks: Array.from({ length: 50 }, (_, i) => ({
      id: `progress-${i}`,
      title: `Task ${i + 1}`,
      priority: ['Low', 'Medium', 'High'][i % 3],
      description: 'Work in progress'
    }))
  },
  {
    id: 'review',
    title: '👀 Review',
    tasks: Array.from({ length: 30 }, (_, i) => ({
      id: `review-${i}`,
      title: `Task ${i + 1}`,
      priority: ['Low', 'Medium', 'High'][i % 3],
      description: 'Under review'
    }))
  },
  {
    id: 'done',
    title: '✅ Done',
    tasks: Array.from({ length: 75 }, (_, i) => ({
      id: `done-${i}`,
      title: `Task ${i + 1}`,
      priority: 'Low',
      description: 'Completed'
    }))
  }
])

// Handle task movement
const handleTaskMove = ({ task, sourceColumnId, targetColumnId, targetIndex }) => {
  console.log('Moving task:', {
    task: task.title,
    from: sourceColumnId,
    to: targetColumnId,
    index: targetIndex
  })
  
  // Find source and target columns
  const sourceColumn = columns.value.find(col => col.id === sourceColumnId)
  const targetColumn = columns.value.find(col => col.id === targetColumnId)
  
  if (!sourceColumn || !targetColumn) return
  
  // Remove from source
  const taskIndex = sourceColumn.tasks.findIndex(t => t.id === task.id)
  if (taskIndex === -1) return
  
  const [movedTask] = sourceColumn.tasks.splice(taskIndex, 1)
  
  // Add to target at specific index
  let insertIndex = targetIndex
  
  // If moving within same column and moving down, adjust index
  if (sourceColumnId === targetColumnId && taskIndex < targetIndex) {
    insertIndex = targetIndex - 1
  }
  
  targetColumn.tasks.splice(insertIndex, 0, movedTask)
  
  // Here you would typically sync with your backend
  // await syncTaskMove(task.id, targetColumnId, insertIndex)
}

// Optional: Add some sample functions you might need
const addTask = (columnId, taskData) => {
  const column = columns.value.find(col => col.id === columnId)
  if (column) {
    column.tasks.push({
      id: `task-${Date.now()}`,
      ...taskData
    })
  }
}

const deleteTask = (taskId) => {
  columns.value.forEach(column => {
    const index = column.tasks.findIndex(t => t.id === taskId)
    if (index !== -1) {
      column.tasks.splice(index, 1)
    }
  })
}
</script>

<style scoped>
.board-header {
  text-align: center;
  padding: 30px 20px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border-bottom: 2px solid rgba(71, 85, 105, 0.5);
  margin-bottom: 20px;
}

.board-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #e2e8f0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.container {
  display: flex;
  gap: 20px;
  padding: 20px;
  overflow-x: auto;
  overflow-y: hidden;
  min-height: calc(100vh - 150px);
  align-items: flex-start;
}

/* Custom scrollbar for horizontal scroll */
.container::-webkit-scrollbar {
  height: 8px;
}

.container::-webkit-scrollbar-track {
  background: rgba(71, 85, 105, 0.3);
  border-radius: 4px;
}

.container::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
  transition: background 0.2s;
}

.container::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

@media (max-width: 768px) {
  .board-header h1 {
    font-size: 1.5rem;
  }
  
  .container {
    padding: 10px;
  }
}
</style>