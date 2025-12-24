import { ref, onBeforeUnmount } from 'vue'

export function useKanbanDragDrop() {
  // ============ STATE ============
  const isDragging = ref(false)
  const draggedTask = ref(null)
  const sourceColumnId = ref(null)
  const sourceIndex = ref(null)
  const placeholderHeight = ref(80)

  // Custom drag preview
  const customDragElement = ref(null)
  const dragOffset = ref({ x: 0, y: 0 })

  // Drop target
  const dropTargetColumnId = ref(null)
  const dropTargetIndex = ref(null)

  // ============ NON-REACTIVE COORDS ============
  let mouseX = 0
  let mouseY = 0
  let rafPending = false

  let dragMoveListener = null
  let dragSourceElement = null
  let cleanupTimeoutId = null

  // Store the onMove callback to execute AFTER animation
  let pendingMoveCallback = null

  const applyPreviewTransform = () => {
    const el = customDragElement.value
    if (!el) return
    const x = mouseX - dragOffset.value.x
    const y = mouseY - dragOffset.value.y
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  const schedulePreviewMove = () => {
    if (rafPending) return
    rafPending = true

    requestAnimationFrame(() => {
      rafPending = false
      applyPreviewTransform()
    })
  }

  const cleanup = () => {
    // Remove drag listeners
    if (dragSourceElement && dragMoveListener) {
      dragSourceElement.removeEventListener('drag', dragMoveListener)
      dragSourceElement = null
      dragMoveListener = null
    }

    // Clear timeouts
    if (cleanupTimeoutId) {
      clearTimeout(cleanupTimeoutId)
      cleanupTimeoutId = null
    }

    // Remove custom drag element
    if (customDragElement.value) {
      try {
        customDragElement.value.remove()
      } catch (e) {
        // Already removed
      }
      customDragElement.value = null
    }

    rafPending = false
    mouseX = 0
    mouseY = 0
    pendingMoveCallback = null
  }

  // ============ DRAG START ============
  const handleDragStart = (event, task, columnId, index, element) => {
    // If element not provided, try to find it
    if (!element) {
      element = event.target?.closest?.('[draggable="true"]')
    }
    
    if (!element) {
      event.preventDefault()
      return
    }

    draggedTask.value = { ...task }
    sourceColumnId.value = columnId
    sourceIndex.value = index

    dropTargetColumnId.value = columnId
    dropTargetIndex.value = index

    const rect = element.getBoundingClientRect()
    placeholderHeight.value = rect.height

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)

    mouseX = event.clientX
    mouseY = event.clientY

    dragOffset.value = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }

    const clone = element.cloneNode(true)
    clone.style.position = 'fixed'
    clone.style.left = '0px'
    clone.style.top = '0px'
    clone.style.width = `${rect.width}px`
    clone.style.opacity = '1'
    clone.style.borderRadius = '7px'
    clone.style.pointerEvents = 'none'
    clone.style.zIndex = '10000'
    clone.style.background = '#22232F'
    clone.style.border = '1px solid rgba(255, 255, 255, 0.15)'
    clone.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.6)'
    clone.style.transition = 'none'
    clone.style.willChange = 'transform'

    customDragElement.value = clone
    document.body.appendChild(clone)

    applyPreviewTransform()

    // Hide default drag image
    const img = new Image()
    img.src =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    event.dataTransfer.setDragImage(img, 0, 0)

    // Track movement
    dragSourceElement = element
    dragMoveListener = (e) => {
      if (e.clientX !== 0 && e.clientY !== 0) {
        mouseX = e.clientX
        mouseY = e.clientY
        schedulePreviewMove()
      }
    }
    dragSourceElement.addEventListener('drag', dragMoveListener)

    // Fallback cleanup timeout
    cleanupTimeoutId = setTimeout(() => {
      if (customDragElement.value) {
        console.warn('Drag cleanup via timeout')
        resetDragState()
      }
    }, 15000)

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

    // Track movement
    if (event.clientX !== 0 && event.clientY !== 0) {
      mouseX = event.clientX
      mouseY = event.clientY
      schedulePreviewMove()
    }

    if (dropTargetColumnId.value !== columnId || dropTargetIndex.value !== taskIndex) {
      dropTargetColumnId.value = columnId
      dropTargetIndex.value = taskIndex
    }
  }

  // ============ DROP ============
  const handleColumnDrop = (event, columnId, onMove) => {
    if (!isDragging.value || !draggedTask.value) return
    event.preventDefault()

    const targetCol = dropTargetColumnId.value || columnId
    const targetIdx = dropTargetIndex.value ?? 0
    const srcCol = sourceColumnId.value
    const srcIdx = sourceIndex.value

    // Store the move data for AFTER animation
    pendingMoveCallback = () => {
      if (onMove) {
        onMove({
          task: draggedTask.value,
          sourceColumnId: srcCol,
          sourceColumnIndex: srcIdx,
          targetColumnId: targetCol,
          targetIndex: targetIdx
        })
      }
    }

    // Find placeholder
    const placeholderEl = document.querySelector('.placeholder-inner')
    
    if (placeholderEl && customDragElement.value) {
      const dragEl = customDragElement.value
      const targetRect = placeholderEl.getBoundingClientRect()
      
      // Stop tracking mouse immediately
      if (dragSourceElement && dragMoveListener) {
        dragSourceElement.removeEventListener('drag', dragMoveListener)
        dragMoveListener = null
      }
      
      // Start animation
      dragEl.style.transition = 'transform 250ms cubic-bezier(0.2, 0, 0, 1)'
      
      // Use RAF to ensure smooth animation start
      requestAnimationFrame(() => {
        dragEl.style.transform = `translate3d(${targetRect.left}px, ${targetRect.top}px, 0)`
      })
      
      // After animation completes
      setTimeout(() => {
        // Fade out the drag preview
        dragEl.style.opacity = '0'
        dragEl.style.transition = 'opacity 100ms ease'
        
        // Execute the move NOW (updates data)
        if (pendingMoveCallback) {
          pendingMoveCallback()
          pendingMoveCallback = null
        }
        
        // Final cleanup after fade
        setTimeout(() => {
          cleanup()
          
          // Clear drag state
          isDragging.value = false
          draggedTask.value = null
          sourceColumnId.value = null
          sourceIndex.value = null
          dropTargetColumnId.value = null
          dropTargetIndex.value = null
          document.body.classList.remove('is-dragging')
        }, 100)
      }, 250)
    } else {
      // No placeholder found - immediate update
      if (pendingMoveCallback) {
        pendingMoveCallback()
        pendingMoveCallback = null
      }
      resetDragState()
    }
  }

  const handleDragEnd = () => {
    // Cancel any pending move
    pendingMoveCallback = null
    resetDragState()
  }

  const resetDragState = () => {
    cleanup()

    isDragging.value = false
    draggedTask.value = null
    sourceColumnId.value = null
    sourceIndex.value = null
    dropTargetColumnId.value = null
    dropTargetIndex.value = null

    document.body.classList.remove('is-dragging')
  }

  // Cleanup on unmount
  onBeforeUnmount(() => {
    resetDragState()
  })

  return {
    isDragging,
    draggedTask,
    sourceColumnId,
    sourceIndex,
    dropTargetColumnId,
    dropTargetIndex,
    placeholderHeight,

    handleDragStart,
    handleDragOver,
    handleColumnDrop,
    handleDragEnd,
    resetDragState,
    cleanup: resetDragState
  }
}