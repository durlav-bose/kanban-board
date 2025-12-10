import { ref, nextTick } from 'vue'

export const useKanbanDragDrop = (options) => {
  // Drag state
  const draggedTask = ref(null)
  const sourceColumnId = ref(null)
  const draggedTaskIndex = ref(null)
  const isDragging = ref(false)

  // const isTaskVisible = ref(true)

  const handleDragStartRemove = options.handleDragStartRemove
  const handleDragCancelReinsert = options.handleDragCancelReinsert
  
  // Drop target state
  const dropTargetColumnId = ref(null)
  const dropTargetIndex = ref(null)
  
  // Placeholder dimensions
  const placeholderHeight = ref(0)

  // ✅ SIMPLE START - No delays, no timers
  const handleDragStart = (event, task, columnId, taskIndex, element) => {
    console.log('[DRAG START]', { task: task.title, columnId, taskIndex })
    
    // Set state IMMEDIATELY
    draggedTask.value = task
    sourceColumnId.value = columnId
    draggedTaskIndex.value = taskIndex
    placeholderHeight.value = element?.offsetHeight || 100
    
    // Set transfer data
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)
    
    // Create drag image
    const dragImage = element.cloneNode(true)
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-9999px'
    dragImage.style.left = '-9999px'
    dragImage.style.width = `${element.offsetWidth}px`
    dragImage.style.opacity = '0.95'
    dragImage.style.transform = 'rotate(2deg) scale(1.03)'
    dragImage.style.border = '2px solid #6366f1'
    dragImage.style.boxShadow = '0 20px 40px rgba(99, 102, 241, 0.6)'
    dragImage.style.borderRadius = '10px'
    document.body.appendChild(dragImage)
    
    event.dataTransfer.setDragImage(
      dragImage,
      element.offsetWidth / 2,
      element.offsetHeight / 2
    )
    
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage)
      }
    }, 0)
    
    // 1. Set isDragging immediately (or in requestAnimationFrame/setTimeout(0))
    // This allows the column/placeholder logic to start.
    requestAnimationFrame(() => {
      isDragging.value = true
      dropTargetColumnId.value = columnId
      dropTargetIndex.value = taskIndex
    })
    
    if (handleDragStartRemove) {
            // Wait for one frame to ensure isDragging is set and drag image is captured
            setTimeout(() => {
                 handleDragStartRemove(columnId, taskIndex)
            }, 50) // or 10ms if 0 is still flaky
        }
  }

  // ✅ SIMPLE DRAG OVER - Just update position
  const handleDragOver = (event, columnId, taskIndex) => {
    if (!isDragging.value) return
    
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    
    const target = event.target.closest('[data-task-index]')
    if (!target) return
    
    const rect = target.getBoundingClientRect()
    const midPoint = rect.top + rect.height / 2
    const mouseY = event.clientY
    
    // Simple: above midpoint = before, below = after
    const newIndex = mouseY < midPoint ? taskIndex : taskIndex + 1
    
    dropTargetColumnId.value = columnId
    dropTargetIndex.value = newIndex
  }

  const handleEmptyColumnDragOver = (event, columnId) => {
    if (!isDragging.value) return
    
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    
    dropTargetColumnId.value = columnId
    dropTargetIndex.value = 0
  }

  const handleColumnDragOver = (event, columnId, taskCount) => {
    if (!isDragging.value) return
    
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    
    dropTargetColumnId.value = columnId
    if (dropTargetIndex.value === null) {
      dropTargetIndex.value = taskCount
    }
  }

  // ✅ SIMPLE DROP - Execute and reset immediately
  const handleDrop = (event, columnId, onTaskMove) => {
    event.preventDefault()
    event.stopPropagation()
    
    console.log('[DROP]', { 
      task: draggedTask.value?.title,
      from: `${sourceColumnId.value}[${draggedTaskIndex.value}]`,
      to: `${dropTargetColumnId.value}[${dropTargetIndex.value}]`
    })
    
    if (!draggedTask.value || !isDragging.value) {
      console.warn('[DROP] Invalid state, resetting')
      resetDragState()
      return
    }
    
    const targetColumnId = dropTargetColumnId.value || columnId
    let targetIndex = dropTargetIndex.value ?? 999
    
    const taskToMove = { ...draggedTask.value }
    const sourceCol = sourceColumnId.value
    const sourceIdx = draggedTaskIndex.value
    
    // Adjust index for same column moves
    // if (sourceCol === targetColumnId && targetIndex > sourceIdx) {
    //   targetIndex = targetIndex - 1
    // }
    
    // Execute move callback
    if (onTaskMove) {
      onTaskMove({
        task: taskToMove,
        sourceColumnId: sourceCol,
        sourceColumnIndex: sourceIdx,
        targetColumnId,
        targetIndex // This index is now correct for the shortened array
      })
    }
    
    resetDragState()
  }

  const handleDragEnd = () => {
    console.log('[DRAG END]')
    
    // CRITICAL: Small delay to let drop fire first if it's going to
    requestAnimationFrame(() => {
      if (isDragging.value) {
        // This runs if drop() did NOT fire before dragend (i.e., drag cancelled)
        console.log('[DRAG END] Resetting (drag cancelled)')
        
        // ✅ Call re-insertion logic before resetting state
        if (handleDragCancelReinsert) {
            handleDragCancelReinsert()
        }
        
        resetDragState()
      }
    })
  }

  // ✅ SIMPLE RESET - Clear everything
  const resetDragState = () => {
    console.log('[RESET] Clearing state')
    
    isDragging.value = false
    draggedTask.value = null
    sourceColumnId.value = null
    draggedTaskIndex.value = null
    dropTargetColumnId.value = null
    dropTargetIndex.value = null
  }

  // Placeholder helpers
  const shouldShowPlaceholderBefore = (columnId, taskIndex) => {
    return isDragging.value && 
           dropTargetColumnId.value === columnId && 
           dropTargetIndex.value === taskIndex
  }

  const shouldShowPlaceholderAfter = (columnId, taskIndex, isLast) => {
    return isDragging.value && 
           isLast && 
           dropTargetColumnId.value === columnId && 
           dropTargetIndex.value > taskIndex
  }

  const shouldShowEmptyPlaceholder = (columnId, isEmpty) => {
    return isDragging.value && 
           isEmpty && 
           dropTargetColumnId.value === columnId
  }

  const isTaskDragging = (taskId) => {
    return isDragging.value && draggedTask.value?.id === taskId
  }

  return {
    // State
    isDragging,
    draggedTask,
    sourceColumnId,
    dropTargetColumnId,
    dropTargetIndex,
    placeholderHeight,
    draggedTaskIndex,
    
    // Handlers
    handleDragStart,
    handleDragOver,
    handleEmptyColumnDragOver,
    handleColumnDragOver,
    handleDrop,
    handleDragEnd,
    resetDragState,
    
    // Helpers
    shouldShowPlaceholderBefore,
    shouldShowPlaceholderAfter,
    shouldShowEmptyPlaceholder,
    isTaskDragging,
  }
}