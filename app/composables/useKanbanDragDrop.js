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
    
    placeholderHeight.value = element?.offsetHeight || 100
    
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/json', JSON.stringify({
      taskId: task.id,
      columnId: columnId
    }))
    
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
    
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage)
      }
    }, 0)
    
    setTimeout(() => {
      if (element) {
        element.classList.add('dragging')
      }
    }, 0)
    
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
    
    const target = event.target.closest('[data-task-index]')
    if (target) {
      const rect = target.getBoundingClientRect()
      const midPoint = rect.top + rect.height / 2
      const mouseY = event.clientY
      
      const isSameColumn = sourceColumnId.value === columnId
      
      if (mouseY < midPoint) {
        dropTargetIndex.value = taskIndex
        console.log(`[DRAGOVER] Before task@${taskIndex}, sameCol=${isSameColumn}, dropIdx=${taskIndex}`)
      } else {
        dropTargetIndex.value = taskIndex + 1
        console.log(`[DRAGOVER] After task@${taskIndex}, sameCol=${isSameColumn}, dropIdx=${taskIndex + 1}`)
      }
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
    // ✅ FIX: Don't always set to taskCount - only if currently null
    // This prevents overriding the specific dropTargetIndex from handleDragOver
    if (dropTargetIndex.value === null) {
      dropTargetIndex.value = taskCount
    }
  }

  const handleDrop = (event, columnId, onTaskMove) => {
    event.preventDefault()
    event.stopPropagation()
    
    if (!draggedTask.value || !isDragging.value) return
    
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
      rawDropIdx: dropTargetIndex.value,
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
    
    dropOccurred.value = true
    
    if (onTaskMove) {
      onTaskMove({
        task: taskToMove,
        sourceColumnId: sourceCol,
        sourceColumnIndex: sourceIdx,
        targetColumnId,
        targetIndex
      })
    }
    
    setTimeout(() => {
      resetDragState()
    }, 10)
  }

  const handleDragEnd = (element) => {
    if (element) {
      element.classList.remove('dragging')
    }
    
    setTimeout(() => {
      if (!dropOccurred.value) {
        resetDragState()
      }
    }, 20)
  }

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

  // ✅ FIXED: Only 2 parameters to match KanbanColumn calls
  const shouldShowPlaceholderBefore = (columnId, taskIndex) => {
    if (!isDragging.value) return false
    if (dropTargetColumnId.value !== columnId) return false
    
    // Direct comparison - both are in original array space
    return dropTargetIndex.value === taskIndex
  }

  const shouldShowPlaceholderAfter = (columnId, taskIndex, isLast, totalTasks) => {
    if (!isDragging.value) return false
    if (!isLast) return false
    if (dropTargetColumnId.value !== columnId) return false
    
    // Show if dropping beyond the last task
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

  const getDragOpacity = (taskId) => {
    return isTaskDragging(taskId) ? 0.3 : 1
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
    getDragOpacity,
  }
}