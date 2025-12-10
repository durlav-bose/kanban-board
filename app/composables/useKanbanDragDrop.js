import { ref } from 'vue'

export const useKanbanDragDrop = () => {
  // Drag state
  const draggedTask = ref(null)
  const sourceColumnId = ref(null)
  const draggedTaskIndex = ref(null)
  const draggedElement = ref(null)
  const isDragging = ref(false)
  const dropOccurred = ref(false)
  
  // Drop target state
  const dropTargetColumnId = ref(null)
  const dropTargetIndex = ref(null)
  
  // Placeholder dimensions
  const placeholderHeight = ref(0)

  // Start dragging
  const handleDragStart = (event, task, columnId, taskIndex, element) => {
    console.log('[DRAG START]', { event, task: task.title, columnId, taskIndex, element })
    
    draggedTask.value = task
    sourceColumnId.value = columnId
    draggedTaskIndex.value = taskIndex
    draggedElement.value = element
    
    placeholderHeight.value = element?.offsetHeight || 100
    
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/json', JSON.stringify({
      taskId: task.id,
      columnId: columnId
    }))
    
    // Create custom drag image
    const dragImage = element.cloneNode(true)
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-9999px'
    dragImage.style.left = '-9999px'
    dragImage.style.width = `${element.offsetWidth}px`
    dragImage.style.opacity = '1.0'
    dragImage.style.transform = 'rotate(2deg) scale(1.02)'
    dragImage.style.border = '2px solid #6366f1'
    dragImage.style.boxShadow = '0 12px 24px rgba(99, 102, 241, 0.5)'
    dragImage.style.borderRadius = '10px'
    dragImage.style.background = 'linear-gradient(135deg, #334155 0%, #1e293b 100%)'
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
    
    setTimeout(() => {
      isDragging.value = true
      // Initialize drop target to source position
      dropTargetColumnId.value = columnId
      dropTargetIndex.value = taskIndex
    }, 0)
  }

  // Handle drag over with proper 50% threshold
  const handleDragOver = (event, columnId, taskIndex) => {
    if (!isDragging.value) return
    
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    
    const target = event.target.closest('[data-task-index]')
    if (target) {
      const rect = target.getBoundingClientRect()
      const midPoint = rect.top + rect.height / 2
      const mouseY = event.clientY
      
      let newIndex
      if (mouseY < midPoint) {
        newIndex = taskIndex
      } else {
        newIndex = taskIndex + 1
      }
      
      // Update placeholder position
      dropTargetColumnId.value = columnId
      dropTargetIndex.value = newIndex
    }
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
    
    // Only set to end if we don't have a specific target
    if (dropTargetIndex.value === null || dropTargetIndex.value === undefined) {
      dropTargetIndex.value = taskCount
    }
  }

  const handleDrop = (event, columnId, onTaskMove) => {
    event.preventDefault()
    event.stopPropagation()
    
    console.log('[DROP START]', { isDragging: isDragging.value, draggedTask: draggedTask.value })
    
    if (!draggedTask.value || !isDragging.value) {
      console.log('[DROP] Aborted - invalid state')
      return
    }
    
    const targetColumnId = dropTargetColumnId.value || columnId
    let targetIndex = dropTargetIndex.value
    
    if (targetIndex === null || targetIndex === undefined) {
      targetIndex = 999
    }
    
    const taskToMove = { ...draggedTask.value }
    const sourceCol = sourceColumnId.value
    const sourceIdx = draggedTaskIndex.value
    
    console.log('[DROP] Before adjustment:', {
      task: taskToMove.title || taskToMove.id,
      sourceCol,
      sourceIdx,
      targetCol: targetColumnId,
      rawDropIdx: targetIndex,
      sameColumn: sourceCol === targetColumnId
    })
    
    // Adjust index if moving within same column
    if (sourceCol === targetColumnId && sourceIdx !== null) {
      if (targetIndex > sourceIdx) {
        targetIndex = targetIndex - 1
        console.log('[DROP] Adjusted targetIndex:', targetIndex)
      }
    }
    
    console.log('[DROP] Final:', {
      task: taskToMove.title || taskToMove.id,
      from: `${sourceCol}[${sourceIdx}]`,
      to: `${targetColumnId}[${targetIndex}]`
    })
    
    // Mark that drop occurred
    dropOccurred.value = true
    
    // Execute the move
    if (onTaskMove) {
      onTaskMove({
        task: taskToMove,
        sourceColumnId: sourceCol,
        sourceColumnIndex: sourceIdx,
        targetColumnId,
        targetIndex
      })
    }
    
    // Reset immediately after move
    console.log('[DROP] Resetting state')
    resetDragState()
  }

  const handleDragEnd = (element) => {
    console.log('[DRAG END]', { dropOccurred: dropOccurred.value })
    
    // Only reset if drop didn't occur (drag was cancelled)
    if (!dropOccurred.value) {
      console.log('[DRAG END] No drop occurred, resetting')
      resetDragState()
    } else {
      console.log('[DRAG END] Drop occurred, state already reset')
    }
  }

  const resetDragState = () => {
    console.log('[RESET] Clearing all drag state')
    
    isDragging.value = false
    draggedTask.value = null
    sourceColumnId.value = null
    draggedTaskIndex.value = null
    draggedElement.value = null
    dropTargetColumnId.value = null
    dropTargetIndex.value = null
    dropOccurred.value = false
  }

  const shouldShowPlaceholderBefore = (columnId, taskIndex) => {
    if (!isDragging.value) return false
    if (dropTargetColumnId.value !== columnId) return false
    
    return dropTargetIndex.value === taskIndex
  }

  const shouldShowPlaceholderAfter = (columnId, taskIndex, isLast, totalTasks) => {
    if (!isDragging.value) return false
    if (!isLast) return false
    if (dropTargetColumnId.value !== columnId) return false
    
    return dropTargetIndex.value > taskIndex
  }

  const shouldShowEmptyPlaceholder = (columnId, isEmpty) => {
    return (
      isDragging.value &&
      isEmpty &&
      dropTargetColumnId.value === columnId
    )
  }

  const isTaskDragging = (taskId) => {
    return isDragging.value && draggedTask.value?.id === taskId
  }

  return {
    isDragging,
    draggedTask,
    sourceColumnId,
    dropTargetColumnId,
    dropTargetIndex,
    placeholderHeight,
    draggedTaskIndex,
    
    handleDragStart,
    handleDragOver,
    handleEmptyColumnDragOver,
    handleColumnDragOver,
    handleDrop,
    handleDragEnd,
    resetDragState,
    
    shouldShowPlaceholderBefore,
    shouldShowPlaceholderAfter,
    shouldShowEmptyPlaceholder,
    isTaskDragging,
  }
}