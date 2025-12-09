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
    draggedTask.value = task
    sourceColumnId.value = columnId
    draggedTaskIndex.value = taskIndex
    draggedElement.value = element
    
    // Store height for placeholder
    placeholderHeight.value = element?.offsetHeight || 100
    
    // Setup drag data
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
    dragImage.style.opacity = '0.95'
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
    
    // Clean up drag image
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage)
      }
    }, 0)
    
    // Add dragging class
    setTimeout(() => {
      if (element) {
        element.classList.add('dragging')
      }
    }, 0)
    
    // Set isDragging after dragstart completes so element stays visible during event
    setTimeout(() => {
      isDragging.value = true
    }, 0)
  }

  // Handle drag over with proper 50% threshold
  const handleDragOver = (event, columnId, taskIndex) => {
    if (!isDragging.value) return
    
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    
    dropTargetColumnId.value = columnId
    
    // Get the target element
    const target = event.target.closest('[data-task-index]')
    if (target) {
      const rect = target.getBoundingClientRect()
      const midPoint = rect.top + rect.height / 2
      const mouseY = event.clientY
      
      // Determine insert position based on 50% threshold
      if (mouseY < midPoint) {
        // Top half - insert BEFORE this task
        dropTargetIndex.value = taskIndex
      } else {
        // Bottom half - insert AFTER this task
        dropTargetIndex.value = taskIndex + 1
      }
    }
  }

  // Handle drag over empty column
  const handleEmptyColumnDragOver = (event, columnId) => {
    if (!isDragging.value) return
    
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    
    dropTargetColumnId.value = columnId
    dropTargetIndex.value = 0
  }

  // Handle drag over column (for empty areas)
  const handleColumnDragOver = (event, columnId, taskCount) => {
    if (!isDragging.value) return
    
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    
    // If no specific task target, drop at end
    dropTargetColumnId.value = columnId
    if (dropTargetIndex.value === null) {
      dropTargetIndex.value = taskCount
    }
  }

  // Handle drop
  const handleDrop = (event, columnId, onTaskMove) => {
    event.preventDefault()
    event.stopPropagation()
    
    if (!draggedTask.value || !isDragging.value) return
    
    const targetColumnId = dropTargetColumnId.value || columnId
    let targetIndex = dropTargetIndex.value
    
    // If no target index set, drop at end
    if (targetIndex === null) {
      // We'll let the board component handle this
      targetIndex = 999 // Large number, will be clamped
    }
    
    // Save the data we need
    const taskToMove = { ...draggedTask.value }
    const sourceCol = sourceColumnId.value
    const sourceIdx = draggedTaskIndex.value
    
    // Adjust index if moving within same column
    if (sourceCol === targetColumnId && sourceIdx !== null) {
      if (targetIndex > sourceIdx) {
        targetIndex = targetIndex - 1
      }
    }
    
    // Mark that drop occurred
    dropOccurred.value = true
    
    // Call move handler immediately (it will handle the visual update)
    if (onTaskMove) {
      onTaskMove({
        task: taskToMove,
        sourceColumnId: sourceCol,
        sourceColumnIndex: sourceIdx,
        targetColumnId,
        targetIndex
      })
    }
    
    // Reset state after a tiny delay to let drop complete
    setTimeout(() => {
      resetDragState()
    }, 10)
  }

  // End dragging
  const handleDragEnd = (element) => {
    if (element) {
      element.classList.remove('dragging')
    }
    
    // Only reset if drop didn't occur (e.g., cancelled drag)
    setTimeout(() => {
      if (!dropOccurred.value) {
        resetDragState()
      }
    }, 20)
  }

  // Reset all drag state
  const resetDragState = () => {
    isDragging.value = false
    draggedTask.value = null
    sourceColumnId.value = null
    draggedTaskIndex.value = null
    draggedElement.value = null
    dropTargetColumnId.value = null
    dropTargetIndex.value = null
    dropOccurred.value = false
  }

  // Check if placeholder should show BEFORE this task
  const shouldShowPlaceholderBefore = (columnId, taskIndex, taskId) => {
    if (!isDragging.value) return false
    if (dropTargetColumnId.value !== columnId) return false
    if (dropTargetIndex.value !== taskIndex) return false
    
    return true
  }

  // Check if placeholder should show AFTER last task
  const shouldShowPlaceholderAfter = (columnId, taskIndex, isLast, totalTasks) => {
    if (!isDragging.value) return false
    if (!isLast) return false
    if (dropTargetColumnId.value !== columnId) return false
    
    // Show if drop index is beyond this task
    const adjustedTotal = (sourceColumnId.value === columnId) ? totalTasks - 1 : totalTasks
    return dropTargetIndex.value > taskIndex && dropTargetIndex.value >= adjustedTotal
  }

  // Check if column should show placeholder when empty
  const shouldShowEmptyPlaceholder = (columnId, isEmpty) => {
    return (
      isDragging.value &&
      isEmpty &&
      dropTargetColumnId.value === columnId
    )
  }

  // Check if task is being dragged
  const isTaskDragging = (taskId) => {
    return isDragging.value && draggedTask.value?.id === taskId
  }

  // Get drag opacity for visual feedback
  const getDragOpacity = (taskId) => {
    return isTaskDragging(taskId) ? 0.3 : 1
  }

  return {
    // State
    isDragging,
    draggedTask,
    sourceColumnId,
    dropTargetColumnId,
    dropTargetIndex,
    placeholderHeight,
    
    // Methods
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
    getDragOpacity,
  }
}