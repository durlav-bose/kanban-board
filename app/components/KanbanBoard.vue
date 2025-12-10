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

const handleDragStartRemove = (columnId, taskIndex) => {
  const sourceColumn = columns.value.find(col => col.id === columnId)
  if (!sourceColumn) return

  // 1. Temporarily remove the task from the data array.
  sourceColumn.tasks.splice(taskIndex, 1)

  // 2. Force the scroller to update its cache
  nextTick(() => { // ✅ Use nextTick instead of requestAnimationFrame for consistency
    columnRefs.value[columnId]?.scroller?.forceUpdate()
  })
}

// ✅ NEW FUNCTION: Handles re-insertion when drag is cancelled/aborted
const handleDragCancelReinsert = () => {
    // Retrieve necessary data from the drag state
    const task = dragDrop.draggedTask.value
    const columnId = dragDrop.sourceColumnId.value
    const index = dragDrop.draggedTaskIndex.value
    
    // Safety check
    if (!task || !columnId || index === null) return

    const sourceColumn = columns.value.find(col => col.id === columnId)
    if (!sourceColumn) return

    // Re-insert the task at its original position
    sourceColumn.tasks.splice(index, 0, task)
    
    // Force update the scroller
    nextTick(() => {
        columnRefs.value[columnId]?.scroller?.forceUpdate()
    })
    console.log('[BOARD] Task re-inserted on cancel:', task.title)
}


// ✅ CRITICAL FIX: Initialize drag and drop by passing ALL necessary handlers
const dragDrop = useKanbanDragDrop({
  handleDragStartRemove: handleDragStartRemove,
  handleDragCancelReinsert: handleDragCancelReinsert // Pass new handler
})

// Provide to child components
provide('kanbanDragDrop', dragDrop)

// ✅ RESTORED/FIXED: Handle task movement (for successful drop)
// const handleTaskMove = async ({ task, sourceColumnId, sourceColumnIndex, targetColumnId, targetIndex }) => {
//   console.log('[BOARD] Moving task:', {
//     task: task.title,
//     from: `${sourceColumnId}[${sourceColumnIndex}]`,
//     to: `${targetColumnId}[${targetIndex}]`
//   })
  
//   const targetColumn = columns.value.find(col => col.id === targetColumnId)
  
//   if (!targetColumn) {
//     console.error('[BOARD] Target column not found')
//     // Since the task was already removed, we must re-insert it if target is invalid
//     handleDragCancelReinsert() 
//     return
//   }
  
//   // NOTE: The task was already removed from the source array in handleDragStartRemove.
//   // We only need to insert it into the target column here.
  
//   const targetNewTasks = [...targetColumn.tasks]
//   // Correctly insert the task at the target index
//   const clampedIndex = Math.max(0, Math.min(targetIndex, targetNewTasks.length))
//   targetNewTasks.splice(clampedIndex, 0, task) 
  
//   targetColumn.tasks = targetNewTasks
  
//   // Force update the scroller(s)
//   await nextTick()
//   const sourceRef = columnRefs.value[sourceColumnId] 
//   const targetRef = columnRefs.value[targetColumnId]
  
//   if (sourceRef && sourceRef.forceUpdate) sourceRef.forceUpdate()
//   if (targetRef && targetRef.forceUpdate) targetRef.forceUpdate()
  
//   console.log('[BOARD] Task moved successfully')
// }

const handleTaskMove = async ({ task, sourceColumnId, sourceColumnIndex, targetColumnId, targetIndex }) => {
  console.log('[BOARD] Moving task:', {
    task: task.title,
    from: `${sourceColumnId}[${sourceColumnIndex}]`,
    to: `${targetColumnId}[${targetIndex}]`
  })
  
  const targetColumn = columns.value.find(col => col.id === targetColumnId)
  
  if (!targetColumn) {
    console.error('[BOARD] Target column not found')
    // If the target is invalid, re-insert the task back at the source
    dragDrop.handleDragCancelReinsert() 
    return
  }
  
  // NOTE: The task was already removed from the source array in handleDragStartRemove.
  // We only need to insert it into the target column here.
  
  // Create a new array to ensure reactivity update
  const targetNewTasks = [...targetColumn.tasks]
  
  // Insert the task at the calculated target index
  const clampedIndex = Math.max(0, Math.min(targetIndex, targetNewTasks.length))
  targetNewTasks.splice(clampedIndex, 0, task) 
  
  targetColumn.tasks = targetNewTasks
  
  // Force update the scroller(s)
  await nextTick()
  const sourceRef = columnRefs.value[sourceColumnId] 
  const targetRef = columnRefs.value[targetColumnId]
  
  if (sourceRef && sourceRef.forceUpdate) sourceRef.forceUpdate()
  if (targetRef && targetRef.forceUpdate) targetRef.forceUpdate()
  
  console.log('[BOARD] Task moved successfully')
}

// Track column refs
const columnRefs = ref({})

const setColumnRef = (columnId, el) => {
  if (el) {
    columnRefs.value[columnId] = el
  }
}

// Sample data
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
// const handleTaskMove = ({ task, sourceColumnId, sourceColumnIndex, targetColumnId, targetIndex }) => {
//   console.log('[BOARD] Moving task:', {
//     task: task.title,
//     from: `${sourceColumnId}[${sourceColumnIndex}]`,
//     to: `${targetColumnId}[${targetIndex}]`
//   })
  
//   const sourceColumn = columns.value.find(col => col.id === sourceColumnId)
//   const targetColumn = columns.value.find(col => col.id === targetColumnId)
  
//   if (!sourceColumn || !targetColumn) {
//     console.error('[BOARD] Column not found')
//     return
//   }
  
//   if (sourceColumnId === targetColumnId) {
//     // Same column move
//     const newTasks = [...sourceColumn.tasks]
//     const [movedTask] = newTasks.splice(sourceColumnIndex, 1)
//     const clampedIndex = Math.max(0, Math.min(targetIndex, newTasks.length))
//     newTasks.splice(clampedIndex, 0, movedTask)
//     sourceColumn.tasks = newTasks
//   } else {
//     // Cross-column move
//     const sourceNewTasks = [...sourceColumn.tasks]
//     const [movedTask] = sourceNewTasks.splice(sourceColumnIndex, 1)
    
//     const targetNewTasks = [...targetColumn.tasks]
//     const clampedIndex = Math.max(0, Math.min(targetIndex, targetNewTasks.length))
//     targetNewTasks.splice(clampedIndex, 0, movedTask)
    
//     sourceColumn.tasks = sourceNewTasks
//     targetColumn.tasks = targetNewTasks
//   }
  
//   console.log('[BOARD] Task moved successfully')
// }

// const handleTaskMove = async ({ task, sourceColumnId, sourceColumnIndex, targetColumnId, targetIndex }) => {
//   console.log('[BOARD] Moving task:', {
//     task: task.title,
//     from: `${sourceColumnId}[${sourceColumnIndex}]`,
//     to: `${targetColumnId}[${targetIndex}]`
//   })
  
//   const sourceColumn = columns.value.find(col => col.id === sourceColumnId)
//   const targetColumn = columns.value.find(col => col.id === targetColumnId)
  
//   if (!sourceColumn || !targetColumn) {
//     console.error('[BOARD] Column not found')
//     return
//   }
  
//   // Create new arrays to trigger reactivity
//   if (sourceColumnId === targetColumnId) {
//     // Same column move
//     const newTasks = [...sourceColumn.tasks]
//     const [movedTask] = newTasks.splice(sourceColumnIndex, 1)
//     const clampedIndex = Math.max(0, Math.min(targetIndex, newTasks.length))
//     newTasks.splice(clampedIndex, 0, movedTask)
//     sourceColumn.tasks = newTasks
    
//     // Force update the column's virtual scroller
//     await nextTick()
//     const columnRef = columnRefs.value[sourceColumnId]
//     if (columnRef && columnRef.forceUpdate) {
//       columnRef.forceUpdate()
//     }
//   } else {
//     // Cross-column move
//     const sourceNewTasks = [...sourceColumn.tasks]
//     const [movedTask] = sourceNewTasks.splice(sourceColumnIndex, 1)
    
//     const targetNewTasks = [...targetColumn.tasks]
//     const clampedIndex = Math.max(0, Math.min(targetIndex, targetNewTasks.length))
//     targetNewTasks.splice(clampedIndex, 0, movedTask)
    
//     // Update both columns
//     sourceColumn.tasks = sourceNewTasks
//     targetColumn.tasks = targetNewTasks
    
//     // Force update both column virtual scrollers
//     await nextTick()
//     const sourceRef = columnRefs.value[sourceColumnId]
//     const targetRef = columnRefs.value[targetColumnId]
    
//     if (sourceRef && sourceRef.forceUpdate) sourceRef.forceUpdate()
//     if (targetRef && targetRef.forceUpdate) targetRef.forceUpdate()
//   }
  
//   console.log('[BOARD] Task moved successfully')
// }
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

@media (max-width: 768px) {
  .board-header h1 {
    font-size: 1.5rem;
  }
  
  .container {
    padding: 10px;
  }
}
</style>