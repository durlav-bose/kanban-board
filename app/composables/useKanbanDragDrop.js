import { ref } from 'vue'

/**
 * Kanban Drag & Drop Composable - Optimized (No continuous RAF loop)
 *
 * Key changes for performance:
 * - No perpetual requestAnimationFrame loop
 * - Preview position updates are RAF-throttled (at most once per frame)
 * - No global document dragover listener
 * - Mouse tracking uses:
 *    1) the dragged element's native "drag" event (best coverage)
 *    2) the column/task "handleDragOver" event (when over drop zones)
 * - Preview moves via transform: translate3d(...) (GPU-friendly)
 */
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

  // Current drop target (placeholder position)
  const dropTargetColumnId = ref(null)
  const dropTargetIndex = ref(null)

  // ============ NON-REACTIVE COORDS (PERF) ============
  let mouseX = 0
  let mouseY = 0

  // RAF throttling state
  let rafPending = false

  // Drag-event listener we attach to the dragged element (cleanup later)
  let dragMoveListener = null
  let dragSourceElement = null

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

  // ============ INTERNAL: CLEANUP ============
  const cleanupPreviewAndListeners = () => {
    // Remove drag-move listener from the source element
    if (dragSourceElement && dragMoveListener) {
      dragSourceElement.removeEventListener('drag', dragMoveListener)
    }
    dragMoveListener = null
    dragSourceElement = null

    // Remove preview
    if (customDragElement.value) {
      customDragElement.value.remove()
      customDragElement.value = null
    }

    rafPending = false
  }

  // ============ DRAG START ============
  const handleDragStart = (event, task, columnId, index, element) => {
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

    // Configure native drag
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)

    // Initialize coords immediately
    mouseX = event.clientX
    mouseY = event.clientY

    // Create custom floating drag preview
    if (element) {
      const rect = element.getBoundingClientRect()

      dragOffset.value = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      }

      // Clone the element for custom preview
      const clone = element.cloneNode(true)

      // Keep the preview "light" to avoid paint cost
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
      // If you suspect shadow causes jank, test with none first:
      clone.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.6)'
      clone.style.transition = 'none'
      clone.style.willChange = 'transform'
      clone.style.contain = 'paint'

      customDragElement.value = clone
      document.body.appendChild(clone)

      // Apply initial position
      applyPreviewTransform()

      // Hide default drag image (transparent 1x1)
      const img = new Image()
      img.src =
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      event.dataTransfer.setDragImage(img, 0, 0)

      /**
       * Track movement using the dragged element's native "drag" event.
       * This avoids a noisy global document dragover listener.
       */
      dragSourceElement = element
      dragMoveListener = (e) => {
        // Some browsers may emit 0/0 at start/end; ignore those
        if (e.clientX !== 0 && e.clientY !== 0) {
          mouseX = e.clientX
          mouseY = e.clientY
          schedulePreviewMove()
        }
      }
      dragSourceElement.addEventListener('drag', dragMoveListener)

      // Cleanup on dragend/drop
      const cleanupDragElement = () => {
        cleanupPreviewAndListeners()
        document.removeEventListener('dragend', cleanupDragElement)
        document.removeEventListener('drop', cleanupDragElement)
      }

      document.addEventListener('dragend', cleanupDragElement, { once: true })
      document.addEventListener('drop', cleanupDragElement, { once: true })
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

    /**
     * Secondary movement tracking: when the cursor is over drop zones,
     * we also update the preview position here. This helps in browsers
     * where the source element "drag" event is lower frequency.
     */
    if (event.clientX !== 0 && event.clientY !== 0) {
      mouseX = event.clientX
      mouseY = event.clientY
      schedulePreviewMove()
    }

    // Only update drop target state if changed
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
    resetDragState()
  }

  // ============ RESET ============
  const resetDragState = () => {
    cleanupPreviewAndListeners()

    isDragging.value = false
    draggedTask.value = null
    sourceColumnId.value = null
    sourceIndex.value = null
    dropTargetColumnId.value = null
    dropTargetIndex.value = null

    document.body.classList.remove('is-dragging')
  }

  // ============ HELPER: Calculate transform for a task ============
  const getTaskTransform = (columnId, taskIndex, taskHeight) => {
    if (!isDragging.value) return null
    if (!draggedTask.value) return null

    const srcCol = sourceColumnId.value
    const srcIdx = sourceIndex.value
    const tgtCol = dropTargetColumnId.value
    const tgtIdx = dropTargetIndex.value

    // Same column drag - apply transforms to tasks between source and target
    if (srcCol === columnId && tgtCol === columnId) {
      if (srcIdx === tgtIdx) return null

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

    // Helpers
    getTaskTransform,
    isDraggedTask,
    shouldShowPlaceholder
  }
}
