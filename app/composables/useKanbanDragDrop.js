import { ref, computed } from 'vue'

/**
 * Kanban Drag & Drop - Linear Style
 * 
 * Simplified approach matching Linear's behavior:
 * - Filter out dragged task from rendered list during drag
 * - Simple placeholder tracking (targetIndex always matches drop position)
 * - No complex index conversions
 * - Works with virtual scrolling
 */
export function useKanbanDragDrop() {
  // ============ DRAG STATE ============
  const isDragging = ref(false)
  const draggedTask = ref(null)
  const sourceColumnId = ref(null)
  const sourceIndex = ref(null)
  const placeholderHeight = ref(80)

  // Drop target - index is in filtered list context (without dragged task)
  const dropTargetColumnId = ref(null)
  const dropTargetIndex = ref(null)

  // ============ DRAG START ============
  const handleDragStart = (event, task, columnId, index, element) => {
    console.log('[DRAG] Start:', task.title, 'from', columnId, 'at index', index)

    // Store drag state
    isDragging.value = true
    draggedTask.value = { ...task }
    sourceColumnId.value = columnId
    sourceIndex.value = index
    
    // Capture height for placeholder
    if (element) {
      placeholderHeight.value = element.getBoundingClientRect().height
    }

    // Reset drop target
    dropTargetColumnId.value = null
    dropTargetIndex.value = null

    // Set drag data
    event.dataTransfer.setData('text/plain', task.id)
    event.dataTransfer.effectAllowed = 'move'

    // Create custom drag image
    if (element) {
      const rect = element.getBoundingClientRect()
      const dragImage = element.cloneNode(true)
      dragImage.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: ${rect.width}px;
        opacity: 0.9;
        transform: rotate(2deg);
        pointer-events: none;
        z-index: 9999;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        border-radius: 10px;
      `
      document.body.appendChild(dragImage)

      const offsetX = event.clientX - rect.left
      const offsetY = event.clientY - rect.top
      event.dataTransfer.setDragImage(dragImage, offsetX, offsetY)

      // Clean up drag image
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (dragImage.parentNode) {
            document.body.removeChild(dragImage)
          }
        }, 0)
      })
    }

    // Add global dragging class
    document.body.classList.add('is-dragging')
  }

  // ============ DRAG OVER (on individual tasks) ============
  const handleDragOver = (event, columnId, taskIndex) => {
    if (!isDragging.value) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    // taskIndex is the index in the FILTERED list (without dragged task)
    // This is exactly where we want to insert
    dropTargetColumnId.value = columnId
    dropTargetIndex.value = taskIndex
  }

  // ============ COLUMN DRAG OVER (bottom of column) ============
  const handleColumnDragOver = (event, columnId, totalTasks) => {
    if (!isDragging.value) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    // Calculate drop index based on mouse position
    const column = event.currentTarget.closest('[data-column]')
    if (!column) {
      dropTargetColumnId.value = columnId
      dropTargetIndex.value = totalTasks
      return
    }

    const mouseY = event.clientY

    // Get all visible task elements (dragged task won't be in DOM due to v-if)
    const taskElements = Array.from(column.querySelectorAll('[data-task-id]'))
      .filter(el => el.getAttribute('data-task-id') !== draggedTask.value?.id)

    if (taskElements.length === 0) {
      dropTargetColumnId.value = columnId
      dropTargetIndex.value = 0
      return
    }

    // Find insertion point
    let insertIndex = taskElements.length

    for (let i = 0; i < taskElements.length; i++) {
      const rect = taskElements[i].getBoundingClientRect()
      const middle = rect.top + rect.height / 2

      if (mouseY < middle) {
        insertIndex = i
        break
      }
    }

    dropTargetColumnId.value = columnId
    dropTargetIndex.value = insertIndex
  }

  // ============ EMPTY COLUMN DRAG OVER ============
  const handleEmptyColumnDragOver = (event, columnId) => {
    if (!isDragging.value) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    dropTargetColumnId.value = columnId
    dropTargetIndex.value = 0
  }

  // ============ DROP ============
  const handleDrop = (event, columnId, onMove) => {
    if (!isDragging.value || !draggedTask.value) return
    event.preventDefault()

    const targetColumnId = dropTargetColumnId.value || columnId
    const targetIndex = dropTargetIndex.value ?? 0

    console.log('[DROP] Task:', draggedTask.value.title)
    console.log('[DROP] Target:', targetColumnId, 'at index:', targetIndex)

    // Call the move callback
    if (onMove) {
      onMove({
        task: draggedTask.value,
        sourceColumnId: sourceColumnId.value,
        sourceColumnIndex: sourceIndex.value,
        targetColumnId: targetColumnId,
        targetIndex: targetIndex
      })
    }

    resetDragState()
  }

  // ============ DRAG END ============
  const handleDragEnd = () => {
    console.log('[DRAG] End')
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
    document.body.classList.remove('is-dragging')
  }

  // ============ HELPER: Get visible tasks (filtered) ============
  /**
   * Returns tasks without the dragged task
   * Use this for rendering to simplify placeholder logic
   */
  const getVisibleTasks = (tasks) => {
    if (!isDragging.value || !draggedTask.value) {
      return tasks
    }
    return tasks.filter(t => t.id !== draggedTask.value.id)
  }

  // ============ HELPER: Check if task is being dragged ============
  const isTaskBeingDragged = (taskId) => {
    return isDragging.value && draggedTask.value?.id === taskId
  }

  // ============ HELPER: Should show placeholder at index ============
  /**
   * Check if placeholder should show BEFORE task at this index
   * index is in filtered list context
   */
  const shouldShowPlaceholder = (columnId, index) => {
    if (!isDragging.value) return false
    if (dropTargetColumnId.value !== columnId) return false
    if (dropTargetIndex.value === null) return false

    return dropTargetIndex.value === index
  }

  // ============ HELPER: Should show placeholder at end ============
  const shouldShowPlaceholderAtEnd = (columnId, filteredTasksLength) => {
    if (!isDragging.value) return false
    if (dropTargetColumnId.value !== columnId) return false
    if (dropTargetIndex.value === null) return false

    return dropTargetIndex.value >= filteredTasksLength
  }

  // ============ HELPER: Should show empty column placeholder ============
  const shouldShowEmptyPlaceholder = (columnId, isEmpty) => {
    if (!isDragging.value) return false
    if (dropTargetColumnId.value !== columnId) return false

    return isEmpty
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
    handleColumnDragOver,
    handleEmptyColumnDragOver,
    handleDrop,
    handleDragEnd,
    resetDragState,

    // Helpers
    getVisibleTasks,
    isTaskBeingDragged,
    shouldShowPlaceholder,
    shouldShowPlaceholderAtEnd,
    shouldShowEmptyPlaceholder,
  }
}