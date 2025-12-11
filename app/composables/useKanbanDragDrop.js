import { ref } from 'vue'

/**
 * Kanban Drag & Drop - Linear Style
 * 
 * Key principles:
 * - Don't filter the list (causes RecycleScroller re-render which cancels drag)
 * - Hide dragged task with CSS opacity
 * - Use placeholder space that pushes other tasks down
 * - Delay isDragging to allow native drag to initialize
 */
export function useKanbanDragDrop() {
  // ============ DRAG STATE ============
  const isDragging = ref(false)
  const draggedTask = ref(null)
  const sourceColumnId = ref(null)
  const sourceIndex = ref(null)
  const placeholderHeight = ref(88)

  // Drop target tracking
  const dropTargetColumnId = ref(null)
  const dropTargetIndex = ref(null)

  // ============ DRAG START ============
  const handleDragStart = (event, task, columnId, index, element) => {
    console.log('[DRAG] Start:', task.title, 'from', columnId, 'at index', index)

    // Set data BEFORE isDragging (prevents CSS from canceling drag)
    draggedTask.value = { ...task }
    sourceColumnId.value = columnId
    sourceIndex.value = index

    // Capture height
    if (element) {
      placeholderHeight.value = element.getBoundingClientRect().height
    }

    // Initialize drop target
    dropTargetColumnId.value = columnId
    dropTargetIndex.value = index

    // Set drag data
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)

    // Custom drag image
    if (element) {
      createDragImage(event, element)
    }

    // CRITICAL: Delay isDragging to let drag event fully initialize
    requestAnimationFrame(() => {
      isDragging.value = true
      document.body.classList.add('is-dragging')
    })
  }

  const createDragImage = (event, element) => {
    const rect = element.getBoundingClientRect()
    
    const dragImage = element.cloneNode(true)
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-1000px'
    dragImage.style.left = '-1000px'
    dragImage.style.width = rect.width + 'px'
    dragImage.style.height = rect.height + 'px'
    dragImage.style.opacity = '0.9'
    dragImage.style.transform = 'rotate(3deg)'
    dragImage.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.35)'
    dragImage.style.borderRadius = '10px'
    dragImage.style.pointerEvents = 'none'
    dragImage.style.zIndex = '10000'
    
    document.body.appendChild(dragImage)

    const offsetX = event.clientX - rect.left
    const offsetY = event.clientY - rect.top
    event.dataTransfer.setDragImage(dragImage, offsetX, offsetY)

    // Cleanup
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (dragImage.parentNode) {
          dragImage.parentNode.removeChild(dragImage)
        }
      }, 0)
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
      console.log('[DRAG OVER] Target:', columnId, 'index:', taskIndex)
    }
  }

  // ============ DROP ============
  const handleDrop = (event, columnId, onMove) => {
    if (!isDragging.value || !draggedTask.value) return
    
    event.preventDefault()

    const targetColumnId = dropTargetColumnId.value || columnId
    let targetIndex = dropTargetIndex.value ?? 0
    const srcColumnId = sourceColumnId.value
    const srcIndex = sourceIndex.value

    console.log('[DROP] Task:', draggedTask.value.title)
    console.log('[DROP] From:', srcColumnId, 'index:', srcIndex)
    console.log('[DROP] To:', targetColumnId, 'raw index:', targetIndex)

    // Calculate final index
    let finalIndex = targetIndex

    if (srcColumnId === targetColumnId) {
      // Same column move
      if (targetIndex > srcIndex) {
        // Moving down: subtract 1 because source will be removed first
        finalIndex = targetIndex - 1
      }
      // Moving up: targetIndex is correct
    }
    // Cross-column: targetIndex is correct as-is

    finalIndex = Math.max(0, finalIndex)
    console.log('[DROP] Final index:', finalIndex)

    if (onMove) {
      onMove({
        task: draggedTask.value,
        sourceColumnId: srcColumnId,
        sourceColumnIndex: srcIndex,
        targetColumnId: targetColumnId,
        targetIndex: finalIndex
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

  // ============ HELPERS ============
  const isTaskBeingDragged = (taskId) => {
    return isDragging.value && draggedTask.value?.id === taskId
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

    // Helpers
    isTaskBeingDragged,
  }
}