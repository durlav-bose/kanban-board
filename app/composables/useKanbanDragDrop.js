import { ref, computed } from 'vue'

/**
 * Kanban Drag & Drop Composable - Linear Style
 * 
 * Key insight: Linear doesn't actually reorder the DOM during drag.
 * Instead, it uses CSS transforms to visually shift items, creating
 * the illusion of smooth reordering.
 * 
 * How it works:
 * 1. Dragged task becomes invisible (opacity: 0) but stays in DOM
 * 2. A floating placeholder shows the drop target position
 * 3. Tasks between source and target shift up/down via CSS transforms
 * 4. On drop, actual array reorder happens and transforms reset
 */
export function useKanbanDragDrop() {
  // ============ STATE ============
  const isDragging = ref(false)
  const draggedTask = ref(null)
  const sourceColumnId = ref(null)
  const sourceIndex = ref(null)
  const placeholderHeight = ref(80)

  // Current drop target (where placeholder shows)
  const dropTargetColumnId = ref(null)
  const dropTargetIndex = ref(null)

  // ============ DRAG START ============
  const handleDragStart = (event, task, columnId, index, element) => {
    console.log('[DRAG START]', task.title, 'from', columnId, 'index', index)

    // Store source info
    draggedTask.value = { ...task }
    sourceColumnId.value = columnId
    sourceIndex.value = index
    
    // Initially, drop target is same as source
    dropTargetColumnId.value = columnId
    dropTargetIndex.value = index

    // Capture element height for placeholder
    if (element) {
      const rect = element.getBoundingClientRect()
      placeholderHeight.value = rect.height
    }

    // Configure drag
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)

    // Custom drag image (fully visible with smooth pickup feel)
    if (element) {
      const rect = element.getBoundingClientRect()
      const clone = element.cloneNode(true)
      
      clone.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: ${rect.width}px;
        opacity: 1;
        // transform: rotate(50deg) scale(1.03);
        // box-shadow: 0 20px 50px rgba(0,0,0,0.7);
        border-radius: 7px;
        pointer-events: none;
        z-index: 10000;
        background: #22232F;
        border: 1px solid rgba(255, 255, 255, 0.06);
        // transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      `
      
      document.body.appendChild(clone)
      event.dataTransfer.setDragImage(clone, event.clientX - rect.left, event.clientY - rect.top)
      
      requestAnimationFrame(() => clone.remove())
    }

    // Delay state to allow drag image to render
    requestAnimationFrame(() => {
      isDragging.value = true
      document.body.classList.add('is-dragging')
    })
  }

  // ============ DRAG OVER ============
  const handleDragOver = (event, columnId, taskIndex) => {
    if (!isDragging.value) return
    
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    // Only update if changed (prevents excessive reactivity)
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
    const targetIdx = dropTargetIndex.value ?? 0
    const srcCol = sourceColumnId.value
    const srcIdx = sourceIndex.value

    console.log('[DROP]', draggedTask.value.title)
    console.log('  From:', srcCol, 'index', srcIdx)
    console.log('  To:', targetCol, 'index', targetIdx)

    // Call the move handler
    if (onMove) {
      onMove({
        task: draggedTask.value,
        sourceColumnId: srcCol,
        sourceColumnIndex: srcIdx,
        targetColumnId: targetCol,
        targetIndex: targetIdx
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
    document.body.classList.remove('is-dragging')
  }

  // ============ HELPER: Calculate transform for a task ============
  /**
   * For Linear-style visual shifting:
   * - Tasks between source and target need to shift to "make room"
   * - If target > source: tasks in between shift UP (negative Y)
   * - If target < source: tasks in between shift DOWN (positive Y)
   */
  const getTaskTransform = (columnId, taskIndex, taskHeight) => {
    if (!isDragging.value) return null
    if (!draggedTask.value) return null
    
    const srcCol = sourceColumnId.value
    const srcIdx = sourceIndex.value
    const tgtCol = dropTargetColumnId.value
    const tgtIdx = dropTargetIndex.value

    // Same column drag - apply transforms to tasks between source and target
    if (srcCol === columnId && tgtCol === columnId) {
      if (srcIdx === tgtIdx) return null // No movement needed
      
      const height = taskHeight || placeholderHeight.value
      
      if (tgtIdx > srcIdx) {
        // Dragging DOWN: tasks between (srcIdx, tgtIdx] shift UP
        if (taskIndex > srcIdx && taskIndex <= tgtIdx) {
          return { transform: `translateY(-${height}px)` }
        }
      } else {
        // Dragging UP: tasks between [tgtIdx, srcIdx) shift DOWN
        if (taskIndex >= tgtIdx && taskIndex < srcIdx) {
          return { transform: `translateY(${height}px)` }
        }
      }
    }
    
    // Cross-column drag
    if (srcCol === columnId && tgtCol !== columnId) {
      // Source column: tasks after source shift UP to fill gap
      if (taskIndex > srcIdx) {
        return { transform: `translateY(-${placeholderHeight.value}px)` }
      }
    }
    
    if (tgtCol === columnId && srcCol !== columnId) {
      // Target column: tasks at/after target shift DOWN to make room
      if (taskIndex >= tgtIdx) {
        return { transform: `translateY(${placeholderHeight.value}px)` }
      }
    }

    return null
  }

  // ============ HELPER: Check if task is the dragged one ============
  const isDraggedTask = (taskId) => {
    return isDragging.value && draggedTask.value?.id === taskId
  }

  // ============ HELPER: Should show placeholder at position ============
  const shouldShowPlaceholder = (columnId, index) => {
    if (!isDragging.value) return false
    return dropTargetColumnId.value === columnId && dropTargetIndex.value === index
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
    
    // Helpers for Linear-style transforms
    getTaskTransform,
    isDraggedTask,
    shouldShowPlaceholder,
  }
}