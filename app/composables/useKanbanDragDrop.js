import { ref, nextTick } from 'vue'

export const useKanbanDragDrop = () => {
  // Drag state
  const draggedTask = ref(null)
  const sourceColumnId = ref(null)
  const draggedElement = ref(null)
  const isDragging = ref(false)
  
  // Drop target state
  const dropTargetColumnId = ref(null)
  const dropTargetIndex = ref(null)
  
  // Placeholder dimensions
  const placeholderHeight = ref(0)
  
  // Animation state
  const animatingTasks = ref(new Set())

  // Start dragging with smooth animation
  const handleDragStart = (event, task, columnId, element) => {
    isDragging.value = true
    draggedTask.value = task
    sourceColumnId.value = columnId
    draggedElement.value = element
    
    // Store height for placeholder
    placeholderHeight.value = element?.offsetHeight || 100

    console.log('placeholderHeight.value :>> ', placeholderHeight.value);
    
    // Setup drag data
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/json', JSON.stringify({
      taskId: task.id,
      columnId: columnId
    }))
    
    // Create custom drag image with style
    const dragImage = element.cloneNode(true)
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-9999px'
    dragImage.style.left = '-9999px'
    dragImage.style.width = `${element.offsetWidth}px`
    dragImage.style.opacity = '1'
    dragImage.style.transform = 'rotate(3deg)'
    dragImage.style.border = '2px solid #6366f1'
    dragImage.style.boxShadow = '0 8px 16px rgba(99, 102, 241, 0.4)'
    dragImage.style.backgroundColor = 'transparent'
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
    
    // Add dragging class with delay to prevent flicker
    setTimeout(() => {
      if (element) {
        element.classList.add('dragging')
      }
    }, 0)
  }

  // Handle drag over with position calculation
  const handleDragOver = (event, columnId, taskIndex, tasks) => {
    if (!isDragging.value) return
    
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    
    dropTargetColumnId.value = columnId
    
    // Use the provided taskIndex directly since DynamicScroller passes correct index
    const target = event.target.closest('.task-wrapper')
    if (target) {
      const rect = target.getBoundingClientRect()
      const midPoint = rect.top + rect.height / 2
      
      // Determine insert position based on cursor position
      // Store the RAW visual index - adjustment happens in placeholder logic
      if (event.clientY < midPoint) {
        // Drop before this task (at this index)
        dropTargetIndex.value = taskIndex
      } else {
        // Drop after this task (at index + 1)
        dropTargetIndex.value = taskIndex + 1
      }
    } else {
      // Dropping in empty space or at end
      dropTargetIndex.value = tasks.length
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

  // Trigger smooth animation (optional - can be used for effects)
  const triggerAnimation = (columnId, index) => {
    // This can be used to trigger additional visual effects
    // For now, the placeholder movement itself provides the animation
  }

  // Handle drop with data update
  const handleDrop = (event, columnId, onTaskMove, tasks) => {
    event.preventDefault()
    
    if (!draggedTask.value || !isDragging.value) return
    
    const targetColumnId = dropTargetColumnId.value || columnId
    let targetIndex = dropTargetIndex.value ?? 0
    
    // If moving within same column, adjust for removed item
    if (sourceColumnId.value === targetColumnId && tasks) {
      const draggedIndex = tasks.findIndex(t => t.id === draggedTask.value.id)
      if (draggedIndex !== -1 && targetIndex > draggedIndex) {
        // When dropping after the current position, account for removal
        targetIndex = Math.max(0, targetIndex - 1)
      }
    }
    
    // Call the move handler
    if (onTaskMove) {
      onTaskMove({
        task: draggedTask.value,
        sourceColumnId: sourceColumnId.value,
        targetColumnId,
        targetIndex
      })
    }
    
    // Reset state with small delay for smooth finish
    setTimeout(() => {
      resetDragState()
    }, 50)
  }

  // End dragging
  const handleDragEnd = (element) => {
    if (element) {
      element.classList.remove('dragging')
    }
    
    setTimeout(() => {
      resetDragState()
    }, 100)
  }

  // Reset all drag state
  const resetDragState = () => {
    isDragging.value = false
    draggedTask.value = null
    sourceColumnId.value = null
    draggedElement.value = null
    dropTargetColumnId.value = null
    dropTargetIndex.value = null
    animatingTasks.value.clear()
  }

  // Check if task should show placeholder before it
  const shouldShowPlaceholderBefore = (columnId, taskIndex, taskId, tasks) => {
    if (!isDragging.value) return false
    if (dropTargetColumnId.value !== columnId) return false
    if (dropTargetIndex.value === null) return false
    
    // Never show placeholder on the dragged item itself
    if (draggedTask.value?.id === taskId) return false
    
    // For same column drags, we need to adjust for the removed item
    if (sourceColumnId.value === columnId && draggedTask.value && tasks) {
      const draggedIndex = tasks.findIndex(t => t.id === draggedTask.value.id)
      
      if (draggedIndex === -1) return dropTargetIndex.value === taskIndex
      
      // Calculate where placeholder should show accounting for removed item
      let adjustedDropIndex = dropTargetIndex.value
      
      // If dropping after the dragged position, adjust down by 1
      if (dropTargetIndex.value > draggedIndex) {
        adjustedDropIndex = dropTargetIndex.value - 1
      }
      
      return adjustedDropIndex === taskIndex
    }
    
    // Different column - simple comparison
    return dropTargetIndex.value === taskIndex
  }

  // Check if task should show placeholder after it
  const shouldShowPlaceholderAfter = (columnId, taskIndex, isLast, tasks) => {
    if (!isDragging.value) return false
    if (dropTargetColumnId.value !== columnId) return false
    if (!isLast) return false
    if (dropTargetIndex.value === null) return false
    
    // For same column, adjust for removed item
    if (sourceColumnId.value === columnId && draggedTask.value && tasks) {
      const draggedIndex = tasks.findIndex(t => t.id === draggedTask.value.id)
      let adjustedDropIndex = dropTargetIndex.value
      
      if (draggedIndex !== -1 && dropTargetIndex.value > draggedIndex) {
        adjustedDropIndex = dropTargetIndex.value - 1
      }
      
      return adjustedDropIndex > taskIndex
    }
    
    return dropTargetIndex.value > taskIndex
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