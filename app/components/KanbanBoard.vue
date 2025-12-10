<template>
  <div>
    <div class="board-header">
      <h1>📋 Kanban Board with Virtual Scroll</h1>
    </div>
    
    <div class="container">
      <KanbanColumn
        v-for="column in columns" 
        :key="column.id"
        :ref="el => setColumnRef(column.id, el)"
        :column="column"
        @task-move="handleTaskMove"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
import { useKanbanDragDrop } from '@/composables/useKanbanDragDrop'
import KanbanColumn from './KanbanColumn.vue'

// Initialize drag and drop
const dragDrop = useKanbanDragDrop()

// Provide to child components
provide('kanbanDragDrop', dragDrop)

// Track column refs
const columnRefs = ref({})

const setColumnRef = (columnId, el) => {
  if (el) {
    columnRefs.value[columnId] = el
  }
}

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

// ✅ FIXED: Handle task movement with minimal reactivity to prevent blinking
const handleTaskMove = ({ task, sourceColumnId, sourceColumnIndex, targetColumnId, targetIndex }) => {
  console.log('Moving task:', {
    task: task.title,
    from: sourceColumnId,
    fromIndex: sourceColumnIndex,
    to: targetColumnId,
    toIndex: targetIndex
  })
  
  // Find source and target columns
  const sourceColumn = columns.value.find(col => col.id === sourceColumnId)
  const targetColumn = columns.value.find(col => col.id === targetColumnId)
  
  if (!sourceColumn || !targetColumn) return
  
  // Create new arrays to minimize reactivity triggers
  if (sourceColumnId === targetColumnId) {
    // Moving within same column - use a single operation
    const newTasks = [...sourceColumn.tasks]
    const [movedTask] = newTasks.splice(sourceColumnIndex, 1)
    const clampedIndex = Math.max(0, Math.min(targetIndex, newTasks.length))
    newTasks.splice(clampedIndex, 0, movedTask)
    
    // Replace entire array at once to minimize reactivity
    sourceColumn.tasks = newTasks
  } else {
    // Moving between columns - batch the operations
    const sourceNewTasks = [...sourceColumn.tasks]
    const [movedTask] = sourceNewTasks.splice(sourceColumnIndex, 1)
    
    const targetNewTasks = [...targetColumn.tasks]
    const clampedIndex = Math.max(0, Math.min(targetIndex, targetNewTasks.length))
    targetNewTasks.splice(clampedIndex, 0, movedTask)
    
    // Update both arrays at once
    sourceColumn.tasks = sourceNewTasks
    targetColumn.tasks = targetNewTasks
  }
  
  console.log('Task moved successfully')
  
  // Here you would typically sync with your backend
  // await api.moveTask(task.id, targetColumnId, clampedIndex)
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