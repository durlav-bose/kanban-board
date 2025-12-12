import { ref } from 'vue'

/**
 * Kanban Drag & Drop Composable
 * 
 * Simple and reliable implementation:
 * - Source task becomes invisible (opacity: 0)
 * - Floating placeholder shows drop position
 * - Tasks shift down via CSS class
 */
export function useKanbanDragDrop() {
  // Drag state
  const isDragging = ref(false)
  const draggedTask = ref(null)
  const sourceColumnId = ref(null)
  const sourceIndex = ref(null)
  const placeholderHeight = ref(80)

  // Drop target
  const dropTargetColumnId = ref(null)
  const dropTargetIndex = ref(null)

  // ============ DRAG START ============
  const handleDragStart = (event, task, columnId, index, element) => {
    console.log('[DRAG START]', task.title, 'from', columnId, 'index', index)

    // Store drag data
    draggedTask.value = { ...task }
    sourceColumnId.value = columnId
    sourceIndex.value = index
    dropTargetColumnId.value = columnId
    dropTargetIndex.value = index

    // Get element height
    if (element) {
      placeholderHeight.value = element.getBoundingClientRect().height
    }

    // Set drag data
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)

    // Custom drag image
    if (element) {
      const rect = element.getBoundingClientRect()
      const clone = element.cloneNode(true)
      
      clone.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: ${rect.width}px;
        opacity: 0.9;
        transform: rotate(2deg);
        box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        border-radius: 8px;
        pointer-events: none;
      `
      
      document.body.appendChild(clone)
      event.dataTransfer.setDragImage(clone, event.clientX - rect.left, event.clientY - rect.top)
      
      setTimeout(() => clone.remove(), 0)
    }

    // Delay state change to allow drag to start
    requestAnimationFrame(() => {
      isDragging.value = true
      document.body.style.cursor = 'grabbing'
    })
  }

  // ============ DRAG OVER ============
  const handleDragOver = (event, columnId, taskIndex) => {
    if (!isDragging.value) return
    
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    if (dropTargetColumnId.value !== columnId || dropTargetIndex.value !== taskIndex) {
      dropTargetColumnId.value = columnId
      dropTargetIndex.value = taskIndex
    }
  }

  // ============ DROP ============
  const handleDrop = (event, columnId, onMove) => {
    if (!isDragging.value || !draggedTask.value) return
    
    event.preventDefault()

    const targetCol = dropTargetColumnId.value || columnId
    let targetIdx = dropTargetIndex.value ?? 0
    const srcCol = sourceColumnId.value
    const srcIdx = sourceIndex.value

    console.log('[DROP]', draggedTask.value.title)
    console.log('  From:', srcCol, 'index', srcIdx)
    console.log('  To:', targetCol, 'index', targetIdx)

    // targetIdx is already in "visual space" (without dragged task) from computeDropIndexOverTask
    // No need to adjust here
    const finalIdx = Math.max(0, targetIdx)
    console.log('  Final index:', finalIdx)

    if (onMove) {
      onMove({
        task: draggedTask.value,
        sourceColumnId: srcCol,
        sourceColumnIndex: srcIdx,
        targetColumnId: targetCol,
        targetIndex: finalIdx
      })
    }

    resetDragState()
  }

  // ============ DRAG END ============
  const handleDragEnd = () => {
    console.log('[DRAG END]')
    resetDragState()
  }

  // ============ RESET ============
  const resetDragState = () => {
    isDragging.value = false
    draggedTask.value = null
    sourceColumnId.value = null
    sourceIndex.value = null
    dropTargetColumnId.value = null
    dropTargetIndex.value = null
    document.body.style.cursor = ''
  }

  return {
    // State
    isDragging,
    draggedTask,
    sourceColumnId,
    sourceIndex,
    dropTargetColumnId,
    dropTargetIndex,
    placeholderHeight,

    // Methods
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    resetDragState,
  }
}