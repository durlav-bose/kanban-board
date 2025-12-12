<template>
  <div>
    <div class="board-header">
      <h1>📋 Kanban Board - Linear Style</h1>
    </div>
    
    <div class="container" ref="boardContainer">
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
import { generateDummyData } from '@/utils/generateDummyData'
import KanbanColumn from './KanbanColumn.vue'

// Initialize drag and drop
const dragDrop = useKanbanDragDrop()

// Provide to child components
provide('kanbanDragDrop', dragDrop)

// Board container ref (for auto-scroll if needed)
const boardContainer = ref(null)

// Track column refs
const columnRefs = ref({})

const setColumnRef = (columnId, el) => {
  if (el) {
    columnRefs.value[columnId] = el
  }
}

// Generate data with variable height tasks (150 tasks per column)
const columns = ref(generateDummyData(150))


// Handle task movement
const handleTaskMove = ({ task, sourceColumnId, sourceColumnIndex, targetColumnId, targetIndex }) => {
  // console.log('[BOARD] Moving task:', {
  //   task: task.title,
  //   from: `${sourceColumnId}[${sourceColumnIndex}]`,
  //   to: `${targetColumnId}[${targetIndex}]`
  // })
  
  const sourceColumn = columns.value.find(col => col.id === sourceColumnId)
  const targetColumn = columns.value.find(col => col.id === targetColumnId)
  
  if (!sourceColumn || !targetColumn) {
    console.error('[BOARD] Column not found')
    return
  }
  
  if (sourceColumnId === targetColumnId) {
    // Same column move
    const newTasks = [...sourceColumn.tasks]
    const [movedTask] = newTasks.splice(sourceColumnIndex, 1)
    
    // targetIndex is already in the filtered list context
    // so we can insert directly
    const clampedIndex = Math.max(0, Math.min(targetIndex, newTasks.length))
    newTasks.splice(clampedIndex, 0, movedTask)
    sourceColumn.tasks = newTasks
    
    console.log('[BOARD] Same column move complete. New order:', newTasks.slice(0, 5).map(t => t.title))
  } else {
    // Cross-column move
    const sourceNewTasks = [...sourceColumn.tasks]
    const [movedTask] = sourceNewTasks.splice(sourceColumnIndex, 1)
    
    const targetNewTasks = [...targetColumn.tasks]
    const clampedIndex = Math.max(0, Math.min(targetIndex, targetNewTasks.length))
    targetNewTasks.splice(clampedIndex, 0, movedTask)
    
    sourceColumn.tasks = sourceNewTasks
    targetColumn.tasks = targetNewTasks
    
    console.log('[BOARD] Cross-column move complete')
  }
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

/* Global dragging styles */
:global(.is-dragging) {
  cursor: grabbing !important;
  user-select: none;
}

:global(.is-dragging *) {
  cursor: grabbing !important;
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