<template>
  <div>
    <div class="board-header">
      <h1>Kanban Board</h1>
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


/**
 * Handle task movement
 * 
 * IMPORTANT: The targetIndex from the column is in "filtered space"
 * - For same-column drags: index assumes dragged task is removed
 * - For cross-column drags: index is direct position in target
 */
const handleTaskMove = ({ task, sourceColumnId, sourceColumnIndex, targetColumnId, targetIndex }) => {
  console.log('[BOARD] Moving task:', {
    task: task.title,
    from: `${sourceColumnId}[${sourceColumnIndex}]`,
    to: `${targetColumnId}[${targetIndex}]`
  })
  
  const sourceColumn = columns.value.find(col => col.id === sourceColumnId)
  const targetColumn = columns.value.find(col => col.id === targetColumnId)
  
  if (!sourceColumn || !targetColumn) {
    console.error('[BOARD] Column not found')
    return
  }
  
  if (sourceColumnId === targetColumnId) {
    // ========== SAME COLUMN MOVE ==========
    // targetIndex is in "filtered space" (as if dragged task doesn't exist)
    // We need to convert it back to actual array position
    
    const newTasks = [...sourceColumn.tasks]
    
    // Remove from source position
    const [movedTask] = newTasks.splice(sourceColumnIndex, 1)
    
    // targetIndex is already correct for the filtered array
    // (where the task has been removed)
    const clampedIndex = Math.max(0, Math.min(targetIndex, newTasks.length))
    newTasks.splice(clampedIndex, 0, movedTask)
    
    sourceColumn.tasks = newTasks
    
    console.log('[BOARD] Same column move complete:', {
      fromIndex: sourceColumnIndex,
      toIndex: clampedIndex,
      newOrder: newTasks.slice(0, 5).map(t => t.title)
    })
  } else {
    // ========== CROSS-COLUMN MOVE ==========
    // targetIndex is direct position in target column
    
    const sourceNewTasks = [...sourceColumn.tasks]
    const [movedTask] = sourceNewTasks.splice(sourceColumnIndex, 1)
    
    const targetNewTasks = [...targetColumn.tasks]
    const clampedIndex = Math.max(0, Math.min(targetIndex, targetNewTasks.length))
    targetNewTasks.splice(clampedIndex, 0, movedTask)
    
    sourceColumn.tasks = sourceNewTasks
    targetColumn.tasks = targetNewTasks
    
    console.log('[BOARD] Cross-column move complete:', {
      fromColumn: sourceColumnId,
      toColumn: targetColumnId,
      toIndex: clampedIndex
    })
  }
}
</script>

<style scoped>
.board-header {
  text-align: center;
  padding: 30px 20px;
  background: #191A23;
  border-bottom: 1px solid rgba(46, 48, 49, 0.5);
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
  background: #191A23;
}

/* Professional scrollbar styling */
.container::-webkit-scrollbar {
  height: 6px;
}

.container::-webkit-scrollbar-track {
  background: transparent;
}

.container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  transition: background 0.2s ease;
}

.container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
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